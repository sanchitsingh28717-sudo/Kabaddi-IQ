import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def generate_credentials():
    print("Fetching players from DB...")
    res = supabase.table("players").select("id, name").execute()
    players = res.data

    credentials = []

    for player in players:
        # e.g., "Pawan Sehrawat" -> pawan.sehrawat@prokl.com
        name_parts = str(player["name"]).lower().replace("-", " ").strip().split(" ")
        base_email = ".".join([p for p in name_parts if p]) + "@prokl.com"
        
        # Simple password for easy testing
        password = name_parts[0] + "123" if name_parts else "player123"

        credentials.append({
            "player_id": player["id"],
            "name": player["name"],
            "email": base_email,
            "password": password
        })

    # Saving frontend JSON
    base_dir = os.path.dirname(os.path.dirname(__file__))
    frontend_data_dir = os.path.join(base_dir, "frontend", "src", "data")
    os.makedirs(frontend_data_dir, exist_ok=True)
    
    json_path = os.path.join(frontend_data_dir, "player_credentials.json")
    with open(json_path, "w") as f:
        json.dump(credentials, f, indent=2)

    # Output a markdown file into the DB backend folder just for reference
    md_path = os.path.join(base_dir, "player_credentials.md")
    with open(md_path, "w") as f:
        f.write("# Player Master Credentials\n\n")
        f.write("A master list of login credentials for the players.\n\n")
        for c in credentials:
            f.write(f"- **{c['name']}** | Email: `{c['email']}` | Password: `{c['password']}`\n")
            
    print(f"Successfully generated credentials for {len(credentials)} players.")
    print(f"JSON saved to {json_path}")
    print(f"Markdown masterlist saved to {md_path}")

if __name__ == "__main__":
    generate_credentials()
