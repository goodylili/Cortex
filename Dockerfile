# Cortex MCP server - a long-running HTTP MCP for remote clients (Claude, etc.).
# Built from the pnpm workspace root so the committed lockfile resolves exactly
# what runs locally; only the cortex-mcp package and its deps are installed.
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="/pnpm:$PATH"
RUN corepack enable
# Toolchain for native optional deps (bufferutil / utf-8-validate from ws).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Workspace manifests first, so the install layer is cached across source edits.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY backend/mcp/package.json backend/mcp/package.json
COPY frontend/package.json frontend/package.json
COPY docs/package.json docs/package.json

RUN pnpm install --frozen-lockfile --filter cortex-mcp

# The MCP source (its sui/ and src/ trees live inside backend/mcp).
COPY backend/mcp backend/mcp

WORKDIR /app/backend/mcp
ENV PORT=8080
EXPOSE 8080
CMD ["pnpm", "run", "start:http"]
