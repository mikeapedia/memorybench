/** Supported log severity levels, from least to most severe. */
type LogLevel = "debug" | "info" | "warn" | "error"

/** ANSI color escape codes for terminal output formatting. */
const COLORS = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  reset: "\x1b[0m",
  green: "\x1b[32m",
}

/**
 * Structured logger with colored output, severity filtering, and progress bars.
 *
 * All library code should use the exported {@link logger} singleton instead of
 * `console.log`. Supports `debug`, `info`, `warn`, `error`, `success`, and
 * `progress` methods. The minimum log level can be set via {@link setLevel}.
 *
 * @example
 * ```ts
 * logger.setLevel("debug")
 * logger.info("Starting pipeline")
 * logger.success("Pipeline complete!")
 * logger.progress(5, 10, "Processing questions")
 * ```
 */
class Logger {
  /** Current minimum log level. Messages below this level are suppressed. */
  private level: LogLevel = "info"

  /**
   * Set the minimum log level.
   *
   * @param level - Minimum severity to display ("debug" shows all, "error" shows only errors)
   */
  setLevel(level: LogLevel) {
    this.level = level
  }

  /** Check if a message at the given level should be displayed. */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"]
    return levels.indexOf(level) >= levels.indexOf(this.level)
  }

  /** Format a log message with timestamp, colored level, and optional metadata JSON. */
  private format(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString()
    const color = COLORS[level]
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ""
    return `${COLORS.reset}[${timestamp}] ${color}${level.toUpperCase()}${COLORS.reset} ${message}${metaStr}`
  }

  /** Log a debug message (gray). Only shown when level is "debug". */
  debug(message: string, meta?: Record<string, unknown>) {
    if (this.shouldLog("debug")) console.log(this.format("debug", message, meta))
  }

  /** Log an informational message (cyan). */
  info(message: string, meta?: Record<string, unknown>) {
    if (this.shouldLog("info")) console.log(this.format("info", message, meta))
  }

  /** Log a warning message (yellow). */
  warn(message: string, meta?: Record<string, unknown>) {
    if (this.shouldLog("warn")) console.warn(this.format("warn", message, meta))
  }

  /** Log an error message (red). */
  error(message: string, meta?: Record<string, unknown>) {
    if (this.shouldLog("error")) console.error(this.format("error", message, meta))
  }

  /** Log a success message with a green checkmark prefix (✓). Always shown regardless of level. */
  success(message: string) {
    console.log(`${COLORS.green}✓${COLORS.reset} ${message}`)
  }

  /**
   * Display an inline progress bar with percentage.
   *
   * Uses carriage return (`\r`) to overwrite the current line, creating an
   * animated progress effect. Prints a newline when `current === total`.
   *
   * @param current - Current progress count
   * @param total - Total expected count
   * @param message - Label to display after the progress bar
   */
  progress(current: number, total: number, message: string) {
    const percent = Math.round((current / total) * 100)
    const bar = "█".repeat(Math.floor(percent / 5)) + "░".repeat(20 - Math.floor(percent / 5))
    process.stdout.write(`\r${COLORS.info}[${bar}]${COLORS.reset} ${percent}% ${message}`)
    if (current === total) console.log()
  }
}

/** Singleton logger instance. Use this throughout the application instead of `console.log`. */
export const logger = new Logger()
