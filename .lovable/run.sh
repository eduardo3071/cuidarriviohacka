#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../apps/web"
npm install --no-audit --no-fund
case "$1" in
  dev) exec npx vite --host 0.0.0.0 --port 8080 --strictPort ;;
  build) exec npx vite build ;;
  build:dev) npx tsc --noEmit && exec npx vite build --mode development ;;
esac
