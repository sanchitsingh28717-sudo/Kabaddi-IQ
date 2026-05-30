from fastapi import APIRouter
from app.core.database import supabase, CSV_TEAMS, CSV_PLAYERS

router = APIRouter(prefix="/api/teams", tags=["Teams"])

@router.get("")
def get_teams():
    """Retrieve all teams with statistics, falling back to local TeamData.csv if offline."""
    if supabase:
        try:
            res = supabase.table("teams").select("*").execute()
            if res.data:
                return res.data
        except Exception as e:
            print(f"[WARN] Supabase teams fetch failed, using CSV fallback: {e}")
    return CSV_TEAMS

@router.get("/{team_id}/players")
def get_team_players(team_id: str):
    """Retrieve all active player profiles belonging to a specific team ID."""
    if supabase:
        try:
            res = supabase.table("players").select("*").eq("team_id", team_id).execute()
            if res.data:
                return res.data
        except Exception as e:
            print(f"[WARN] Supabase team players fetch failed, using CSV fallback: {e}")
    return [p for p in CSV_PLAYERS if p.get("team_id") == team_id]
