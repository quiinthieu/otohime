#!/bin/bash
# Bounded public GitHub API reads for pm-270 acceptance. Usage: api.sh outdir
out=$1; mkdir -p "$out"; R=https://api.github.com/repos/quiinthieu/otohime
get() { curl -sS -H 'Accept: application/vnd.github+json' -D "$out/$1.hdr" -o "$out/$1.json" "$2"; echo "$1 $(head -1 "$out/$1.hdr" | tr -d '\r') rem=$(grep -i x-ratelimit-remaining "$out/$1.hdr" | tr -d '\r' | awk '{print $2}')"; }
get runs-latest "$R/actions/workflows/ci.yml/runs?branch=main&event=push&per_page=30"
get runs-failure "$R/actions/workflows/ci.yml/runs?branch=main&status=failure&per_page=30"
get runs-success "$R/actions/workflows/ci.yml/runs?branch=main&status=success&per_page=30"
get runs-cancelled "$R/actions/workflows/ci.yml/runs?branch=main&status=cancelled&per_page=10"
get runs-inprogress "$R/actions/workflows/ci.yml/runs?branch=main&status=in_progress&per_page=10"
get runs-queued "$R/actions/workflows/ci.yml/runs?branch=main&status=queued&per_page=10"
for s in 8b9826587572145c935e52d41b652938e48a2116 3dc10f8; do full=$(git -C "$2" rev-parse $s); get "headsha-$s" "$R/actions/runs?head_sha=$full"; done
