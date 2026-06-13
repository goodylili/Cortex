#!/usr/bin/env bash
set -euo pipefail
# Seed a namespace with sample sources and run an extract + consolidate pass on the mock.
node backend/dist/cli.js demo
