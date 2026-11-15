#!/bin/sh
# Alle automatischen Prüfungen: Regelwerk über mehrere Saisons, Kalibrierung, Browser-Durchlauf
set -e
cd "$(dirname "$0")/.."
node tests/invariants.js 6 7 FCK
node tests/invariants.js 4 19 FCB noassist
QUIET=1 node tests/calib.js
node tests/euro.js 3 VFB 5
if node -e "require('playwright')" 2>/dev/null || NODE_PATH=$(npm root -g) node -e "require('playwright')" 2>/dev/null; then NODE_PATH=$(npm root -g) WEEKS=${WEEKS:-12} node tests/e2e.js && NODE_PATH=$(npm root -g) node tests/e2e-euro.js; else echo "Playwright nicht installiert – Browser-Test übersprungen"; fi
