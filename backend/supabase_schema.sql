-- =========================================================================
-- KABADDI IQ: COMPLETE SUPABASE SQL SCHEMA
-- =========================================================================
-- Copy and paste this script directly into the Supabase SQL Editor
-- (https://supabase.com/dashboard/project/_/sql/new) to set up your database tables.
-- =========================================================================

-- Enable UUID extension (in case it is not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TEAMS TABLE
CREATE TABLE IF NOT EXISTS teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    games INT DEFAULT 0,
    total_points_scored INT DEFAULT 0,
    total_points_conceded INT DEFAULT 0,
    avg_points_scored FLOAT DEFAULT 0.0,
    avg_raid_points FLOAT DEFAULT 0.0,
    avg_tackle_points FLOAT DEFAULT 0.0,
    successful_raids INT DEFAULT 0,
    raid_points INT DEFAULT 0,
    successful_tackles INT DEFAULT 0,
    tackle_points INT DEFAULT 0,
    super_raids INT DEFAULT 0,
    super_tackles INT DEFAULT 0,
    do_or_die_raid_points INT DEFAULT 0,
    all_outs_inflicted INT DEFAULT 0,
    all_outs_conceded INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PLAYERS TABLE
CREATE TABLE IF NOT EXISTS players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    position TEXT,
    born TEXT,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    height TEXT,
    nationality TEXT,
    weight TEXT,
    matches_played INT DEFAULT 0,
    points INT DEFAULT 0,
    career_best_points INT DEFAULT 0,
    not_out_pct FLOAT DEFAULT 0.0,
    raids INT DEFAULT 0,
    successful_raids INT DEFAULT 0,
    unsuccessful_raids INT DEFAULT 0,
    empty_raids INT DEFAULT 0,
    successful_raid_pct FLOAT DEFAULT 0.0,
    raid_touch_points INT DEFAULT 0,
    raid_bonus_points INT DEFAULT 0,
    total_raid_points INT DEFAULT 0,
    super_raids INT DEFAULT 0,
    super_10s INT DEFAULT 0,
    tackles INT DEFAULT 0,
    successful_tackles INT DEFAULT 0,
    unsuccessful_tackles INT DEFAULT 0,
    tackles_per_match FLOAT DEFAULT 0.0,
    tackle_bonus_points INT DEFAULT 0,
    tackle_success_rate FLOAT DEFAULT 0.0,
    super_tackles INT DEFAULT 0,
    high_5s INT DEFAULT 0,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. FIXTURES TABLE
CREATE TABLE IF NOT EXISTS fixtures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date TEXT,
    home_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    away_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    result_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    is_completed BOOLEAN DEFAULT false,
    outcome TEXT, -- 'Win' | 'Loss' | 'Tie'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. LEAGUE TABLE
CREATE TABLE IF NOT EXISTS league_table (
    id SERIAL PRIMARY KEY,
    rank INT DEFAULT 0,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    played INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    ties INT DEFAULT 0,
    score_diff INT DEFAULT 0,
    points INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. MATCH FEATURES TABLE (Needed for pre-match Random Forest outcomes)
CREATE TABLE IF NOT EXISTS match_features (
    id SERIAL PRIMARY KEY,
    fixture_id UUID REFERENCES fixtures(id) ON DELETE CASCADE,
    home_avg_pts_scored FLOAT,
    home_avg_raid_pts FLOAT,
    home_avg_tackle_pts FLOAT,
    home_super_raids_per_g FLOAT,
    home_super_tackles_per_g FLOAT,
    home_all_outs_infl_per_g FLOAT,
    home_all_outs_conc_per_g FLOAT,
    home_wins INT,
    home_losses INT,
    home_ties INT,
    away_avg_pts_scored FLOAT,
    away_avg_raid_pts FLOAT,
    away_avg_tackle_pts FLOAT,
    away_super_raids_per_g FLOAT,
    away_super_tackles_per_g FLOAT,
    away_all_outs_infl_per_g FLOAT,
    away_all_outs_conc_per_g FLOAT,
    away_wins INT,
    away_losses INT,
    away_ties INT,
    outcome TEXT NOT NULL -- 'Win' | 'Loss' | 'Tie'
);

-- Enable Row Level Security (RLS) if desired.
-- NOTE: If accessing via SUPABASE_SERVICE_ROLE_KEY from FastAPI, RLS is automatically bypassed.
-- If using anon key from frontend, you might want to create read policies or disable RLS:
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE fixtures DISABLE ROW LEVEL SECURITY;
ALTER TABLE league_table DISABLE ROW LEVEL SECURITY;
ALTER TABLE match_features DISABLE ROW LEVEL SECURITY;
