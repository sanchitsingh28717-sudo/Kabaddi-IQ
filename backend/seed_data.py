import os
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def seed_db():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    
    # Check if teams are already seeded
    res = supabase.table("teams").select("id").limit(1).execute()
    if len(res.data) > 0:
        print("Database already seeded. Skipping.")
        return

    print("Seeding from CSVs...")

    try:
        # 1. Teams
        df_teams = pd.read_csv(os.path.join(base_dir, "TeamData.csv"))
        if "Unnamed: 0" in df_teams.columns:
            df_teams.drop(columns=["Unnamed: 0"], inplace=True)
            
        teams_list = []
        for _, row in df_teams.iterrows():
            teams_list.append({
                "name": row.get("Team"),
                "games": row.get("Games", 0),
                "total_points_scored": row.get("TOTAL POINTS SCORED", 0),
                "total_points_conceded": row.get("TOTAL POINTS CONCEDED", 0),
                "avg_points_scored": row.get("AVG POINTS SCORED", 0.0),
                "successful_raids": row.get("SUCCESSFUL RAIDS", 0),
                "raid_points": row.get("RAID POINTS", 0),
                "avg_raid_points": row.get("AVG RAID POINTS", 0.0),
                "successful_tackles": row.get("SUCCESSFUL TACKLES", 0),
                "tackle_points": row.get("TACKLE POINTS", 0),
                "avg_tackle_points": row.get("AVG TACKLE POINTS", 0.0),
                "super_raids": row.get("SUPER RAID", 0),
                "super_tackles": row.get("SUPER TACKLES", 0),
                "do_or_die_raid_points": row.get("DO-OR-DIE RAID POINTS", 0),
                "all_outs_inflicted": row.get("ALL-OUTS INFLICTED", 0),
                "all_outs_conceded": row.get("ALL-OUTS CONCEDED", 0)
            })
        
        inserted_teams = supabase.table("teams").insert(teams_list).execute()
        team_id_map = {team["name"]: team["id"] for team in inserted_teams.data}
        print(f"Inserted {len(inserted_teams.data)} teams.")

        # 2. Players
        df_players = pd.read_csv(os.path.join(base_dir, "PlayerData.csv"))
        if "Unnamed: 0" in df_players.columns:
            df_players.drop(columns=["Unnamed: 0"], inplace=True)

        players_list = []
        for _, row in df_players.iterrows():
            team_name = row.get("Team")
            team_id = team_id_map.get(team_name)
            
            # converting values safely to avoid NaNs being mapped to JSON null via simple python dict
            # or ignoring NaN if it happens
            def _float(val):
                return float(val) if pd.notnull(val) else 0.0
            def _int(val):
                return int(val) if pd.notnull(val) else 0

            players_list.append({
                "name": row.get("Name"),
                "position": row.get("Position"),
                "born": row.get("Born") if pd.notnull(row.get("Born")) else None,
                "team_id": team_id,
                "height": row.get("Height") if pd.notnull(row.get("Height")) else None,
                "nationality": row.get("Nationality"),
                "weight": row.get("Weight") if pd.notnull(row.get("Weight")) else None,
                "matches_played": _int(row.get("Match Played")),
                "points": _int(row.get("Points")),
                "career_best_points": _int(row.get("Career Best Points")),
                "not_out_pct": _float(row.get("Not Out Percentage")),
                "raids": _int(row.get("Raids")),
                "successful_raids": _int(row.get("Successful Raids")),
                "unsuccessful_raids": _int(row.get("Unsuccessful Raids")),
                "empty_raids": _int(row.get("Empty Raid")),
                "successful_raid_pct": _float(row.get("Successful Raid Percentage")),
                "raid_touch_points": _int(row.get("Raid Touch Points")),
                "raid_bonus_points": _int(row.get("Raid Bonus Points")),
                "total_raid_points": _int(row.get("Total Raid Points")),
                "super_raids": _int(row.get("Super Raids")),
                "super_10s": _int(row.get("Super 10s")),
                "tackles": _int(row.get("Tackles")),
                "successful_tackles": _int(row.get("Successful Tackles")),
                "unsuccessful_tackles": _int(row.get("Unsuccessful Tackles")),
                "tackles_per_match": _float(row.get("Successful Tackles Per Match")),
                "tackle_bonus_points": _int(row.get("Tackle Bonus Points")),
                "tackle_success_rate": _float(row.get("Tackle Success Rate")),
                "super_tackles": _int(row.get("Super Tackles")),
                "high_5s": _int(row.get("High 5s"))
            })
            
        supabase.table("players").insert(players_list).execute()
        print(f"Inserted {len(players_list)} players.")

        # 3. Fixtures Results
        df_fixtures = pd.read_csv(os.path.join(base_dir, "FixtureResults.csv"))
        if "Unnamed: 0" in df_fixtures.columns:
            df_fixtures.drop(columns=["Unnamed: 0"], inplace=True)
            
        fixtures_list = []
        for _, row in df_fixtures.iterrows():
            ht = row.get("HomeTeam")
            at = row.get("AwayTeam")
            res = row.get("Result")
            
            ht_id = team_id_map.get(ht)
            at_id = team_id_map.get(at)
            
            result_team_id = None
            if res != "Tie" and pd.notnull(res):
                result_team_id = team_id_map.get(res)

            fixtures_list.append({
                "date": row.get("Date"),
                "home_team_id": ht_id,
                "away_team_id": at_id,
                "result_team_id": result_team_id,
                "is_completed": True
            })
            
        supabase.table("fixtures").insert(fixtures_list).execute()
        print(f"Inserted {len(fixtures_list)} past fixtures.")

        # 4. League Table
        df_lt = pd.read_csv(os.path.join(base_dir, "Leaguetable.csv"))
        if "Unnamed: 0" in df_lt.columns:
            df_lt.drop(columns=["Unnamed: 0"], inplace=True)
            
        lt_list = []
        for _, row in df_lt.iterrows():
            t_id = team_id_map.get(row.get("Team"))
            lt_list.append({
                "rank": _int(row.get("Rank")),
                "team_id": t_id,
                "played": _int(row.get("P")),
                "wins": _int(row.get("W")),
                "losses": _int(row.get("L")),
                "ties": _int(row.get("T")),
                "score_diff": _int(row.get("Score Diff.")),
                "points": _int(row.get("Pts"))
            })
        
        supabase.table("league_table").insert(lt_list).execute()
        print(f"Inserted {len(lt_list)} league table rows.")
        
        # 5. Upcoming Fixtures
        # Columns: date, HomeTeam, AwayTeam
        df_uf = pd.read_csv(os.path.join(base_dir, "Upcomingfixtures.csv"))
        if "Unnamed: 0" in df_uf.columns:
            df_uf.drop(columns=["Unnamed: 0"], inplace=True)
        
        up_fixes_list = []
        for _, row in df_uf.iterrows():
            ht = row.get("HomeTeam")
            at = row.get("AwayTeam")
            
            ht_id = team_id_map.get(ht)
            at_id = team_id_map.get(at)
            
            up_fixes_list.append({
                "date": row.get("date"),
                "home_team_id": ht_id,
                "away_team_id": at_id,
                "result_team_id": None,
                "is_completed": False
            })
            
        supabase.table("fixtures").insert(up_fixes_list).execute()
        print(f"Inserted {len(up_fixes_list)} upcoming fixtures.")

        print("Seeding Complete!")

    except Exception as e:
        print(f"Error seeding database: {e}")

if __name__ == "__main__":
    seed_db()
