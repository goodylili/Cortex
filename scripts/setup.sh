#!/usr/bin/env bash
set -euo pipefail
echo "cortex setup"
[ -f config/config.yaml ] || cp config/config.example.yaml config/config.yaml
pnpm install
pnpm --filter @cortex/backend build
echo "done. edit config/config.yaml, then: cortex demo"
