import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUserAuth } from './lib/UserAuthContext';
import { token } from './lib/api';
import Landing from './components/landing';
import { Credentials, Login } from './components/auth';
import { Dashboard, EventDetail } from './components/dashboard';
import { Explore, Schedule, Leaderboard } from './components/discover';
import { Mirage, Announcements, LostFound } from './components/community';
import { Rating, Feedback, Report } from './components/forms';
import AdminApp from './admin-panel/App';
import FAQ from './components/faq';
import {
  CoinsHomePage,
  UGCSubmitPage,
  LeaderboardPage as CoinsLeaderboardPage,
  RewardsPage,
  CoinHistoryPage,
  MyQRPage,
  GuidePage,
  TermsPage,
} from './components/sidequest';
import RedemptionBooth from './components/redemption';

/** Blocks access to protected user pages — redirects to /login if not authed. */
function RequireAuth({ children }) {
  const { user, ready } = useUserAuth();
  if (!ready) return null; // wait for token check before rendering
  return user ? children : <Navigate to="/login" replace />;
}

/** Blocks /coins/* for users whose is_attending flag is false. */
function RequireAttending({ children }) {
  const { user, ready } = useUserAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_attending) return <Navigate to="/dashboard" replace />;
  return children;
}

/** Prevents logged-in users from seeing login page again. Redirects to respective dashboards. */
function GuestOnly({ children }) {
  const { user, ready } = useUserAuth();
  
  if (token.getAdmin()) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (!ready) return null;
  return !user ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Panel Entry — has its own auth */}
        <Route path="/admin/*"       element={<AdminApp />} />

        {/* Public */}
        <Route path="/"              element={<GuestOnly><Landing /></GuestOnly>} />
        <Route path="/login"         element={<GuestOnly><Login /></GuestOnly>} />
        {/* <Route path="/credentials"   element={<Credentials />} /> */}
        <Route path="/faq"           element={<FAQ />} />
        <Route path="/schedule"      element={<Schedule />}/>
        <Route path="/explore"       element={<Explore />}/>


        {/* Protected user app */}
        <Route path="/dashboard"     element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/event-detail/:eventId" element={<RequireAuth><EventDetail /></RequireAuth>} />
        <Route path="/leaderboard"   element={<RequireAuth><Leaderboard /></RequireAuth>} />
        <Route path="/mirage"        element={<RequireAuth><Mirage /></RequireAuth>} />
        <Route path="/announcements" element={<RequireAuth><Announcements /></RequireAuth>} />
        <Route path="/lost-found"    element={<RequireAuth><LostFound /></RequireAuth>} />
        <Route path="/rating"        element={<RequireAuth><Rating /></RequireAuth>} />
        <Route path="/feedback"      element={<RequireAuth><Feedback /></RequireAuth>} />
        {/* <Route path="/report"        element={<RequireAuth><Report /></RequireAuth>} /> */}

        {/* Redemption Booth — has its own auth (redemption_volunteer JWT) */}
        <Route path="/redemption"        element={<RedemptionBooth />} />

        {/* Sidequest — Ascent Coins */}
        <Route path="/coins"             element={<RequireAttending><CoinsHomePage /></RequireAttending>} />
        <Route path="/coins/submit"      element={<RequireAttending><UGCSubmitPage /></RequireAttending>} />
        <Route path="/coins/leaderboard" element={<RequireAttending><CoinsLeaderboardPage /></RequireAttending>} />
        <Route path="/coins/rewards"     element={<RequireAttending><RewardsPage /></RequireAttending>} />
        <Route path="/coins/qr"          element={<RequireAttending><MyQRPage /></RequireAttending>} />
        <Route path="/coins/history"     element={<RequireAttending><CoinHistoryPage /></RequireAttending>} />
        <Route path="/coins/guide"       element={<RequireAttending><GuidePage /></RequireAttending>} />
        <Route path="/coins/terms"       element={<RequireAttending><TermsPage /></RequireAttending>} />

        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
