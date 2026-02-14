import type { ProviderName } from "../types/provider"
import type { BenchmarkName } from "../types/benchmark"
import type { SamplingConfig } from "../types/checkpoint"
import type { BenchmarkResult } from "../types/unified"
import { orchestrator, CheckpointManager } from "./index"
import { createBenchmark } from "../benchmarks"
import { logger } from "../utils/logger"
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { startRun, endRun } from "../server/runState"

const checkpointManager = new CheckpointManager()

/** Directory for comparison manifests and metadata. */
const COMPARE_DIR = "./data/compare"
/** Directory for individual run data and reports. */
const RUNS_DIR = "./data/runs"

/**
 * Manifest tracking a multi-provider comparison run.
 *
 * Persisted to `data/compare/{compareId}/manifest.json` and used to
 * coordinate parallel runs, resume interrupted comparisons, and generate
 * comparison reports.
 */
export interface CompareManifest {
  compareId: string
  createdAt: string
  updatedAt: string
  benchmark: string
  judge: string
  answeringModel: string
  sampling?: SamplingConfig
  targetQuestionIds: string[]
  runs: Array<{
    provider: string
    runId: string
  }>
}

/** Options for initiating a new multi-provider comparison. */
export interface CompareOptions {
  providers: ProviderName[]
  benchmark: BenchmarkName
  judgeModel: string
  answeringModel: string
  sampling?: SamplingConfig
  force?: boolean
}

/** Result returned after all comparison runs complete. */
export interface CompareResult {
  compareId: string
  manifest: CompareManifest
  successes: number
  failures: number
}

/**
 * Generate a unique comparison ID based on the current timestamp.
 *
 * Format: `compare-YYYYMMDD-HHmmss`
 *
 * @returns Unique comparison identifier string
 */
function generateCompareId(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, "")
  const time = now.toISOString().slice(11, 19).replace(/:/g, "")
  return `compare-${date}-${time}`
}

/**
 * Select a subset of questions based on a sampling configuration.
 *
 * Supports three modes:
 * - `"full"`: Return all question IDs
 * - `"limit"`: Return the first N question IDs
 * - `"sample"`: Return N questions per category (consecutive or random)
 *
 * @param allQuestions - Full list of questions with IDs and types
 * @param sampling - Sampling configuration specifying mode and parameters
 * @returns Array of selected question IDs
 */
function selectQuestionsBySampling(
  allQuestions: { questionId: string; questionType: string }[],
  sampling: SamplingConfig
): string[] {
  if (sampling.mode === "full") {
    return allQuestions.map((q) => q.questionId)
  }
  if (sampling.mode === "limit" && sampling.limit) {
    return allQuestions.slice(0, sampling.limit).map((q) => q.questionId)
  }
  if (sampling.mode === "sample" && sampling.perCategory) {
    const byType: Record<string, { questionId: string; questionType: string }[]> = {}
    for (const q of allQuestions) {
      if (!byType[q.questionType]) byType[q.questionType] = []
      byType[q.questionType].push(q)
    }
    const selected: string[] = []
    for (const questions of Object.values(byType)) {
      if (sampling.sampleType === "random") {
        const shuffled = [...questions].sort(() => Math.random() - 0.5)
        selected.push(...shuffled.slice(0, sampling.perCategory).map((q) => q.questionId))
      } else {
        selected.push(...questions.slice(0, sampling.perCategory).map((q) => q.questionId))
      }
    }
    return selected
  }
  return allQuestions.map((q) => q.questionId)
}

/**
 * Manages multi-provider comparison runs.
 *
 * Coordinates running the same benchmark pipeline against multiple providers
 * in parallel, tracks results via manifests, and generates comparison reports
 * with accuracy, latency, retrieval quality, and ensemble lift analysis.
 *
 * @example
 * ```ts
 * const result = await batchManager.compare({
 *   providers: ["supermemory", "mem0", "zep"],
 *   benchmark: "locomo",
 *   judgeModel: "gpt-4o",
 *   answeringModel: "gpt-4o",
 * })
 * batchManager.printComparisonReport(result.manifest)
 * ```
 */
export class BatchManager {
  /** @param compareId - Comparison identifier */
  private getComparePath(compareId: string): string {
    return join(COMPARE_DIR, compareId)
  }

  /** @param compareId - Comparison identifier */
  private getManifestPath(compareId: string): string {
    return join(this.getComparePath(compareId), "manifest.json")
  }

  /** Check if a comparison manifest exists on disk. */
  exists(compareId: string): boolean {
    return existsSync(this.getManifestPath(compareId))
  }

  /** Persist a comparison manifest to disk, updating the `updatedAt` timestamp. */
  saveManifest(manifest: CompareManifest): void {
    const comparePath = this.getComparePath(manifest.compareId)
    if (!existsSync(comparePath)) {
      mkdirSync(comparePath, { recursive: true })
    }
    manifest.updatedAt = new Date().toISOString()
    writeFileSync(this.getManifestPath(manifest.compareId), JSON.stringify(manifest, null, 2))
  }

  /** Load a comparison manifest from disk, or return `null` if not found. */
  loadManifest(compareId: string): CompareManifest | null {
    const path = this.getManifestPath(compareId)
    if (!existsSync(path)) return null
    try {
      return JSON.parse(readFileSync(path, "utf8")) as CompareManifest
    } catch {
      return null
    }
  }

  /** Delete a comparison and all its associated run data from disk. */
  delete(compareId: string): void {
    const comparePath = this.getComparePath(compareId)
    if (existsSync(comparePath)) {
      rmSync(comparePath, { recursive: true })
    }
    const manifest = this.loadManifest(compareId)
    if (manifest) {
      for (const run of manifest.runs) {
        const runPath = join(RUNS_DIR, run.runId)
        if (existsSync(runPath)) {
          rmSync(runPath, { recursive: true })
        }
      }
    }
  }

  /** Load a run's report.json from disk, or return `null` if not found. */
  loadReport(runId: string): BenchmarkResult | null {
    const reportPath = join(RUNS_DIR, runId, "report.json")
    if (!existsSync(reportPath)) return null
    try {
      return JSON.parse(readFileSync(reportPath, "utf8")) as BenchmarkResult
    } catch {
      return null
    }
  }

  /**
   * Run a full comparison: create manifest, then execute all provider runs in parallel.
   *
   * @param options - Comparison configuration (providers, benchmark, models, sampling)
   * @returns CompareResult with success/failure counts and the manifest
   */
  async compare(options: CompareOptions): Promise<CompareResult> {
    const manifest = await this.createManifest(options)
    return this.executeRuns(manifest)
  }

  /**
   * Create a comparison manifest by loading the benchmark and selecting questions.
   *
   * Generates a unique compareId, loads the benchmark dataset, selects questions
   * based on sampling config, and creates per-provider run entries.
   *
   * @param options - Comparison configuration
   * @returns Persisted CompareManifest with run IDs for each provider
   */
  async createManifest(options: CompareOptions): Promise<CompareManifest> {
    const { providers, benchmark, judgeModel, answeringModel, sampling } = options
    const compareId = generateCompareId()

    logger.info(`Loading benchmark: ${benchmark}`)
    const benchmarkInstance = createBenchmark(benchmark)
    await benchmarkInstance.load()
    const allQuestions = benchmarkInstance.getQuestions()

    let targetQuestionIds: string[]
    if (sampling) {
      targetQuestionIds = selectQuestionsBySampling(allQuestions, sampling)
    } else {
      targetQuestionIds = allQuestions.map((q) => q.questionId)
    }

    const manifest: CompareManifest = {
      compareId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      benchmark,
      judge: judgeModel,
      answeringModel,
      sampling,
      targetQuestionIds,
      runs: providers.map((provider) => ({
        provider,
        runId: `${compareId}-${provider}`,
      })),
    }

    this.saveManifest(manifest)
    logger.info(`Created comparison: ${compareId}`)
    logger.info(`Providers: ${providers.join(", ")}`)
    logger.info(`Questions: ${targetQuestionIds.length}`)

    return manifest
  }

  /**
   * Resume an interrupted comparison or delete it with `--force`.
   *
   * @param compareId - ID of the comparison to resume
   * @param force - If true, delete the comparison instead of resuming
   * @returns CompareResult from the resumed execution
   * @throws {Error} If the comparison is not found or was force-deleted
   */
  async resume(compareId: string, force?: boolean): Promise<CompareResult> {
    if (force) {
      this.delete(compareId)
      throw new Error(`Comparison ${compareId} deleted with --force. Start a new comparison.`)
    }

    const manifest = this.loadManifest(compareId)
    if (!manifest) {
      throw new Error(`Comparison not found: ${compareId}`)
    }

    logger.info(`Resuming comparison: ${manifest.compareId}`)
    return this.executeRuns(manifest)
  }

  /**
   * Execute all provider runs in a comparison manifest in parallel.
   *
   * Each run is registered with the server's active run tracker, executed
   * via the orchestrator, and unregistered on completion. Failed runs have
   * their checkpoint status updated to "failed".
   *
   * @param manifest - The comparison manifest with provider run entries
   * @returns CompareResult with success/failure counts
   */
  async executeRuns(manifest: CompareManifest): Promise<CompareResult> {
    logger.info(`Starting ${manifest.runs.length} parallel runs...`)

    // Register all runs in activeRuns before starting
    for (const run of manifest.runs) {
      startRun(run.runId, manifest.benchmark)
    }

    const results = await Promise.allSettled(
      manifest.runs.map(async (run) => {
        try {
          return await orchestrator.run({
            provider: run.provider as ProviderName,
            benchmark: manifest.benchmark as BenchmarkName,
            judgeModel: manifest.judge,
            runId: run.runId,
            answeringModel: manifest.answeringModel,
            questionIds: manifest.targetQuestionIds,
          })
        } catch (error) {
          // Update checkpoint status to persist the failure state
          const checkpoint = checkpointManager.load(run.runId)
          if (checkpoint) {
            checkpointManager.updateStatus(checkpoint, "failed")
          }
          throw error
        } finally {
          // Always unregister the run when done (success or failure)
          endRun(run.runId)
        }
      })
    )

    const failures = results.filter((r) => r.status === "rejected")
    const successes = results.filter((r) => r.status === "fulfilled").length

    if (failures.length > 0) {
      logger.warn(`${failures.length} run(s) failed`)
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status === "rejected") {
          logger.error(`  ${manifest.runs[i].provider}: ${result.reason}`)
        }
      }
    }

    if (successes > 0) {
      logger.success(`${successes} run(s) completed successfully`)
    }

    this.saveManifest(manifest)

    return {
      compareId: manifest.compareId,
      manifest,
      successes,
      failures: failures.length,
    }
  }

  /**
   * Load all available reports for a comparison's runs.
   *
   * @param manifest - The comparison manifest to load reports for
   * @returns Array of `{ provider, report }` for runs that have completed reports
   */
  getReports(manifest: CompareManifest): Array<{ provider: string; report: BenchmarkResult }> {
    const reports: Array<{ provider: string; report: BenchmarkResult }> = []
    for (const run of manifest.runs) {
      const report = this.loadReport(run.runId)
      if (report) {
        reports.push({ provider: run.provider, report })
      }
    }
    return reports
  }

  /**
   * Print a formatted multi-provider comparison report to stdout.
   *
   * Renders tables comparing:
   * - Overall accuracy (sorted by accuracy, best marked with ←)
   * - Per-phase latency (fastest marked with ←)
   * - Retrieval quality metrics (Hit@K, Precision, Recall, F1, MRR, NDCG)
   * - Per-question-type accuracy with best provider per type
   * - Ensemble lift analysis (accuracy lift over best individual provider)
   * - Per-question-type ensemble lift breakdown
   *
   * @param manifest - The comparison manifest to generate the report for
   */
  printComparisonReport(manifest: CompareManifest): void {
    const reports = this.getReports(manifest)

    if (reports.length === 0) {
      logger.error("No reports found to compare")
      return
    }

    const pad = (s: string, n: number) => s.padEnd(n)
    const padNum = (n: number, width: number) => n.toString().padStart(width)
    const padPct = (n: number, width: number) => `${(n * 100).toFixed(1)}%`.padStart(width)

    console.log("\n" + "═".repeat(80))
    console.log(`                    COMPARISON: ${manifest.compareId}`)
    console.log(
      `                    Benchmark: ${manifest.benchmark} | Questions: ${manifest.targetQuestionIds.length} | Judge: ${manifest.judge}`
    )
    console.log("═".repeat(80))

    const sortedByAccuracy = [...reports].sort(
      (a, b) => b.report.summary.accuracy - a.report.summary.accuracy
    )
    const bestAccuracy = sortedByAccuracy[0]?.provider

    console.log("\nOVERALL ACCURACY")
    console.log(
      "┌" + "─".repeat(17) + "┬" + "─".repeat(10) + "┬" + "─".repeat(9) + "┬" + "─".repeat(10) + "┐"
    )
    console.log(
      "│ " +
        pad("Provider", 15) +
        " │ " +
        pad("Correct", 8) +
        " │ " +
        pad("Total", 7) +
        " │ " +
        pad("Accuracy", 8) +
        " │"
    )
    console.log(
      "├" + "─".repeat(17) + "┼" + "─".repeat(10) + "┼" + "─".repeat(9) + "┼" + "─".repeat(10) + "┤"
    )
    for (const { provider, report } of sortedByAccuracy) {
      const best = provider === bestAccuracy ? " ←" : ""
      const label = report.ensembleMetadata ? `${provider} [E]` : provider
      console.log(
        "│ " +
          pad(label, 15) +
          " │ " +
          padNum(report.summary.correctCount, 8) +
          " │ " +
          padNum(report.summary.totalQuestions, 7) +
          " │ " +
          padPct(report.summary.accuracy, 7) +
          best.padEnd(2) +
          " │"
      )
    }
    console.log(
      "└" + "─".repeat(17) + "┴" + "─".repeat(10) + "┴" + "─".repeat(9) + "┴" + "─".repeat(10) + "┘"
    )

    console.log("\nLATENCY (avg ms)")
    console.log(
      "┌" +
        "─".repeat(17) +
        "┬" +
        "─".repeat(9) +
        "┬" +
        "─".repeat(9) +
        "┬" +
        "─".repeat(9) +
        "┬" +
        "─".repeat(10) +
        "┬" +
        "─".repeat(9) +
        "┐"
    )
    console.log(
      "│ " +
        pad("Provider", 15) +
        " │ " +
        pad("Ingest", 7) +
        " │ " +
        pad("Search", 7) +
        " │ " +
        pad("Answer", 7) +
        " │ " +
        pad("Evaluate", 8) +
        " │ " +
        pad("Total", 7) +
        " │"
    )
    console.log(
      "├" +
        "─".repeat(17) +
        "┼" +
        "─".repeat(9) +
        "┼" +
        "─".repeat(9) +
        "┼" +
        "─".repeat(9) +
        "┼" +
        "─".repeat(10) +
        "┼" +
        "─".repeat(9) +
        "┤"
    )

    const latencyMins = {
      ingest: Math.min(...reports.map((r) => r.report.latency.ingest.mean)),
      search: Math.min(...reports.map((r) => r.report.latency.search.mean)),
      answer: Math.min(...reports.map((r) => r.report.latency.answer.mean)),
      evaluate: Math.min(...reports.map((r) => r.report.latency.evaluate.mean)),
      total: Math.min(...reports.map((r) => r.report.latency.total.mean)),
    }

    for (const { provider, report } of reports) {
      const ingestMark = report.latency.ingest.mean === latencyMins.ingest ? "←" : " "
      const searchMark = report.latency.search.mean === latencyMins.search ? "←" : " "
      const answerMark = report.latency.answer.mean === latencyMins.answer ? "←" : " "
      const evaluateMark = report.latency.evaluate.mean === latencyMins.evaluate ? "←" : " "
      const totalMark = report.latency.total.mean === latencyMins.total ? "←" : " "
      console.log(
        "│ " +
          pad(provider, 15) +
          " │ " +
          padNum(report.latency.ingest.mean, 6) +
          ingestMark +
          " │ " +
          padNum(report.latency.search.mean, 6) +
          searchMark +
          " │ " +
          padNum(report.latency.answer.mean, 6) +
          answerMark +
          " │ " +
          padNum(report.latency.evaluate.mean, 7) +
          evaluateMark +
          " │ " +
          padNum(report.latency.total.mean, 6) +
          totalMark +
          " │"
      )
    }
    console.log(
      "└" +
        "─".repeat(17) +
        "┴" +
        "─".repeat(9) +
        "┴" +
        "─".repeat(9) +
        "┴" +
        "─".repeat(9) +
        "┴" +
        "─".repeat(10) +
        "┴" +
        "─".repeat(9) +
        "┘"
    )

    const hasRetrieval = reports.some((r) => r.report.retrieval)
    if (hasRetrieval) {
      const k = reports.find((r) => r.report.retrieval)?.report.retrieval?.k || 10
      console.log(`\nRETRIEVAL METRICS (K=${k})`)
      console.log(
        "┌" +
          "─".repeat(17) +
          "┬" +
          "─".repeat(9) +
          "┬" +
          "─".repeat(11) +
          "┬" +
          "─".repeat(10) +
          "┬" +
          "─".repeat(9) +
          "┬" +
          "─".repeat(9) +
          "┬" +
          "─".repeat(9) +
          "┐"
      )
      console.log(
        "│ " +
          pad("Provider", 15) +
          " │ " +
          pad("Hit@K", 7) +
          " │ " +
          pad("Precision", 9) +
          " │ " +
          pad("Recall", 8) +
          " │ " +
          pad("F1", 7) +
          " │ " +
          pad("MRR", 7) +
          " │ " +
          pad("NDCG", 7) +
          " │"
      )
      console.log(
        "├" +
          "─".repeat(17) +
          "┼" +
          "─".repeat(9) +
          "┼" +
          "─".repeat(11) +
          "┼" +
          "─".repeat(10) +
          "┼" +
          "─".repeat(9) +
          "┼" +
          "─".repeat(9) +
          "┼" +
          "─".repeat(9) +
          "┤"
      )

      for (const { provider, report } of reports) {
        if (report.retrieval) {
          const r = report.retrieval
          console.log(
            "│ " +
              pad(provider, 15) +
              " │ " +
              padPct(r.hitAtK, 7) +
              " │ " +
              padPct(r.precisionAtK, 9) +
              " │ " +
              padPct(r.recallAtK, 8) +
              " │ " +
              padPct(r.f1AtK, 7) +
              " │ " +
              r.mrr.toFixed(3).padStart(7) +
              " │ " +
              r.ndcg.toFixed(3).padStart(7) +
              " │"
          )
        } else {
          console.log(
            "│ " +
              pad(provider, 15) +
              " │ " +
              pad("N/A", 7) +
              " │ " +
              pad("N/A", 9) +
              " │ " +
              pad("N/A", 8) +
              " │ " +
              pad("N/A", 7) +
              " │ " +
              pad("N/A", 7) +
              " │ " +
              pad("N/A", 7) +
              " │"
          )
        }
      }
      console.log(
        "└" +
          "─".repeat(17) +
          "┴" +
          "─".repeat(9) +
          "┴" +
          "─".repeat(11) +
          "┴" +
          "─".repeat(10) +
          "┴" +
          "─".repeat(9) +
          "┴" +
          "─".repeat(9) +
          "┴" +
          "─".repeat(9) +
          "┘"
      )
    }

    const allTypes = new Set<string>()
    for (const { report } of reports) {
      for (const type of Object.keys(report.byQuestionType)) {
        allTypes.add(type)
      }
    }

    if (allTypes.size > 0) {
      console.log("\nBY QUESTION TYPE")
      const providerWidth = 13
      const headerRow = ["│ " + pad("Type", 17)]
      for (const { provider } of reports) {
        headerRow.push(pad(provider, providerWidth))
      }
      headerRow.push(pad("Best", 13) + " │")

      const borderTop =
        "┌" +
        "─".repeat(19) +
        reports.map(() => "┬" + "─".repeat(providerWidth + 2)).join("") +
        "┬" +
        "─".repeat(15) +
        "┐"
      const borderMid =
        "├" +
        "─".repeat(19) +
        reports.map(() => "┼" + "─".repeat(providerWidth + 2)).join("") +
        "┼" +
        "─".repeat(15) +
        "┤"
      const borderBot =
        "└" +
        "─".repeat(19) +
        reports.map(() => "┴" + "─".repeat(providerWidth + 2)).join("") +
        "┴" +
        "─".repeat(15) +
        "┘"

      console.log(borderTop)
      console.log(headerRow.join(" │ "))
      console.log(borderMid)

      for (const type of [...allTypes].sort()) {
        const row = ["│ " + pad(type, 17)]
        let bestProvider = ""
        let bestAccuracyForType = -1

        for (const { provider, report } of reports) {
          const stats = report.byQuestionType[type]
          if (stats) {
            row.push(padPct(stats.accuracy, providerWidth))
            if (stats.accuracy > bestAccuracyForType) {
              bestAccuracyForType = stats.accuracy
              bestProvider = provider
            }
          } else {
            row.push(pad("N/A", providerWidth))
          }
        }
        row.push(pad(bestProvider, 13) + " │")
        console.log(row.join(" │ "))
      }
      console.log(borderBot)
    }

    // Ensemble-specific metrics: show lift over best individual provider
    const ensembleReports = reports.filter((r) => r.report.ensembleMetadata)
    const individualReports = reports.filter((r) => !r.report.ensembleMetadata)

    if (ensembleReports.length > 0 && individualReports.length > 0) {
      const bestIndividualAccuracy = Math.max(
        ...individualReports.map((r) => r.report.summary.accuracy)
      )
      const bestIndividualProvider = individualReports.find(
        (r) => r.report.summary.accuracy === bestIndividualAccuracy
      )?.provider

      console.log("\nENSEMBLE ANALYSIS")
      console.log(
        "┌" +
          "─".repeat(25) +
          "┬" +
          "─".repeat(14) +
          "┬" +
          "─".repeat(12) +
          "┬" +
          "─".repeat(14) +
          "┬" +
          "─".repeat(22) +
          "┐"
      )
      console.log(
        "│ " +
          pad("Ensemble", 23) +
          " │ " +
          pad("Accuracy", 12) +
          " │ " +
          pad("Lift", 10) +
          " │ " +
          pad("Strategy", 12) +
          " │ " +
          pad("Sub-providers", 20) +
          " │"
      )
      console.log(
        "├" +
          "─".repeat(25) +
          "┼" +
          "─".repeat(14) +
          "┼" +
          "─".repeat(12) +
          "┼" +
          "─".repeat(14) +
          "┼" +
          "─".repeat(22) +
          "┤"
      )

      for (const { provider, report } of ensembleReports) {
        const ensAcc = report.summary.accuracy
        const lift = ensAcc - bestIndividualAccuracy
        const liftStr =
          lift >= 0
            ? `+${(lift * 100).toFixed(1)}%`
            : `${(lift * 100).toFixed(1)}%`
        const strategy = report.ensembleMetadata?.strategyName || "?"
        const subProviders = report.ensembleMetadata?.subProviders?.join("+") || "?"
        const truncSubs = subProviders.length > 20 ? subProviders.slice(0, 17) + "..." : subProviders

        console.log(
          "│ " +
            pad(provider, 23) +
            " │ " +
            padPct(ensAcc, 12) +
            " │ " +
            liftStr.padStart(10) +
            " │ " +
            pad(strategy, 12) +
            " │ " +
            pad(truncSubs, 20) +
            " │"
        )
      }

      console.log(
        "└" +
          "─".repeat(25) +
          "┴" +
          "─".repeat(14) +
          "┴" +
          "─".repeat(12) +
          "┴" +
          "─".repeat(14) +
          "┴" +
          "─".repeat(22) +
          "┘"
      )
      console.log(
        `  Best individual: ${bestIndividualProvider} (${(bestIndividualAccuracy * 100).toFixed(1)}%)`
      )

      // Per-question-type ensemble lift
      if (allTypes.size > 0 && ensembleReports.length > 0) {
        console.log("\nENSEMBLE LIFT BY QUESTION TYPE")
        const ensReport = ensembleReports[0].report

        const liftRows: Array<{ type: string; indBest: number; ensAcc: number; lift: number; bestProv: string }> = []
        for (const type of [...allTypes].sort()) {
          const ensStats = ensReport.byQuestionType[type]
          if (!ensStats) continue

          let bestIndAcc = 0
          let bestProv = ""
          for (const { provider: prov, report: r } of individualReports) {
            const s = r.byQuestionType[type]
            if (s && s.accuracy > bestIndAcc) {
              bestIndAcc = s.accuracy
              bestProv = prov
            }
          }

          liftRows.push({
            type,
            indBest: bestIndAcc,
            ensAcc: ensStats.accuracy,
            lift: ensStats.accuracy - bestIndAcc,
            bestProv,
          })
        }

        if (liftRows.length > 0) {
          console.log(
            "┌" + "─".repeat(19) + "┬" + "─".repeat(14) + "┬" + "─".repeat(14) + "┬" + "─".repeat(12) + "┐"
          )
          console.log(
            "│ " + pad("Type", 17) + " │ " + pad("Best Indiv.", 12) + " │ " + pad("Ensemble", 12) + " │ " + pad("Lift", 10) + " │"
          )
          console.log(
            "├" + "─".repeat(19) + "┼" + "─".repeat(14) + "┼" + "─".repeat(14) + "┼" + "─".repeat(12) + "┤"
          )

          for (const row of liftRows) {
            const liftStr = row.lift >= 0 ? `+${(row.lift * 100).toFixed(1)}%` : `${(row.lift * 100).toFixed(1)}%`
            console.log(
              "│ " +
                pad(row.type, 17) +
                " │ " +
                padPct(row.indBest, 12) +
                " │ " +
                padPct(row.ensAcc, 12) +
                " │ " +
                liftStr.padStart(10) +
                " │"
            )
          }

          console.log(
            "└" + "─".repeat(19) + "┴" + "─".repeat(14) + "┴" + "─".repeat(14) + "┴" + "─".repeat(12) + "┘"
          )
        }
      }
    }

    console.log("\n" + "═".repeat(80))
    if (bestAccuracy) {
      const bestReport = reports.find((r) => r.provider === bestAccuracy)?.report
      const isEnsemble = bestReport?.ensembleMetadata != null
      const winnerLabel = isEnsemble ? `${bestAccuracy} [ensemble]` : bestAccuracy
      console.log(
        `WINNER: ${winnerLabel} (${(bestReport!.summary.accuracy * 100).toFixed(1)}% overall accuracy)`
      )
    }
    console.log("═".repeat(80) + "\n")
  }
}

/** Singleton BatchManager instance used by the CLI and API. */
export const batchManager = new BatchManager()
