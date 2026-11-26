#!/usr/bin/env bash
# Focused retry: push an existing site commit to gh-pages (main already pushed).
set -u
cd "D:/vibe coding/DshBot"
SITE_COMMIT="${1:?site commit hash required}"
git config http.version HTTP/1.1
git config http.postBuffer 524288000
for i in $(seq 1 20); do
  if git push -q --force origin "${SITE_COMMIT}:refs/heads/gh-pages" 2>/tmp/push_site_err.txt; then
    echo "PUSH OK gh-pages (${SITE_COMMIT:0:7}) attempt $i"
    exit 0
  fi
  echo "PUSH FAIL gh-pages attempt $i: $(tail -1 /tmp/push_site_err.txt)"
  sleep 15
done
echo "PUSH GAVEUP gh-pages"
exit 1
