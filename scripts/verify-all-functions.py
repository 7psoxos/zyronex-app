#!/usr/bin/env python3
"""
Verifies:
  1. claude-proxy: normal call returns HTTP 200 with valid content array
  2. admin-usage:  returns 200 for the super-admin shop_id
  3. admin-usage:  returns 403 for an unknown shop_id
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

# ── Report ────────────────────────────────────────────────────────────────────
print()
if failures:
    for f in failures:
        print(f"FAIL: {f}")
    sys.exit(1)
else:
    print("ALL CHECKS PASSED")
    print(f"  claude-proxy: 200 + content ✓")
    print(f"  admin-usage super-admin:   200 ✓")
    print(f"  admin-usage unknown:       403 ✓")
