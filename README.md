# Cortex

**Sovereign, persistent memory and a multi-agent runtime for AI, built on the Sui stack.**

AI loses your context every time the session, tool, or model changes. Cortex fixes that: it ingests your notes, files, and other sources, distills them into durable memories, stores them on infrastructure you control (Sui, Walrus, and Seal), and recalls the right context later, across any session, tool, or model. The durable copy of your world lives on-chain and in decentralized storage, not in a browser cache or a vendor database.

- **Live app:** https://usecortexai.xyz
- **Demo video:** https://usecortexai.xyz/demo
- **Hosted MCP server:** https://mcp.usecortexai.xyz/mcp

## What it does

- **Durable memory.** Notes, files, and URLs become distilled memories stored on Walrus and encrypted with Seal, scoped to namespaces you own.
- **Semantic recall.** Memories are retrieved by meaning, not keywords, so the right context resurfaces when you need it.
- **Cross-tool by design.** The same memory plane is reachable from the web app and from any MCP client (such as Claude), so context follows you between surfaces.
- **Self-improving.** Consolidation periodically merges, verifies, prunes, and connects memories instead of letting them pile up.
- **Multi-agent runtime.** A shared task board, message bus, memory-backed context, and self-correcting execution loops, all reachable over MCP.

## How it works

1. You give Cortex a source: a note, document, file, or URL.
2. Cortex stores the source and extracts durable memories from it.
3. Memories live in a namespace and are recalled later by meaning.
4. Consolidation periodically merges, verifies, prunes, and pattern-matches memories into diffs.
5. The resulting state becomes reusable context for prompts, agents, workspaces, and external tools.

The result is memory that is persistent across sessions, portable across tools and models, inspectable rather than hidden, and cleanly separated between raw durable storage and active retrieval.

## The Sui stack

Cortex is built on four layers. When live credentials are absent the runtime falls back to a local mock so you can develop without any of them.

| Layer | Role in Cortex |
| --- | --- |
| **Sui** | Identity, ownership, and coordination (accounts, registries, capability objects). |
| **Walrus** | Durable, decentralized storage for session and memory blobs. |
| **Seal** | Threshold encryption and on-chain access gating. |
| **MemWal** | Persistent memory namespaces and semantic recall. |

Durable blobs are always encrypted client-side before reaching Walrus. Seal threshold encryption is used when key servers are configured (new blobs carry a `0x02` tag); a wallet-derived AES-GCM scheme is the fallback (`0x01`), and untagged legacy blobs are read as AES.

## Repository layout

A pnpm workspace with three packages plus the Move contracts.

```text
frontend/                  cortex-frontend: the Next.js app (the product)
backend/
  mcp/                     cortex-mcp: the runtime + MCP server
    src/core/              the Cortex facade (cortex.ts), config, sync, models, artifacts
    sui/                   Sui / Walrus / Seal / MemWal client wiring
    server.ts             memory, agents, loops, execution, and connector tools
  sui/
    contract/cortex/       the Cortex Move package (deployed to mainnet)
docs/                      cortex-docs: the documentation site (Vocs)
```

The main entry point is the `Cortex` class in `backend/mcp/src/core/cortex.ts`. Core artifact types (`Source`, `Memory`, `Extraction`, `MemoryDiff`, `NamespaceManifest`) live in `backend/mcp/src/core/models.ts`.

## Getting started

Requirements: Node.js 20+ and pnpm 9.

```bash
pnpm install
pnpm dev          # the Next.js app at http://localhost:3000
```

Other entry points:

```bash
pnpm demo         # run the core memory pipeline (seed, consolidate, diff, verify)
pnpm dev:mcp      # MCP server over stdio, watch mode
pnpm start:mcp:http   # MCP server over Streamable HTTP at /mcp on :8787
pnpm dev:docs     # the docs site
```

### Common commands

All run from the repo root.

- **Develop:** `pnpm dev`, `pnpm dev:mcp`, `pnpm dev:docs`
- **Build:** `pnpm build` (app), `pnpm build:docs`, `pnpm build:all` (every package)
- **Run a build:** `pnpm start`, `pnpm start:docs`, `pnpm start:mcp` / `pnpm start:mcp:http`
- **Quality:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format`

## Configuration

There are two config surfaces, and both default to a working mock mode when unset.

**Frontend** (`frontend/.env.example` to `frontend/.env.local`): Privy auth, client-side Sui and Walrus endpoints, the deployed Cortex package and registry ids, Seal key servers and threshold, the MemWal relayer and contract ids, and model-provider keys for the app's API routes. Values exist per network as `_MAINNET` and `_TESTNET` slots.

**Core and MCP runtime** (`backend/mcp/.env.example` to `backend/mcp/.env`): the namespace, Sui RPC and network, Walrus publisher and aggregator, the cortex package and access objects, the MCP delegate wallet (which must hold the `ExecutorCap`), MemWal relayer and keys, Seal servers and threshold, and the model provider and keys. The file is gitignored, loaded on startup, and relocatable via `CORTEX_ENV_FILE`. The core CLI also accepts an optional `config/config.yaml`.

The deployed object ids to fill in are listed in `backend/sui/contract/cortex/DEPLOYMENT.md`.

## Auth and privacy

The app is gated behind sign-in and stores nothing personal in the browser before then, so a signed-out visitor sees a product that does nothing until they authenticate. Any action opens the Privy sign-in flow, and new users go through onboarding. On sign-out, everything the browser held for that user (profile, onboarding flag, key vault, MemWal credentials, session) is wiped; only device and UI preferences remain.

## Deployment

The `cortex` Move package is published to **mainnet**:

```
0x643fbc9d6182493e533a85a49a584a1c08471e2d28e6de842eb183c8d2ed9438
```

The canonical record of the package id, shared registries, and capability objects lives in `backend/sui/contract/cortex/DEPLOYMENT.md`. The MCP server is hosted at `mcp.usecortexai.xyz` and the web app on Vercel.

## Further reading

- `AGENTIC-LOOPS.md`: the agent loop runtime and design.
- `backend/sui/contract/cortex/DEPLOYMENT.md`: on-chain ids and how to wire them.
- `docs/`: the full documentation site.

## Tech stack

Next.js, React, TypeScript, Tailwind CSS, Radix UI, Sui, Walrus, Seal, MemWal, and MCP.
