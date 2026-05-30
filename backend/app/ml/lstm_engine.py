import os
import pickle
import math
import numpy as np
import torch
import torch.nn as nn

# LSTM Model Definition
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

# Load LSTM bundle
LSTM_MODEL = None
LSTM_BUNDLE = None

_base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_lstm_path = os.path.join(_base_dir, "model_lstm.pkl")

if os.path.exists(_lstm_path):
    try:
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
    print(f"[WARN] LSTM model file not found at {_lstm_path}")

def _resolve_raid_rate(state) -> float:
    if hasattr(state, 'home_raid_success_rate') and state.home_raid_success_rate >= 0:
        return state.home_raid_success_rate
    if hasattr(state, 'raid_success_rate') and state.raid_success_rate >= 0:
        return state.raid_success_rate
    return 50.0

def calc_win_probability(score_diff: int, minutes_remaining: int, raid_success_rate: float) -> float:
    """Logistic win probability calculation formula fallback."""
    base = 50.0
    base += math.tanh(score_diff / 8.0) * 35.0
    time_factor = (40 - minutes_remaining) / 40.0
    if score_diff != 0:
        base += math.copysign(time_factor * 10.0, score_diff)
    raid_delta = (raid_success_rate - 50.0) / 50.0
    base += raid_delta * 8.0
    return round(max(3.0, min(97.0, base)) / 100.0, 3)

def lstm_infer_sequence(sequence: list) -> float:
    """Run PyTorch LSTM inference over a state sequence."""
    if LSTM_MODEL is None:
        return None

    try:
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
