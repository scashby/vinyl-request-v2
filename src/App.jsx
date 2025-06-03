import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import EventsPage from './pages/events/EventsPage';
import EventDetail from './pages/events/EventDetail';
import BrowseQueue from './pages/browse/BrowseQueue';
import NowPlayingPage from './pages/now-playing/NowPlayingPage';
import BrowseAlbumsPage from './pages/browse/BrowseAlbumsPage';
import AlbumDetailPage from './pages/browse/AlbumDetailPage';

import AdminDashboard from './pages/admin/AdminDashboard';
import EditQueue from './pages/admin/EditQueue';
import SetNowPlaying from './pages/admin/SetNowPlaying';
import ImportDiscogs from './pages/admin/ImportDiscogs';
import BlockSides from './pages/admin/BlockSides';
import ImportCollection from './pages/admin/ImportCollection';
import ManageEvents from './pages/admin/ManageEvents';
import EditEventForm from './components/EditEventForm';
import LoginPage from './pages/admin/LoginPage';

const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  if (loading) return null;
  if (!session) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  return children;
};

function App() {
  return (
    <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/browse" element={<BrowseAlbumsPage />} />
          <Route path="/browse-queue" element={<BrowseQueue />} />
          <Route path="/now-playing" element={<NowPlayingPage />} />
          <Route path="/album/:id" element={<AlbumDetailPage />} /> 

          {/* Admin Login */}
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Admin */}
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/events" element={<ProtectedRoute><ManageEvents /></ProtectedRoute>} />
          <Route path="/admin/events/new" element={<ProtectedRoute><EditEventForm /></ProtectedRoute>} />
          <Route path="/admin/events/:id" element={<ProtectedRoute><EditEventForm /></ProtectedRoute>} />
          <Route path="/admin/edit-queue" element={<ProtectedRoute><EditQueue /></ProtectedRoute>} />
          <Route path="/admin/set-now-playing" element={<ProtectedRoute><SetNowPlaying /></ProtectedRoute>} />
          <Route path="/admin/import-discogs" element={<ProtectedRoute><ImportDiscogs /></ProtectedRoute>} />
          <Route path="/admin/block-sides" element={<ProtectedRoute><BlockSides /></ProtectedRoute>} />
          <Route path="/admin/import-collection" element={<ProtectedRoute><ImportCollection /></ProtectedRoute>} />
        </Routes>
    </Router>
  );
}

export default App;
