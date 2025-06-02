import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Public Pages
import LandingPage from './pages/LandingPage';
import EventsPage from './pages/EventsPage';
import EventDetail from './pages/EventDetail';
import BrowsePage from './pages/BrowsePage';
import NowPlayingPage from './pages/NowPlayingPage';
import BrowseAlbumsPage from './pages/browse/BrowseAlbumsPage';
import AlbumDetailPage from './pages/browse/AlbumDetailPage';

// Admin Pages
import AdminDashboard from './pages/AdminDashboard';
import EditQueue from './pages/EditQueue';
import SetNowPlaying from './pages/SetNowPlaying';
import ImportDiscogs from './pages/ImportDiscogs';
import BlockSides from './pages/BlockSides';
import ImportCollection from './pages/ImportCollection';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/event/:id" element={<EventDetail />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/now-playing" element={<NowPlayingPage />} />
        <Route path="/albums" element={<BrowseAlbumsPage />} />
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
