# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

"""
KabaddiIQ — LSTM Live Win Probability Trainer
==============================================
Generates synthetic Kabaddi match sequences and trains a PyTorch LSTM.

Run once:
    python train_lstm.py

Saves: backend/model_lstm.pkl
Requires: torch, numpy, scikit-learn
"""

import os
import math
import pickle
import random
import numpy as np

# ── Synthetic Match Data Generator ───────────────────────────────────────────

def generate_match_sequence(match_id: int, seq_len: int = 40):
    """
    Simulate a single Kabaddi match as a sequence of per-minute snapshots.

    Features per time step (8 total):
        0: score_diff               — home_score - away_score
        1: minutes_remaining        — 40 → 0
        2: home_raid_success_rate   — fraction 0.0–1.0
        3: away_raid_success_rate   — fraction 0.0–1.0
        4: home_tackle_success_rate — fraction 0.0–1.0
        5: away_tackle_success_rate — fraction 0.0–1.0
        6: all_outs_home            — cumulative all-outs by home team (normalised /5)
        7: is_second_half           — 0 or 1

    Label: 1.0 if home wins, 0.5 if tie, 0.0 if away wins
    """
    rng = random.Random(match_id)

    # Team strengths: 0.4 – 0.8, with slight home advantage
    home_strength = rng.uniform(0.42, 0.80)
    away_strength = rng.uniform(0.40, 0.78)

    home_score = 0
    away_score = 0
    all_outs_home = 0

    sequence = []

    for t in range(seq_len):
        minutes_elapsed = t
        minutes_remaining = 40 - t
        is_second_half = 1.0 if t >= 20 else 0.0

        # Per-minute point generation (on average ~0.8 pts/min per team)
        # Each raid ~30s → ~2 raids/min per team
        raids_this_minute = 2

        # Home team raids
        h_raid_rate = max(0.25, min(0.90, rng.gauss(home_strength, 0.08)))
        h_tackle_rate = max(0.30, min(0.95, rng.gauss(home_strength * 0.9, 0.07)))
        h_raids_success = sum(1 for _ in range(raids_this_minute) if rng.random() < h_raid_rate)
        home_score += h_raids_success

        # Away team raids
        a_raid_rate = max(0.25, min(0.90, rng.gauss(away_strength, 0.08)))
        a_tackle_rate = max(0.30, min(0.95, rng.gauss(away_strength * 0.9, 0.07)))
        a_raids_success = sum(1 for _ in range(raids_this_minute) if rng.random() < a_raid_rate)
        away_score += a_raids_success

        # All-outs: random events with ~5% chance per minute for home team
        if rng.random() < 0.05 * home_strength:
            all_outs_home += 1
            away_score = max(0, away_score - 2)  # all-out gives 2 pts + resets opponent

        score_diff = home_score - away_score

        # Build feature vector (normalise for LSTM stability)
        step = [
            score_diff / 20.0,                  # score_diff: ±20 range → ±1.0
            minutes_remaining / 40.0,            # minutes_remaining: 40→0 / 40
            h_raid_rate,                         # already 0–1
            a_raid_rate,
            h_tackle_rate,
            a_tackle_rate,
            min(all_outs_home, 5) / 5.0,        # normalised 0–1
            is_second_half,
        ]
        sequence.append(step)

    # Final label
    if home_score > away_score:
        label = 1.0
    elif home_score < away_score:
        label = 0.0
    else:
        label = 0.5

    return np.array(sequence, dtype=np.float32), label


def build_dataset(n_matches: int = 5000, seq_len: int = 40):
    print(f"[1] Generating {n_matches} synthetic Kabaddi match sequences...")
    X_list, y_list = [], []
    for i in range(n_matches):
        seq, label = generate_match_sequence(i, seq_len)
        # Use every suffix of the sequence as a training example
        # (so the model learns at every phase of the match)
        for end in range(2, seq_len + 1, 2):      # step=2 to limit dataset size
            X_list.append(seq[:end])              # variable length → we'll pad below
            y_list.append(label)

    # Pad all sequences to seq_len
    X_padded = np.zeros((len(X_list), seq_len, 8), dtype=np.float32)
    for i, seq in enumerate(X_list):
        X_padded[i, :len(seq)] = seq

    y_arr = np.array(y_list, dtype=np.float32)
    print(f"    Total samples: {len(y_arr)}")
    print(f"    Home wins: {(y_arr == 1.0).sum()} | Away wins: {(y_arr == 0.0).sum()} | Ties: {(y_arr == 0.5).sum()}")
    return X_padded, y_arr


# ── PyTorch LSTM Model ────────────────────────────────────────────────────────

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
    from sklearn.model_selection import train_test_split
except ImportError:
    print("[ERR] PyTorch not installed. Run: pip install torch scikit-learn numpy")
    sys.exit(1)


class KabaddiLSTM(nn.Module):
    """
    2-layer LSTM → FC → Sigmoid
    Input:  (batch, seq_len, 8)
    Output: (batch,)  — win probability for home team
    """
    def __init__(self, input_size: int = 8, hidden_size: int = 64, num_layers: int = 2, dropout: float = 0.3):
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
        # x: (batch, seq_len, input_size)
        lstm_out, _ = self.lstm(x)
        last_step = lstm_out[:, -1, :]          # take the last time step output
        out = self.dropout(last_step)
        prob = self.fc(out).squeeze(-1)         # (batch,)
        return prob


# ── Training ──────────────────────────────────────────────────────────────────

def train():
    SEED = 42
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    random.seed(SEED)

    SEQ_LEN = 40
    BATCH_SIZE = 256
    EPOCHS = 40
    LR = 1e-3

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[0] Device: {device}")

    X, y = build_dataset(n_matches=5000, seq_len=SEQ_LEN)

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.15, random_state=SEED)
    print(f"\n[2] Train: {len(X_train)} | Val: {len(X_val)}")

    train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train))
    val_ds   = TensorDataset(torch.from_numpy(X_val),   torch.from_numpy(y_val))
    train_dl = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_dl   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    model = KabaddiLSTM(input_size=8, hidden_size=64, num_layers=2, dropout=0.3).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)
    criterion = nn.BCELoss()

    print(f"\n[3] Training for {EPOCHS} epochs...")
    best_val_loss = float("inf")
    best_state = None

    for epoch in range(1, EPOCHS + 1):
        # Train
        model.train()
        train_loss = 0.0
        for xb, yb in train_dl:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            preds = model(xb)
            loss = criterion(preds, yb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            train_loss += loss.item() * len(xb)
        train_loss /= len(X_train)

        # Validate
        model.eval()
        val_loss = 0.0
        correct = 0
        total = 0
        with torch.no_grad():
            for xb, yb in val_dl:
                xb, yb = xb.to(device), yb.to(device)
                preds = model(xb)
                val_loss += criterion(preds, yb).item() * len(xb)
                predicted_class = (preds > 0.5).float()
                label_class = (yb > 0.5).float()
                correct += (predicted_class == label_class).sum().item()
                total += len(yb)
        val_loss /= len(X_val)
        val_acc = correct / total * 100

        scheduler.step()

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

        if epoch % 5 == 0 or epoch == 1:
            print(f"    Epoch {epoch:02d}/{EPOCHS} | train_loss={train_loss:.4f} | val_loss={val_loss:.4f} | val_acc={val_acc:.1f}%")

    # Restore best weights
    model.load_state_dict(best_state)
    print(f"\n[4] Best val_loss: {best_val_loss:.4f}")

    # ── Save ──────────────────────────────────────────────────────────────────
    save_path = os.path.join(os.path.dirname(__file__), "model_lstm.pkl")
    bundle = {
        "model_state": best_state,
        "input_size": 8,
        "hidden_size": 64,
        "num_layers": 2,
        "dropout": 0.3,
        "seq_len": SEQ_LEN,
        "feature_names": [
            "score_diff",
            "minutes_remaining",
            "home_raid_success_rate",
            "away_raid_success_rate",
            "home_tackle_success_rate",
            "away_tackle_success_rate",
            "all_outs_home",
            "is_second_half",
        ],
        "normalisation": {
            "score_diff": {"divide_by": 20.0},
            "minutes_remaining": {"divide_by": 40.0},
            "all_outs_home": {"divide_by": 5.0, "clip_max": 5},
        },
    }
    with open(save_path, "wb") as f:
        pickle.dump(bundle, f)
    print(f"[OK] LSTM model saved to: {save_path}")
    print("     Restart your FastAPI server to load the model.")


if __name__ == "__main__":
    train()
