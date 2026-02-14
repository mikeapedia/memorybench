import type { ProviderPrompts } from "../../types/prompts"

/**
 * Shape of a single Hindsight recall result.
 * Used internally for type-safe context formatting.
 */
interface HindsightResult {
  /** Memory content text (from retain) */
  content?: string
  /** Alternative text field */
  text?: string
  /** Memory type classification (e.g., "world_fact", "experience") */
  type?: string
  /** ISO timestamp of when the memory was retained */
  timestamp?: string
  /** Additional metadata attached to the memory */
  metadata?: Record<string, unknown>
}

/**
 * Format Hindsight recall results into a numbered context string.
 *
 * Each result is rendered as `[index][type](timestamp) content` with
 * optional type and timestamp annotations when available.
 *
 * @param context - Array of raw Hindsight recall results
 * @returns Formatted string with numbered, annotated memory entries
 */
function buildHindsightContext(context: unknown[]): string {
  const results = context as HindsightResult[]

  return results
    .map((r, i) => {
      const content = r.content || r.text || JSON.stringify(r)
      const type = r.type ? ` [${r.type}]` : ""
      const timestamp = r.timestamp ? ` (${r.timestamp})` : ""
      return `[${i + 1}]${type}${timestamp} ${content}`
    })
    .join("\n\n")
}

/**
 * Build the answer generation prompt for Hindsight search results.
 *
 * Tailored for Hindsight's memory model which categorizes results as
 * world facts, experiences, and mental models. The prompt emphasizes
 * temporal reasoning and recency-based prioritization.
 *
 * @param question - The benchmark question to answer
 * @param context - Array of Hindsight recall results
 * @returns Formatted prompt string with memory context and temporal reasoning instructions
 */
export function buildHindsightAnswerPrompt(question: string, context: unknown[]): string {
  const contextStr = buildHindsightContext(context)

  return `You are a question-answering system using memories retrieved from Hindsight.

Hindsight returns memories categorized as world facts, experiences, and mental models.
Analyze all retrieved memories carefully to answer the question.

Key instructions:
- Examine timestamps to understand temporal ordering
- Prioritize more recent memories when contradictions exist
- Convert relative time references to specific dates based on timestamps
- Look for direct evidence across all memory types
- Be specific about people, places, and events

Memories:
${contextStr}

Question: ${question}

Think step by step, then provide a concise answer.

Reasoning:
[Your step-by-step reasoning]

Answer:
[Your final answer]`
}

/**
 * Hindsight-specific prompt configuration.
 *
 * Uses a custom answer prompt that understands Hindsight's memory type system
 * (world facts, experiences, mental models) and emphasizes temporal reasoning.
 */
export const HINDSIGHT_PROMPTS: ProviderPrompts = {
  answerPrompt: buildHindsightAnswerPrompt,
}

export default HINDSIGHT_PROMPTS
