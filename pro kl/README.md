# Kabaddi IQ

**Kabaddi IQ** is an elite Kabaddi analytics workspace and dashboard designed to forecast match outcomes using AI time-series models, manage role-based authentication setups, and power interactive dashboards for coaches, analysts, and front-office personnel.

This repository features a robust **Python/FastAPI** backend powered by PyTorch LSTM and Random Forest models, paired with a comprehensive **React/Vite** frontend built with TailwindCSS for modern, responsive design.

## 🚀 Key Features

### **AI-Powered Analytics**
- **LSTM Time-Series Model**: Real-time win probability predictions based on match sequences
- **Random Forest Model**: Pre-match outcome predictions using team statistics
- **Smart Timeout Advisor**: Tactical recommendations with urgency scoring
- **Live Telemetry**: Real-time match state tracking and analysis

### **Coach Dashboard**
- **Dynamic Team Formations**: Real player data integration from database
- **Intelligent Substitution System**: Smart player replacement with role compatibility
- **Live Match Tracking**: Score tracking, stamina monitoring, and performance analytics
- **Visual Feedback**: Instant updates with professional UI animations

### **Player Management**
- **Real Team Rosters**: Integration with actual team and player databases
- **Performance Metrics**: Comprehensive player statistics and analytics
- **Stamina Tracking**: Real-time player condition monitoring
- **Bench Management**: Smart substitution recommendations

## Project Structure

```
.
├── backend/                    # FastAPI Server & AI Architecture
│   ├── main.py                # Server endpoints & AI model integration
│   ├── train_lstm.py          # LSTM model training pipeline
│   ├── train_model.py         # Random Forest model training
│   ├── model_lstm.pkl         # Trained LSTM model
│   ├── model_rf.pkl           # Trained Random Forest model
│   ├── requirements.txt       # Python dependencies
│   ├── .env.example          # Backend environment template
│   └── seed_data.py          # Database seeding utilities
├── frontend/                   # Modern React/Vite Frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── CoachDashboard.jsx    # Main coach interface
│   │   │   ├── PlayerDashboard.jsx   # Player management
│   │   │   └── AnalystDashboard.jsx  # Analytics interface
│   │   ├── components/
│   │   │   └── Layout.jsx            # App layout with navigation
│   │   └── lib/
│   │       └── supabase.js           # Database client
│   ├── coach_dash.html        # Static coach dashboard
│   ├── player_roster.html     # Static player roster
│   ├── package.json          # Node dependencies
│   └── .env.example          # Frontend environment template
├── PlayerData.csv            # Player statistics database
├── TeamData.csv             # Team performance metrics
└── FixtureResults.csv       # Match results data
```

## Prerequisites

Before setting up Kabaddi IQ, ensure your local environment has the following installed:
- **Python 3.9+** (for backend AI models)
- **Node.js 18+** (for frontend development)
- **Supabase Account** (for managed database and authentication)

## 🛠️ Quick Start

### Option 1: Automated Setup (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd kabaddi-iq

# Start both servers simultaneously
# Backend: http://127.0.0.1:8000
# Frontend: http://localhost:5173
```

### Option 2: Manual Setup

## 1. Backend Setup

The backend features dual AI models: an LSTM for sequence-based predictions and Random Forest for pre-match analysis.

### Installation
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies with PyTorch CPU support
pip install -r requirements.txt
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

### Environment Configuration
```bash
cp .env.example .env
```

Configure your `.env` file with:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number
RESEND_API_KEY=your_resend_api_key
```

### Start Backend Server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Expected Output:**
```
[OK] Random Forest model loaded from model_rf.pkl
[OK] LSTM model loaded from model_lstm.pkl
INFO: Application startup complete.
```

## 2. Frontend Setup

Modern React application with TailwindCSS styling and real-time updates.

### Installation
```bash
cd frontend
npm install
```

### Environment Configuration
```bash
cp .env.example .env
```

Configure your `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://127.0.0.1:8000
```

### Start Frontend Server
```bash
npm run dev
```

**Access the application at:** http://localhost:5173

## 🎯 Usage Guide

### Coach Dashboard Features

1. **Live Match Tracking**
   - Real-time score input and win probability calculation
   - LSTM-powered sequence analysis for accurate predictions
   - Dynamic timeout recommendations

2. **Team Formation Management**
   - View active lineup with real player data
   - Monitor player stamina and performance
   - Smart substitution system with role compatibility

3. **Substitution System**
   - Automatic detection of low-stamina players
   - One-click substitution with bench player selection
   - Visual feedback and formation updates

4. **AI Predictions**
   - **Win Probability**: Real-time LSTM predictions
   - **Timeout Advisor**: Smart tactical recommendations
   - **Match Outcome**: Pre-match Random Forest analysis

### Key Endpoints

- **GET** `/api/teams` - Retrieve all teams
- **GET** `/api/teams/{team_id}/players` - Get team roster
- **POST** `/api/predict/win-probability` - LSTM win prediction
- **POST** `/api/predict/timeout` - Timeout recommendations
- **POST** `/api/predict/match-outcome` - Pre-match analysis

## 🔧 Development

### Model Training
```bash
# Train LSTM model
python backend/train_lstm.py

# Train Random Forest model
python backend/train_model.py
```

### Database Seeding
```bash
python backend/seed_data.py
```

## 🚀 Deployment

The application is configured for deployment on:
- **Backend**: Any Python hosting service (Heroku, Railway, etc.)
- **Frontend**: Vercel, Netlify, or similar static hosting

## 📊 Data Sources

- **PlayerData.csv**: Comprehensive player statistics
- **TeamData.csv**: Team performance metrics
- **FixtureResults.csv**: Historical match results
- **Supabase Database**: Real-time data storage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

**Kabaddi IQ** - Transforming Kabaddi analytics with AI-powered insights.
