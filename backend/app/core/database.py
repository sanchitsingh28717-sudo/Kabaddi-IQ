import os
import pandas as pd
import json
from supabase import create_client, Client as Client_Supa
from app.core.config import settings

# Supabase Initialization
supabase: Client_Supa = None
if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        print(f"[WARN] Failed to initialize Supabase client: {e}")

# Centralized Fallback Data Repositories
CSV_TEAMS = []
CSV_PLAYERS = []
PLAYER_PHOTO_MAP = {}
CSV_LEAGUE_TABLE = []
CSV_FIXTURES_RESULTS = []
CSV_FIXTURES_UPCOMING = []

def find_csv_team_by_name(name: str):
    if not name:
        return None
    name_clean = name.replace(".", "").replace(" ", "").lower()
    for t in CSV_TEAMS:
        t_clean = t["name"].replace(".", "").replace(" ", "").lower()
        if name_clean in t_clean or t_clean in name_clean:
            return t
    return None

def _load_csv_fallback():
    """Load player, team, league standings, and fixtures data from offline CSV fallback files."""
    global CSV_TEAMS, CSV_PLAYERS, PLAYER_PHOTO_MAP, CSV_LEAGUE_TABLE, CSV_FIXTURES_RESULTS, CSV_FIXTURES_UPCOMING
    
    # Root directory is 4 levels up from app/core/database.py (repository root)
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

    
    # ── Load Player Photo Map ──
    photo_map_path = os.path.join(base_dir, "backend", "player_photo_map.json")
    if os.path.exists(photo_map_path):
        try:
            with open(photo_map_path, "r") as f:
                PLAYER_PHOTO_MAP = json.load(f)
            print(f"[OK] CSV fallback: Loaded {len(PLAYER_PHOTO_MAP)} real player photo URLs.")
        except Exception as e:
            print(f"[WARN] Could not load player_photo_map.json: {e}")

    # ── Load Teams ──
    teams_csv = os.path.join(base_dir, "TeamData.csv")
    if os.path.exists(teams_csv):
        try:
            df = pd.read_csv(teams_csv)
            CSV_TEAMS = []
            for idx, row in df.iterrows():
                team_id = f"csv-team-{idx}"
                CSV_TEAMS.append({
                    "id": team_id,
                    "name": str(row.get("Team", "")),
                    "games": int(row.get("Games", 0)),
                    "avg_points_scored": float(row.get("AVG POINTS SCORED", 0)),
                    "avg_raid_points": float(row.get("AVG RAID POINTS", 0)),
                    "avg_tackle_points": float(row.get("AVG TACKLE POINTS", 0)),
                    "successful_raids": int(row.get("SUCCESSFUL RAIDS", 0)),
                    "raid_points": int(row.get("RAID POINTS", 0)),
                    "successful_tackles": int(row.get("SUCCESSFUL TACKLES", 0)),
                    "tackle_points": int(row.get("TACKLE POINTS", 0)),
                    "super_raids": int(row.get("SUPER RAID", 0)),
                    "super_tackles": int(row.get("SUPER TACKLES", 0)),
                    "all_outs_inflicted": int(row.get("ALL-OUTS INFLICTED", 0)),
                    "all_outs_conceded": int(row.get("ALL-OUTS CONCEDED", 0)),
                })
            print(f"[OK] CSV fallback: {len(CSV_TEAMS)} teams loaded from {teams_csv}")
        except Exception as e:
            print(f"[WARN] Could not load teams CSV: {e}")
    
    # ── Build team name → id map ──
    team_name_map = {t["name"]: t["id"] for t in CSV_TEAMS}
    
    # ── Load Players ──
    players_csv = os.path.join(base_dir, "PlayerData.csv")
    if os.path.exists(players_csv):
        try:
            df = pd.read_csv(players_csv)
            CSV_PLAYERS = []
            for idx, row in df.iterrows():
                team_name = str(row.get("Team", ""))
                team_id = team_name_map.get(team_name)
                team_obj = next((t for t in CSV_TEAMS if t["id"] == team_id), None)
                
                def _safe_float(val, default=0.0):
                    try:
                        return float(val) if pd.notna(val) else default
                    except (ValueError, TypeError):
                        return default
                
                def _safe_int(val, default=0):
                    try:
                        return int(float(val)) if pd.notna(val) else default
                    except (ValueError, TypeError):
                        return default
                
                player_name = str(row.get("Name", ""))
                ghibli_avatars = [
                    "/ghibli_player_blue.png",
                    "/ghibli_player_red.png",
                    "/ghibli_player_green.png",
                    "/ghibli_player_orange.png",
                ]
                avatar_idx = sum(ord(c) for c in player_name) % len(ghibli_avatars)
                photo_url = ghibli_avatars[avatar_idx]

                CSV_PLAYERS.append({
                    "id": f"csv-player-{idx}",
                    "name": player_name,
                    "position": str(row.get("Position", "")),
                    "team_id": team_id,
                    "team": team_obj,
                    "height": str(row.get("Height", "")),
                    "nationality": str(row.get("Nationality", "")),
                    "weight": str(row.get("Weight", "")),
                    "matches_played": _safe_int(row.get("Match Played")),
                    "points": _safe_int(row.get("Points")),
                    "career_best_points": _safe_int(row.get("Career Best Points")),
                    "not_out_pct": _safe_float(row.get("Not Out Percentage")),
                    "raids": _safe_int(row.get("Raids")),
                    "successful_raids": _safe_int(row.get("Successful Raids")),
                    "unsuccessful_raids": _safe_int(row.get("Unsuccessful Raids")),
                    "empty_raids": _safe_int(row.get("Empty Raid")),
                    "successful_raid_pct": _safe_float(row.get("Successful Raid Percentage")),
                    "raid_touch_points": _safe_int(row.get("Raid Touch Points")),
                    "raid_bonus_points": _safe_int(row.get("Raid Bonus Points")),
                    "total_raid_points": _safe_int(row.get("Total Raid Points")),
                    "super_raids": _safe_int(row.get("Super Raids")),
                    "super_10s": _safe_int(row.get("Super 10s")),
                    "tackles": _safe_int(row.get("Tackles")),
                    "successful_tackles": _safe_int(row.get("Successful Tackles")),
                    "unsuccessful_tackles": _safe_int(row.get("Unsuccessful Tackles")),
                    "tackles_per_match": _safe_float(row.get("Successful Tackles Per Match")),
                    "tackle_bonus_points": _safe_int(row.get("Tackle Bonus Points")),
                    "tackle_success_rate": _safe_float(row.get("Tackle Success Rate")),
                    "super_tackles": _safe_int(row.get("Super Tackles")),
                    "high_5s": _safe_int(row.get("High 5s")),
                    "photo_url": photo_url,
                })
            print(f"[OK] CSV fallback: {len(CSV_PLAYERS)} players loaded from {players_csv}")
        except Exception as e:
            print(f"[WARN] Could not load players CSV: {e}")

    # ── Load League Table ──
    league_csv = os.path.join(base_dir, "Leaguetable.csv")
    if os.path.exists(league_csv):
        try:
            df = pd.read_csv(league_csv)
            CSV_LEAGUE_TABLE = []
            for idx, row in df.iterrows():
                team_name = str(row.get("Team", ""))
                team_obj = find_csv_team_by_name(team_name)
                
                def _safe_int(val, default=0):
                    try:
                        return int(float(val)) if pd.notna(val) else default
                    except (ValueError, TypeError):
                        return default
                
                CSV_LEAGUE_TABLE.append({
                    "rank": _safe_int(row.get("Rank")),
                    "team_id": team_obj["id"] if team_obj else f"csv-team-lt-{idx}",
                    "played": _safe_int(row.get("P")),
                    "wins": _safe_int(row.get("W")),
                    "losses": _safe_int(row.get("L")),
                    "ties": _safe_int(row.get("T")),
                    "score_diff": _safe_int(row.get("Score Diff.")),
                    "points": _safe_int(row.get("Pts")),
                    "teams": team_obj
                })
            print(f"[OK] CSV fallback: {len(CSV_LEAGUE_TABLE)} league table entries loaded from {league_csv}")
        except Exception as e:
            print(f"[WARN] Could not load league table CSV: {e}")

    # ── Load Fixture Results ──
    results_csv = os.path.join(base_dir, "FixtureResults.csv")
    if os.path.exists(results_csv):
        try:
            df = pd.read_csv(results_csv)
            CSV_FIXTURES_RESULTS = []
            for idx, row in df.iterrows():
                home_name = str(row.get("HomeTeam", ""))
                away_name = str(row.get("AwayTeam", ""))
                res_name = str(row.get("Result", ""))
                
                home_team = find_csv_team_by_name(home_name)
                away_team = find_csv_team_by_name(away_name)
                
                home_id = home_team["id"] if home_team else f"csv-team-home-{idx}"
                away_id = away_team["id"] if away_team else f"csv-team-away-{idx}"
                
                result_team_id = None
                if res_name != "Tie" and res_name.lower() != "tie":
                    won_team = find_csv_team_by_name(res_name)
                    if won_team:
                        result_team_id = won_team["id"]
                    elif res_name.lower() in home_name.lower():
                        result_team_id = home_id
                    elif res_name.lower() in away_name.lower():
                        result_team_id = away_id
                
                CSV_FIXTURES_RESULTS.append({
                    "id": f"csv-result-{idx}",
                    "date": str(row.get("Date", "")),
                    "home_team_id": home_id,
                    "away_team_id": away_id,
                    "result_team_id": result_team_id,
                    "is_completed": True,
                    "home": home_team,
                    "away": away_team
                })
            print(f"[OK] CSV fallback: {len(CSV_FIXTURES_RESULTS)} fixture results loaded from {results_csv}")
        except Exception as e:
            print(f"[WARN] Could not load fixture results CSV: {e}")

    # ── Load Upcoming Fixtures ──
    upcoming_csv = os.path.join(base_dir, "Upcomingfixtures.csv")
    if os.path.exists(upcoming_csv):
        try:
            df = pd.read_csv(upcoming_csv)
            CSV_FIXTURES_UPCOMING = []
            for idx, row in df.iterrows():
                home_name = str(row.get("HomeTeam", ""))
                away_name = str(row.get("AwayTeam", ""))
                
                home_team = find_csv_team_by_name(home_name)
                away_team = find_csv_team_by_name(away_name)
                
                home_id = home_team["id"] if home_team else f"csv-team-home-{idx}"
                away_id = away_team["id"] if away_team else f"csv-team-away-{idx}"
                
                CSV_FIXTURES_UPCOMING.append({
                    "id": f"csv-upcoming-{idx}",
                    "date": str(row.get("date", "")),
                    "home_team_id": home_id,
                    "away_team_id": away_id,
                    "result_team_id": None,
                    "is_completed": False,
                    "home": home_team,
                    "away": away_team
                })
            print(f"[OK] CSV fallback: {len(CSV_FIXTURES_UPCOMING)} upcoming fixtures loaded from {upcoming_csv}")
        except Exception as e:
            print(f"[WARN] Could not load upcoming fixtures CSV: {e}")

# Execute fallback loading at file load time
_load_csv_fallback()
