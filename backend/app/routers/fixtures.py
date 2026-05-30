from fastapi import APIRouter
from app.core.database import supabase, CSV_FIXTURES_RESULTS, CSV_FIXTURES_UPCOMING, CSV_LEAGUE_TABLE

router = APIRouter(prefix="/api/fixtures", tags=["Fixtures"])

@router.get("/results")
def get_fixture_results(team: str = None):
    """Retrieve all completed match fixture results with team profiles."""
    if supabase:
        try:
            query = supabase.table("fixtures").select("*, home:teams!home_team_id(*), away:teams!away_team_id(*)").eq("is_completed", True)
            res = query.execute()
            if res.data is not None:
                data = res.data
                if team:
                    data = [d for d in data if d["home_team_id"] == team or d["away_team_id"] == team]
                return data
        except Exception as e:
            print(f"[WARN] Supabase fixture results fetch failed, using CSV fallback: {e}")
            
    # CSV fallback
    data = CSV_FIXTURES_RESULTS
    if team:
        data = [d for d in data if d["home_team_id"] == team or d["away_team_id"] == team]
    return data

@router.get("/upcoming")
def get_fixture_upcoming():
    """Retrieve all scheduled upcoming match fixtures."""
    if supabase:
        try:
            res = supabase.table("fixtures").select("*, home:teams!home_team_id(*), away:teams!away_team_id(*)").eq("is_completed", False).execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            print(f"[WARN] Supabase upcoming fixtures fetch failed, using CSV fallback: {e}")
    return CSV_FIXTURES_UPCOMING

# Separate sub-router prefix route for league-table for frontend compatibility
router_lt = APIRouter(prefix="/api/league-table", tags=["League Standings"])

@router_lt.get("")
def get_league_table():
    """Retrieve active league standings rankings with franchise profiles."""
    if supabase:
        try:
            res = supabase.table("league_table").select("*, teams(*)").order("rank").execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            print(f"[WARN] Supabase league table fetch failed, using CSV fallback: {e}")
    return CSV_LEAGUE_TABLE
