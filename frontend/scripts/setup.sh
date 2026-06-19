#!/usr/bin/env bash
set -euo pipefail
echo "cortex setup"
pnpm install
[ -f config/config.yaml ] || cp config/config.example.yaml config/config.yaml
echo "done. edit config/config.yaml (optional — demo runs on mock infra), then: pnpm demo"
