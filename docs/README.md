# Cortex Docs

This directory contains the standalone Vocs-based documentation package for Cortex.

## Run locally

```bash
pnpm install
pnpm dev:docs
```

Or from inside this directory:

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build:docs
```

Or from inside this directory:

```bash
pnpm build
```

## Structure

- `vocs.config.ts`: global docs config, navigation, theme, repo links
- `docs/pages`: MDX pages that back the docs site
- `package.json`: standalone package metadata so the docs can live cleanly on their own

## Repo readiness

The package is configured with its own metadata, scripts, and GitHub edit links so it
can be managed as a dedicated docs project while still living inside the main monorepo.
