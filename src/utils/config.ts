import type { EnsembleConfig } from "../types/ensemble"

/**
 * Application-wide configuration loaded from environment variables.
 *
 * Each field corresponds to an environment variable (see `.env.example`).
 * All values default to empty strings or sensible URLs if the env var is unset.
 */
export interface Config {
  supermemoryApiKey: string
  supermemoryBaseUrl: string
  mem0ApiKey: string
  zepApiKey: string
  hindsightApiUrl: string
  hindsightApiKey: string
  lettaApiKey: string
  lettaBaseUrl: string
  openaiApiKey: string
  anthropicApiKey: string
  googleApiKey: string
  ollamaBaseUrl: string
}

/** Singleton config object populated from `process.env` at import time. */
export const config: Config = {
  supermemoryApiKey: process.env.SUPERMEMORY_API_KEY || "",
  supermemoryBaseUrl: process.env.SUPERMEMORY_BASE_URL || "https://api.supermemory.ai",
  mem0ApiKey: process.env.MEM0_API_KEY || "",
  zepApiKey: process.env.ZEP_API_KEY || "",
  hindsightApiUrl: process.env.HINDSIGHT_API_URL || "http://localhost:8888",
  hindsightApiKey: process.env.HINDSIGHT_API_KEY || "",
  lettaApiKey: process.env.LETTA_API_KEY || "",
  lettaBaseUrl: process.env.LETTA_BASE_URL || "https://api.letta.com",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  googleApiKey: process.env.GOOGLE_API_KEY || "",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
}

/**
 * Global ensemble config state.
 *
 * Set by the CLI when `--ensemble-config` is passed, read by the EnsembleProvider
 * during initialization. This global pattern avoids threading the config through
 * the Orchestrator's generic Provider interface.
 */
let _ensembleConfig: EnsembleConfig | undefined

/**
 * Set the global ensemble configuration (called by CLI arg parser).
 *
 * @param cfg - Parsed EnsembleConfig from the JSON config file
 */
export function setEnsembleConfig(cfg: EnsembleConfig): void {
  _ensembleConfig = cfg
}

/** Get the current global ensemble configuration, or `undefined` if not set. */
export function getEnsembleConfig(): EnsembleConfig | undefined {
  return _ensembleConfig
}

/**
 * Get the API credentials and configuration for a specific provider.
 *
 * Reads from the global {@link config} object and returns provider-specific
 * fields. For the "ensemble" provider, includes the global ensemble config.
 *
 * @param provider - Provider name (e.g., "supermemory", "mem0", "ensemble")
 * @returns Provider-specific config with `apiKey` and optional `baseUrl`
 * @throws {Error} If the provider name is not recognized
 */
export function getProviderConfig(
  provider: string
): { apiKey: string; baseUrl?: string;[key: string]: unknown } {
  switch (provider) {
    case "supermemory":
      return { apiKey: config.supermemoryApiKey, baseUrl: config.supermemoryBaseUrl }
    case "mem0":
      return { apiKey: config.mem0ApiKey }
    case "zep":
      return { apiKey: config.zepApiKey }
    case "hindsight":
      return { apiKey: config.hindsightApiKey, baseUrl: config.hindsightApiUrl }
    case "letta":
      return { apiKey: config.lettaApiKey, baseUrl: config.lettaBaseUrl }
    case "ensemble":
      return { apiKey: "", ensembleConfig: _ensembleConfig }
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Get the API key for a judge provider.
 *
 * @param judge - Judge provider name ("openai", "anthropic", "google", "ollama")
 * @returns Object with `apiKey` for the specified judge
 * @throws {Error} If the judge name is not recognized
 */
export function getJudgeConfig(judge: string): { apiKey: string; baseUrl?: string; model?: string } {
  switch (judge) {
    case "openai":
      return { apiKey: config.openaiApiKey }
    case "anthropic":
      return { apiKey: config.anthropicApiKey }
    case "google":
      return { apiKey: config.googleApiKey }
    case "ollama":
      return { apiKey: "ollama", baseUrl: config.ollamaBaseUrl }
    default:
      throw new Error(`Unknown judge: ${judge}`)
  }
}
