#!/usr/bin/env bash
# Check or configure the owner identity used for this repository. No global config is changed.
set -euo pipefail

usage() { echo "Usage: bash scripts/setup-owner-git.sh [--check|--configure]" >&2; }
if [ "$#" -gt 1 ]; then usage; exit 2; fi
mode="${1:---check}"
case "$mode" in --check|--configure) ;; *) usage; exit 2 ;; esac
script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
checkout_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$checkout_root" ] || [ "$(cd "$checkout_root" && pwd -P)" != "$script_root" ]; then
  echo "Run this from the Otohime checkout containing this script." >&2
  exit 2
fi

owner_name="Otohime"
owner_email="quiinthieu@gmail.com"
if [ "$mode" = "--configure" ]; then
  # --local is scoped to this clone, but is shared by its linked Git worktrees.
  git config --local --replace-all user.name "$owner_name"
  git config --local --replace-all user.email "$owner_email"
  echo "Configured this clone as $owner_name <$owner_email> (shared by linked worktrees)."
fi

# Git resolves GIT_AUTHOR_EMAIL ahead of user.email. Check the effective email;
# the configured name also satisfies the repository's guestbook delivery check.
author="$(git var GIT_AUTHOR_IDENT 2>/dev/null || true)"
case "$author" in
  *" <$owner_email> "*) echo "Effective commit author: $author" ;;
  *)
    echo "Commit author is not the verified Otohime owner: ${author:-not configured}." >&2
    echo "For the owner's own clone, run: bash scripts/setup-owner-git.sh --configure" >&2
    echo "Check GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, worktree config, and any git commit --author override." >&2
    exit 1
    ;;
esac
