#!/bin/bash
# =========================================================================
-- KABADDI IQ: AUTOMATED SUPABASE DATABASE SETUP & SEED SCRIPT
-- =========================================================================
# This script executes all DDL queries, seeds CSV data, and builds AI features
# for your Supabase backend automatically.
# =========================================================================

# Clear terminal screen
clear

echo "========================================================="
echo "   Kabaddi IQ - Setup & Calibration Helper"
echo "========================================================="
echo ""

# Ensure we are in the repository root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 1. Activate Python Virtual Environment
echo "[1] Activating python virtual environment..."
if [ -d "backend/venv" ]; then
    source backend/venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "❌ Virtual environment (venv) not found. Attempting to run with system python3..."
fi

# Make sure requests and other dependencies are installed
echo "[2] Ensuring setup dependencies are active..."
pip install -r backend/requirements.txt --quiet

# 2. Run DDL migration
echo ""
echo "[3] Running apply_ddl.py to deploy database tables..."
python3 backend/apply_ddl.py

# 3. Seed data
echo ""
echo "[4] Running seed_data.py to ingest players, teams, and standings..."
python3 backend/seed_data.py

# 4. Calibrate ML pipeline
echo ""
echo "[5] Running fix_supabase.py to build match outcome labels & AI feature sets..."
python3 backend/fix_supabase.py

echo ""
echo "========================================================="
echo "   Database setup completed!"
echo "   Your Kabaddi IQ backend is calibrated and fully active."
echo "========================================================="
