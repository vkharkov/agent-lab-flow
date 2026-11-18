#!/usr/bin/env bash
# One-time setup: creates a public repository from this folder and turns on GitHub Pages.
# Usage: ./pages-setup.sh <repo-name>      Needs: git, gh (logged in as the owner).
set -euo pipefail
REPO="${1:?Usage: ./pages-setup.sh <repo-name>}"
command -v gh >/dev/null || { echo "Install GitHub CLI: https://cli.github.com"; exit 1; }
OWNER=$(gh api user --jq .login)
echo "Check for internal data..."
bash tools/leak-check.sh .
echo "This will create the PUBLIC repository $OWNER/$REPO and publish these pages."
read -r -p "Type 'publish' to continue: " ok
[ "$ok" = "publish" ] || { echo "Stopped."; exit 1; }
[ -d .git ] || git init -q -b main
git add -A && git commit -q -m "pages: first publish" || true
gh repo create "$OWNER/$REPO" --public --source . --remote origin --push
gh api -X POST "repos/$OWNER/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 \
  || gh api -X PUT "repos/$OWNER/$REPO/pages" -f build_type=workflow >/dev/null
echo "Done. The first build takes about one minute:"
echo "  https://$OWNER.github.io/$REPO/"
