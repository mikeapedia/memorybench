import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"
import type { FusionStrategy, ProviderSearchOutput, FusionContext } from "../../../types/ensemble"
import { extractTextContent, deduplicateResults } from "../dedup"
import { resolveModel } from "../../../utils/models"
import { config } from "../../../utils/config"

/**
 * LLM-based re-ranking fusion strategy.
 *
 * Collects all results from all providers, deduplicates them, then asks an LLM
 * to rank them by relevance to the query. This is the most expensive strategy
 * (requires an additional LLM call per search) but potentially yields the highest
 * quality since it leverages semantic understanding for ranking.
 *
 * The LLM receives candidate texts (truncated to 500 chars each) and returns
 * a JSON array of indices ordered by relevance. If the LLM response cannot be
 * parsed, falls back to returning the first `limit` candidates in original order.
 *
 * @example
 * ```ts
 * const reranker = new LLMRerankStrategy({ model: "gpt-4o-mini" })
 * const fused = await reranker.fuse(providerResults, {
 *   query: "What did we discuss about the project?",
 *   limit: 10,
 * })
 * ```
 */
export class LLMRerankStrategy implements FusionStrategy {
  name = "llm-rerank"
  /**
   * Model alias to use for re-ranking (resolved via {@link resolveModel}).
   * Defaults to `"gpt-4o-mini"` for cost efficiency.
   */
  private modelAlias: string

  /**
   * @param cfg - Strategy configuration
   * @param cfg.model - LLM model alias for re-ranking (default: `"gpt-4o-mini"`)
   */
  constructor(cfg: { model?: string }) {
    this.modelAlias = cfg.model ?? "gpt-4o-mini"
  }

  /**
   * Fuse results by having an LLM re-rank deduplicated candidates.
   *
   * Pipeline:
   * 1. Flatten all provider results into a single array
   * 2. Deduplicate by content hash
   * 3. If candidates ≤ limit, return as-is (no LLM call needed)
   * 4. Format candidates as numbered, truncated text blocks
   * 5. Ask the LLM to return a JSON array of indices ranked by relevance
   * 6. Parse the response and map indices back to original results
   * 7. On parse failure, fall back to first `limit` candidates
   *
   * @param providerResults - Search outputs from each sub-provider
   * @param context - Fusion context with query, limit, and ensemble config
   * @returns Re-ranked results ordered by LLM-judged relevance
   */
  async fuse(
    providerResults: ProviderSearchOutput[],
    context: FusionContext
  ): Promise<unknown[]> {
    const allResults = providerResults.flatMap((pr) => pr.results)
    const candidates = deduplicateResults(allResults)

    // If few enough results, return as-is
    if (candidates.length <= context.limit) return candidates

    const candidateTexts = candidates
      .map((c, i) => {
        const text = extractTextContent(c)
        const truncated = text.length > 500 ? text.slice(0, 500) + "..." : text
        return `[${i}] ${truncated}`
      })
      .join("\n\n")

    const modelInfo = resolveModel(this.modelAlias)

    // Create the language model based on provider
    let model: ReturnType<ReturnType<typeof createOpenAI>>
    switch (modelInfo.provider) {
      case "openai": {
        const openai = createOpenAI({ apiKey: config.openaiApiKey })
        model = openai(modelInfo.id) as ReturnType<ReturnType<typeof createOpenAI>>
        break
      }
      case "anthropic": {
        const anthropic = createAnthropic({ apiKey: config.anthropicApiKey })
        model = anthropic(modelInfo.id) as ReturnType<ReturnType<typeof createOpenAI>>
        break
      }
      case "google": {
        const google = createGoogleGenerativeAI({ apiKey: config.googleApiKey })
        model = google(modelInfo.id) as ReturnType<ReturnType<typeof createOpenAI>>
        break
      }
    }

    const { text } = await generateText({
      model,
      prompt: `Given the query: "${context.query}"

Rank the following search results by relevance to the query. Return ONLY a JSON array of indices ordered by relevance (most relevant first). Include at most ${context.limit} indices.

Results:
${candidateTexts}

Return ONLY a JSON array like [3, 0, 7, 1, ...] with no other text.`,
      maxTokens: 500,
    })

    try {
      const match = text.match(/\[[\d,\s]+\]/)
      if (!match) return candidates.slice(0, context.limit)

      const indices = JSON.parse(match[0]) as number[]
      return indices
        .filter((i) => i >= 0 && i < candidates.length)
        .slice(0, context.limit)
        .map((i) => candidates[i])
    } catch {
      return candidates.slice(0, context.limit)
    }
  }
}
