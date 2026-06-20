# Cortex

Cortex is a sovereign persistent memory layer and multi-agent operating system for AI, built on the Sui stack (Sui, Walrus, Seal, and MemWal).

It is built around one idea: AI should not lose the user's context every time the session, tool, or model changes. Cortex ingests notes, files, and other sources, extracts durable memories from them, stores artifacts on user-controlled infrastructure, recalls the right context later, and improves over time through consolidation and correction.

At the product level, Cortex aims to be the shared brain behind agents and tools:

- memory and artifacts persist beyond a single chat
- corrections become current truth instead of competing facts
- context can move across interfaces and agents
- state can be durable, inspectable, and permissioned

## What This Repo Contains

This repository currently includes three main surfaces:

- a `Next.js` app for the main Cortex product experience
- a local core runtime that exposes the Cortex facade and CLI flows
- an `MCP` server that lets external agents and hosts access the same memory plane

In code, the main facade is the `Cortex` class in [`src/core/cortex.ts`](file:///Users/goodylili/GolandProjects/cortex/src/core/cortex.ts), which handles:

- ingesting sources into memory
- recalling memories from a namespace
- running consolidation and applying diffs
- producing derived views like tags, digest, timeline, and connections
- verifying storage fetchability on the live path

## Core Concepts

### Memory, Not Just Chat History

Cortex is not meant to be a chatbot wrapper or a prompt library. It is a memory system with structured artifacts and durable state.

The central artifact types live in [`src/core/models.ts`](file:///Users/goodylili/GolandProjects/cortex/src/core/models.ts):

- `Source`: a raw input such as a note, document, image, audio file, video, URL, or structured payload
- `Memory`: a durable extracted memory with text, tags, confidence, provenance, and timestamps
- `Extraction`: the result of processing a source into memories
- `MemoryDiff`: a structured consolidation result that can merge, verify, prune, or pattern-match memories
- `NamespaceManifest`: the per-namespace pointer record for versions and artifacts

### Built on the Sui Stack

Cortex is built on the Sui stack for identity, storage, and encryption. For development, with no live credentials configured, the runtime falls back to mock mode. That makes the repo usable for development and product work without requiring Sui, Walrus, Seal, or MemWal credentials up front.

When the live path is configured, Cortex uses:

- `Sui` for identity and coordination
- `Walrus` for durable artifact storage
- `Seal` for encryption and access gating
- `MemWal` for persistent memory namespaces and recall

### Mainnet Deployment

The `cortex` Move package is published to mainnet. The canonical record of the package id, shared registries, and capability objects lives in [`backend/sui/contract/cortex/DEPLOYMENT.md`](backend/sui/contract/cortex/DEPLOYMENT.md) (full receipt in `published.json`, toolchain pins in `Published.toml`). Package id: `0x643fbc9d6182493e533a85a49a584a1c08471e2d28e6de842eb183c8d2ed9438`.

### Encryption (Seal vs AES)

Durable session and memory blobs are always encrypted client-side before they reach Walrus; which scheme is used is a runtime switch driven by configuration:

- **Seal threshold encryption** is used when `NEXT_PUBLIC_SEAL_SERVER_IDS` (comma-separated key-server object ids) is set. Blobs are encrypted under the user's owner identity, with decryption gated on-chain by the `seal_approve` Move entry points; `NEXT_PUBLIC_SEAL_THRESHOLD` controls how many key servers must return a share to decrypt. New Seal blobs carry a one-byte `0x02` format tag.
- **Wallet-derived AES-GCM** is the fallback when no Seal key servers are configured. The key is derived deterministically from a wallet signature, and new blobs carry a `0x01` tag. Blobs written before tagging existed carry no tag and are always read as AES, so the fallback stays backward-compatible.

Get testnet key-server object ids from Mysten's published Seal testnet servers (see the `@mysten/seal` README) or from `getAllowlistedKeyServers("testnet")`. The same switch exists server-side for the core/MCP runtime via `SEAL_SERVER_IDS`/`SEAL_THRESHOLD` in the MCP's `.env` (see `backend/mcp/.env.example`).

### Multi-Agent State

The repo also contains the foundations for durable agent workflows and loop-based execution, with a shared task board, message bus, memory-backed context, and MCP access.

## Repository Structure

```text
src/
  app/                 Next.js app routes and UI
  components/          UI components for the Cortex app
  core/                the Cortex facade, config, sync, CLI, watcher
  lib/cortex/          browser/client-side Cortex flows, Walrus/Seal integration
  lib/llm/             model registry and completion helpers
  types/               local type declarations

sui/
  app/                 Sui/Walrus/Seal client wiring for the core runtime
  contract/cortex/     Move contracts for Cortex
  walrus/              MemWal and Walrus helpers

mcp/
  server.ts            MCP server exposing memory, agents, execution, and connectors

config/
  config.example.yaml  server/core runtime config template
```

## Getting Started

### Requirements

- `pnpm`
- Node.js `20+` recommended

Install dependencies:

```bash
pnpm install
```

### Run the App

Start the Next.js app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

If `.env.local` is empty, the app still runs, but stays on the local mock path for storage and memory.

### Run the Demo Flow

The core runtime includes a demo command that seeds sample sources, runs consolidation, applies the diff, and verifies artifact fetchability:

```bash
pnpm demo
```

This is the quickest way to exercise the Cortex pipeline outside the web UI.

### Run the MCP Server

Start the MCP server:

```bash
pnpm mcp
```

The MCP server exposes:

- memory recall, remember, ingest, forget, verify, and dream operations
- derived read views like tags, digest, connections, extraction, and timeline
- agent/task collaboration primitives over shared state
- outbound bridge tools such as fetch and notifications

## Available Scripts

- `pnpm dev`: start the Next.js development server
- `pnpm build`: build the web app
- `pnpm start`: run the production build
- `pnpm lint`: run ESLint
- `pnpm typecheck`: run the app TypeScript check
- `pnpm server:typecheck`: run the server/core TypeScript check
- `pnpm format`: format the repo with Prettier
- `pnpm format:check`: check formatting without writing
- `pnpm demo`: seed and run the core Cortex demo pipeline
- `pnpm mcp`: launch the MCP server

## Configuration

There are two main configuration surfaces.

### Frontend App Config

Copy [`.env.example`](file:///Users/goodylili/GolandProjects/cortex/.env.example) to `.env.local`:

```bash
cp .env.example .env.local
```

This controls:

- Privy authentication
- client-side Sui and Walrus endpoints
- deployed Cortex package and registry ids
- Seal key server ids and threshold
- MemWal relayer and contract ids
- model provider API keys for the app's API routes

If you leave these unset, the frontend remains usable in local mock mode.

### Core / MCP Runtime Config

The MCP server reads its config from an `.env` file. Copy the template and fill it in:

```bash
cp backend/mcp/.env.example backend/mcp/.env
```

`backend/mcp/.env` is gitignored (safe for secrets) and is loaded on startup; point elsewhere with `CORTEX_ENV_FILE`. It controls:

- namespace (`CORTEX_NAMESPACE`)
- Sui RPC/network (`CORTEX_SUI_RPC`, `CORTEX_SUI_NETWORK`)
- Walrus publisher and aggregator (`CORTEX_WALRUS_PUBLISHER`, `CORTEX_WALRUS_AGGREGATOR`, `CORTEX_WALRUS_EPOCHS`)
- cortex package id and on-chain access model (`CORTEX_PACKAGE_ID`, `CORTEX_ACCESS_REGISTRY`, `CORTEX_EXECUTOR_CAP`)
- the MCP delegate wallet (`CORTEX_DELEGATE_KEY`), which must hold the `ExecutorCap`
- MemWal relayer, account id, and delegate key (`MEMWAL_SERVER_URL`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_PRIVATE_KEY`)
- Seal servers and threshold (`SEAL_SERVER_IDS`, `SEAL_THRESHOLD`)
- model provider and keys (`CORTEX_MODEL_PROVIDER`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`)

The deployed package and object ids to put here are listed in [`backend/sui/contract/cortex/DEPLOYMENT.md`](backend/sui/contract/cortex/DEPLOYMENT.md). The core CLI also accepts an optional `config/config.yaml` (see `config/config.example.yaml`) as an alternative to env vars.

## Modes

### Mock Mode

Mock mode is the default when live config is incomplete.

Use it when you want to:

- work on the product and UI
- test the memory pipeline locally
- iterate on prompts, extraction, and derived artifacts
- develop without live blockchain and storage dependencies

### Live Mode

Live mode is enabled once the required infrastructure config is present.

Use it when you want:

- durable storage on Walrus
- coordinated identity and permissions on Sui
- encrypted blobs through Seal
- persistent MemWal-backed namespaces

## Architectural Summary

At a high level, Cortex works like this:

1. The user gives Cortex a source such as a note, document, file, or URL.
2. Cortex stores the source and extracts memories from it.
3. Those memories are persisted in a namespace and can be recalled later.
4. Cortex periodically consolidates memory into diffs, patterns, verifications, and prunes.
5. The resulting state becomes reusable context for agents, prompts, workspaces, and external tools.

This gives Cortex a few important properties:

- persistence across sessions
- portability across tools and models
- inspectable state rather than opaque hidden memory
- separation between raw durable storage and active retrieval behavior

## Development Notes

- The current web app still includes positioning and UX for prompt generation, but the deeper repo architecture is larger than that: Cortex is the memory and agent substrate underneath the product.
- The repo contains both browser-side and server-side/live-path integrations for Walrus, Seal, Sui, and MemWal.
- The Move contracts under `sui/contract/cortex` are part of the live coordination and access model.

## Tech Stack

- `Next.js`
- `React`
- `TypeScript`
- `Tailwind CSS`
- `Radix UI`
- `Sui`
- `Walrus`
- `Seal`
- `MemWal`
- `MCP`

## Status

This repo is an active build toward a hackathon-ready and extensible Cortex foundation. Some surfaces are already wired end-to-end, while others are still evolving toward the broader product vision described in the planning docs.
# Cortex
