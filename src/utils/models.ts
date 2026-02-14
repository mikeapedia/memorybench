/**
 * Configuration for a single LLM model, including provider routing and parameter constraints.
 *
 * Used by judges and answer generation to correctly configure API calls
 * (e.g., some models don't support temperature, some use different token params).
 */
export interface ModelConfig {
  id: string
  provider: "openai" | "anthropic" | "google" | "ollama"
  displayName: string
  supportsTemperature: boolean
  defaultTemperature: number
  maxTokensParam: "maxTokens" | "max_completion_tokens" | "maxOutputTokens"
  defaultMaxTokens: number
}

/**
 * Registry of known LLM models keyed by short alias.
 *
 * Aliases are used in CLI flags (`-j gpt-4o`, `-a sonnet-4`) and resolved
 * to full model IDs and provider-specific parameters via {@link getModelConfig}.
 */
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // OpenAI - Standard models (support temperature)
  "gpt-4o": {
    id: "gpt-4o",
    provider: "openai",
    displayName: "GPT-4o (Legacy)",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    provider: "openai",
    displayName: "GPT-4o Mini (Legacy)",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },
  "gpt-4.1": {
    id: "gpt-4.1",
    provider: "openai",
    displayName: "GPT-4.1",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },
  "gpt-4.1-mini": {
    id: "gpt-4.1-mini",
    provider: "openai",
    displayName: "GPT-4.1 Mini",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },
  "gpt-4.1-nano": {
    id: "gpt-4.1-nano",
    provider: "openai",
    displayName: "GPT-4.1 Nano",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },

  // OpenAI - Reasoning models (NO temperature support)
  "gpt-5": {
    id: "gpt-5",
    provider: "openai",
    displayName: "GPT-5",
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokensParam: "max_completion_tokens",
    defaultMaxTokens: 1000,
  },
  "gpt-5-mini": {
    id: "gpt-5-mini",
    provider: "openai",
    displayName: "GPT-5 Mini",
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokensParam: "max_completion_tokens",
    defaultMaxTokens: 1000,
  },
  o1: {
    id: "o1",
    provider: "openai",
    displayName: "o1",
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokensParam: "max_completion_tokens",
    defaultMaxTokens: 1000,
  },
  "o1-pro": {
    id: "o1-pro",
    provider: "openai",
    displayName: "o1 Pro",
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokensParam: "max_completion_tokens",
    defaultMaxTokens: 1000,
  },
  o3: {
    id: "o3",
    provider: "openai",
    displayName: "o3",
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokensParam: "max_completion_tokens",
    defaultMaxTokens: 1000,
  },
  "o3-mini": {
    id: "o3-mini",
    provider: "openai",
    displayName: "o3 Mini",
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokensParam: "max_completion_tokens",
    defaultMaxTokens: 1000,
  },
  "o3-pro": {
    id: "o3-pro",
    provider: "openai",
    displayName: "o3 Pro",
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokensParam: "max_completion_tokens",
    defaultMaxTokens: 1000,
  },
  "o4-mini": {
    id: "o4-mini",
    provider: "openai",
    displayName: "o4 Mini",
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokensParam: "max_completion_tokens",
    defaultMaxTokens: 1000,
  },

  // Anthropic - All Claude models (support temperature)
  "opus-4.5": {
    id: "claude-opus-4-5-20251101",
    provider: "anthropic",
    displayName: "Claude Opus 4.5",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },
  "sonnet-4.5": {
    id: "claude-sonnet-4-5-20250929",
    provider: "anthropic",
    displayName: "Claude Sonnet 4.5",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },
  "haiku-4.5": {
    id: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    displayName: "Claude Haiku 4.5",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },
  "opus-4.1": {
    id: "claude-opus-4-1-20250805",
    provider: "anthropic",
    displayName: "Claude Opus 4.1",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },
  "sonnet-4": {
    id: "claude-sonnet-4-20250514",
    provider: "anthropic",
    displayName: "Claude Sonnet 4",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },

  // Google - Gemini 2.x (support temperature)
  "gemini-2.5-pro": {
    id: "gemini-2.5-pro",
    provider: "google",
    displayName: "Gemini 2.5 Pro",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    provider: "google",
    displayName: "Gemini 2.5 Flash",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },
  "gemini-2.5-flash-lite": {
    id: "gemini-2.5-flash-lite",
    provider: "google",
    displayName: "Gemini 2.5 Flash Lite",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    provider: "google",
    displayName: "Gemini 2.0 Flash",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },

  // Google - Gemini 3 (MUST use temperature=1, lower causes issues)
  "gemini-3-pro-preview": {
    id: "gemini-3-pro-preview",
    provider: "google",
    displayName: "Gemini 3 Pro Preview",
    supportsTemperature: true,
    defaultTemperature: 1,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  },

  // Ollama - Local models (via OpenAI compability)
  "ollama-llama3.1": {
    id: "llama3.1",
    provider: "ollama",
    displayName: "Ollama Llama 3.1",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 4096,
  },
  "ollama-llama3.2": {
    id: "llama3.2",
    provider: "ollama",
    displayName: "Ollama Llama 3.2",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 4096,
  },
  "ollama-mistral": {
    id: "mistral",
    provider: "ollama",
    displayName: "Ollama Mistral",
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 4096,
  },
}

/** Default model alias used for answer generation when none is specified. */
export const DEFAULT_ANSWERING_MODEL = "gpt-4o"
/** Default judge model alias per LLM provider. */
export const DEFAULT_JUDGE_MODELS: Record<string, string> = {
  openai: "gpt-4o",
  anthropic: "sonnet-4",
  google: "gemini-2.5-flash",
  ollama: "ollama-llama3.1",
}

/**
 * Resolve a model alias to its full configuration.
 *
 * First checks the {@link MODEL_CONFIGS} registry for an exact match. If not found,
 * infers the provider and parameters from the alias prefix (e.g., `"gpt-"` → OpenAI,
 * `"claude-"` → Anthropic, `"gemini-"` → Google). Falls back to OpenAI defaults.
 *
 * @param alias - Short model alias (e.g., "gpt-4o", "sonnet-4", "gemini-2.5-pro")
 * @returns Full ModelConfig with provider, model ID, and parameter constraints
 */
export function getModelConfig(alias: string): ModelConfig {
  const lowerAlias = alias.toLowerCase()

  if (MODEL_CONFIGS[lowerAlias]) {
    return MODEL_CONFIGS[lowerAlias]
  }

  // Fallback for unknown models - try to infer from prefix
  if (
    alias.startsWith("gpt-5") ||
    alias.startsWith("o1") ||
    alias.startsWith("o3") ||
    alias.startsWith("o4")
  ) {
    return {
      id: alias,
      provider: "openai",
      displayName: alias,
      supportsTemperature: false,
      defaultTemperature: 1,
      maxTokensParam: "max_completion_tokens",
      defaultMaxTokens: 1000,
    }
  }
  if (alias.startsWith("gpt-")) {
    return {
      id: alias,
      provider: "openai",
      displayName: alias,
      supportsTemperature: true,
      defaultTemperature: 0,
      maxTokensParam: "maxTokens",
      defaultMaxTokens: 1000,
    }
  }
  if (alias.startsWith("claude-")) {
    return {
      id: alias,
      provider: "anthropic",
      displayName: alias,
      supportsTemperature: true,
      defaultTemperature: 0,
      maxTokensParam: "maxTokens",
      defaultMaxTokens: 1000,
    }
  }
  if (alias.startsWith("gemini-3")) {
    return {
      id: alias,
      provider: "google",
      displayName: alias,
      supportsTemperature: true,
      defaultTemperature: 1,
      maxTokensParam: "maxTokens",
      defaultMaxTokens: 1000,
    }
  }
  if (alias.startsWith("gemini-")) {
    return {
      id: alias,
      provider: "google",
      displayName: alias,
      supportsTemperature: true,
      defaultTemperature: 0,
      maxTokensParam: "maxTokens",
      defaultMaxTokens: 1000,
    }
  }
  if (alias.startsWith("ollama-")) {
    // Expected format: "ollama-<model_name>", e.g. "ollama-llama3"
    // The ID passed to the provider should be the model name (without "ollama-" prefix) if using createOpenAI with ollama
    // But wait, createOpenAI takes a 'modelId' which is usually passed in the body.
    // If I use createOpenAI with baseURL, the model ID is passed as 'model'.
    // So 'ollama-llama3' -> model ID 'llama3'.
    const modelId = alias.replace(/^ollama-/, "")
    return {
      id: modelId,
      provider: "ollama",
      displayName: `Ollama ${modelId}`,
      supportsTemperature: true,
      defaultTemperature: 0,
      maxTokensParam: "maxTokens",
      defaultMaxTokens: 4096, // Ollama models often support larger context
    }
  }

  // Default fallback
  return {
    id: alias,
    provider: "openai",
    displayName: alias,
    supportsTemperature: true,
    defaultTemperature: 0,
    maxTokensParam: "maxTokens",
    defaultMaxTokens: 1000,
  }
}

/** @deprecated Use {@link MODEL_CONFIGS} directly. Kept for backward compatibility. */
export const MODEL_ALIASES = MODEL_CONFIGS

/**
 * Resolve a model alias to its configuration. Alias for {@link getModelConfig}.
 *
 * @param alias - Short model alias
 * @returns Full ModelConfig
 */
export function resolveModel(alias: string): ModelConfig {
  return getModelConfig(alias)
}

/**
 * Get the full model ID for an alias (e.g., `"sonnet-4"` → `"claude-sonnet-4-20250514"`).
 *
 * @param alias - Short model alias
 * @returns The provider-specific model identifier string
 */
export function getModelId(alias: string): string {
  return getModelConfig(alias).id
}

/**
 * Get the LLM provider for a model alias.
 *
 * @param alias - Short model alias
 * @returns Provider name ("openai", "anthropic", "google", or "ollama")
 */
export function getModelProvider(alias: string): "openai" | "anthropic" | "google" | "ollama" {
  return getModelConfig(alias).provider
}

/** List all registered model aliases. */
export function listAvailableModels(): string[] {
  return Object.keys(MODEL_CONFIGS)
}

/**
 * List all registered model aliases for a specific provider.
 *
 * @param provider - LLM provider to filter by
 * @returns Array of model aliases belonging to the specified provider
 */
export function listModelsByProvider(
  provider: "openai" | "anthropic" | "google" | "ollama"
): string[] {
  return Object.entries(MODEL_CONFIGS)
    .filter(([_, config]) => config.provider === provider)
    .map(([alias]) => alias)
}
