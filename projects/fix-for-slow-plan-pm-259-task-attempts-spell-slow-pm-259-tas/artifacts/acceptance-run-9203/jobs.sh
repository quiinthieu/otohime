#!/bin/bash
# jobs.sh outdir runid... : jobs (with steps) per run
out=$1; shift; R=https://api.github.com/repos/quiinthieu/otohime
for r in "$@"; do curl -sS -H 'Accept: application/vnd.github+json' -D "$out/jobs-$r.hdr" -o "$out/jobs-$r.json" "$R/actions/runs/$r/jobs?per_page=20"; echo "$r $(head -1 $out/jobs-$r.hdr|tr -d '\r') rem=$(grep -i x-ratelimit-remaining $out/jobs-$r.hdr|tr -d '\r'|awk '{print $2}')"; done
