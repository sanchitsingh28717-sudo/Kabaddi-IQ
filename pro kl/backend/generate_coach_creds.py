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
    print("Fetching teams from DB...")
    res = supabase.table("teams").select("id, name").execute()
    teams = res.data

    coach_credentials = []

    for team in teams:
        raw_name = str(team["name"]).lower().replace(" ", "").replace(".", "").strip()
        email = f"coach_{raw_name}@prokl.com"
        password = "coach123"

        coach_credentials.append({
            "team_id": team["id"],
            "team_name": team["name"],
            "email": email,
            "password": password
        })

    # Save frontend JSON
    base_dir = os.path.dirname(os.path.dirname(__file__))
    frontend_data_dir = os.path.join(base_dir, "frontend", "src", "data")
    os.makedirs(frontend_data_dir, exist_ok=True)
    
    json_path = os.path.join(frontend_data_dir, "coach_credentials.json")
    with open(json_path, "w") as f:
        json.dump(coach_credentials, f, indent=2)

    # Output a markdown file
    md_path = os.path.join(base_dir, "coach_credentials.md")
    with open(md_path, "w") as f:
        f.write("# Coach Master Credentials\n\n")
        f.write("A master list of login credentials for the coaches.\n\n")
        for c in coach_credentials:
            f.write(f"- **{c['team_name']}** | Email: `{c['email']}` | Password: `{c['password']}`\n")
            
    print(f"Successfully generated credentials for {len(coach_credentials)} coaches.")
    print(f"JSON saved to {json_path}")
    print(f"Markdown masterlist saved to {md_path}")

if __name__ == "__main__":
    generate_credentials()
