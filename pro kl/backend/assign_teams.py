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

def assign_teams():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    
    print("Fetching teams from DB...")
    res = supabase.table("teams").select("id, name").execute()
    team_id_map = {team["name"]: team["id"] for team in res.data}
    
    print("Loaded team map:", team_id_map)

    print("Reading PlayerData.csv...")
    df_players = pd.read_csv(os.path.join(base_dir, "PlayerData.csv"))
    
    updates = 0
    # Process updates row by row or in batches
    for _, row in df_players.iterrows():
        player_name = row.get("Name")
        team_name = row.get("Team")
        
        if pd.isna(player_name) or not player_name:
            continue
            
        if player_name.lower() == "sanchit":
            print(f"Skipping update for player: {player_name}")
            continue
            
        team_id = team_id_map.get(team_name)
        
        if team_id:
            # Update the player in the database
            # We match by name since name should be unique enough for this synthetic dataset
            try:
                update_res = supabase.table("players").update({"team_id": team_id}).eq("name", player_name).execute()
                if update_res.data:
                    updates += len(update_res.data)
            except Exception as e:
                print(f"Error updating player {player_name}: {e}")

    print(f"Successfully updated team_id for {updates} players.")

if __name__ == "__main__":
    assign_teams()
