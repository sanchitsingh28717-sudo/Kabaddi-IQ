from fastapi import APIRouter, HTTPException
from app.core.database import supabase, CSV_TEAMS, CSV_LEAGUE_TABLE, find_csv_team_by_name
from app.schemas.predictions import WinProbRequest, TimeoutRequest, MatchOutcomeRequest
from app.ml.lstm_engine import lstm_infer_sequence, calc_win_probability, _resolve_raid_rate
from app.ml.rf_engine import RF_MODEL, RF_LABEL_ENCODER, build_team_feature_vector

router = APIRouter(prefix="/api/predict", tags=["AI Modeling & Predictions"])

@router.post("/win-probability")
def predict_win_probability(req: WinProbRequest):
    """LSTM-based real-time win probability forecasting with fallback formula."""
    if req.sequence and len(req.sequence) > 0:
        latest = req.sequence[-1]
        s_diff = latest.score_diff
        m_rem = latest.minutes_remaining
        h_raid = _resolve_raid_rate(latest)
    else:
        s_diff = req.score_diff if req.score_diff is not None else 0
        m_rem = req.minutes_remaining if req.minutes_remaining is not None else 40
        h_raid = _resolve_raid_rate(req) if hasattr(req, 'home_raid_success_rate') and req.home_raid_success_rate else (
            req.raid_success_rate if req.raid_success_rate else 50.0
        )

    model_used = "formula"
    home_win_prob = None

    if req.sequence and len(req.sequence) >= 2:
        home_win_prob = lstm_infer_sequence(req.sequence)
        if home_win_prob is not None:
            model_used = "lstm"

    if home_win_prob is None:
        home_win_prob = calc_win_probability(s_diff, m_rem, h_raid)

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

@router.post("/timeout")
def predict_timeout(req: TimeoutRequest):
    """Real-time Timeout Decision Advisor using tactical momentum alerts and urgency scoring."""
    raid_rate = req.home_raid_success_rate if req.home_raid_success_rate >= 0 else (
        req.raid_success_rate if req.raid_success_rate >= 0 else 50.0
    )

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

@router.post("/match-outcome")
def predict_match_outcome(req: MatchOutcomeRequest):
    """Pre-match win probability classifier using trained Random Forest model and CSV fallback."""
    team_a = None
    team_b = None
    lt_map = {}
    
    if supabase:
        try:
            team_a_res = supabase.table("teams").select("*").eq("id", req.home_team_id).limit(1).execute()
            team_b_res = supabase.table("teams").select("*").eq("id", req.away_team_id).limit(1).execute()
            if team_a_res.data and team_b_res.data:
                team_a = team_a_res.data[0]
                team_b = team_b_res.data[0]
            
            try:
                lt_res = supabase.table("league_table").select("team_id, wins, losses, ties").execute()
                if lt_res.data:
                    for lt in lt_res.data:
                        lt_map[lt["team_id"]] = lt
            except Exception:
                pass
        except Exception as e:
            print(f"[WARN] Supabase team fetch in predict_match_outcome failed, using CSV fallback: {e}")

    # Fallback to local CSV if not found in database
    if not team_a or not team_b:
        team_a = next((t for t in CSV_TEAMS if t["id"] == req.home_team_id), None)
        team_b = next((t for t in CSV_TEAMS if t["id"] == req.away_team_id), None)
        
        if not team_a:
            team_a = find_csv_team_by_name(req.home_team_id)
        if not team_b:
            team_b = find_csv_team_by_name(req.away_team_id)
            
        # Populate lt_map from CSV_LEAGUE_TABLE
        for lt in CSV_LEAGUE_TABLE:
            lt_map[lt["team_id"]] = {
                "team_id": lt["team_id"],
                "wins": lt["wins"],
                "losses": lt["losses"],
                "ties": lt["ties"]
            }

    if not team_a or not team_b:
        raise HTTPException(status_code=404, detail="Team not found")

    # Random Forest Inference
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

    # Formula fallback logic
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
