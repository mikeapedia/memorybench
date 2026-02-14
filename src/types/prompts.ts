/**
 * Result from a judge prompt function, keyed by question type.
 * Must include a `default` key as fallback for unknown question types.
 *
 * @example
 * ```ts
 * const result: JudgePromptResult = {
 *   default: "Evaluate this answer...",
 *   "temporal": "Pay special attention to temporal reasoning...",
 * }
 * ```
 */
export type JudgePromptResult = Record<string, string> & { default: string }

/**
 * Function that generates judge prompts customized per question type.
 * Called during evaluation to get type-specific judging criteria.
 *
 * @param question - The benchmark question being evaluated
 * @param groundTruth - The expected correct answer
 * @param hypothesis - The provider's generated answer
 * @returns Map of question type to judge prompt, with a `default` fallback
 */
export type JudgePromptFunction = (
  question: string,
  groundTruth: string,
  hypothesis: string
) => JudgePromptResult

/**
 * Custom prompts a provider can supply to customize answer generation and judge evaluation.
 * Attached as a class property on Provider implementations (e.g., `prompts = MY_PROMPTS`).
 */
export interface ProviderPrompts {
  /**
   * Prompt for answer generation. Can be:
   * - A static string template
   * - A function that builds the prompt from the question, search results, and optional date context
   */
  answerPrompt?: string | ((question: string, context: unknown[], questionDate?: string) => string)
  /** Optional function to generate judge prompts per question type */
  judgePrompt?: JudgePromptFunction
}

/**
 * Serialize search context to a JSON string for use in prompts.
 * Default fallback when a provider doesn't supply a custom `answerPrompt` function.
 *
 * @param context - Array of search results to format
 * @returns Pretty-printed JSON string of the context
 */
export function buildContextString(context: unknown[]): string {
  return JSON.stringify(context, null, 2)
}
