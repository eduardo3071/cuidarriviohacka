#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/web"
npm install --no-audit --no-fund
case "$1" in
  dev) exec npx vite --host 0.0.0.0 --port 8080 --strictPort ;;
  build) npx vite build ;;
  build:dev) npx tsc --noEmit && npx vite build --mode development ;;
esac
# Lovable publica o dist/ da RAIZ do repositorio; o vite escreve em apps/web/dist.
rm -rf "$ROOT/dist"
cp -r dist "$ROOT/dist"
