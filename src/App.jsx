import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/landingpage/LandingPage';
import EventsPage from './pages/EventsPage';
import BrowseAlbumsPage from './pages/BrowseAlbumsPage';
import BrowseQueue from './pages/BrowseQueue';
import NowPlayingPage from './pages/NowPlayingPage';
import AlbumDetailPage from './pages/AlbumDetailPage';
import LoginPage from './pages/admin/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageEvents from './pages/admin/ManageEvents';
import EditEventForm from './components/EditEventForm';
import EditQueue from './pages/admin/EditQueue';
import SetNowPlaying from './pages/admin/SetNowPlaying';
import ImportDiscogs from './pages/admin/ImportDiscogs';
import BlockSides from './pages/admin/BlockSides';
import ImportCollection from './pages/admin/ImportCollection';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/browse" element={<BrowseAlbumsPage />} />
        <Route path="/browse-queue" element={<BrowseQueue />} />
        <Route path="/now-playing" element={<NowPlayingPage />} />
        <Route path="/album/:id" element={<AlbumDetailPage />} />

        {/* Admin Login */}
        <Route path="/admin/login" element={<LoginPage />} />

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
