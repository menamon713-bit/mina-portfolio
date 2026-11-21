#!/usr/bin/env bash
# Security self-check for your OWN portfolio repo.
# Usage (from repo root):  bash security-check.sh https://mina-portfolio-pied.vercel.app
SITE="${1:-https://mina-portfolio-pied.vercel.app}"
EX="--exclude-dir=.git --exclude-dir=node_modules"

h() { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }

h "1. Secrets in current files"
grep -rInEi $EX "(password|passwd|pwd|secret|api[_-]?key|bearer|private[_-]?key|sk-[A-Za-z0-9]{10,}|mongodb(\+srv)?://|postgres://)" . \
  || echo "OK: nothing found"

h "2. Secrets in git history"
if command -v gitleaks >/dev/null; then
  gitleaks detect --source . -v || true
else
  git log -p 2>/dev/null | grep -iE "(password|passwd|pwd|secret|api[_-]?key|bearer|private[_-]?key|sk-[A-Za-z0-9]{10,}|mongodb\+srv://|postgres://)" | head -20 \
    || true
  echo "(done - install gitleaks for a deeper scan)"
fi

h "3. Things that break your strict CSP (inline script/handlers/styles)"
grep -nP '<script(?![^>]*\bsrc=)' *.html
grep -nE ' on(click|load|submit|change|error|input|keyup)=' *.html
grep -nE ' style="' *.html
grep -nE '<style' *.html
echo "(empty above = OK)"

h "4. Dangerous JS patterns"
grep -nE "innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function" *.js

h "5. Client-side auth smell (auth decided in browser)"
grep -nEi "(localStorage|sessionStorage).*(admin|auth|token|login|role)|isAdmin|if *\(.*(password|pass).*===" admin.js dashboard.js script.js contact.js 2>/dev/null

h "6. External URLs used by the site"
grep -rhoE $EX "https?://[^\"' )<>]+" *.html *.css *.js 2>/dev/null | sort -u

h "7. API files: which ones never mention auth/session?"
if [ -d api ]; then
  ls api
  echo "-- files with NO auth/session/401/403 keyword:"
  grep -rLEi "auth|session|cookie|jwt|401|403" api || true
  echo "-- wildcard CORS:"
  grep -rn "Access-Control-Allow-Origin" api | grep '\*' || echo "OK: none"
  echo "-- input validation hints (look for each endpoint):"
  grep -rnEi "req\.body|req\.query" api | head -20
fi

h "8. Dependencies"
if [ -f package.json ] && command -v npm >/dev/null; then
  npm audit --omit=dev || true
else
  echo "skip (no package.json or npm)"
fi

h "9. Live checks on $SITE (use incognito logic: no cookies)"
for p in / /admin.html /dashboard.html /admin.js /dashboard.js /api /api/contact /.git/config /.env /package.json /vercel.json; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$SITE$p")
  printf "%-18s -> %s\n" "$p" "$code"
done
echo
echo "Expected: /.git/config /.env => 404.  admin/dashboard/api => login page, 401 or 403, NOT real data."
echo "NOTE: /package.json and /vercel.json returning 200 is low risk but remove them from public if you can."

h "10. Security headers"
curl -sI "$SITE" | grep -iE "content-security|strict-transport|x-frame|x-content-type|referrer|permissions|cross-origin"
