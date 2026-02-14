/**
 * Per-phase concurrency limits for controlling parallelism in the pipeline.
 * Providers can declare default concurrency, and the CLI can override per-phase.
 */
export interface ConcurrencyConfig {
  /** Default concurrency for all phases unless overridden */
  default: number
  /** Override for the ingest phase (number of parallel ingestions) */
  ingest?: number
  /** Override for the indexing phase */
  indexing?: number
  /** Override for the search phase (number of parallel searches) */
  search?: number
  /** Override for the answer phase (number of parallel LLM calls) */
  answer?: number
  /** Override for the evaluate phase (number of parallel judge calls) */
  evaluate?: number
}

/** Pipeline phase identifier for concurrency configuration. */
export type PhaseId = "ingest" | "indexing" | "search" | "answer" | "evaluate"

/** Maps each phase to its resolved concurrency value. */
export type PhaseConcurrencyMap = {
  [K in PhaseId]: number
}

/**
 * Resolve the effective concurrency limit for a given pipeline phase.
 *
 * Priority order (highest to lowest):
 * 1. CLI per-phase flag (e.g., `--concurrency-search 10`)
 * 2. CLI default flag (e.g., `--concurrency 5`)
 * 3. Provider per-phase default (from provider's `concurrency` property)
 * 4. Provider default concurrency
 * 5. Global fallback: 1 (sequential execution)
 *
 * @param phase - The pipeline phase to resolve concurrency for
 * @param cliConfig - Concurrency overrides from CLI flags
 * @param providerDefault - Provider's declared concurrency defaults
 * @returns The effective concurrency limit (number of parallel operations)
 */
export function resolveConcurrency(
  phase: PhaseId,
  cliConfig?: ConcurrencyConfig,
  providerDefault?: ConcurrencyConfig
): number {
  // Priority 1: CLI per-phase flag
  if (cliConfig && cliConfig[phase] !== undefined) {
    return cliConfig[phase]!
  }

  // Priority 2: CLI default flag
  if (cliConfig?.default !== undefined) {
    return cliConfig.default
  }

  // Priority 3: Provider per-phase default
  if (providerDefault && providerDefault[phase] !== undefined) {
    return providerDefault[phase]!
  }

  // Priority 4: Provider default
  if (providerDefault?.default !== undefined) {
    return providerDefault.default
  }

  // Priority 5: Global default (sequential)
  return 1
}
