# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

"""
KabaddiIQ - Random Forest Training Script
==========================================
Run once to train the model:
    python train_model.py

Saves: backend/model_rf.pkl
"""

import os
import pickle
import pandas as pd
import numpy as np
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

FEATURE_COLS = [
    "home_avg_pts_scored", "home_avg_raid_pts", "home_avg_tackle_pts",
    "home_super_raids_per_g", "home_super_tackles_per_g",
    "home_all_outs_infl_per_g", "home_all_outs_conc_per_g",
    "home_wins", "home_losses", "home_ties",
    "away_avg_pts_scored", "away_avg_raid_pts", "away_avg_tackle_pts",
    "away_super_raids_per_g", "away_super_tackles_per_g",
    "away_all_outs_infl_per_g", "away_all_outs_conc_per_g",
    "away_wins", "away_losses", "away_ties",
]

TARGET_COL = "outcome"  # "Win" | "Loss" | "Tie"

print("\n[1] Fetching match_features from Supabase...")
res = supabase.table("match_features").select("*").limit(2000).execute()
rows = res.data
print(f"    Fetched {len(rows)} rows.")

if not rows:
    print("[ERR] No data in match_features. Run fix_supabase.py first.")
    sys.exit(1)

df = pd.DataFrame(rows)
print(f"    Columns: {list(df.columns)}")
print(f"    Outcome distribution:\n{df[TARGET_COL].value_counts().to_string()}")

# Drop rows with missing features
df = df.dropna(subset=FEATURE_COLS + [TARGET_COL])
print(f"\n[2] Clean rows after dropping NaN: {len(df)}")

X = df[FEATURE_COLS].astype(float)
y = df[TARGET_COL]

# ── Train/Test Split ─────────────────────────────────────────────────────────
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix

# Encode labels
le = LabelEncoder()
y_enc = le.fit_transform(y)
print(f"\n[3] Label encoding: {dict(zip(le.classes_, le.transform(le.classes_)))}")

X_train, X_test, y_train, y_test = train_test_split(
    X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
)
print(f"    Train: {len(X_train)} | Test: {len(X_test)}")

# ── Train Model ──────────────────────────────────────────────────────────────
print("\n[4] Training RandomForestClassifier...")
rf = RandomForestClassifier(
    n_estimators=300,
    max_depth=8,
    min_samples_split=3,
    min_samples_leaf=2,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1
)
rf.fit(X_train, y_train)
print("    Training complete.")

# ── Evaluate ─────────────────────────────────────────────────────────────────
y_pred = rf.predict(X_test)
print("\n[5] Classification Report:")
print(classification_report(y_test, y_pred, target_names=le.classes_))
print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# Cross-validation
cv_scores = cross_val_score(rf, X, y_enc, cv=5, scoring='accuracy')
print(f"\n[6] 5-Fold CV Accuracy: {cv_scores.mean():.3f} (+/- {cv_scores.std():.3f})")

# Feature importances
importances = pd.Series(rf.feature_importances_, index=FEATURE_COLS).sort_values(ascending=False)
print("\n[7] Top 5 Feature Importances:")
print(importances.head(5).to_string())

# ── Save ─────────────────────────────────────────────────────────────────────
save_path = os.path.join(os.path.dirname(__file__), "model_rf.pkl")
model_bundle = {
    "model": rf,
    "label_encoder": le,
    "feature_cols": FEATURE_COLS,
}
with open(save_path, "wb") as f:
    pickle.dump(model_bundle, f)

print(f"\n[OK] Model saved to: {save_path}")
print("     Now restart your FastAPI server to load the model.")
