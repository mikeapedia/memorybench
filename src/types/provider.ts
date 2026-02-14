import type { UnifiedSession } from "./unified"
import type { ProviderPrompts } from "./prompts"
import type { ConcurrencyConfig } from "./concurrency"

/**
 * Configuration passed to a provider during initialization.
 * Each provider reads the fields it needs (e.g., `apiKey`, `baseUrl`).
 * The index signature allows provider-specific options like `ensembleConfig`.
 */
export interface ProviderConfig {
  /** API key for authenticating with the provider's service */
  apiKey: string
  /** Base URL override for self-hosted or non-default endpoints */
  baseUrl?: string
  [key: string]: unknown
}

/**
 * Options for the ingest phase.
 * Each question gets its own `containerTag` to isolate haystack sessions.
 */
export interface IngestOptions {
  /** Unique tag identifying the memory container (typically derived from questionId) */
  containerTag: string
  /** Optional metadata to attach to ingested documents */
  metadata?: Record<string, unknown>
}

/**
 * Options for the search phase.
 * Providers query their stored memories using the question as the search query.
 */
export interface SearchOptions {
  /** Container tag to scope the search to relevant memories */
  containerTag: string
  /** Maximum number of results to return (default varies by provider) */
  limit?: number
  /** Minimum relevance threshold (0-1, provider-dependent) */
  threshold?: number
}

/**
 * Result returned from the ingest phase.
 * Used by `awaitIndexing()` to track which documents need indexing confirmation.
 */
export interface IngestResult {
  /** IDs of documents created during ingestion */
  documentIds: string[]
  /** IDs of async processing tasks (for providers with deferred indexing) */
  taskIds?: string[]
}

/**
 * Progress update during the indexing phase.
 * Passed to the `onProgress` callback in `awaitIndexing()`.
 */
export interface IndexingProgress {
  /** Document IDs that have completed indexing */
  completedIds: string[]
  /** Document IDs that failed to index */
  failedIds: string[]
  /** Total number of documents being indexed */
  total: number
}

/** Callback invoked periodically during `awaitIndexing()` to report progress. */
export type IndexingProgressCallback = (progress: IndexingProgress) => void

/**
 * Core interface that all memory providers must implement.
 *
 * The pipeline calls methods in order: `initialize()` -> `ingest()` -> `awaitIndexing()` -> `search()` -> `clear()`.
 * Each provider wraps a different memory service (Supermemory, Mem0, Zep, Hindsight, Letta)
 * or combines multiple providers (Ensemble).
 *
 * @example
 * ```ts
 * const provider = createProvider("supermemory")
 * await provider.initialize({ apiKey: "sk-..." })
 * const result = await provider.ingest(sessions, { containerTag: "q1" })
 * await provider.awaitIndexing(result, "q1")
 * const memories = await provider.search("What happened?", { containerTag: "q1" })
 * await provider.clear("q1")
 * ```
 */
export interface Provider {
  /** Unique provider identifier (e.g., "supermemory", "ensemble") */
  name: string
  /** Optional custom prompts for answer generation and judge evaluation */
  prompts?: ProviderPrompts
  /** Optional concurrency limits per pipeline phase */
  concurrency?: ConcurrencyConfig
  /**
   * Initialize the provider with credentials and configuration.
   * Must be called before any other method.
   * @param config - Provider-specific configuration (API keys, endpoints)
   */
  initialize(config: ProviderConfig): Promise<void>
  /**
   * Ingest conversation sessions into the provider's memory store.
   * @param sessions - Normalized conversation sessions to store
   * @param options - Container tag and optional metadata
   * @returns Document IDs and task IDs for tracking indexing
   */
  ingest(sessions: UnifiedSession[], options: IngestOptions): Promise<IngestResult>
  /**
   * Wait for ingested documents to be indexed and searchable.
   * Some providers index synchronously (no-op), others require polling.
   * @param result - IngestResult from the ingest phase
   * @param containerTag - Container to check indexing status for
   * @param onProgress - Optional callback for indexing progress updates
   */
  awaitIndexing(
    result: IngestResult,
    containerTag: string,
    onProgress?: IndexingProgressCallback
  ): Promise<void>
  /**
   * Search the provider's memory for relevant results.
   * Returns provider-specific result objects (use `extractTextContent()` from dedup.ts to normalize).
   * @param query - The question or search query
   * @param options - Container tag, result limit, and threshold
   * @returns Array of provider-specific result objects
   */
  search(query: string, options: SearchOptions): Promise<unknown[]>
  /**
   * Clear all memories associated with a container tag.
   * Called after each question to prevent cross-contamination.
   * @param containerTag - Container to clear
   */
  clear(containerTag: string): Promise<void>
}

/** Union of all registered provider names. Add new providers here when extending. */
export type ProviderName = "supermemory" | "mem0" | "zep" | "hindsight" | "letta" | "ensemble"
