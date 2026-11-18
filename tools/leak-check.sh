#!/usr/bin/env bash
# Stops the publish when a page contains internal data.
# Usage: tools/leak-check.sh [dir]   (default: repository root)
set -euo pipefail
DIR="${1:-.}"
PATTERNS=(
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'   # internal IDs
  '[A-Z]{2,5}-[0-9]{1,4}\b'                                          # issue keys
  '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}'                      # e-mail
  'gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|sk-[A-Za-z0-9_-]{20,}'     # tokens
  'claude\.ai/'                                                      # private links
)
# Your own forbidden words (server domain, product names, account name):
#   LEAK_WORDS="word1,word2"  — from the environment or a repository secret, not from a file in the repo.
#   LEAK_WORDS_FILE=path      — a local file, one word per line (do not commit it).
EXTRA="${LEAK_WORDS_FILE:-}"
IFS=',' read -r -a WORDS <<< "${LEAK_WORDS:-}"
fail=0
while IFS= read -r -d '' f; do
  for p in "${PATTERNS[@]}"; do
    if hits=$(grep -n -o -E -e "$p" "$f" | grep -v -E 'UTF-8|ISO-8601|RFC-[0-9]+' | head -5) && [ -n "$hits" ]; then
      echo "LEAK in $f (pattern: $p):"; echo "$hits" | sed 's/^/  /'; fail=1
    fi
  done
  for w in "${WORDS[@]:-}"; do
    [ -z "$w" ] && continue
    if grep -q -i -F -e "$w" "$f"; then echo "LEAK in $f: a forbidden word from LEAK_WORDS"; fail=1; fi
  done
  if [ -n "$EXTRA" ] && [ -f "$EXTRA" ]; then
    while IFS= read -r w; do
      [ -z "$w" ] && continue
      if grep -q -i -F -e "$w" "$f"; then echo "LEAK in $f: word '$w'"; fail=1; fi
    done < "$EXTRA"
  fi
done < <(find "$DIR" -type f \( -name '*.html' -o -name '*.json' -o -name '*.js' -o -name '*.md' \) -not -path '*/.git/*' -not -path '*/tools/*' -not -path '*/.github/*' -print0)
if [ "$fail" -ne 0 ]; then echo "FAIL: remove the data above before you publish."; exit 1; fi
echo "OK: no internal data found."
