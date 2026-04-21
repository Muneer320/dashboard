import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './components/landing';
import { Credentials, Login } from './components/auth';
import { Dashboard, EventDetail } from './components/dashboard';
import { Explore, Schedule, Leaderboard } from './components/discover';
import { Mirage, Announcements, LostFound } from './components/community';
import { Rating, Feedback, Report } from './components/forms';
import AdminApp from './admin-panel/App';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Panel Entry */}
        <Route path="/admin/*"       element={<AdminApp />} />

        {/* User Interfaces */}
        <Route path="/"              element={<Landing />} />
        <Route path="/credentials"   element={<Credentials />} />
        <Route path="/login"         element={<Login />} />
        <Route path="/dashboard"     element={<Dashboard />} />
        <Route path="/event-detail"  element={<EventDetail />} />
        <Route path="/explore"       element={<Explore />} />
        <Route path="/schedule"      element={<Schedule />} />
        <Route path="/leaderboard"   element={<Leaderboard />} />
        <Route path="/mirage"        element={<Mirage />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/lost-found"    element={<LostFound />} />
        <Route path="/rating"        element={<Rating />} />
        <Route path="/feedback"      element={<Feedback />} />
        <Route path="/report"        element={<Report />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
