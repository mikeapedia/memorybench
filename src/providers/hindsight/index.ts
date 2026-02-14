import { HindsightClient } from "@vectorize-io/hindsight-client"
import type {
  Provider,
  ProviderConfig,
  IngestOptions,
  IngestResult,
  SearchOptions,
  IndexingProgressCallback,
} from "../../types/provider"
import type { UnifiedSession } from "../../types/unified"
import { logger } from "../../utils/logger"
import { HINDSIGHT_PROMPTS } from "./prompts"

/**
 * Memory provider backed by Hindsight (Vectorize.io).
 *
 * Hindsight organizes memories into "banks" and supports three operations:
 * - **Retain**: Store memories with timestamps and contextual metadata
 * - **Recall**: Retrieve relevant memories using natural language queries
 * - **Reflect**: Consolidate and summarize stored memories
 *
 * Each benchmark question gets its own bank (derived from containerTag) to
 * prevent cross-contamination. Banks are deleted during cleanup.
 *
 * @see {@link https://docs.vectorize.io/hindsight | Hindsight documentation}
 *
 * @example
 * ```ts
 * const provider = new HindsightProvider()
 * await provider.initialize({
 *   apiKey: "hs-...",
 *   baseUrl: "http://localhost:8888",
 * })
 * ```
 */
export class HindsightProvider implements Provider {
  name = "hindsight"
  prompts = HINDSIGHT_PROMPTS
  concurrency = {
    default: 10,
    ingest: 5,
  }
  /** Hindsight SDK client instance, initialized in {@link initialize}. */
  private client: HindsightClient | null = null

  /**
   * Initialize the Hindsight client with API credentials.
   *
   * @param config - Provider configuration with `apiKey` and optional `baseUrl`
   *                 (defaults to `http://localhost:8888` for local development)
   */
  async initialize(config: ProviderConfig): Promise<void> {
    this.client = new HindsightClient({
      baseUrl: config.baseUrl || "http://localhost:8888",
      apiKey: config.apiKey || undefined,
    })
    logger.info(`Initialized Hindsight provider (${config.baseUrl || "http://localhost:8888"})`)
  }

  /**
   * Ingest conversation sessions into a Hindsight bank using batch retain.
   *
   * Creates a new bank named after the containerTag, then inserts each session's
   * messages as individual memory items with timestamps and session metadata.
   * If the bank already exists, silently continues with the existing bank.
   *
   * @param sessions - Conversation sessions to store as memories
   * @param options - Container tag (used as bank ID) and optional metadata
   * @returns IngestResult with session IDs as document IDs
   * @throws {Error} If the provider has not been initialized
   */
  async ingest(sessions: UnifiedSession[], options: IngestOptions): Promise<IngestResult> {
    if (!this.client) throw new Error("Provider not initialized")

    const bankId = sanitizeBankId(options.containerTag)

    try {
      await this.client.createBank(bankId, {
        name: `MemoryBench ${options.containerTag}`,
        background: "Memory benchmark evaluation bank for conversational data",
      })
      logger.debug(`Created bank: ${bankId}`)
    } catch {
      logger.debug(`Bank ${bankId} may already exist`)
    }

    const documentIds: string[] = []

    for (const session of sessions) {
      const items = session.messages.map((m) => {
        const speaker = m.speaker || m.role
        return {
          content: `${speaker}: ${m.content}`,
          timestamp: m.timestamp || (session.metadata?.date as string) || undefined,
          context: `session:${session.sessionId}`,
          metadata: {
            sessionId: session.sessionId,
            ...(session.metadata?.date ? { date: session.metadata.date as string } : {}),
          },
        }
      })

      await this.client.retainBatch(bankId, items, {
        documentId: session.sessionId,
      })

      documentIds.push(session.sessionId)
      logger.debug(`Ingested session ${session.sessionId} (${items.length} messages)`)
    }

    return { documentIds }
  }

  /**
   * Wait for Hindsight to finish indexing retained memories.
   *
   * Hindsight processes retain calls synchronously, so indexing is near-immediate.
   * A brief 2-second pause is applied to allow any async consolidation to settle.
   *
   * @param result - IngestResult from the ingest phase
   * @param _containerTag - Container tag (unused — Hindsight indexes inline)
   * @param onProgress - Optional callback for indexing progress updates
   */
  async awaitIndexing(
    result: IngestResult,
    _containerTag: string,
    onProgress?: IndexingProgressCallback
  ): Promise<void> {
    // Hindsight processes retain calls synchronously, so indexing is immediate.
    // We do a brief pause to allow any async consolidation to settle.
    const total = result.documentIds.length
    onProgress?.({ completedIds: [], failedIds: [], total })

    await new Promise((r) => setTimeout(r, 2000))

    onProgress?.({
      completedIds: [...result.documentIds],
      failedIds: [],
      total,
    })
  }

  /**
   * Search Hindsight memories using the recall API.
   *
   * Queries the bank associated with the containerTag, requesting mid-budget
   * results with chunk content included (up to 8192 tokens per chunk).
   *
   * @param query - Natural language search query
   * @param options - Container tag to scope search and optional limit/threshold
   * @returns Array of Hindsight result objects with content, type, and metadata
   * @throws {Error} If the provider has not been initialized
   */
  async search(query: string, options: SearchOptions): Promise<unknown[]> {
    if (!this.client) throw new Error("Provider not initialized")

    const bankId = sanitizeBankId(options.containerTag)

    const response = await this.client.recall(bankId, query, {
      budget: "mid",
      includeChunks: true,
      maxChunkTokens: 8192,
    })

    // Return the results array from the recall response
    const results = (response as { results?: unknown[] }).results || []
    return results
  }

  /**
   * Delete the Hindsight bank associated with a container tag.
   *
   * @param containerTag - Container tag identifying the bank to delete
   */
  async clear(containerTag: string): Promise<void> {
    if (!this.client) throw new Error("Provider not initialized")
    const bankId = sanitizeBankId(containerTag)
    try {
      await this.client.deleteBank(bankId)
      logger.info(`Deleted bank: ${bankId}`)
    } catch (e) {
      logger.warn(`Failed to delete bank ${bankId}: ${e}`)
    }
  }
}

/**
 * Sanitize a container tag into a valid Hindsight bank ID.
 *
 * Replaces any character that isn't alphanumeric, underscore, or hyphen
 * with an underscore to meet Hindsight's bank ID requirements.
 *
 * @param tag - Raw container tag string
 * @returns Sanitized string safe for use as a Hindsight bank ID
 */
function sanitizeBankId(tag: string): string {
  return tag.replace(/[^a-zA-Z0-9_-]/g, "_")
}

export default HindsightProvider
