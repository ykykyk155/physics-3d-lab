#!/usr/bin/env bash
# Retry pushing main + gh-pages when github.com:443 is flaky (same issue seen in D1 release).
set -u
cd "D:/vibe coding/DshBot"
REPO="D:/vibe coding/DshBot"
git config http.version HTTP/1.1
git config http.postBuffer 524288000

push_retry() {
  local spec="$1" what="$2" i
  for i in $(seq 1 12); do
    if git push -q --force origin "$spec" 2>/tmp/push_err.txt; then
      echo "PUSH OK   $what (attempt $i)"
      return 0
    fi
    echo "PUSH FAIL $what (attempt $i): $(tail -1 /tmp/push_err.txt)"
    sleep 10
  done
  echo "PUSH GAVEUP $what"
  return 1
}

# 1) main
push_retry "HEAD:refs/heads/main" "main" || exit 1

# 2) site branch = exactly release/physics-3d-lab tree
REL="$REPO/release/physics-3d-lab"
SITE_INDEX="$REPO/.git/gh-pages.index"
rm -f "$SITE_INDEX"
export GIT_INDEX_FILE="$SITE_INDEX"
git read-tree --empty
git --work-tree="$REL" add -A -f -- .
TREE=$(git write-tree)
unset GIT_INDEX_FILE
rm -f "$SITE_INDEX"
if [ -z "$TREE" ]; then echo "write-tree empty"; exit 1; fi
SITE_COMMIT=$(git commit-tree "$TREE" -m "site build $(date '+%Y-%m-%d %H:%M')")
echo "SITE COMMIT $SITE_COMMIT"
push_retry "$SITE_COMMIT:refs/heads/gh-pages" "gh-pages ($(echo $SITE_COMMIT | cut -c1-7))" || exit 1
echo "ALL DONE main=$(git rev-parse --short HEAD) gh-pages=$(echo $SITE_COMMIT | cut -c1-7)"
