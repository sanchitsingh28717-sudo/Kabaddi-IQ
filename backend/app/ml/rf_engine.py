import os
import pickle

RF_MODEL = None
RF_LABEL_ENCODER = None
RF_FEATURE_COLS = None

_base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_model_path = os.path.join(_base_dir, "model_rf.pkl")

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
    print(f"[WARN] model_rf.pkl not found at {_model_path}")

def build_team_feature_vector(home_team: dict, away_team: dict, lt_map: dict):
    """Build the 20-feature vector for the RF model based on team historical profiles."""
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
