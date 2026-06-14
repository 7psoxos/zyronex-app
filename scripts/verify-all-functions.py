#!/usr/bin/env python3
"""
Verifies:
  1. claude-proxy:         normal call returns HTTP 200 with valid content array
  2. admin-usage:          returns 200 for the super-admin shop_id
  3. admin-usage:          returns 403 for an unknown shop_id
  4. admin-secrets:        returns 200 (keys all null) for super-admin shop_id
  5. admin-secrets:        returns 403 for an unknown shop_id
  6. admin-ticket-notes:   returns 200 {notes:[]} for super-admin + valid ticket_id
  7. admin-ticket-notes:   returns 403 for an unknown shop_id
"""
import json, sys, urllib.request, urllib.error

BASE = "https://wopyucsdaeamywscxfzs.supabase.co/functions/v1"
SUPER_ADMIN = "c162329a-ecd9-44d3-b3fc-f107fe101590"
RANDO       = "00000000-0000-0000-0000-000000000000"

def post(url, body, label):
    data = json.dumps(body).encode()
    req  = urllib.request.Request(url, data=data,
           headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')

failures = []

# ── 1. claude-proxy normal call ──────────────────────────────────────────────
print("\n=== claude-proxy normal call ===")
status, d = post(BASE + "/claude-proxy", {
    "model": "claude-sonnet-4-6",
    "max_tokens": 16,
    "system": "You are a helpful assistant.",
    "messages": [{"role": "user", "content": "Say OK"}]
}, "claude-proxy")
content = d.get("content", [])
has_content = bool(content and isinstance(content, list) and content[0].get("text"))
print(f"  HTTP {status}  content valid: {has_content}")
print(f"  content[0].text: {content[0].get('text','') if content else 'N/A'}")
print(f"  usage: {d.get('usage')}")
if status != 200 or not has_content:
    failures.append(f"claude-proxy: expected 200+content, got {status} has_content={has_content}")

# ── 2. admin-usage with super-admin shop_id ───────────────────────────────────
print("\n=== admin-usage (super-admin) ===")
status2, d2 = post(BASE + "/admin-usage", {"shop_id": SUPER_ADMIN, "days": 7}, "admin-usage 200")
print(f"  HTTP {status2}")
if status2 == 200:
    print(f"  days={d2.get('days')}  totals.calls={d2.get('totals',{}).get('calls','?')}")
else:
    print(f"  body: {d2}")
if status2 != 200:
    failures.append(f"admin-usage (super-admin): expected 200, got {status2}")

# ── 3. admin-usage with unknown shop_id ──────────────────────────────────────
print("\n=== admin-usage (unknown shop_id → 403) ===")
status3, d3 = post(BASE + "/admin-usage", {"shop_id": RANDO}, "admin-usage 403")
print(f"  HTTP {status3}  body: {d3}")
if status3 != 403:
    failures.append(f"admin-usage (rando): expected 403, got {status3}")

# ── 4. admin-secrets with super-admin shop_id (keys should all be null) ──────
print("\n=== admin-secrets (super-admin, action=get) ===")
status4, d4 = post(BASE + "/admin-secrets", {"shop_id": SUPER_ADMIN, "action": "get"}, "admin-secrets 200")
print(f"  HTTP {status4}")
if status4 == 200:
    keys = d4.get("keys", {})
    print(f"  keys: {keys}")
    print(f"  models: {d4.get('models')}")
    print(f"  order: {d4.get('order')}")
else:
    print(f"  body: {d4}")
if status4 != 200:
    failures.append(f"admin-secrets (super-admin): expected 200, got {status4}")

# ── 5. admin-secrets with unknown shop_id ────────────────────────────────────
print("\n=== admin-secrets (unknown shop_id → 403) ===")
status5, d5 = post(BASE + "/admin-secrets", {"shop_id": RANDO, "action": "get"}, "admin-secrets 403")
print(f"  HTTP {status5}  body: {d5}")
if status5 != 403:
    failures.append(f"admin-secrets (rando): expected 403, got {status5}")

# ── 6. admin-ticket-notes with super-admin (empty notes list) ────────────────
print("\n=== admin-ticket-notes (super-admin, action=list) ===")
NULL_TICKET = "00000000-0000-0000-0000-000000000000"
status6, d6 = post(BASE + "/admin-ticket-notes", {"shop_id": SUPER_ADMIN, "action": "list", "ticket_id": NULL_TICKET}, "admin-ticket-notes 200")
print(f"  HTTP {status6}")
if status6 == 200:
    notes = d6.get("notes", "MISSING")
    print(f"  notes: {notes}")
else:
    print(f"  body: {d6}")
if status6 != 200:
    failures.append(f"admin-ticket-notes (super-admin): expected 200, got {status6}")
elif not isinstance(d6.get("notes"), list):
    failures.append(f"admin-ticket-notes: expected {{notes:[]}}, got {d6}")

# ── 7. admin-ticket-notes with unknown shop_id ───────────────────────────────
print("\n=== admin-ticket-notes (unknown shop_id → 403) ===")
status7, d7 = post(BASE + "/admin-ticket-notes", {"shop_id": RANDO, "action": "list", "ticket_id": "x"}, "admin-ticket-notes 403")
print(f"  HTTP {status7}  body: {d7}")
if status7 != 403:
    failures.append(f"admin-ticket-notes (rando): expected 403, got {status7}")

# ── Report ────────────────────────────────────────────────────────────────────
print()
if failures:
    for f in failures:
        print(f"FAIL: {f}")
    sys.exit(1)
else:
    print("ALL CHECKS PASSED")
    print(f"  claude-proxy: 200 + content ✓")
    print(f"  admin-usage super-admin:        200 ✓")
    print(f"  admin-usage unknown:            403 ✓")
    print(f"  admin-secrets super-admin:      200 ✓")
    print(f"  admin-secrets unknown:          403 ✓")
    print(f"  admin-ticket-notes super-admin: 200 ✓")
    print(f"  admin-ticket-notes unknown:     403 ✓")
