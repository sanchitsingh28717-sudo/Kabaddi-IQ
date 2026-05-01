import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// Mock simple imports until we create them fully
import Login from './pages/Login';
import CoachDashboard from './pages/CoachDashboard';
import PlayerDashboard from './pages/PlayerDashboard';
import PlayerDetail from './pages/PlayerDetail';
import AnalystDashboard from './pages/AnalystDashboard';
import AuctionDashboard from './pages/AuctionDashboard';
import ForgotPassword from './pages/ForgotPassword';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/analyst" replace />} />
          <Route path="coach" element={<CoachDashboard />} />
          <Route path="player" element={<PlayerDashboard />} />
          <Route path="player/:id" element={<PlayerDetail />} />
          <Route path="analyst" element={<AnalystDashboard />} />
          <Route path="auction" element={<AuctionDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
