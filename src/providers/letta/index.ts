import { Letta } from "@letta-ai/letta-client"
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
import { LETTA_PROMPTS } from "./prompts"

/**
 * Memory provider backed by Letta (formerly MemGPT).
 *
 * Letta stores conversational data in "archives" containing "passages" — chunks
 * of text with metadata and relevance scoring. Each benchmark question gets its
 * own archive to prevent cross-contamination.
 *
 * The provider supports both batch and single-passage insertion as a fallback.
 * Search uses Letta's passage search API which returns results ranked by relevance score.
 *
 * @see {@link https://docs.letta.com | Letta documentation}
 *
 * @example
 * ```ts
 * const provider = new LettaProvider()
 * await provider.initialize({
 *   apiKey: "letta-...",
 *   baseUrl: "https://api.letta.com",
 * })
 * ```
 */
export class LettaProvider implements Provider {
  name = "letta"
  prompts = LETTA_PROMPTS
  concurrency = {
    default: 10,
    ingest: 5,
  }
  /** Letta SDK client instance, initialized in {@link initialize}. */
  private client: Letta | null = null
  /** Maps containerTag → Letta archive ID for search and cleanup operations. */
  private archiveIds: Map<string, string> = new Map()

  /**
   * Initialize the Letta client with API credentials.
   *
   * @param config - Provider configuration with `apiKey` and optional `baseUrl`
   */
  async initialize(config: ProviderConfig): Promise<void> {
    this.client = new Letta({
      apiKey: config.apiKey || undefined,
      baseURL: config.baseUrl || undefined,
    })
    logger.info(`Initialized Letta provider`)
  }

  /**
   * Ingest conversation sessions into a Letta archive as passages.
   *
   * Creates a new archive for the containerTag, then converts each message
   * into a timestamped passage with session metadata. Attempts batch insertion
   * first; falls back to one-at-a-time insertion if batch API is unavailable.
   *
   * @param sessions - Conversation sessions to store as passages
   * @param options - Container tag (used to name the archive) and optional metadata
   * @returns IngestResult with session IDs as document IDs
   * @throws {Error} If the provider has not been initialized
   * @throws {Error} If archive creation fails and no existing archive is found
   */
  async ingest(sessions: UnifiedSession[], options: IngestOptions): Promise<IngestResult> {
    if (!this.client) throw new Error("Provider not initialized")

    const archiveName = `memorybench_${options.containerTag.replace(/[^a-zA-Z0-9_-]/g, "_")}`

    // Create an archive for this container
    let archiveId: string
    try {
      const archive = await this.client.archives.create({
        name: archiveName,
        description: `MemoryBench evaluation archive for ${options.containerTag}`,
      })
      archiveId = archive.id
      this.archiveIds.set(options.containerTag, archiveId)
      logger.debug(`Created archive: ${archiveName} (${archiveId})`)
    } catch {
      // Archive may already exist - try to find it
      const archives = await this.client.archives.list({ name: archiveName })
      const existing = archives.data?.[0]
      if (existing) {
        archiveId = existing.id
        this.archiveIds.set(options.containerTag, archiveId)
        logger.debug(`Using existing archive: ${archiveName} (${archiveId})`)
      } else {
        throw new Error(`Failed to create or find archive: ${archiveName}`)
      }
    }

    const documentIds: string[] = []

    for (const session of sessions) {
      const isoDate = session.metadata?.date as string | undefined

      // Build session content as passages
      const passages = session.messages.map((m) => {
        const speaker = m.speaker || m.role
        const timestamp = m.timestamp || isoDate || ""
        return {
          text: `[${timestamp}] ${speaker}: ${m.content}`,
          metadata: {
            sessionId: session.sessionId,
            role: m.role,
            ...(isoDate ? { date: isoDate } : {}),
          },
        }
      })

      // Batch insert passages into the archive
      try {
        await this.client.archives.passages.createMany(archiveId, {
          passages: passages.map((p) => ({
            text: p.text,
            metadata: p.metadata,
          })),
        })
      } catch {
        // Fallback: insert one at a time
        for (const p of passages) {
          await this.client.archives.passages.create(archiveId, {
            text: p.text,
            metadata: p.metadata,
          })
        }
      }

      documentIds.push(session.sessionId)
      logger.debug(`Ingested session ${session.sessionId} (${passages.length} passages)`)
    }

    return { documentIds }
  }

  /**
   * Wait for Letta to finish indexing inserted passages.
   *
   * Letta indexes passages synchronously on insert, so a brief 1-second
   * pause is sufficient to ensure all passages are searchable.
   *
   * @param result - IngestResult from the ingest phase
   * @param _containerTag - Container tag (unused — Letta indexes inline)
   * @param onProgress - Optional callback for indexing progress updates
   */
  async awaitIndexing(
    result: IngestResult,
    _containerTag: string,
    onProgress?: IndexingProgressCallback
  ): Promise<void> {
    // Letta indexes passages synchronously on insert
    const total = result.documentIds.length
    onProgress?.({ completedIds: [], failedIds: [], total })
    await new Promise((r) => setTimeout(r, 1000))
    onProgress?.({
      completedIds: [...result.documentIds],
      failedIds: [],
      total,
    })
  }

  /**
   * Search Letta passages by relevance to a query.
   *
   * Uses Letta's passage search API, scoped to the archive associated with
   * the containerTag. Returns results as `{ text, score, metadata }` objects.
   *
   * @param query - Natural language search query
   * @param options - Container tag to scope search, result limit, and threshold
   * @returns Array of `{ text, score, metadata }` objects sorted by relevance
   * @throws {Error} If the provider has not been initialized
   */
  async search(query: string, options: SearchOptions): Promise<unknown[]> {
    if (!this.client) throw new Error("Provider not initialized")

    const archiveId = this.archiveIds.get(options.containerTag)

    // Use passage search - works with or without an archive ID
    const response = await this.client.passages.search({
      query,
      archive_id: archiveId || undefined,
      limit: options.limit || 20,
    })

    // response is an array of { passage, score } objects
    return (response || []).map((r: { passage: { text: string; metadata?: Record<string, unknown> }; score: number }) => ({
      text: r.passage.text,
      score: r.score,
      metadata: r.passage.metadata,
    }))
  }

  /**
   * Delete the Letta archive associated with a container tag.
   *
   * @param containerTag - Container tag identifying the archive to delete
   */
  async clear(containerTag: string): Promise<void> {
    if (!this.client) throw new Error("Provider not initialized")
    const archiveId = this.archiveIds.get(containerTag)
    if (archiveId) {
      try {
        await this.client.archives.delete(archiveId)
        this.archiveIds.delete(containerTag)
        logger.info(`Deleted archive: ${archiveId}`)
      } catch (e) {
        logger.warn(`Failed to delete archive ${archiveId}: ${e}`)
      }
    }
  }
}

export default LettaProvider
