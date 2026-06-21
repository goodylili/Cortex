# Cortex

Cortex is a sovereign persistent memory layer and multi-agent operating system for AI, built on the Sui stack (Sui, Walrus, Seal, and MemWal).

It exists for one reason: AI should not lose your context every time the session, tool, or model changes. Cortex ingests notes, files, and other sources, extracts durable memories, stores them on infrastructure you control, recalls the right context later, and improves over time through consolidation and correction. The durable copy of your world lives on the Sui stack, not in a browser or a vendor database.

## Monorepo Layout

This is a pnpm workspace with three packages plus the Move contracts.

```text
frontend/                  cortex-frontend: the Next.js app (the product)
backend/
  mcp/                     cortex-mcp: the merged runtime + MCP server
    src/core/              the Cortex facade (cortex.ts), config, sync, models, artifacts
    src/lib/cortex/        backend loop helpers
    sui/                   Sui/Walrus/Seal/MemWal client wiring for the runtime
    server.ts              memory, agents, loops, execution, and connector tools
  sui/
    contract/cortex/       the Cortex Move package (deployed to mainnet)
docs/                      cortex-docs: the documentation site (Vocs)
```

The main facade is the `Cortex` class in `backend/mcp/src/core/cortex.ts`. The core artifact types (`Source`, `Memory`, `Extraction`, `MemoryDiff`, `NamespaceManifest`) live in `backend/mcp/src/core/models.ts`.

## Quick Start

Requirements: Node.js 20+ and pnpm 9.

```bash
pnpm install
```

Run the app (http://localhost:3000):

```bash
pnpm dev
```

Run the core demo pipeline (seeds sources, consolidates, applies a diff, verifies fetchability):

```bash
pnpm demo
```

Run the MCP server over stdio, or as a hosted HTTP endpoint at `/mcp`:

```bash
pnpm dev:mcp          # stdio, watch mode
pnpm start:mcp:http   # Streamable HTTP on :8787
```

Run the docs site:

```bash
pnpm dev:docs
```

## Scripts

Run from the repo root.

- `pnpm dev`: start the Next.js app
- `pnpm dev:docs` / `pnpm dev:mcp`: start docs or the MCP server in watch mode
- `pnpm build`: build the app
- `pnpm build:docs`: build the docs site
- `pnpm build:all`: build every package that defines a build script
- `pnpm start` / `pnpm start:docs`: run a production build
- `pnpm start:mcp` / `pnpm start:mcp:http`: run the MCP server (stdio or HTTP)
- `pnpm demo`: run the core Cortex demo pipeline
- `pnpm lint`: lint the frontend
- `pnpm typecheck`: typecheck every package
- `pnpm test`: run every package's tests
- `pnpm format` / `pnpm format:check`: format with Prettier

## Configuration

There are two configuration surfaces, and both default to a working mock mode when left unset.

### Frontend

```bash
cp frontend/.env.example frontend/.env.local
```

Controls Privy authentication, the client-side Sui and Walrus endpoints, the deployed Cortex package and registry ids, Seal key servers and threshold, the MemWal relayer and contract ids, and model provider keys for the app's API routes. Values exist per network as `_MAINNET` and `_TESTNET` slots. Left unset, the app runs in local mock mode.

### Core and MCP runtime

```bash
cp backend/mcp/.env.example backend/mcp/.env
```

`backend/mcp/.env` is gitignored, loaded on startup, and can be relocated with `CORTEX_ENV_FILE`. It sets the namespace, the Sui RPC and network, Walrus publisher and aggregator, the cortex package and access objects, the MCP delegate wallet (which must hold the `ExecutorCap`), MemWal relayer and keys, Seal servers and threshold, and the model provider and keys. The core CLI also accepts an optional `config/config.yaml`.

The deployed ids to fill in are listed in `backend/sui/contract/cortex/DEPLOYMENT.md`.

## How It Works

1. You give Cortex a source: a note, document, file, or URL.
2. Cortex stores the source and extracts durable memories from it.
3. Memories live in a namespace and can be recalled later.
4. Consolidation periodically merges, verifies, prunes, and pattern-matches memories into diffs.
5. The resulting state becomes reusable context for prompts, agents, workspaces, and external tools.

This keeps memory persistent across sessions, portable across tools and models, inspectable rather than hidden, and separated between raw durable storage and active retrieval.

## Auth and Privacy

The app is gated behind sign-in. Cortex stores nothing personal in the browser and has no offline sync, so the product does nothing until you sign in. Any action a signed-out visitor takes opens the (Privy) sign-in flow, and new users go through onboarding. On sign-out, everything the browser held for that user (profile, onboarding flag, key vault, MemWal credentials, session) is wiped; only device and UI preferences remain.

## The Sui Stack and Deployment

When the live path is configured, Cortex uses Sui for identity and coordination, Walrus for durable artifact storage, Seal for encryption and on-chain access gating, and MemWal for persistent memory namespaces and recall. Without live credentials, the runtime falls back to mock mode so you can develop without those dependencies.

Durable session and memory blobs are always encrypted client-side before reaching Walrus. Seal threshold encryption is used when key servers are configured (new blobs carry a `0x02` tag); a wallet-derived AES-GCM scheme is the fallback (tag `0x01`), with untagged legacy blobs read as AES.

The `cortex` Move package is published to mainnet. The canonical record of the package id, shared registries, and capability objects lives in `backend/sui/contract/cortex/DEPLOYMENT.md`.

Mainnet package id: `0x643fbc9d6182493e533a85a49a584a1c08471e2d28e6de842eb183c8d2ed9438`

## Multi-Agent State and Loops

Cortex includes durable agent workflows: a shared task board, a message bus, memory-backed context, and self-correcting execution loops, all reachable over MCP. See `AGENTIC-LOOPS.md` for the loop runtime and design.

## Tech Stack

Next.js, React, TypeScript, Tailwind CSS, Radix UI, Sui, Walrus, Seal, MemWal, and MCP.
