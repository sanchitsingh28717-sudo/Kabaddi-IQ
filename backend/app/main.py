from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, teams, players, fixtures, predict

app = FastAPI(
    title="PKL AI Analytics API",
    description="Kabaddi IQ - Elite Analytics & AI Win Forecasting API Layer",
    version="2.0.0"
)

# Configure Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register modular routes
app.include_router(auth.router)
app.include_router(teams.router)
app.include_router(players.router)
app.include_router(fixtures.router)
app.include_router(fixtures.router_lt)
app.include_router(predict.router)

@app.get("/")
def read_root():
    return {"status": "active", "service": "PKL AI Analytics", "architecture": "clean"}
