#!/bin/bash
BASE="http://localhost:3000"
PASS=0
FAIL=0
ERRORS=""

check() {
  local desc="$1"
  local condition="$2"
  if eval "$condition"; then
    echo "PASS: $desc"
    ((PASS++))
  else
    echo "FAIL: $desc"
    ((FAIL++))
    ERRORS="$ERRORS
  - $desc"
  fi
}
