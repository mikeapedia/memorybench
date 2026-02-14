import type { ProviderPrompts } from "./prompts"

/**
 * Configuration for initializing a judge.
 */
export interface JudgeConfig {
  /** API key for the LLM provider used for judging */
  apiKey: string
  /** Model to use for evaluation (e.g., "gpt-4o", "sonnet-4") */
  model?: string
  /** Base URL for the LLM provider (optional, for Ollama/local) */
  baseUrl?: string
}

/**
 * Input to the judge's `evaluate()` method.
 * Contains all information needed to score a provider's answer.
 */
export interface JudgeInput {
  /** The benchmark question that was asked */
  question: string
  /** Raw question type from benchmark (e.g., "1", "single-session-user", "user_evidence") */
  questionType: string
  /** The expected correct answer */
  groundTruth: string
  /** The provider's generated answer to be evaluated */
  hypothesis: string
  /** Optional serialized search context for reference */
  context?: string
  /** Optional provider-specific judge prompts */
  providerPrompts?: ProviderPrompts
}

/**
 * Result from the judge's evaluation of a single answer.
 */
export interface JudgeResult {
  /** Binary score: 1 for correct, 0 for incorrect */
  score: number
  /** Human-readable correctness label */
  label: "correct" | "incorrect"
  /** Detailed explanation of the judge's reasoning */
  explanation: string
}

/**
 * Interface that all judge implementations must implement.
 * Judges use LLMs to evaluate whether a provider's answer matches the ground truth.
 *
 * Implementations exist for OpenAI (GPT), Anthropic (Claude), Google (Gemini), and Ollama (Local).
 */
export interface Judge {
  /** Judge identifier (e.g., "openai", "anthropic", "google", "ollama") */
  name: string
  /**
   * Initialize the judge with API credentials and model selection.
   * @param config - API key and optional model override
   */
  initialize(config: JudgeConfig): Promise<void>
  /**
   * Evaluate a provider's answer against the ground truth.
   * @param input - Question, ground truth, hypothesis, and optional context
   * @returns Score, label, and explanation
   */
  evaluate(input: JudgeInput): Promise<JudgeResult>
  /**
   * Get the evaluation prompt for a specific question type.
   * @param questionType - Raw question type ID from the benchmark
   * @param providerPrompts - Optional provider-specific prompt overrides
   * @returns The judge prompt string
   */
  getPromptForQuestionType(questionType: string, providerPrompts?: ProviderPrompts): string
  /**
   * Get the underlying LLM model instance (Vercel AI SDK LanguageModel).
   * @returns The configured language model
   */
  getModel(): import("ai").LanguageModel
}

/** Union of all available judge provider names. */
export type JudgeName = "openai" | "anthropic" | "google" | "ollama"
