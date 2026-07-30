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

# A quiet tree is not necessarily a valid one: an agent can pause mid-edit
# between writing a reference and writing its declaration. Keep re-checking
# until the tree both settles AND compiles, rather than failing on the first
# look at a half-written file.
check_all() {
  npx tsc --noEmit || return 1
  npx vitest run --silent >/dev/null || return 1
  # Typecheck alone does not catch a broken import graph or a missing
  # stylesheet; only the bundler resolves everything.
  npx vite build --logLevel error >/dev/null || return 1
  return 0
}

# The checks take ~30s, and an agent can write a file during that window — so
# a tree that passed is not necessarily the tree that gets staged. Fingerprint
# the sources before and after; if anything moved, the result is stale and the
# whole cycle repeats. Without this, `git add -A` can commit a file that was
# never checked, which is exactly how a mid-write puzzle module reached CI.
fingerprint() {
  find src tools docs public index.html package.json -type f \
    -not -path '*/node_modules/*' -not -path '*/.git/*' \
    -printf '%p %T@\n' 2>/dev/null | sort | md5sum
}

attempt=0
while :; do
  before="$(fingerprint)"
  if check_all && [ "$before" = "$(fingerprint)" ]; then
    break
  fi
  attempt=$((attempt + 1))
  if [ "$((waited + attempt * 30))" -ge "$MAX_WAIT" ]; then
    echo "safe-commit: REFUSING to commit — tree never reached a valid quiet state in ${MAX_WAIT}s" >&2
    exit 1
  fi
  if [ "$before" != "$(fingerprint)" ]; then
    echo "safe-commit: tree changed during validation (attempt ${attempt}) — rechecking in 30s"
  else
    echo "safe-commit: tree does not build yet (attempt ${attempt}); an agent is mid-edit — waiting 30s"
  fi
  sleep 30
done

git add -A
git commit -q -m "$MSG"
echo "safe-commit: committed — $(git log --oneline -1)"
