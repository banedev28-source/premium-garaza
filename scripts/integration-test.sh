#!/bin/bash
BASE="http://localhost:3000"
PASS=0
FAIL=0
ERRORS=""
COOKIEDIR="$(cd "$(dirname "$0")/.." && pwd)/.test-cookies"
mkdir -p "$COOKIEDIR"

check() {
  local desc="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    echo "  PASS: $desc"
    ((PASS++))
  else
    echo "  FAIL: $desc"
    ((FAIL++))
    ERRORS="${ERRORS}\n  - ${desc}"
  fi
}

contains() { [[ "$1" == *"$2"* ]]; }
not_contains() { [[ "$1" != *"$2"* ]]; }
status_is() { [[ "$1" == "$2" ]]; }

# Helper: login and return cookie file path
do_login() {
  local email="$1"
  local password="$2"
  local name="$3"
  local jar="$COOKIEDIR/${name}.txt"
  # Get CSRF token
  curl -s -c "$jar" "$BASE/api/auth/csrf" > "$COOKIEDIR/${name}_csrf.json"
  local csrf=$(cat "$COOKIEDIR/${name}_csrf.json" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
  # Login
  curl -s -c "$jar" -b "$jar" \
    -X POST "$BASE/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -H "Origin: $BASE" \
    -d "email=${email}&password=${password}&redirect=false&csrfToken=${csrf}&json=true" \
    -L -o /dev/null 2>/dev/null
  echo "$jar"
}

echo "=========================================="
echo "  COMPREHENSIVE INTEGRATION TEST SUITE"
echo "=========================================="
echo ""

# ═══════════ 1. SECURITY HEADERS ═══════════
echo "[1/22] Security Headers"
H=$(curl -sI "$BASE/login")

check "Content-Security-Policy present" contains "$H" "Content-Security-Policy"
check "CSP allows Pusher WSS" contains "$H" "wss://*.pusher.com"
check "X-Frame-Options: DENY" contains "$H" "X-Frame-Options: DENY"
check "X-Content-Type-Options: nosniff" contains "$H" "nosniff"
check "Referrer-Policy present" contains "$H" "Referrer-Policy"
check "Permissions-Policy present" contains "$H" "Permissions-Policy"
check "HSTS present" contains "$H" "Strict-Transport-Security"
check "frame-ancestors none in CSP" contains "$H" "frame-ancestors 'none'"

# ═══════════ 2. CSRF PROTECTION ═══════════
echo ""
echo "[2/22] CSRF Protection"
C1=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auctions" -H "Content-Type: application/json" -d '{}')
check "POST without Origin = 403" status_is "$C1" "403"

C2=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/users/x")
check "DELETE without Origin = 403" status_is "$C2" "403"

C3=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/users/x" -H "Content-Type: application/json" -d '{}')
check "PATCH without Origin = 403" status_is "$C3" "403"

C4=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/auctions")
check "GET not blocked by CSRF" not_contains "$C4" "403"

# Cron exempt from CSRF
C5=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cron/auction-lifecycle")
check "Cron exempt from CSRF (401 not 403)" status_is "$C5" "401"

# ═══════════ 3. PWA ═══════════
echo ""
echo "[3/22] PWA"
check "manifest.json = 200" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/manifest.json")" "200"

MANIFEST=$(curl -s "$BASE/manifest.json")
check "manifest has name" contains "$MANIFEST" "Aukcija"
check "manifest has icons" contains "$MANIFEST" "icons"
check "manifest has screenshots" contains "$MANIFEST" "screenshots"
check "manifest has display:standalone" contains "$MANIFEST" "standalone"
check "manifest has start_url" contains "$MANIFEST" "start_url"
check "manifest has id" contains "$MANIFEST" '"id"'

check "sw.js = 200" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/sw.js")" "200"
check "icon-72 = 200" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/icon-72x72.png")" "200"
check "icon-96 = 200" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/icon-96x96.png")" "200"
check "icon-128 = 200" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/icon-128x128.png")" "200"
check "icon-144 = 200" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/icon-144x144.png")" "200"
check "icon-152 = 200" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/icon-152x152.png")" "200"
check "icon-192 = 200" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/icon-192x192.png")" "200"
check "icon-384 = 200" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/icon-384x384.png")" "200"
check "icon-512 = 200" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/icon-512x512.png")" "200"
check "offline page = 200" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/offline")" "200"

# ═══════════ 4. AUTH ═══════════
echo ""
echo "[4/22] Authentication"

# Admin login
ADMIN_JAR=$(do_login "admin%40aukcija.rs" "admin123" "admin")
AS=$(curl -s -b "$ADMIN_JAR" "$BASE/api/auth/session")
check "Admin login succeeds" contains "$AS" "admin@aukcija.rs"
check "Admin has ADMIN role" contains "$AS" "ADMIN"

# Buyer login
BUYER_JAR=$(do_login "kupac%40aukcija.rs" "buyer123" "buyer")
BS=$(curl -s -b "$BUYER_JAR" "$BASE/api/auth/session")
check "Buyer login succeeds" contains "$BS" "kupac@aukcija.rs"
check "Buyer has BUYER role" contains "$BS" "BUYER"

# Wrong password
WRONG_JAR=$(do_login "admin%40aukcija.rs" "WRONG" "wrong")
WS=$(curl -s -b "$WRONG_JAR" "$BASE/api/auth/session")
check "Wrong password = no session" not_contains "$WS" "admin@aukcija.rs"

# ═══════════ 5. API AUTH PROTECTION ═══════════
echo ""
echo "[5/22] API Auth Protection (no session)"
check "Auctions 401" contains "$(curl -s "$BASE/api/auctions")" "Unauthorized"
check "Vehicles 401" contains "$(curl -s "$BASE/api/vehicles")" "Unauthorized"
check "Users 401" contains "$(curl -s "$BASE/api/users")" "Unauthorized"
check "Notifications 401" contains "$(curl -s "$BASE/api/notifications")" "Unauthorized"
check "My-bids 401" contains "$(curl -s "$BASE/api/my-bids")" "Unauthorized"
check "Won-auctions 401" contains "$(curl -s "$BASE/api/won-auctions")" "Unauthorized"

# ═══════════ 6. ADMIN API ═══════════
echo ""
echo "[6/22] Admin API"
AA=$(curl -s -b $ADMIN_JAR "$BASE/api/auctions")
check "Admin can list auctions" contains "$AA" "["

AV=$(curl -s -b $ADMIN_JAR "$BASE/api/vehicles")
check "Admin can list vehicles" contains "$AV" "["

AU=$(curl -s -b $ADMIN_JAR "$BASE/api/users")
check "Admin can list users" contains "$AU" "["

# ═══════════ 7. BUYER API ═══════════
echo ""
echo "[7/22] Buyer API"
BA=$(curl -s -b $BUYER_JAR "$BASE/api/auctions")
check "Buyer can list auctions" contains "$BA" "["

BM=$(curl -s -b $BUYER_JAR "$BASE/api/my-bids")
check "Buyer can list my-bids" contains "$BM" "["

BW=$(curl -s -b $BUYER_JAR "$BASE/api/won-auctions")
check "Buyer can list won-auctions" contains "$BW" "["

BN=$(curl -s -b $BUYER_JAR "$BASE/api/notifications")
check "Buyer can list notifications" contains "$BN" "["

# ═══════════ 8. ROLE ISOLATION ═══════════
echo ""
echo "[8/22] Role Isolation"
BU=$(curl -s -b $BUYER_JAR "$BASE/api/users")
check "Buyer cant list users" contains "$BU" "Unauthorized"

BC=$(curl -s -o /dev/null -w "%{http_code}" -b $BUYER_JAR -X POST "$BASE/api/auctions" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{}')
check "Buyer cant create auction" status_is "$BC" "401"

AB=$(curl -s -o /dev/null -w "%{http_code}" -b $ADMIN_JAR -X POST "$BASE/api/auctions/x/bid" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"amount":1}')
check "Admin cant bid" status_is "$AB" "403"

BI=$(curl -s -o /dev/null -w "%{http_code}" -b $BUYER_JAR -X POST "$BASE/api/users/invite" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"email":"x@x.rs","role":"BUYER"}')
check "Buyer cant invite" status_is "$BI" "401"

# ═══════════ 9. INVITE TOKEN SECURITY ═══════════
echo ""
echo "[9/22] Invite Token Security"
INV=$(curl -s -b $ADMIN_JAR -X POST "$BASE/api/users/invite" -H "Content-Type: application/json" -H "Origin: $BASE" -d "{\"email\":\"sectest_${RANDOM}@test.rs\",\"role\":\"BUYER\"}")
check "No inviteToken in response" not_contains "$INV" "inviteToken"
check "inviteLink in response" contains "$INV" "inviteLink"

# ═══════════ 10. INVITE VALIDATION ═══════════
echo ""
echo "[10/22] Invite Validation"
check "Invalid token = 404" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/invite/validate?token=fakefake")" "404"
check "Accept invalid token = 404" status_is "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/invite/accept" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"token":"fake","password":"StrongPw1","name":"T"}')" "404"

# ═══════════ 11. PASSWORD POLICY ═══════════
echo ""
echo "[11/22] Password Policy"
PP1=$(curl -s -X POST "$BASE/api/invite/accept" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"token":"x","password":"Ab1","name":"T"}')
check "Short password rejected" contains "$PP1" "error"

PP2=$(curl -s -X POST "$BASE/api/invite/accept" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"token":"x","password":"nouppercase1","name":"T"}')
check "No uppercase rejected" contains "$PP2" "error"

PP3=$(curl -s -X POST "$BASE/api/invite/accept" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"token":"x","password":"NoNumberHere","name":"T"}')
check "No number rejected" contains "$PP3" "error"

PP4=$(curl -s -X POST "$BASE/api/invite/accept" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"token":"x","password":"nolowercasehere1","name":"T"}')
check "No lowercase rejected" contains "$PP4" "error"

# ═══════════ 12. BID VALIDATION ═══════════
echo ""
echo "[12/22] Bid Validation"
check "Negative bid = 400" status_is "$(curl -s -o /dev/null -w '%{http_code}' -b $BUYER_JAR -X POST "$BASE/api/auctions/x/bid" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"amount":-1}')" "400"
check "Zero bid = 400" status_is "$(curl -s -o /dev/null -w '%{http_code}' -b $BUYER_JAR -X POST "$BASE/api/auctions/x/bid" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"amount":0}')" "400"
check "String bid = 400" status_is "$(curl -s -o /dev/null -w '%{http_code}' -b $BUYER_JAR -X POST "$BASE/api/auctions/x/bid" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"amount":"abc"}')" "400"

# ═══════════ 13. CRON AUTH ═══════════
echo ""
echo "[13/22] Cron Auth"
check "Cron no auth = 401" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/cron/auction-lifecycle")" "401"
check "Cron wrong secret = 401" status_is "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/cron/auction-lifecycle" -H 'Authorization: Bearer wrong')" "401"

# ═══════════ 14. PUSHER AUTH ═══════════
echo ""
echo "[14/22] Pusher Auth"
check "Pusher no session = 401" status_is "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/pusher/auth" -H "Origin: $BASE" -H "Content-Type: application/x-www-form-urlencoded" -d 'socket_id=1.1&channel_name=private-user-x')" "401"
check "Pusher wrong channel = 403" status_is "$(curl -s -o /dev/null -w '%{http_code}' -b $BUYER_JAR -X POST "$BASE/api/pusher/auth" -H "Origin: $BASE" -H "Content-Type: application/x-www-form-urlencoded" -d 'socket_id=1.1&channel_name=private-user-WRONG')" "403"

# ═══════════ 15. UPLOAD MAGIC BYTES ═══════════
echo ""
echo "[15/22] Upload Magic Bytes"
echo "This is not an image" > "$COOKIEDIR/fake.jpg"
UF=$(curl -s -o /dev/null -w "%{http_code}" -b "$ADMIN_JAR" -X POST "$BASE/api/upload" -H "Origin: $BASE" -F "file=@$COOKIEDIR/fake.jpg;type=image/jpeg")
check "Fake image rejected (400)" status_is "$UF" "400"

# ═══════════ 16. ERROR HANDLING ═══════════
echo ""
echo "[16/22] Error Handling"
check "Non-existent auction = 404" status_is "$(curl -s -o /dev/null -w '%{http_code}' -b $ADMIN_JAR "$BASE/api/auctions/nonexistent123")" "404"

# ═══════════ 17. SELF-DELETE PROTECTION ═══════════
echo ""
echo "[17/22] Self-Delete Protection"
ADMIN_ID=$(echo "$AS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$ADMIN_ID" ]; then
  SD=$(curl -s -o /dev/null -w "%{http_code}" -b $ADMIN_JAR -X DELETE "$BASE/api/users/$ADMIN_ID" -H "Origin: $BASE")
  check "Admin cannot delete self (400)" status_is "$SD" "400"
fi

# ═══════════ 18. PAGINATION ═══════════
echo ""
echo "[18/22] Pagination"
check "Auctions page=1&limit=1" contains "$(curl -s -b $ADMIN_JAR "$BASE/api/auctions?page=1&limit=1")" "["
check "My-bids page=1&limit=1" contains "$(curl -s -b $BUYER_JAR "$BASE/api/my-bids?page=1&limit=1")" "["
check "Won-auctions page=1&limit=1" contains "$(curl -s -b $BUYER_JAR "$BASE/api/won-auctions?page=1&limit=1")" "["

# ═══════════ 19. STATUS FILTER VALIDATION ═══════════
echo ""
echo "[19/22] Status Filter Validation"
check "Invalid status param ignored safely" contains "$(curl -s -b $ADMIN_JAR "$BASE/api/auctions?status=HACKED")" "["
check "LIVE status filter works" contains "$(curl -s -b $ADMIN_JAR "$BASE/api/auctions?status=LIVE")" "["
check "ENDED status filter works" contains "$(curl -s -b $ADMIN_JAR "$BASE/api/auctions?status=ENDED")" "["

# ═══════════ 20. BUYER AUCTION VISIBILITY ═══════════
echo ""
echo "[20/22] Buyer Auction Visibility"
BA2=$(curl -s -b $BUYER_JAR "$BASE/api/auctions")
check "Buyer sees no DRAFT auctions" not_contains "$BA2" '"status":"DRAFT"'
check "Buyer sees no ARCHIVED auctions" not_contains "$BA2" '"status":"ARCHIVED"'

# ═══════════ 21. NOTIFICATIONS ═══════════
echo ""
echo "[21/22] Notifications"
NR=$(curl -s -o /dev/null -w "%{http_code}" -b $BUYER_JAR -X PATCH "$BASE/api/notifications" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"markAllRead":true}')
check "Mark all read = 200" status_is "$NR" "200"

# ═══════════ 22. STATUS TRANSITIONS ═══════════
echo ""
echo "[22/22] Status Transitions (invalid)"
# Try invalid transitions
FIRST_ENDED=$(curl -s -b $ADMIN_JAR "$BASE/api/auctions?status=ENDED" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$FIRST_ENDED" ]; then
  check "ENDED->LIVE rejected (400)" status_is "$(curl -s -o /dev/null -w '%{http_code}' -b $ADMIN_JAR -X PATCH "$BASE/api/auctions/$FIRST_ENDED" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"status":"LIVE"}')" "400"
  check "ENDED->DRAFT rejected (400)" status_is "$(curl -s -o /dev/null -w '%{http_code}' -b $ADMIN_JAR -X PATCH "$BASE/api/auctions/$FIRST_ENDED" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"status":"DRAFT"}')" "400"
else
  echo "  SKIP: No ENDED auctions for transition test"
fi

# ═══════════ CLEANUP & SUMMARY ═══════════
rm -rf "$COOKIEDIR"

echo ""
echo "=========================================="
echo "  RESULTS: $PASS PASS / $FAIL FAIL"
echo "  Total: $((PASS + FAIL)) tests"
echo "=========================================="
if [ "$FAIL" -gt 0 ]; then
  echo -e "\nFailed tests:$ERRORS"
fi
