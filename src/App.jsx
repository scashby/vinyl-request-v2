import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import LandingPage from './pages/public/LandingPage';
import EventsPage from './pages/public/EventsPage';
import EventDetail from './pages/events/EventDetail';
import BrowseAlbumsPage from './pages/public/BrowseAlbumsPage';
import BrowseQueue from './pages/public/BrowseQueue';
import NowPlayingPage from './pages/public/NowPlayingPage';
import AlbumDetailPage from './pages/public/AlbumDetailPage';

import ManageEvents from './pages/admin/ManageEvents';
import EditEventForm from './components/EditEventForm';
import LoginPage from './pages/admin/LoginPage';

const App = () => {
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

        {/* Admin */}
        <Route path="/admin" element={<LoginPage />} />
        <Route path="/admin/events" element={<ManageEvents />} />
        <Route path="/admin/events/new" element={<EditEventForm />} />
        <Route path="/admin/events/:id" element={<EditEventForm />} />
      </Routes>
    </Router>
  );
};

export default App;
