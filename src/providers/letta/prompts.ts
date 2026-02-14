import type { ProviderPrompts } from "../../types/prompts"

/**
 * Shape of a single Letta passage search result.
 * Used internally for type-safe context formatting.
 */
interface LettaResult {
  /** Passage text content */
  text?: string
  /** Relevance score from Letta's passage search (0-1) */
  score?: number
  /** Passage metadata (sessionId, date, role, etc.) */
  metadata?: Record<string, unknown>
}

/**
 * Format Letta passage search results into a numbered context string.
 *
 * Each result is rendered as `[index][date](relevance: score) text` with
 * optional date and relevance annotations when available.
 *
 * @param context - Array of raw Letta passage search results
 * @returns Formatted string with numbered, annotated passage entries
 */
function buildLettaContext(context: unknown[]): string {
  const results = context as LettaResult[]

  return results
    .map((r, i) => {
      const text = r.text || JSON.stringify(r)
      const score = r.score ? ` (relevance: ${r.score.toFixed(3)})` : ""
      const date = r.metadata?.date as string | undefined
      const dateInfo = date ? ` [${date}]` : ""
      return `[${i + 1}]${dateInfo}${score} ${text}`
    })
    .join("\n\n")
}

/**
 * Build the answer generation prompt for Letta passage search results.
 *
 * Tailored for Letta's archival passage model where results are ordered
 * by relevance score. The prompt instructs the LLM to consider relevance
 * ordering and temporal context from embedded timestamps.
 *
 * @param question - The benchmark question to answer
 * @param context - Array of Letta passage search results
 * @returns Formatted prompt string with passage context and instructions
 */
export function buildLettaAnswerPrompt(question: string, context: unknown[]): string {
  const contextStr = buildLettaContext(context)

  return `You are a question-answering system using archival memory passages retrieved from Letta.

Letta stores conversational passages with metadata and timestamps.
Analyze all retrieved passages carefully to answer the question.

Key instructions:
- Passages are ordered by relevance score
- Examine timestamps in the passage text to understand temporal ordering
- Prioritize more recent information when contradictions exist
- Convert relative time references to specific dates based on context
- Look for direct evidence in the passages
- Be specific about people, places, and events

Passages:
${contextStr}

Question: ${question}

Answer concisely and directly.`
}

/**
 * Letta-specific prompt configuration.
 *
 * Uses a custom answer prompt that emphasizes relevance-scored passage ordering
 * and temporal reasoning from embedded timestamps in passage text.
 */
export const LETTA_PROMPTS: ProviderPrompts = {
  answerPrompt: buildLettaAnswerPrompt,
}

export default LETTA_PROMPTS
