# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

"""
Apply DDL to Supabase via the pg_meta / postgres REST API.
Uses the service role JWT to execute raw SQL through the rpc endpoint.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL  = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY   = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("[ERR] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
    sys.exit(1)

HEADERS = {
    "apikey":        SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal",
}

# ── 1. Check if `outcome` column already exists on fixtures ──────────────────
print("\n[1] Checking fixtures schema...")
schema_url = f"{SUPABASE_URL}/rest/v1/fixtures?limit=1"
r = requests.get(schema_url, headers=HEADERS)
sample = r.json()
if isinstance(sample, list) and sample:
    cols = list(sample[0].keys())
    print(f"    Columns in fixtures: {cols}")
    has_outcome = "outcome" in cols
else:
    cols = []
    has_outcome = False
    print(f"    [WARN] Unexpected response: {sample}")

if has_outcome:
    print("    [OK] 'outcome' column already exists on fixtures.")
else:
    print("    [WARN] 'outcome' column MISSING from fixtures.")

# ── 2. Check if match_features table exists ──────────────────────────────────
print("\n[2] Checking match_features table...")
mf_url = f"{SUPABASE_URL}/rest/v1/match_features?limit=1"
r2 = requests.get(mf_url, headers=HEADERS)
if r2.status_code == 200:
    print("    [OK] match_features table exists.")
    mf_exists = True
elif r2.status_code == 404 or (r2.status_code == 400 and "PGRST" in r2.text):
    print("    [WARN] match_features table does NOT exist.")
    mf_exists = False
else:
    print(f"    [INFO] match_features status {r2.status_code}: {r2.text[:200]}")
    mf_exists = "PGRST205" not in r2.text

# ── 3. Apply DDL via the Supabase SQL query function ─────────────────────────
# Supabase exposes a generic SQL endpoint via the pg API.
# We use /rest/v1/rpc/... but for raw DDL we need postgres-meta or the
# management API. The simplest approach: call the sql function via rpc
# (requires the function to exist) OR use the management API.

MANAGEMENT_KEY = SERVICE_KEY  # service role works for management calls too

PROJECT_REF = SUPABASE_URL.replace("https://", "").split(".supabase.co")[0]
print(f"\n[3] Project ref: {PROJECT_REF}")

# Supabase management API: POST /v1/projects/{ref}/database/query
mgmt_url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

DDL_SQL = """
-- Add outcome column to fixtures
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS outcome TEXT;

-- Create match_features table for Random Forest
CREATE TABLE IF NOT EXISTS match_features (
    id                        SERIAL PRIMARY KEY,
    fixture_id                UUID REFERENCES fixtures(id),
    home_avg_pts_scored       FLOAT,
    home_avg_raid_pts         FLOAT,
    home_avg_tackle_pts       FLOAT,
    home_super_raids_per_g    FLOAT,
    home_super_tackles_per_g  FLOAT,
    home_all_outs_infl_per_g  FLOAT,
    home_all_outs_conc_per_g  FLOAT,
    home_wins                 INT,
    home_losses               INT,
    home_ties                 INT,
    away_avg_pts_scored       FLOAT,
    away_avg_raid_pts         FLOAT,
    away_avg_tackle_pts       FLOAT,
    away_super_raids_per_g    FLOAT,
    away_super_tackles_per_g  FLOAT,
    away_all_outs_infl_per_g  FLOAT,
    away_all_outs_conc_per_g  FLOAT,
    away_wins                 INT,
    away_losses               INT,
    away_ties                 INT,
    outcome                   TEXT NOT NULL
);
"""

print(f"\n[4] Posting DDL to Supabase management API...")
mgmt_headers = {
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type":  "application/json",
}
payload = {"query": DDL_SQL}

resp = requests.post(mgmt_url, headers=mgmt_headers, json=payload)
print(f"    Status: {resp.status_code}")
print(f"    Body:   {resp.text[:500]}")

if resp.status_code in (200, 201):
    print("\n    [OK] DDL applied successfully via management API!")
    ddl_ok = True
else:
    print("\n    [WARN] Management API failed. Trying alternate approach...")
    # Fallback: use Supabase's postgres-meta via the REST API with exec
    # The service_role has superuser on Supabase for the project DB
    # We can try the pg_meta endpoint which is available at /pg/query
    alt_url = f"https://{PROJECT_REF}.supabase.co/rest/v1/rpc/exec_sql"
    alt_resp = requests.post(alt_url, headers=HEADERS, json={"sql": DDL_SQL})
    print(f"    Alt status: {alt_resp.status_code} | {alt_resp.text[:300]}")
    ddl_ok = alt_resp.status_code in (200, 201)

# ── 5. Verify ────────────────────────────────────────────────────────────────
print("\n[5] Re-verifying tables...")

r3 = requests.get(f"{SUPABASE_URL}/rest/v1/fixtures?limit=1", headers=HEADERS)
if r3.status_code == 200:
    data = r3.json()
    if data and "outcome" in data[0]:
        print("    [OK] 'outcome' column confirmed on fixtures!")
    else:
        cols_now = list(data[0].keys()) if data else []
        print(f"    [WARN] 'outcome' still missing. Current cols: {cols_now}")
else:
    print(f"    [WARN] Could not re-check fixtures: {r3.status_code}")

r4 = requests.get(f"{SUPABASE_URL}/rest/v1/match_features?limit=1", headers=HEADERS)
if r4.status_code == 200:
    print("    [OK] match_features table confirmed!")
else:
    print(f"    [WARN] match_features still not accessible ({r4.status_code}).")
    print()
    print("    ====================================================")
    print("    ACTION REQUIRED: Run this SQL in Supabase SQL Editor")
    print("    https://supabase.com/dashboard/project/" + PROJECT_REF + "/sql/new")
    print("    ====================================================")
    print()
    print(DDL_SQL)
