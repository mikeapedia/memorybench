# MemoryBench Project `GEMINI.md`

This document provides a comprehensive overview of the MemoryBench project, its structure, and how to work with it.

## Project Overview

MemoryBench is a pluggable benchmarking framework for evaluating memory and context systems for AI applications. It allows for mixing and matching different "providers" (memory systems) with various "benchmarks" (datasets and tasks).

The project has two main parts:

1.  **A command-line interface (CLI)** written in TypeScript, located in the `src` directory. This is the primary tool for running benchmarks, comparing providers, and managing test runs.
2.  **A web-based user interface (UI)** built with Next.js, located in the `ui` directory. The UI allows for interactive inspection of runs, questions, and failures in real-time.

### Key Technologies

*   **Backend/CLI**: TypeScript, Bun (runtime and package manager)
*   **Frontend/UI**: Next.js, React, TypeScript, Tailwind CSS
*   **Database**: The UI uses `better-sqlite3`, and the backend uses a file-based checkpointing system in `data/runs`.

## Building and Running

The project is a monorepo with two main parts, each with its own `package.json` and scripts.

### Backend/CLI

The main CLI is in the `src` directory.

*   **Install Dependencies:**
    ```bash
    bun install
    ```

*   **Run Commands:**
    The main entry point is `src/index.ts`. All commands are run through `bun run`.
    ```bash
    # Run a full benchmark
    bun run src/index.ts run -p <provider> -b <benchmark>

    # Start the web UI server
    bun run src/index.ts serve
    ```

*   **Available Scripts** (`package.json`):
    *   `start`: Alias for `bun run src/index.ts`.
    *   `test`: Runs tests with `bun test`.
    *   `format`: Formats the code with Prettier.

### Frontend/UI

The UI is a Next.js application in the `ui` directory.

*   **Install Dependencies:**
    ```bash
    cd ui
    bun install
    ```

*   **Run in Development Mode:**
    ```bash
    cd ui
    bun run dev
    ```
    This will start the Next.js development server, usually on `http://localhost:3000`.

*   **Build for Production:**
    ```bash
    cd ui
    bun run build
    ```

*   **Run in Production Mode:**
    ```bash
    cd ui
    bun run start
    ```

## Development Conventions

*   **Code Style**: The project uses Prettier for code formatting. You can format the code by running `bun run format`.
*   **Type Checking**: The project is written in TypeScript, so all code is statically typed.
*   **Modularity**: The project is highly modular, with clear separation of concerns.
    *   `src/providers`: Contains integrations for different memory providers.
    *   `src/benchmarks`: Contains different benchmark datasets and tasks.
    *   `src/judges`: Contains integrations for different "judge" models (e.g., GPT-4, Claude) for evaluation.
    *   `src/cli/commands`: Each CLI command is implemented in its own file.
*   **Checkpointing**: Benchmark runs are checkpointed to the `data/runs/{runId}` directory, allowing for resumption of failed or interrupted runs.
*   **Extensibility**: The project is designed to be extensible. New providers, benchmarks, and judges can be added by following the patterns in the respective `README.md` files within `src/providers`, `src/benchmarks`, and `src/judges`.
