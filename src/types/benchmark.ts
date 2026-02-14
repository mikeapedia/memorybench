import type { UnifiedQuestion, UnifiedSession, QuestionTypeRegistry } from "./unified"

/**
 * Configuration for loading a benchmark dataset.
 */
export interface BenchmarkConfig {
  /** Custom path to the benchmark data directory (overrides default) */
  dataPath?: string
}

/**
 * Filter options for retrieving a subset of benchmark questions.
 */
export interface QuestionFilter {
  /** Filter by raw question type IDs (benchmark-specific, e.g., ["1", "2"]) */
  questionTypes?: string[]
  /** Maximum number of questions to return */
  limit?: number
  /** Number of questions to skip (for pagination) */
  offset?: number
}

/**
 * Interface that all benchmark dataset loaders must implement.
 * Each benchmark (LoCoMo, LongMemEval, ConvoMem) normalizes its data
 * into unified types for provider-agnostic evaluation.
 *
 * @example
 * ```ts
 * const benchmark = createBenchmark("locomo")
 * await benchmark.load()
 * const questions = benchmark.getQuestions({ limit: 10 })
 * const sessions = benchmark.getHaystackSessions(questions[0].questionId)
 * ```
 */
export interface Benchmark {
  /** Benchmark identifier (e.g., "locomo", "longmemeval", "convomem") */
  name: string
  /**
   * Load the benchmark dataset from disk or remote source.
   * Must be called before any getter methods.
   * @param config - Optional configuration (e.g., custom data path)
   */
  load(config?: BenchmarkConfig): Promise<void>
  /**
   * Get benchmark questions, optionally filtered.
   * @param filter - Optional filter by question type, limit, or offset
   * @returns Array of normalized questions with ground truth
   */
  getQuestions(filter?: QuestionFilter): UnifiedQuestion[]
  /**
   * Get the conversation sessions needed to answer a specific question.
   * These "haystack" sessions are ingested into the provider before searching.
   * @param questionId - The question to get sessions for
   * @returns Array of conversation sessions containing relevant information
   */
  getHaystackSessions(questionId: string): UnifiedSession[]
  /**
   * Get the ground truth answer for a question.
   * @param questionId - The question to get the answer for
   * @returns The expected correct answer string
   */
  getGroundTruth(questionId: string): string
  /**
   * Get the registry of question types with display metadata.
   * @returns Mapping of question type IDs to their info (alias, description)
   */
  getQuestionTypes(): QuestionTypeRegistry
}

/** Union of all available benchmark dataset names. */
export type BenchmarkName = "locomo" | "longmemeval" | "convomem"
