import type { SearchResult, RetrievalMetrics } from "./unified"
import type { IngestResult } from "./provider"
import type { ConcurrencyConfig } from "./concurrency"

/** Status of a single pipeline phase within a question's processing. */
export type PhaseStatus = "pending" | "in_progress" | "completed" | "failed"

/**
 * Pipeline phase identifier.
 * Includes all 6 phases in execution order: ingest -> indexing -> search -> answer -> evaluate -> report.
 */
export type PhaseId = "ingest" | "indexing" | "search" | "answer" | "evaluate" | "report"

/** Ordered array of all pipeline phases. Used for resumption and phase iteration. */
export const PHASE_ORDER: PhaseId[] = [
  "ingest",
  "indexing",
  "search",
  "answer",
  "evaluate",
  "report",
]

/**
 * Get the list of phases to execute starting from a given phase.
 * Used when resuming a run from a specific phase (e.g., `--from-phase search`).
 *
 * @param fromPhase - The phase to start from
 * @returns Array of phases from `fromPhase` through "report"
 *
 * @example
 * ```ts
 * getPhasesFromPhase("search") // ["search", "answer", "evaluate", "report"]
 * ```
 */
export function getPhasesFromPhase(fromPhase: PhaseId): PhaseId[] {
  const startIndex = PHASE_ORDER.indexOf(fromPhase)
  if (startIndex === -1) return PHASE_ORDER
  return PHASE_ORDER.slice(startIndex)
}

/** Checkpoint state for the ingest phase of a single question. */
export interface IngestPhaseCheckpoint {
  status: PhaseStatus
  /** Session IDs that have been successfully ingested */
  completedSessions: string[]
  /** Result from provider.ingest() (document IDs, task IDs) */
  ingestResult?: IngestResult
  startedAt?: string
  completedAt?: string
  durationMs?: number
  error?: string
}

/** Checkpoint state for the indexing phase of a single question. */
export interface IndexingPhaseCheckpoint {
  status: PhaseStatus
  /** Document IDs that completed indexing */
  completedIds?: string[]
  /** Document IDs that failed to index */
  failedIds?: string[]
  startedAt?: string
  completedAt?: string
  durationMs?: number
  error?: string
}

/** Checkpoint state for the search phase of a single question. */
export interface SearchPhaseCheckpoint {
  status: PhaseStatus
  /** Path to the search results JSON file */
  resultFile?: string
  /** Inline search results (for small result sets) */
  results?: SearchResult[]
  /** Number of results returned */
  resultCount?: number
  startedAt?: string
  completedAt?: string
  durationMs?: number
  error?: string
}

/** Checkpoint state for the answer phase of a single question. */
export interface AnswerPhaseCheckpoint {
  status: PhaseStatus
  /** The LLM-generated answer (hypothesis) */
  hypothesis?: string
  startedAt?: string
  completedAt?: string
  durationMs?: number
  error?: string
}

/** Checkpoint state for the evaluate phase of a single question. */
export interface EvaluatePhaseCheckpoint {
  status: PhaseStatus
  /** Judge's correctness label */
  label?: "correct" | "incorrect"
  /** Judge's binary score (1 = correct, 0 = incorrect) */
  score?: number
  /** Judge's reasoning explanation */
  explanation?: string
  /** Retrieval quality metrics for this question */
  retrievalMetrics?: RetrievalMetrics
  startedAt?: string
  completedAt?: string
  durationMs?: number
  error?: string
}

/** Metadata about a haystack session used for a question. */
export interface SessionMetadata {
  sessionId: string
  /** Date of the session (for temporal question context) */
  date?: string
  /** Number of messages in the session */
  messageCount: number
}

/**
 * Complete checkpoint for a single question within a benchmark run.
 * Tracks progress through all pipeline phases with per-phase state.
 * Persisted to `data/runs/{runId}/checkpoint.json` for resumability.
 */
export interface QuestionCheckpoint {
  questionId: string
  /** Memory container tag isolating this question's data */
  containerTag: string
  question: string
  groundTruth: string
  questionType: string
  /** Date context for temporal questions */
  questionDate?: string
  /** Metadata about ingested haystack sessions */
  sessions?: SessionMetadata[]
  /** Per-phase checkpoint state */
  phases: {
    ingest: IngestPhaseCheckpoint
    indexing: IndexingPhaseCheckpoint
    search: SearchPhaseCheckpoint
    answer: AnswerPhaseCheckpoint
    evaluate: EvaluatePhaseCheckpoint
  }
}

/** Overall status of a benchmark run. */
export type RunStatus = "initializing" | "running" | "completed" | "failed"

/** How questions are selected from the benchmark. */
export type SelectionMode = "full" | "sample" | "limit"

/** How samples are drawn when using "sample" selection mode. */
export type SampleType = "consecutive" | "random"

/**
 * Configuration for question sampling in benchmark runs.
 * Controls how many and which questions are selected from the full benchmark.
 */
export interface SamplingConfig {
  /** Selection strategy: "full" (all), "sample" (N per category), "limit" (first N) */
  mode: SelectionMode
  /** Sampling method when mode is "sample" */
  sampleType?: SampleType
  /** Number of questions per category (for "sample" mode) */
  perCategory?: number
  /** Maximum total questions (for "limit" mode) */
  limit?: number
}

/**
 * Top-level checkpoint for an entire benchmark run.
 * Persisted to `data/runs/{runId}/checkpoint.json` and used for:
 * - Resuming interrupted runs
 * - Tracking real-time progress via the web UI
 * - Generating final reports
 */
export interface RunCheckpoint {
  /** Unique run identifier */
  runId: string
  /** Run ID used as data source (same as runId for fresh runs) */
  dataSourceRunId: string
  /** Current run status */
  status: RunStatus
  /** Memory provider being benchmarked */
  provider: string
  /** Benchmark dataset being used */
  benchmark: string
  /** Judge model for evaluation */
  judge: string
  /** Model used for answer generation */
  answeringModel: string
  /** ISO timestamp of run creation */
  createdAt: string
  /** ISO timestamp of last checkpoint update */
  updatedAt: string
  /** Optional question limit */
  limit?: number
  /** Sampling configuration for question selection */
  sampling?: SamplingConfig
  /** Explicit list of question IDs to process */
  targetQuestionIds?: string[]
  /** Concurrency configuration for this run */
  concurrency?: ConcurrencyConfig
  /** Per-question checkpoint state */
  questions: Record<string, QuestionCheckpoint>
}
