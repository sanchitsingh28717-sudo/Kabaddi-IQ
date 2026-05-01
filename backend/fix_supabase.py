# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
"""
KabaddiIQ – Supabase Diagnostic & Fix Script
=============================================
This script:
  1. Connects to Supabase and inspects all relevant tables
  2. Reports schema issues, nulls, type mismatches
  3. Fixes fixtures table to correctly flag Tie outcomes
  4. Ensures a `match_outcome` column exists on the fixtures table
  5. Generates a `match_features` table with Win / Loss / Tie labels
     ready for Random Forest training
  6. Inserts synthetic Tie rows (interpolated between Win/Loss feature
     distributions) if real Tie feature rows are too few

Run from the backend/ directory:
    python fix_supabase.py
"""

import os
import sys
import math
import random
import statistics
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_KEY", "")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

SEPARATOR = "─" * 65

# ── helpers ─────────────────────────────────────────────────────────────────
def section(title: str):
    print(f"\n{SEPARATOR}")
    print(f"  {title}")
    print(SEPARATOR)


def ok(msg):    print(f"  [OK]   {msg}")
def warn(msg):  print(f"  [WARN] {msg}")
def err(msg):   print(f"  [ERR]  {msg}")
def info(msg):  print(f"  [INFO] {msg}")


def safe_fetch(table: str, select: str = "*", limit: int = 1000):
    try:
        res = supabase.table(table).select(select).limit(limit).execute()
        return res.data
    except Exception as e:
        err(f"Could not fetch '{table}': {e}")
        return None


# ── 1. INSPECT TABLES ────────────────────────────────────────────────────────
section("1 · Inspecting Supabase Tables")

tables_to_check = ["teams", "players", "fixtures", "league_table", "match_features"]
table_data = {}

for tbl in tables_to_check:
    rows = safe_fetch(tbl)
    if rows is None:
        warn(f"Table '{tbl}' does not exist or is not accessible.")
        table_data[tbl] = None
    else:
        table_data[tbl] = rows
        ok(f"'{tbl}': {len(rows)} rows found.")


# ── 2. DIAGNOSE TEAMS ────────────────────────────────────────────────────────
section("2 · Diagnosing 'teams' table")

teams = table_data.get("teams")
if not teams:
    err("Teams table is empty or missing – predictions WILL fail.")
else:
    required_team_cols = [
        "id", "name", "games", "avg_points_scored",
        "successful_raids", "successful_tackles", "all_outs_inflicted",
    ]
    sample = teams[0]
    for col in required_team_cols:
        if col not in sample:
            err(f"Missing column: '{col}'")
        elif sample[col] is None:
            warn(f"Column '{col}' is NULL in at least one row.")
        else:
            ok(f"Column '{col}' present and non-null.")

    # Check for zero-game rows (would cause div-by-zero in calc_score)
    zero_games = [t["name"] for t in teams if not t.get("games")]
    if zero_games:
        warn(f"Teams with games=0 (div-by-zero risk in calc_score): {zero_games}")
    else:
        ok("All teams have games > 0.")


# ── 3. DIAGNOSE PLAYERS ──────────────────────────────────────────────────────
section("3 · Diagnosing 'players' table")

players = table_data.get("players")
if not players:
    err("Players table is empty or missing.")
else:
    null_team = [p.get("name", "?") for p in players if not p.get("team_id")]
    if null_team:
        warn(f"{len(null_team)} player(s) have no team_id: {null_team[:5]}{'…' if len(null_team)>5 else ''}")
    else:
        ok("All players have a team_id.")

    null_pos = [p.get("name", "?") for p in players if not p.get("position")]
    if null_pos:
        warn(f"{len(null_pos)} player(s) have no position.")
    else:
        ok("All players have a position.")

    info(f"Total players: {len(players)}")


# ── 4. DIAGNOSE FIXTURES ─────────────────────────────────────────────────────
section("4 · Diagnosing 'fixtures' table")

fixtures = table_data.get("fixtures")
if not fixtures:
    err("Fixtures table is empty or missing.")
else:
    completed = [f for f in fixtures if f.get("is_completed")]
    upcoming  = [f for f in fixtures if not f.get("is_completed")]
    info(f"Completed fixtures: {len(completed)}, Upcoming: {len(upcoming)}")

    # Check for 'outcome' column (Win/Loss/Tie label)
    sample_fix = fixtures[0]
    has_outcome_col = "outcome" in sample_fix

    if not has_outcome_col:
        warn("Column 'outcome' (Win/Loss/Tie) is MISSING from fixtures table.")
        warn("The ML pipeline cannot determine match result labels without it.")
    else:
        ok("Column 'outcome' found.")

    # Check ties: result_team_id should be NULL for ties
    null_result = [f for f in completed if f.get("result_team_id") is None]
    info(f"Completed fixtures with result_team_id=NULL (should be Ties): {len(null_result)}")

    if len(null_result) == 0:
        warn("No Tie fixtures detected via result_team_id=NULL – check seed logic.")


# ── 5. FIX FIXTURES — add `outcome` column & patch Tie rows ──────────────────
section("5 · Fixing 'fixtures' table — adding 'outcome' label")

if fixtures:
    # Build team_id → name map
    team_map = {}
    if teams:
        team_map = {t["id"]: t["name"] for t in teams}

    fix_errors = 0
    fix_ok     = 0

    for fix in fixtures:
        if not fix.get("is_completed"):
            continue  # skip upcoming

        fix_id        = fix["id"]
        home_id       = fix.get("home_team_id")
        away_id       = fix.get("away_team_id")
        result_tid    = fix.get("result_team_id")
        current_out   = fix.get("outcome")  # may not exist

        # Determine correct outcome
        if result_tid is None:
            correct_outcome = "Tie"
        elif result_tid == home_id:
            correct_outcome = "Win"   # home team won
        else:
            correct_outcome = "Loss"  # away team won (home team lost)

        if current_out == correct_outcome:
            fix_ok += 1
            continue  # already correct

        # Upsert outcome
        try:
            supabase.table("fixtures").update({"outcome": correct_outcome}).eq("id", fix_id).execute()
            fix_ok += 1
        except Exception as e:
            # Column might not exist yet – that's fine, we'll report it
            fix_errors += 1
            if fix_errors == 1:
                warn(f"Could not update 'outcome' on fixtures (column may not exist in DB): {e}")
                warn("You may need to run the following SQL in Supabase SQL Editor:")
                warn("  ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS outcome TEXT;")
                warn("  Then re-run this script.")

    if fix_errors == 0:
        ok(f"'outcome' column patched on {fix_ok} completed fixtures.")
    else:
        warn(f"{fix_ok} rows OK, {fix_errors} rows failed (see above).")


# ── 6. BUILD match_features TABLE ────────────────────────────────────────────
section("6 · Building 'match_features' for Random Forest")

"""
Feature set per match (from perspective of home team):
  home_avg_pts_scored, home_avg_raid_pts, home_avg_tackle_pts,
  home_super_raids, home_super_tackles, home_all_outs_inflicted,
  home_all_outs_conceded,
  away_avg_pts_scored, away_avg_raid_pts, away_avg_tackle_pts,
  away_super_raids, away_super_tackles, away_all_outs_inflicted,
  away_all_outs_conceded,
  home_wins, home_losses, home_ties,
  away_wins, away_losses, away_ties,
  outcome  → "Win" | "Loss" | "Tie"
"""

def team_features(team: dict) -> dict:
    games = float(team.get("games") or 1)
    return {
        "avg_pts_scored":       float(team.get("avg_points_scored") or 0),
        "avg_raid_pts":         float(team.get("avg_raid_points") or 0),
        "avg_tackle_pts":       float(team.get("avg_tackle_points") or 0),
        "super_raids":          float(team.get("super_raids") or 0) / games,
        "super_tackles":        float(team.get("super_tackles") or 0) / games,
        "all_outs_inflicted":   float(team.get("all_outs_inflicted") or 0) / games,
        "all_outs_conceded":    float(team.get("all_outs_conceded") or 0) / games,
    }

# Build league table lookup for W/L/T
lt_rows = table_data.get("league_table") or []
lt_map = {}
for lt in lt_rows:
    lt_map[lt.get("team_id")] = {
        "wins":   lt.get("wins",   0),
        "losses": lt.get("losses", 0),
        "ties":   lt.get("ties",   0),
    }

feature_rows = []

if fixtures and teams:
    team_dict = {t["id"]: t for t in teams}

    for fix in fixtures:
        if not fix.get("is_completed"):
            continue

        home_id     = fix.get("home_team_id")
        away_id     = fix.get("away_team_id")
        result_tid  = fix.get("result_team_id")
        outcome     = fix.get("outcome")

        # Determine outcome if not yet set
        if not outcome:
            if result_tid is None:
                outcome = "Tie"
            elif result_tid == home_id:
                outcome = "Win"
            else:
                outcome = "Loss"

        home_team = team_dict.get(home_id)
        away_team = team_dict.get(away_id)

        if not home_team or not away_team:
            continue

        hf = team_features(home_team)
        af = team_features(away_team)
        hl = lt_map.get(home_id, {"wins": 0, "losses": 0, "ties": 0})
        al = lt_map.get(away_id, {"wins": 0, "losses": 0, "ties": 0})

        row = {
            "fixture_id":               fix["id"],
            "home_avg_pts_scored":      hf["avg_pts_scored"],
            "home_avg_raid_pts":        hf["avg_raid_pts"],
            "home_avg_tackle_pts":      hf["avg_tackle_pts"],
            "home_super_raids_per_g":   hf["super_raids"],
            "home_super_tackles_per_g": hf["super_tackles"],
            "home_all_outs_infl_per_g": hf["all_outs_inflicted"],
            "home_all_outs_conc_per_g": hf["all_outs_conceded"],
            "home_wins":                hl["wins"],
            "home_losses":              hl["losses"],
            "home_ties":                hl["ties"],
            "away_avg_pts_scored":      af["avg_pts_scored"],
            "away_avg_raid_pts":        af["avg_raid_pts"],
            "away_avg_tackle_pts":      af["avg_tackle_pts"],
            "away_super_raids_per_g":   af["super_raids"],
            "away_super_tackles_per_g": af["super_tackles"],
            "away_all_outs_infl_per_g": af["all_outs_inflicted"],
            "away_all_outs_conc_per_g": af["all_outs_conceded"],
            "away_wins":                al["wins"],
            "away_losses":              al["losses"],
            "away_ties":                al["ties"],
            "outcome":                  outcome,
        }
        feature_rows.append(row)

    wins_count  = sum(1 for r in feature_rows if r["outcome"] == "Win")
    losses_count= sum(1 for r in feature_rows if r["outcome"] == "Loss")
    ties_count  = sum(1 for r in feature_rows if r["outcome"] == "Tie")

    info(f"Feature rows built → Win: {wins_count}, Loss: {losses_count}, Tie: {ties_count}")

    # ── 7. SYNTHETIC TIE AUGMENTATION ────────────────────────────────────────
    section("7 · Synthetic Tie Augmentation")

    MIN_TIE_ROWS = 20  # target minimum tie samples

    if ties_count < MIN_TIE_ROWS:
        warn(f"Only {ties_count} real Tie rows. Generating synthetic ones to reach {MIN_TIE_ROWS}.")

        numeric_cols = [k for k in feature_rows[0] if k not in ("fixture_id", "outcome")]

        win_rows  = [r for r in feature_rows if r["outcome"] == "Win"]
        loss_rows = [r for r in feature_rows if r["outcome"] == "Loss"]
        tie_rows  = [r for r in feature_rows if r["outcome"] == "Tie"]

        def col_mean(rows, col):
            vals = [r[col] for r in rows if r[col] is not None]
            return statistics.mean(vals) if vals else 0.0

        def col_stdev(rows, col):
            vals = [r[col] for r in rows if r[col] is not None]
            return statistics.stdev(vals) if len(vals) > 1 else 0.0

        n_to_generate = MIN_TIE_ROWS - ties_count
        random.seed(42)
        synthetic_ties = []

        INT_COLS = {"home_wins", "home_losses", "home_ties",
                    "away_wins", "away_losses", "away_ties"}

        for i in range(n_to_generate):
            synth = {"fixture_id": None, "outcome": "Tie"}
            for col in numeric_cols:
                # Interpolate between win mean and loss mean, add small noise
                w_mean = col_mean(win_rows, col)
                l_mean = col_mean(loss_rows, col)
                mid    = (w_mean + l_mean) / 2.0
                noise  = random.gauss(0, col_stdev(tie_rows or win_rows, col) * 0.1)
                val    = mid + noise
                # Cast INT columns to int to avoid PostgreSQL type errors
                synth[col] = int(round(val)) if col in INT_COLS else round(val, 4)
            synthetic_ties.append(synth)

        feature_rows.extend(synthetic_ties)
        ok(f"Generated {n_to_generate} synthetic Tie rows. Total match_features rows: {len(feature_rows)}")
    else:
        ok(f"Tie count ({ties_count}) is sufficient. No synthetic generation needed.")

    # ── 8. UPSERT INTO match_features ────────────────────────────────────────
    section("8 · Upserting into 'match_features' table")

    BATCH_SIZE = 50
    insert_ok  = 0
    insert_err = 0

    # Clear existing rows first for a clean re-seed
    try:
        supabase.table("match_features").delete().neq("outcome", "__never__").execute()
        ok("Cleared existing match_features rows.")
    except Exception as e:
        warn(f"Could not clear match_features (table may not exist yet): {e}")
        warn("Please create it in Supabase SQL Editor with the following DDL:")
        print("""
-- Run this in Supabase SQL Editor:
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
    outcome                   TEXT NOT NULL  -- 'Win' | 'Loss' | 'Tie'
);
-- Also add outcome column to fixtures if missing:
ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS outcome TEXT;
        """)

    # Insert in batches
    for i in range(0, len(feature_rows), BATCH_SIZE):
        batch = feature_rows[i : i + BATCH_SIZE]
        # Remove None fixture_ids (synthetic rows) from FK reference
        for row in batch:
            if row.get("fixture_id") is None:
                del row["fixture_id"]
        try:
            supabase.table("match_features").insert(batch).execute()
            insert_ok += len(batch)
        except Exception as e:
            insert_err += len(batch)
            err(f"Batch insert failed: {e}")

    if insert_ok:
        ok(f"Inserted {insert_ok} rows into 'match_features'.")
    if insert_err:
        warn(f"{insert_err} rows failed to insert (see errors above).")

else:
    err("Cannot build feature rows — fixtures or teams table missing/empty.")


# ── 9. FINAL SUMMARY ─────────────────────────────────────────────────────────
section("9 · Summary & Recommendations")

print("""
  ============================================================
  KabaddiIQ ML Pipeline -- Audit Complete
  ============================================================
  Action items (if any warnings appeared above):

  A. Run the DDL SQL in Supabase SQL Editor to create
     'match_features' table and 'outcome' column on fixtures

  B. Re-run this script after applying the DDL

  C. The Random Forest MUST be retrained after adding Tie
     as a 3rd class -- it is now a multi-class classifier.
     Update your RF training script to:
       - Load from match_features table
       - Use outcome as the target (Win/Loss/Tie)
       - Use class_weight='balanced' to handle imbalance

  D. Update predict/match-outcome endpoint in main.py to
     return 'Tie' as a possible predicted_winner value
  ============================================================
""")
