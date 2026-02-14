/**
 * Deduplication utilities for combining search results from multiple memory providers.
 *
 * Each provider (Supermemory, Mem0, Zep, Hindsight, Letta) returns results in different
 * shapes. This module normalizes them to plain text for comparison and provides
 * content-based deduplication using the djb2 hash algorithm.
 *
 * @module
 */

/**
 * Extract the primary text content from a provider-specific search result.
 *
 * Each memory provider returns results in a different shape. This function
 * checks known field names in priority order and returns the first match:
 *
 * | Provider      | Field(s) checked              |
 * |---------------|-------------------------------|
 * | Supermemory   | `memory`, `chunk`, `chunks`   |
 * | Zep           | `fact`, `name`, `summary`     |
 * | Hindsight     | `content`, `text`             |
 * | Letta         | `text`                        |
 * | Mem0          | `memory`                      |
 * | Generic       | `data`                        |
 *
 * Falls back to `JSON.stringify()` if no known field is found.
 *
 * @param result - A search result object from any provider (typed as `unknown`)
 * @returns The extracted text content as a string
 *
 * @example
 * ```ts
 * extractTextContent({ memory: "User likes coffee" })  // "User likes coffee"
 * extractTextContent({ fact: "Meeting on Monday" })     // "Meeting on Monday"
 * extractTextContent({ content: "Hello world" })        // "Hello world"
 * extractTextContent(42)                                 // "42"
 * ```
 */
export function extractTextContent(result: unknown): string {
  if (typeof result === "string") return result

  const obj = result as Record<string, unknown>

  // Supermemory: { memory, chunk, chunks }
  if (obj.memory && typeof obj.memory === "string") return obj.memory

  // Zep: { fact, name, summary }
  if (obj.fact && typeof obj.fact === "string") return obj.fact

  // Hindsight: { content, text }
  if (obj.content && typeof obj.content === "string") return obj.content

  // Letta: { text }
  if (obj.text && typeof obj.text === "string") return obj.text

  // Mem0: { memory }
  // (already covered above)

  // Generic: { data }
  if (obj.data && typeof obj.data === "string") return obj.data

  // Fallback to JSON
  return JSON.stringify(result)
}

/**
 * Extract a numeric relevance score from a provider-specific search result.
 *
 * Checks common score field names: `score`, `relevance`, `similarity`.
 * Used by the {@link WeightedStrategy} to apply per-provider weights to native scores.
 *
 * @param result - A search result object from any provider
 * @returns The numeric score if found, or `undefined` if no score field exists
 *
 * @example
 * ```ts
 * extractScore({ score: 0.95 })      // 0.95
 * extractScore({ relevance: 0.8 })   // 0.8
 * extractScore({ text: "no score" }) // undefined
 * ```
 */
export function extractScore(result: unknown): number | undefined {
  if (typeof result !== "object" || result === null) return undefined
  const obj = result as Record<string, unknown>

  if (typeof obj.score === "number") return obj.score
  if (typeof obj.relevance === "number") return obj.relevance
  if (typeof obj.similarity === "number") return obj.similarity

  return undefined
}

/**
 * Simple string hash for deduplication using the djb2 algorithm.
 *
 * Produces a base-36 encoded hash string from the input. Used internally
 * by {@link computeDeduplicationKey} to create compact, collision-resistant keys.
 *
 * @param str - Input string to hash
 * @returns Base-36 encoded hash string
 */
function hashString(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}

/**
 * Compute a content-based deduplication key from a search result.
 *
 * Extracts text content, normalizes it (lowercase, trim, collapse whitespace),
 * and hashes it with djb2. Two results with semantically identical text
 * (ignoring case and whitespace differences) will produce the same key.
 *
 * @param result - A search result object from any provider
 * @returns A base-36 hash string suitable for use as a Map/Set key
 *
 * @example
 * ```ts
 * const key1 = computeDeduplicationKey({ memory: "Hello World" })
 * const key2 = computeDeduplicationKey({ text: "hello  world" })
 * key1 === key2 // true — same content after normalization
 * ```
 */
export function computeDeduplicationKey(result: unknown): string {
  const text = extractTextContent(result)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
  return hashString(text)
}

/**
 * Deduplicate an array of search results, keeping the first occurrence of each unique content.
 *
 * Uses {@link computeDeduplicationKey} to identify duplicates across different
 * provider result shapes. Order is preserved — the first result with a given
 * content hash is kept, later duplicates are discarded.
 *
 * @param results - Array of search results from one or more providers
 * @returns Deduplicated array with first-occurrence ordering preserved
 *
 * @example
 * ```ts
 * const results = [
 *   { memory: "User likes coffee" },    // kept
 *   { text: "user likes coffee" },       // removed (duplicate after normalization)
 *   { fact: "Meeting on Monday" },       // kept
 * ]
 * deduplicateResults(results) // [{ memory: "User likes coffee" }, { fact: "Meeting on Monday" }]
 * ```
 */
export function deduplicateResults(results: unknown[]): unknown[] {
  const seen = new Set<string>()
  const deduped: unknown[] = []

  for (const result of results) {
    const key = computeDeduplicationKey(result)
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(result)
    }
  }

  return deduped
}
