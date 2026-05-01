import os
import pickle
import math
import random
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client as Client_Supa
from dotenv import load_dotenv
import pandas as pd
from typing import List, Optional
from twilio.rest import Client
import resend

load_dotenv()

app = FastAPI(title="PKL AI Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY", "")

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client_Supa = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    supabase = None

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER", "")

if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
else:
    twilio_client = None

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# ── Load Random Forest Model ─────────────────────────────────────────────────
RF_MODEL = None
RF_LABEL_ENCODER = None
RF_FEATURE_COLS = None

_model_path = os.path.join(os.path.dirname(__file__), "model_rf.pkl")
if os.path.exists(_model_path):
    try:
        with open(_model_path, "rb") as f:
            _bundle = pickle.load(f)
        RF_MODEL = _bundle["model"]
        RF_LABEL_ENCODER = _bundle["label_encoder"]
        RF_FEATURE_COLS = _bundle["feature_cols"]
        print(f"[OK] Random Forest model loaded from {_model_path}")
    except Exception as e:
        print(f"[WARN] Could not load RF model: {e}")
else:
    print("[WARN] model_rf.pkl not found. Run train_model.py first.")

# ── Load LSTM Model ───────────────────────────────────────────────────────────
LSTM_MODEL = None
LSTM_BUNDLE = None

_lstm_path = os.path.join(os.path.dirname(__file__), "model_lstm.pkl")
if os.path.exists(_lstm_path):
    try:
        import torch
        import torch.nn as nn

        class KabaddiLSTM(nn.Module):
            def __init__(self, input_size=8, hidden_size=64, num_layers=2, dropout=0.3):
                super().__init__()
                self.lstm = nn.LSTM(
                    input_size=input_size,
                    hidden_size=hidden_size,
                    num_layers=num_layers,
                    batch_first=True,
                    dropout=dropout if num_layers > 1 else 0.0,
                )
                self.dropout = nn.Dropout(dropout)
                self.fc = nn.Sequential(
                    nn.Linear(hidden_size, 32),
                    nn.ReLU(),
                    nn.Dropout(dropout * 0.5),
                    nn.Linear(32, 1),
                    nn.Sigmoid(),
                )

            def forward(self, x):
                lstm_out, _ = self.lstm(x)
                last_step = lstm_out[:, -1, :]
                out = self.dropout(last_step)
                return self.fc(out).squeeze(-1)

        with open(_lstm_path, "rb") as f:
            LSTM_BUNDLE = pickle.load(f)

        _lstm = KabaddiLSTM(
            input_size=LSTM_BUNDLE["input_size"],
            hidden_size=LSTM_BUNDLE["hidden_size"],
            num_layers=LSTM_BUNDLE["num_layers"],
            dropout=LSTM_BUNDLE["dropout"],
        )
        _lstm.load_state_dict(LSTM_BUNDLE["model_state"])
        _lstm.eval()
        LSTM_MODEL = _lstm
        print(f"[OK] LSTM model loaded from {_lstm_path}")
    except Exception as e:
        print(f"[WARN] Could not load LSTM model: {e}")
else:
    print("[WARN] model_lstm.pkl not found. Run train_lstm.py first.")

# ---- PYDANTIC MODELS ----
class ResetPasswordRequest(BaseModel):
    method: str
    contact: str

class VerifyOTPRequest(BaseModel):
    contact: str
    otp: str

class MatchState(BaseModel):
    score_diff: int
    minutes_remaining: int
    home_raid_success_rate: float       # 0.0 – 100.0 (percentage)
    away_raid_success_rate: float       # 0.0 – 100.0
    home_tackle_success_rate: float     # 0.0 – 100.0
    away_tackle_success_rate: float     # 0.0 – 100.0
    all_outs_home: int = 0             # cumulative all-outs inflicted by home team
    is_second_half: int = 0            # 0 = first half, 1 = second half

    # backward-compat alias so old clients that send raid_success_rate still work
    raid_success_rate: float = -1.0


class WinProbRequest(BaseModel):
    score_diff: Optional[int] = None
    minutes_remaining: Optional[int] = None
    home_raid_success_rate: Optional[float] = None
    away_raid_success_rate: Optional[float] = None
    home_tackle_success_rate: Optional[float] = None
    away_tackle_success_rate: Optional[float] = None
    all_outs_home: Optional[int] = None
    is_second_half: Optional[int] = None
    raid_success_rate: Optional[float] = None   # legacy fallback
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
    raid_success_rate: float = -1.0     # legacy

class MatchOutcomeRequest(BaseModel):
    home_team_id: str
    away_team_id: str

class PlayerCreate(BaseModel):
    name: str
    position: str
    team_id: str = None
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

# ── ML HELPERS ───────────────────────────────────────────────────────────────
def _resolve_raid_rate(state) -> float:
    """Return home raid success rate, accepting both old and new field names."""
    if hasattr(state, 'home_raid_success_rate') and state.home_raid_success_rate >= 0:
        return state.home_raid_success_rate
    if hasattr(state, 'raid_success_rate') and state.raid_success_rate >= 0:
        return state.raid_success_rate
    return 50.0


def calc_win_probability(score_diff: int, minutes_remaining: int, raid_success_rate: float) -> float:
    """Logistic-style win probability from live match state (formula fallback)."""
    base = 50.0
    base += math.tanh(score_diff / 8.0) * 35.0
    time_factor = (40 - minutes_remaining) / 40.0
    if score_diff != 0:
        base += math.copysign(time_factor * 10.0, score_diff)
    raid_delta = (raid_success_rate - 50.0) / 50.0
    base += raid_delta * 8.0
    return round(max(3.0, min(97.0, base)) / 100.0, 3)


def lstm_infer_sequence(sequence: list) -> float:
    """
    Run the LSTM on a sequence of MatchState objects.
    Returns home-win probability (0.0 – 1.0).
    """
    if LSTM_MODEL is None:
        return None

    try:
        import torch
        SEQ_LEN = LSTM_BUNDLE["seq_len"]  # 40
        feat = np.zeros((SEQ_LEN, 8), dtype=np.float32)

        for i, s in enumerate(sequence[-SEQ_LEN:]):
            idx = SEQ_LEN - min(len(sequence), SEQ_LEN) + i
            h_raid = _resolve_raid_rate(s) / 100.0
            a_raid = (s.away_raid_success_rate / 100.0) if s.away_raid_success_rate >= 0 else 0.50
            h_tack = (s.home_tackle_success_rate / 100.0) if s.home_tackle_success_rate >= 0 else 0.60
            a_tack = (s.away_tackle_success_rate / 100.0) if s.away_tackle_success_rate >= 0 else 0.60
            all_outs = getattr(s, 'all_outs_home', 0) or 0
            is_sh = getattr(s, 'is_second_half', 0) or 0

            feat[idx] = [
                s.score_diff / 20.0,
                s.minutes_remaining / 40.0,
                h_raid,
                a_raid,
                h_tack,
                a_tack,
                min(all_outs, 5) / 5.0,
                float(is_sh),
            ]

        x = torch.from_numpy(feat).unsqueeze(0)   # (1, SEQ_LEN, 8)
        with torch.no_grad():
            prob = LSTM_MODEL(x).item()
        return round(max(0.03, min(0.97, prob)), 3)
    except Exception as e:
        print(f"[WARN] LSTM inference failed: {e}")
        return None


def build_team_feature_vector(home_team: dict, away_team: dict, lt_map: dict):
    """Build the 20-feature vector for the RF model."""
    def _safe(d, k):
        v = d.get(k)
        return float(v) if v is not None else 0.0

    def _games(t):
        return max(float(t.get("games") or 1), 1)

    hg = _games(home_team)
    ag = _games(away_team)
    hl = lt_map.get(home_team.get("id"), {})
    al = lt_map.get(away_team.get("id"), {})

    return [
        _safe(home_team, "avg_points_scored"),
        _safe(home_team, "avg_raid_points"),
        _safe(home_team, "avg_tackle_points"),
        _safe(home_team, "super_raids") / hg,
        _safe(home_team, "super_tackles") / hg,
        _safe(home_team, "all_outs_inflicted") / hg,
        _safe(home_team, "all_outs_conceded") / hg,
        float(hl.get("wins", 0)),
        float(hl.get("losses", 0)),
        float(hl.get("ties", 0)),
        _safe(away_team, "avg_points_scored"),
        _safe(away_team, "avg_raid_points"),
        _safe(away_team, "avg_tackle_points"),
        _safe(away_team, "super_raids") / ag,
        _safe(away_team, "super_tackles") / ag,
        _safe(away_team, "all_outs_inflicted") / ag,
        _safe(away_team, "all_outs_conceded") / ag,
        float(al.get("wins", 0)),
        float(al.get("losses", 0)),
        float(al.get("ties", 0)),
    ]


# ---- API ENDPOINTS ----
PENDING_OTPS = {}

@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    otp = str(random.randint(100000, 999999))
    if req.method == "phone":
        if req.contact != "+918353945200" and req.contact.replace(" ", "") != "+918353945200":
            raise HTTPException(status_code=403, detail="Not an authorized test phone number.")
        if not twilio_client:
            raise HTTPException(status_code=500, detail="Twilio is not configured on the server.")
        message_body = f"[KabaddiIQ] Your System Override OTP is {otp}. Do not share this key."
        try:
            message = twilio_client.messages.create(body=message_body, from_=TWILIO_PHONE_NUMBER, to=req.contact)
            PENDING_OTPS[req.contact] = otp
            return {"status": "success", "message": "OTP sent.", "sid": message.sid}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    elif req.method == "email":
        if not RESEND_API_KEY:
            raise HTTPException(status_code=500, detail="Resend is not configured on the server.")
        html_content = f"""
        <div style="font-family: monospace; background: #0e0e0e; color: #ffffff; padding: 40px; text-align: center; border: 1px solid #333;">
            <h2 style="color: #6366f1; letter-spacing: 2px;">KABADDI IQ - SYSTEM OVERRIDE</h2>
            <p>An emergency access recovery protocol was initiated.</p>
            <p style="margin-top: 30px; font-size: 14px; color: #888;">YOUR DECRYPTION KEY IS:</p>
            <h1 style="font-size: 48px; letter-spacing: 10px; margin: 10px 0; color: #ffffff;">{otp}</h1>
            <p style="color: #ef4444; font-size: 10px; margin-top: 40px;">IF YOU DID NOT INITIATE THIS, SECURE YOUR ACCOUNT IMMEDIATELY.</p>
        </div>
        """
        try:
            r = resend.Emails.send({"from": "KabaddiIQ Override <onboarding@resend.dev>", "to": [req.contact], "subject": "System Override Decryption Key", "html": html_content})
            PENDING_OTPS[req.contact] = otp
            return {"status": "success", "message": f"Recovery email dispatched to {req.contact}."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="Invalid method.")

@app.post("/api/auth/verify-otp")
def verify_otp(req: VerifyOTPRequest):
    expected_otp = PENDING_OTPS.get(req.contact)
    if not expected_otp:
        raise HTTPException(status_code=400, detail="No pending OTP for this contact.")
    if req.otp != expected_otp:
        raise HTTPException(status_code=401, detail="Invalid OTP")
    del PENDING_OTPS[req.contact]
    return {"status": "success", "message": "OTP verified successfully"}

@app.get("/api/teams")
def get_teams():
    if not supabase: return []
    res = supabase.table("teams").select("*").execute()
    return res.data

@app.get("/api/teams/{team_id}/players")
def get_team_players(team_id: str):
    if not supabase: return []
    res = supabase.table("players").select("*").eq("team_id", team_id).execute()
    return res.data

@app.get("/api/players")
def get_players(position: str = None, team: str = None):
    if not supabase: return []
    query = supabase.table("players").select("*, team:teams(*)")
    if position:
        query = query.eq("position", position)
    if team:
        query = query.eq("team_id", team)
    res = query.execute()
    return res.data

@app.post("/api/players")
def create_player(player: PlayerCreate):
    if not supabase: return {"error": "Supabase not configured"}
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

@app.get("/api/players/{id}")
def get_player(id: str):
    if not supabase: return {}
    res = supabase.table("players").select("*").eq("id", id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Player not found")
    return res.data[0]

@app.put("/api/players/{id}")
def update_player(id: str, player: PlayerUpdate):
    if not supabase: return {"error": "Supabase not configured"}
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

@app.get("/api/fixtures/results")
def get_fixture_results(team: str = None):
    if not supabase: return []
    query = supabase.table("fixtures").select("*, home:teams!home_team_id(*), away:teams!away_team_id(*)").eq("is_completed", True)
    res = query.execute()
    data = res.data
    if team:
        data = [d for d in data if d["home_team_id"] == team or d["away_team_id"] == team]
    return data

@app.get("/api/fixtures/upcoming")
def get_fixture_upcoming():
    if not supabase: return []
    res = supabase.table("fixtures").select("*, home:teams!home_team_id(*), away:teams!away_team_id(*)").eq("is_completed", False).execute()
    return res.data

@app.get("/api/league-table")
def get_league_table():
    if not supabase: return []
    res = supabase.table("league_table").select("*, teams(*)").order("rank").execute()
    return res.data

# ── PREDICTION ENDPOINTS ──────────────────────────────────────────────────────

@app.post("/api/predict/win-probability")
def predict_win_probability(req: WinProbRequest):
    """LSTM win probability (sequence-aware) with formula fallback."""

    # ── Resolve current snapshot values ──────────────────────────────────────
    if req.sequence and len(req.sequence) > 0:
        latest = req.sequence[-1]
        s_diff   = latest.score_diff
        m_rem    = latest.minutes_remaining
        h_raid   = _resolve_raid_rate(latest)
    else:
        s_diff = req.score_diff if req.score_diff is not None else 0
        m_rem  = req.minutes_remaining if req.minutes_remaining is not None else 40
        h_raid = _resolve_raid_rate(req) if hasattr(req, 'home_raid_success_rate') and req.home_raid_success_rate else (
                    req.raid_success_rate if req.raid_success_rate else 50.0)

    model_used = "formula"

    # ── LSTM path: use when sequence has >= 2 steps ───────────────────────────
    home_win_prob = None
    if req.sequence and len(req.sequence) >= 2:
        home_win_prob = lstm_infer_sequence(req.sequence)
        if home_win_prob is not None:
            model_used = "lstm"

    # ── Formula fallback ──────────────────────────────────────────────────────
    if home_win_prob is None:
        home_win_prob = calc_win_probability(s_diff, m_rem, h_raid)

    # ── Trend ─────────────────────────────────────────────────────────────────
    trend = None
    if req.sequence and len(req.sequence) >= 2:
        prev = req.sequence[-2]
        if model_used == "lstm" and len(req.sequence) >= 3:
            prev_prob = lstm_infer_sequence(req.sequence[:-1])
        else:
            prev_prob = None
        if prev_prob is None:
            prev_prob = calc_win_probability(
                prev.score_diff,
                prev.minutes_remaining,
                _resolve_raid_rate(prev),
            )
        trend = round(home_win_prob - prev_prob, 3)

    return {
        "home_win_prob": home_win_prob,
        "away_win_prob": round(1.0 - home_win_prob, 3),
        "trend": trend,
        "score_diff": s_diff,
        "minutes_remaining": m_rem,
        "model": model_used,
        "sequence_length": len(req.sequence) if req.sequence else 1,
    }


@app.post("/api/predict/timeout")
def predict_timeout(req: TimeoutRequest):
    """6-signal timeout advisor with urgency scoring."""
    # Resolve raid rate from new or legacy field
    raid_rate = req.home_raid_success_rate if req.home_raid_success_rate >= 0 else (
        req.raid_success_rate if req.raid_success_rate >= 0 else 50.0)

    signals = []
    urgency_score = 0

    if req.minutes_remaining < 5 and req.score_diff < -3:
        signals.append("Trailing with less than 5 minutes remaining — critical momentum window.")
        urgency_score += 40

    if raid_rate < 35:
        signals.append(f"Raid success rate critically low ({raid_rate:.0f}%). Raiders losing confidence.")
        urgency_score += 30

    if req.score_diff < -7:
        signals.append(f"Point deficit of {abs(req.score_diff)} is dangerous. Tactical reset required.")
        urgency_score += 25

    if req.score_diff > 8 and req.minutes_remaining < 10:
        signals.append("Commanding lead in final phase. No timeout needed — preserve flow.")
        urgency_score -= 20

    if raid_rate > 55 and req.score_diff < 0:
        signals.append("Raiders performing well but defense is conceding — defensive adjustment needed.")
        urgency_score += 15

    if req.minutes_remaining > 20 and req.score_diff < -5:
        signals.append("Early large deficit. Timeout can reset defensive shape before halftime.")
        urgency_score += 20

    urgency_score = max(0, min(100, urgency_score))
    take_timeout = urgency_score >= 35

    if not signals:
        signals.append("Match state nominal. Current momentum is acceptable.")

    return {
        "advice": "Take Timeout Now" if take_timeout else "Continue Play",
        "urgency_score": urgency_score,
        "reason": signals[0],
        "all_signals": signals,
        "take_timeout": take_timeout,
    }


@app.post("/api/predict/match-outcome")
def predict_match_outcome(req: MatchOutcomeRequest):
    """Random Forest prediction: Win / Loss / Tie with probabilities."""
    if not supabase:
        return {"predicted_winner": "Unknown", "confidence": 0.5, "outcome": "Unknown"}

    team_a_res = supabase.table("teams").select("*").eq("id", req.home_team_id).limit(1).execute()
    team_b_res = supabase.table("teams").select("*").eq("id", req.away_team_id).limit(1).execute()

    if not team_a_res.data or not team_b_res.data:
        raise HTTPException(status_code=404, detail="Team not found")

    team_a = team_a_res.data[0]
    team_b = team_b_res.data[0]

    lt_map = {}
    try:
        lt_res = supabase.table("league_table").select("team_id, wins, losses, ties").execute()
        for lt in lt_res.data:
            lt_map[lt["team_id"]] = lt
    except Exception:
        pass

    # RF Model path
    if RF_MODEL is not None:
        try:
            import numpy as np
            fv = build_team_feature_vector(team_a, team_b, lt_map)
            X = np.array([fv])
            pred_enc = RF_MODEL.predict(X)[0]
            proba = RF_MODEL.predict_proba(X)[0]
            classes = RF_LABEL_ENCODER.classes_

            predicted_outcome = RF_LABEL_ENCODER.inverse_transform([pred_enc])[0]
            proba_dict = {cls: round(float(p), 3) for cls, p in zip(classes, proba)}

            if predicted_outcome == "Win":
                predicted_winner = team_a["name"]
            elif predicted_outcome == "Loss":
                predicted_winner = team_b["name"]
            else:
                predicted_winner = "Tie"

            confidence = max(0.4, min(0.97, float(max(proba))))

            return {
                "predicted_winner": predicted_winner,
                "predicted_outcome": predicted_outcome,
                "confidence": round(confidence, 3),
                "probabilities": proba_dict,
                "model": "random_forest",
                "home_team": team_a["name"],
                "away_team": team_b["name"],
            }
        except Exception as e:
            print(f"[WARN] RF prediction failed: {e}. Falling back to formula.")

    # Formula fallback
    def calc_score(team):
        avg_pts = float(team.get("avg_points_scored") or 0)
        games = max(float(team.get("games") or 1), 1)
        raids = float(team.get("successful_raids") or 0)
        tackles = float(team.get("successful_tackles") or 0)
        all_outs = float(team.get("all_outs_inflicted") or 0)
        return (avg_pts * 0.4) + ((raids / games) * 0.3) + ((tackles / games) * 0.2) + ((all_outs / games) * 0.1)

    score_a = calc_score(team_a)
    score_b = calc_score(team_b)
    total = max(score_a + score_b, 0.001)
    diff_pct = abs(score_a - score_b) / max(score_a, score_b, 0.001)

    if diff_pct < 0.05:
        predicted_winner, predicted_outcome = "Tie", "Tie"
    elif score_a > score_b:
        predicted_winner, predicted_outcome = team_a["name"], "Win"
    else:
        predicted_winner, predicted_outcome = team_b["name"], "Loss"

    return {
        "predicted_winner": predicted_winner,
        "predicted_outcome": predicted_outcome,
        "confidence": round(max(0.5, min(0.92, diff_pct)), 3),
        "probabilities": {"Win": round(score_a / total, 3), "Loss": round(score_b / total, 3), "Tie": 0.0},
        "model": "formula_fallback",
        "home_team": team_a["name"],
        "away_team": team_b["name"],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
