#!/usr/bin/env bash
# Build the production bundle and publish it to the GitHub Pages branch.
# Usage: bash scripts/deploy-pages.sh [remote-name]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${1:-origin}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT"
echo "▸ building…"
npm run build

echo "▸ staging $ROOT/dist → gh-pages…"
rm -rf "$WORK"/*
cp -R "$ROOT/dist/." "$WORK/"

cd "$WORK"
git init -b gh-pages -q
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-orrery}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-orrery@users.noreply.github.com}" \
    commit -q -m "Deploy $(date -u '+%Y-%m-%d %H:%M UTC')"
git remote add origin "$(git -C "$ROOT" remote get-url "$REMOTE")"
git push -f "$REMOTE" gh-pages

echo "✓ published: https://thomaswu2024.github.io/orrery-solar-system/"
