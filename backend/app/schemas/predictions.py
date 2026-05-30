from pydantic import BaseModel
from typing import List, Optional

class MatchState(BaseModel):
    score_diff: int
    minutes_remaining: int
    home_raid_success_rate: float
    away_raid_success_rate: float
    home_tackle_success_rate: float
    away_tackle_success_rate: float
    all_outs_home: int = 0
    is_second_half: int = 0
    raid_success_rate: float = -1.0  # legacy fallback

class WinProbRequest(BaseModel):
    score_diff: Optional[int] = None
    minutes_remaining: Optional[int] = None
    home_raid_success_rate: Optional[float] = None
    away_raid_success_rate: Optional[float] = None
    home_tackle_success_rate: Optional[float] = None
    away_tackle_success_rate: Optional[float] = None
    all_outs_home: Optional[int] = None
    is_second_half: Optional[int] = None
    raid_success_rate: Optional[float] = None  # legacy fallback
    sequence: Optional[List[MatchState]] = None

class TimeoutRequest(BaseModel):
    score_diff: int
    minutes_remaining: int
    home_raid_success_rate: float = 50.0
    away_raid_success_rate: float = 50.0
    home_tackle_success_rate: float = 60.0
    away_tackle_success_rate: float = 60.0
    all_outs_home: int = 0
    is_second_half: int = 0
    raid_success_rate: float = -1.0  # legacy fallback

class MatchOutcomeRequest(BaseModel):
    home_team_id: str
    away_team_id: str
