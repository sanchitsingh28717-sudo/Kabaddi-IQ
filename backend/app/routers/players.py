from fastapi import APIRouter, HTTPException
from app.core.database import supabase, CSV_PLAYERS
from app.schemas.players import PlayerCreate, PlayerUpdate

router = APIRouter(prefix="/api/players", tags=["Players"])

@router.get("")
def get_players(position: str = None, team: str = None):
    """Retrieve all player profiles with optional position/team filters."""
    if supabase:
        try:
            query = supabase.table("players").select("*, team:teams(*)")
            if position:
                query = query.eq("position", position)
            if team:
                query = query.eq("team_id", team)
            res = query.execute()
            if res.data:
                return res.data
        except Exception as e:
            print(f"[WARN] Supabase players fetch failed, using CSV fallback: {e}")
            
    # CSV fallback
    result = CSV_PLAYERS
    if position:
        result = [p for p in result if p.get("position") == position]
    if team:
        result = [p for p in result if p.get("team_id") == team]
    return result

@router.post("")
def create_player(player: PlayerCreate):
    """Create a new player profile (Supabase write required)."""
    if not supabase: 
        return {"error": "Supabase not configured"}
        
    team_id = player.team_id
    if team_id:
        try:
            team_res = supabase.table("teams").select("id").ilike("name", f"%{team_id}%").limit(1).execute()
            team_id = team_res.data[0]["id"] if team_res.data else None
        except Exception:
            team_id = None
            
    payload = player.model_dump()
    payload["team_id"] = team_id
    try:
        res = supabase.table("players").insert(payload).execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{id}")
def get_player(id: str):
    """Retrieve details for a single player profile by ID."""
    if supabase:
        try:
            res = supabase.table("players").select("*, team:teams(*)").eq("id", id).limit(1).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            print(f"[WARN] Supabase player fetch failed, using CSV fallback: {e}")
            
    # CSV fallback
    player = next((p for p in CSV_PLAYERS if p["id"] == id), None)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player

@router.put("/{id}")
def update_player(id: str, player: PlayerUpdate):
    """Update properties of an existing player profile by ID."""
    if not supabase: 
        return {"error": "Supabase not configured"}
        
    update_data = {k: v for k, v in player.model_dump().items() if v is not None}
    if not update_data:
        return {"status": "no data to update"}
        
    try:
        res = supabase.table("players").update(update_data).eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Player not found")
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
