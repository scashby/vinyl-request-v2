import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Public Pages
import LandingPage from './pages/LandingPage';
import EventsPage from './pages/events/EventsPage';
import EventDetail from './pages/events/EventDetail';
import BrowseQueue from './pages/browse/BrowseQueue';
import NowPlayingPage from './pages/now-playing/NowPlayingPage';
import BrowseAlbumsPage from './pages/browse/BrowseAlbumsPage';
import AlbumDetailPage from './pages/browse/AlbumDetailPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import EditQueue from './pages/admin/EditQueue';
import SetNowPlaying from './pages/admin/SetNowPlaying';
import ImportDiscogs from './pages/admin/ImportDiscogs';
import BlockSides from './pages/admin/BlockSides';
import ImportCollection from './pages/admin/ImportCollection';

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

        {/* Admin */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/edit-queue" element={<EditQueue />} />
        <Route path="/admin/set-now-playing" element={<SetNowPlaying />} />
        <Route path="/admin/import-discogs" element={<ImportDiscogs />} />
        <Route path="/admin/block-sides" element={<BlockSides />} />
        <Route path="/admin/import-collection" element={<ImportCollection />} />
      </Routes>
    </Router>
  );
}

export default App;
