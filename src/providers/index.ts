import type { Provider, ProviderName } from "../types/provider"
import type { ConcurrencyConfig } from "../types/concurrency"
import { SupermemoryProvider } from "./supermemory"
import { Mem0Provider } from "./mem0"
import { ZepProvider } from "./zep"
import { HindsightProvider } from "./hindsight"
import { LettaProvider } from "./letta"
import { EnsembleProvider } from "./ensemble"

/**
 * Registry mapping provider names to their constructor classes.
 * Add new providers here when extending the system.
 */
const providers: Record<ProviderName, new () => Provider> = {
  supermemory: SupermemoryProvider,
  mem0: Mem0Provider,
  zep: ZepProvider,
  hindsight: HindsightProvider,
  letta: LettaProvider,
  ensemble: EnsembleProvider,
}

/**
 * Factory function that creates a new, uninitialized provider instance by name.
 *
 * The returned provider must be initialized via `provider.initialize(config)` before use.
 *
 * @param name - One of the registered provider names
 * @returns A new Provider instance (not yet initialized)
 * @throws {Error} If the provider name is not registered
 *
 * @example
 * ```ts
 * const provider = createProvider("supermemory")
 * await provider.initialize({ apiKey: "sm-..." })
 * ```
 */
export function createProvider(name: ProviderName): Provider {
  const ProviderClass = providers[name]
  if (!ProviderClass) {
    throw new Error(`Unknown provider: ${name}. Available: ${Object.keys(providers).join(", ")}`)
  }
  return new ProviderClass()
}

/**
 * Get the list of all registered provider names.
 *
 * @returns Array of available provider name strings
 *
 * @example
 * ```ts
 * getAvailableProviders() // ["supermemory", "mem0", "zep", "hindsight", "letta", "ensemble"]
 * ```
 */
export function getAvailableProviders(): ProviderName[] {
  return Object.keys(providers) as ProviderName[]
}

/**
 * Get display information and default concurrency config for a provider.
 *
 * Creates a temporary provider instance to read its concurrency settings.
 * Useful for CLI help text and the web UI provider selector.
 *
 * @param name - Provider name to get info for
 * @returns Object with name, display name, and concurrency config
 */
export function getProviderInfo(name: ProviderName): {
  name: string
  displayName: string
  concurrency: ConcurrencyConfig | null
} {
  const provider = createProvider(name)
  return {
    name,
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    concurrency: provider.concurrency || null,
  }
}

export {
  SupermemoryProvider,
  Mem0Provider,
  ZepProvider,
  HindsightProvider,
  LettaProvider,
  EnsembleProvider,
}
