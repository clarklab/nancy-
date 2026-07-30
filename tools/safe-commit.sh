#!/usr/bin/env bash
# Commit only when the working tree is quiescent and actually valid.
#
# Subagents write files in the background, so a naive `git add -A && commit`
# can capture a half-finished edit — which is exactly how CI went red with a
# function that was defined one second before its first caller was written.
#
# Waits for no tracked file to have changed for QUIET seconds, then runs the
# fast checks, then commits. Refuses to commit a tree that does not typecheck.
#
#   tools/safe-commit.sh "commit message" [quiet-seconds] [max-wait-seconds]

set -euo pipefail

MSG="${1:?usage: safe-commit.sh <message> [quiet-seconds] [max-wait]}"
QUIET="${2:-45}"
MAX_WAIT="${3:-600}"

cd "$(dirname "$0")/.."

newest_mtime() {
  # Newest mtime among tracked + untracked files, ignoring build output.
  find src tools docs public index.html package.json -type f \
    -not -path '*/node_modules/*' -not -path '*/.git/*' \
    -printf '%T@\n' 2>/dev/null | sort -rn | head -1
}

waited=0
while :; do
  newest="$(newest_mtime)"
  now="$(date +%s)"
  age=$(printf '%.0f' "$(echo "$now - ${newest:-0}" | bc)")
  if [ "$age" -ge "$QUIET" ]; then
    break
  fi
  if [ "$waited" -ge "$MAX_WAIT" ]; then
    echo "safe-commit: still busy after ${MAX_WAIT}s (newest edit ${age}s ago); committing anyway" >&2
    break
  fi
  sleep 10
  waited=$((waited + 10))
done

if git diff --quiet && git diff --cached --quiet && [ -z "$(git status --porcelain)" ]; then
  echo "safe-commit: nothing to commit"
  exit 0
fi

echo "safe-commit: typechecking…"
if ! npx tsc --noEmit; then
  echo "safe-commit: REFUSING to commit — typecheck failed" >&2
  exit 1
fi

echo "safe-commit: running tests…"
npx vitest run --silent >/dev/null

# Typecheck alone does not catch a broken import graph or a missing stylesheet,
# both of which only surface when the bundler actually resolves everything.
echo "safe-commit: building…"
if ! npx vite build --logLevel error >/dev/null; then
  echo "safe-commit: REFUSING to commit — build failed" >&2
  exit 1
fi

git add -A
git commit -q -m "$MSG"
echo "safe-commit: committed — $(git log --oneline -1)"
