import type {
  Provider,
  ProviderConfig,
  IngestOptions,
  IngestResult,
  SearchOptions,
  IndexingProgressCallback,
} from "../../types/provider"
import type { UnifiedSession } from "../../types/unified"
import type { ProviderPrompts } from "../../types/prompts"
import type { EnsembleConfig, FusionStrategy, ProviderSearchOutput } from "../../types/ensemble"
import { createProvider } from "../index"
import { getProviderConfig } from "../../utils/config"
import { createStrategy } from "./strategies"
import { extractTextContent } from "./dedup"
import { logger } from "../../utils/logger"
import { buildContextString } from "../../types/prompts"

/**
 * Meta-provider that fans out operations to multiple sub-providers and fuses their results.
 *
 * The EnsembleProvider wraps N sub-providers (e.g., Supermemory, Mem0, Zep) and delegates
 * all pipeline operations to them in parallel. During search, it collects results from every
 * sub-provider and combines them using a configurable {@link FusionStrategy} (RRF, union,
 * weighted, LLM-rerank, or voting).
 *
 * Requires an `--ensemble-config` JSON file at initialization specifying:
 * - Which providers to include and their weights
 * - Which fusion strategy to use and its parameters
 *
 * @example
 * ```ts
 * const provider = new EnsembleProvider()
 * await provider.initialize({
 *   apiKey: "",
 *   ensembleConfig: {
 *     providers: [
 *       { name: "supermemory", weight: 1.0 },
 *       { name: "mem0", weight: 0.8 },
 *     ],
 *     strategy: { name: "rrf", k: 60 },
 *   },
 * })
 * ```
 *
 * @see {@link FusionStrategy} for available fusion algorithms
 * @see {@link EnsembleConfig} for the full configuration schema
 */
export class EnsembleProvider implements Provider {
  name = "ensemble"
  concurrency = {
    default: 5,
    ingest: 3,
  }

  /** Initialized sub-provider instances, in config order. */
  private subProviders: Provider[] = []
  /** Active fusion strategy instance. */
  private strategy: FusionStrategy | null = null
  /** Parsed ensemble configuration. */
  private ensembleConfig: EnsembleConfig | null = null
  /**
   * Maps provider name → IngestResult so each sub-provider's `awaitIndexing()`
   * receives its own document IDs rather than the combined set.
   */
  private ingestResultsByProvider: Map<string, IngestResult> = new Map()

  /**
   * Custom prompts for ensemble answer generation.
   * Uses {@link buildEnsembleAnswerPrompt} which formats fused results
   * with numbered citations from multiple memory providers.
   */
  get prompts(): ProviderPrompts {
    return {
      answerPrompt: buildEnsembleAnswerPrompt,
    }
  }

  /**
   * Initialize all sub-providers and the fusion strategy.
   *
   * Reads the `ensembleConfig` from the provider config, creates each sub-provider
   * via {@link createProvider}, initializes them with their respective API keys
   * from environment, and instantiates the fusion strategy.
   *
   * @param config - Must include `ensembleConfig` with providers and strategy
   * @throws {Error} If `ensembleConfig` is missing from the config object
   */
  async initialize(config: ProviderConfig): Promise<void> {
    const ensembleConfig = config.ensembleConfig as EnsembleConfig | undefined
    if (!ensembleConfig) {
      throw new Error(
        "Ensemble provider requires --ensemble-config. " +
          "Pass a JSON config file with providers and strategy."
      )
    }
    this.ensembleConfig = ensembleConfig

    logger.info(
      `Initializing ensemble with ${ensembleConfig.providers.length} providers: ` +
        ensembleConfig.providers.map((p) => p.name).join(", ")
    )
    logger.info(`Fusion strategy: ${ensembleConfig.strategy.name}`)

    // Initialize each sub-provider
    for (const entry of ensembleConfig.providers) {
      const provider = createProvider(entry.name)
      const providerConfig = getProviderConfig(entry.name)
      await provider.initialize(providerConfig)
      this.subProviders.push(provider)
    }

    // Initialize the fusion strategy
    this.strategy = createStrategy(ensembleConfig.strategy)
  }

  /**
   * Ingest conversation sessions into all sub-providers in parallel.
   *
   * Each sub-provider receives the same sessions and container tag. Individual
   * IngestResults are cached in {@link ingestResultsByProvider} so that
   * {@link awaitIndexing} can pass the correct document IDs to each provider.
   *
   * @param sessions - Normalized conversation sessions to store
   * @param options - Container tag and optional metadata
   * @returns Combined IngestResult with all document IDs and task IDs from every sub-provider
   * @throws {Error} If the provider has not been initialized
   */
  async ingest(sessions: UnifiedSession[], options: IngestOptions): Promise<IngestResult> {
    if (this.subProviders.length === 0) throw new Error("Provider not initialized")

    const combined: IngestResult = { documentIds: [], taskIds: [] }

    // Fan out: ingest into all sub-providers in parallel
    const results = await Promise.all(
      this.subProviders.map(async (provider) => {
        const result = await provider.ingest(sessions, options)
        this.ingestResultsByProvider.set(provider.name, result)
        return result
      })
    )

    for (const result of results) {
      combined.documentIds.push(...result.documentIds)
      if (result.taskIds) combined.taskIds!.push(...result.taskIds)
    }

    return combined
  }

  /**
   * Wait for all sub-providers to finish indexing their documents.
   *
   * Each sub-provider's `awaitIndexing()` is called with its own IngestResult
   * (not the combined one), ensuring providers only wait for their own documents.
   *
   * @param _result - Combined IngestResult (ignored — per-provider results are used instead)
   * @param containerTag - Container to check indexing status for
   * @param onProgress - Optional callback for indexing progress updates
   * @throws {Error} If the provider has not been initialized
   */
  async awaitIndexing(
    _result: IngestResult,
    containerTag: string,
    onProgress?: IndexingProgressCallback
  ): Promise<void> {
    if (this.subProviders.length === 0) throw new Error("Provider not initialized")

    // Await indexing for each sub-provider using their own IngestResult
    await Promise.all(
      this.subProviders.map((provider) => {
        const providerResult = this.ingestResultsByProvider.get(provider.name) || {
          documentIds: [],
          taskIds: [],
        }
        return provider.awaitIndexing(providerResult, containerTag, onProgress)
      })
    )
  }

  /**
   * Search all sub-providers in parallel, then fuse results using the configured strategy.
   *
   * Each sub-provider's search is timed and tagged with the provider's weight from config.
   * The collected {@link ProviderSearchOutput} array is passed to the fusion strategy,
   * which combines and re-ranks results according to its algorithm.
   *
   * @param query - The question or search query
   * @param options - Container tag, result limit, and relevance threshold
   * @returns Fused and de-duplicated results from all sub-providers
   * @throws {Error} If the provider has not been initialized
   */
  async search(query: string, options: SearchOptions): Promise<unknown[]> {
    if (this.subProviders.length === 0 || !this.strategy || !this.ensembleConfig)
      throw new Error("Provider not initialized")

    // Fan out: search all sub-providers in parallel
    const searchPromises = this.subProviders.map(async (provider, idx) => {
      const startTime = Date.now()
      const results = await provider.search(query, options)
      const latencyMs = Date.now() - startTime

      return {
        providerName: provider.name,
        providerIndex: idx,
        results,
        latencyMs,
        weight: this.ensembleConfig!.providers[idx].weight ?? 1.0,
      } satisfies ProviderSearchOutput
    })

    const providerResults = await Promise.all(searchPromises)

    const totalResults = providerResults.reduce((sum, pr) => sum + pr.results.length, 0)
    logger.debug(
      `Ensemble search: ${totalResults} results from ${providerResults.length} providers, ` +
        `fusing with ${this.strategy.name}`
    )

    // Apply the fusion strategy to combine results
    return this.strategy.fuse(providerResults, {
      query,
      limit: options.limit || 10,
      ensembleConfig: this.ensembleConfig,
    })
  }

  /**
   * Clear memories from all sub-providers and reset internal state.
   *
   * @param containerTag - Container tag to clear across all sub-providers
   */
  async clear(containerTag: string): Promise<void> {
    await Promise.all(this.subProviders.map((p) => p.clear(containerTag)))
    this.ingestResultsByProvider.clear()
  }
}

/**
 * Build the answer generation prompt for ensemble search results.
 *
 * Formats fused results as a numbered list with text extracted from each
 * provider-specific result shape. The prompt instructs the LLM to synthesize
 * information from multiple memory providers and provide a reasoned answer.
 *
 * @param question - The benchmark question to answer
 * @param context - Array of fused search results from multiple providers
 * @returns Formatted prompt string with numbered context and instructions
 */
function buildEnsembleAnswerPrompt(question: string, context: unknown[]): string {
  const contextStr = context
    .map((r, i) => {
      const text = extractTextContent(r)
      return `[${i + 1}] ${text}`
    })
    .join("\n\n---\n\n")

  return `You are a question-answering system. Based on the retrieved context below (fused from multiple memory providers), answer the question.

Question: ${question}

Retrieved Context (from ensemble of memory providers):
${contextStr}

Instructions:
- The context contains results merged from multiple memory systems
- Some results may overlap or provide complementary information
- Synthesize information from multiple results when relevant
- If the context contains enough information, provide a clear, concise answer
- If the context does not contain enough information, respond with "I don't know"
- Base your answer ONLY on the provided context

Think step by step, then provide your answer.

Reasoning:
[Your step-by-step reasoning]

Answer:
[Your final answer]`
}

export default EnsembleProvider
