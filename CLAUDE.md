# CLAUDE.md

## Commands

```bash
# Install dependencies
bun install

# Run CLI (main entry point)
bun run src/index.ts <command> [options]

# Run full benchmark pipeline
bun run src/index.ts run -p <provider> -b <benchmark> -j <judge> -r <runId>

# Compare multiple providers
bun run src/index.ts compare -p supermemory,mem0,zep,hindsight,letta -b locomo -j gpt-4o

# Run ensemble with config
bun run src/index.ts run -p ensemble -b locomo --ensemble-config ./ensemble-configs/all-rrf.json

# Start web UI server
bun run src/index.ts serve

# Format code
bun run format

# Check formatting
bun run format:check

# Run tests
bun test
```

## Architecture

```
src/
├── cli/                  # CLI commands (run, compare, serve, help, etc.)
│   ├── index.ts          # CLI dispatcher — routes args to command handlers
│   └── commands/         # One file per command
├── providers/            # Memory provider implementations
│   ├── index.ts          # Provider registry — createProvider() factory
│   ├── supermemory/      # Supermemory provider
│   ├── mem0/             # Mem0 provider
│   ├── zep/              # Zep provider
│   ├── hindsight/        # Hindsight provider (retain/recall/reflect)
│   ├── letta/            # Letta provider (archives/passages)
│   └── ensemble/         # Meta-provider combining multiple providers
│       ├── index.ts      # EnsembleProvider — fan-out ingest/search
│       ├── dedup.ts      # Cross-provider result deduplication
│       └── strategies/   # Fusion strategies (rrf, union, weighted, llm-rerank, voting)
├── benchmarks/           # Benchmark dataset loaders (locomo, longmemeval, convomem)
├── judges/               # LLM-based evaluation (openai, anthropic, google)
├── orchestrator/         # Pipeline execution engine
│   ├── index.ts          # Orchestrator class — manages 6-phase pipeline
│   ├── phases/           # Phase implementations (ingest, indexing, search, answer, evaluate, report)
│   ├── batch.ts          # BatchManager — parallel provider comparison
│   └── checkpoint.ts     # Checkpoint save/load for resumable runs
├── server/               # HTTP + WebSocket server (Bun.serve)
│   ├── index.ts          # Server setup, CORS, route dispatch
│   ├── routes/           # API route handlers (runs, compare, leaderboard, benchmarks)
│   ├── db/               # SQLite via Drizzle ORM (leaderboard.db)
│   └── websocket.ts      # Real-time progress updates
├── types/                # All TypeScript type definitions
│   ├── provider.ts       # Provider interface + ProviderName union
│   ├── unified.ts        # BenchmarkResult, EvaluationResult, LatencyStats
│   ├── ensemble.ts       # EnsembleConfig, FusionStrategy, StrategyConfig
│   ├── checkpoint.ts     # RunCheckpoint, phase types
│   └── prompts.ts        # ProviderPrompts interface
└── utils/
    ├── config.ts         # Environment config + provider config getters
    ├── models.ts         # LLM model registry and resolution
    └── logger.ts         # Custom logger (info, warn, error, success, debug)

ui/                       # Next.js 15 frontend (separate bun install)
ensemble-configs/         # Preset ensemble JSON configs
data/                     # Runtime data (gitignored) — runs/, leaderboard.db
```

## Key Interfaces

### Provider (src/types/provider.ts)
Every memory provider implements: `initialize()`, `ingest()`, `awaitIndexing()`, `search()`, `clear()`
`ProviderName = "supermemory" | "mem0" | "zep" | "hindsight" | "letta" | "ensemble"`

### FusionStrategy (src/types/ensemble.ts)
Ensemble strategies implement: `fuse(providerResults, context) -> Promise<unknown[]>`
`StrategyConfig` is a discriminated union keyed on `name`

### Benchmark (src/types/benchmark.ts)
Benchmarks implement: `load()`, `getQuestions()`, `getHaystackSessions()`, `getGroundTruth()`

## Code Style

- **Prettier**: no semicolons, double quotes, 2-space indent, 100-char width, ES5 trailing commas
- **Imports**: use `import type { X }` for type-only imports; relative paths throughout
- **Exports**: default export for provider/benchmark/judge classes; named exports for types and utilities
- **Errors**: throw immediately on uninitialized state (`if (!this.client) throw new Error("...")`)
- **Logging**: always use `logger` from `src/utils/logger.ts`, never `console.log` in library code
- **Types**: prefer `type` for data shapes, `interface` for extensible contracts; use discriminated unions for variants
- **satisfies**: use `satisfies` for object literal type checking (e.g., `{...} satisfies ProviderSearchOutput`)
- **Prompts**: provider prompts are exported constants from `prompts.ts`, attached as class property `prompts = MY_PROMPTS`

## Environment

Runtime: Bun (not Node.js). Entry point: `src/index.ts`. Module type: ESM.
TypeScript strict mode enabled. Target: ESNext. Types: bun-types.

Required env vars (see `.env.example`):
- `OPENAI_API_KEY` — for judge/answering models
- `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` — alternative LLM providers
- `SUPERMEMORY_API_KEY`, `MEM0_API_KEY`, `ZEP_API_KEY` — memory providers
- `HINDSIGHT_API_URL`, `HINDSIGHT_API_KEY` — Hindsight provider
- `LETTA_API_KEY`, `LETTA_BASE_URL` — Letta provider

## Adding a New Provider

1. Create `src/providers/<name>/index.ts` — class implementing `Provider` interface
2. Create `src/providers/<name>/prompts.ts` — `ProviderPrompts` with `answerPrompt` function
3. Add `"<name>"` to `ProviderName` union in `src/types/provider.ts`
4. Register in `src/providers/index.ts` providers record
5. Add config case in `src/utils/config.ts` `getProviderConfig()`
6. Add env vars to `.env.example`
7. Update help text in `src/cli/index.ts` `printProvidersHelp()`

## Adding an Ensemble Strategy

1. Create `src/providers/ensemble/strategies/<name>.ts` implementing `FusionStrategy`
2. Register in `src/providers/ensemble/strategies/index.ts` `createStrategy()` switch
3. Add variant to `StrategyConfig` union in `src/types/ensemble.ts`

## Gotchas

- Bun on Windows: may need `export PATH="$HOME/.bun/bin:$PATH"` prefix on bash commands
- Search results are `unknown[]` — each provider returns different shapes. Use `dedup.ts` `extractTextContent()` to normalize
- Ensemble config uses global state: `setEnsembleConfig()`/`getEnsembleConfig()` in `config.ts` threads config from CLI to provider without modifying Orchestrator
- The `tail` and `head` commands are not available in Windows Git Bash — avoid piping to them
- Provider prompts use function overloads: `string | ((question, context, questionDate?) => string)`
- Database is SQLite at `data/leaderboard.db` — auto-created on first `serve` command
- Web UI (`ui/`) has its own `package.json` and requires separate `bun install` in the `ui/` directory
- CLI arg parsing is manual (no yargs/commander) — use the for-loop pattern with `args[++i]`
- Checkpoint files live in `data/runs/{runId}/` — delete with `--force` flag or manually remove the directory
