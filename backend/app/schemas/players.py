from pydantic import BaseModel
from typing import Optional

class PlayerCreate(BaseModel):
    name: str
    position: str
    team_id: Optional[str] = None
    height: float = 0.0
    nationality: str = ""
    weight: float = 0.0
    matches_played: int = 0
    points: int = 0
    career_best_points: int = 0
    not_out_pct: float = 0.0
    raids: int = 0
    successful_raids: int = 0
    unsuccessful_raids: int = 0
    empty_raids: int = 0
    successful_raid_pct: float = 0.0
    raid_touch_points: int = 0
    raid_bonus_points: int = 0
    total_raid_points: int = 0
    super_raids: int = 0
    super_10s: int = 0
    tackles: int = 0
    successful_tackles: int = 0
    unsuccessful_tackles: int = 0
    tackles_per_match: float = 0.0
    tackle_bonus_points: int = 0
    tackle_success_rate: float = 0.0
    super_tackles: int = 0
    high_5s: int = 0

class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[str] = None
    photo_url: Optional[str] = None
