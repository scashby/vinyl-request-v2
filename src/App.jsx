
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EventsPage from './pages/events/EventsPage';

import NowPlayingPage from './pages/now-playing/NowPlayingPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import EditQueue from './pages/admin/EditQueue';
import SetNowPlaying from './pages/admin/SetNowPlaying';
import ImportDiscogs from './pages/admin/ImportDiscogs';
import BlockSides from './pages/admin/BlockSides';
import ImportCollection from './pages/admin/ImportCollection';
import AlbumGatefoldPage from './pages/AlbumGatefoldPage';
import BrowseQueue from './pages/browse/BrowseQueue';
import LandingPage from './pages/LandingPage';


export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/browse" element={<BrowseAlbumsPage />} />
        <Route path="/now-playing" element={<NowPlayingPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/edit-queue" element={<EditQueue />} />
        <Route path="/set-now-playing" element={<SetNowPlaying />} />
        <Route path="/import-discogs" element={<ImportDiscogs />} />
        <Route path="/block-sides" element={<BlockSides />} />
        <Route path="/import-collection" element={<ImportCollection />} />
        <Route path="/album-demo" element={<AlbumGatefoldPage />} />
        <Route path="/browse-queue" element={<BrowseQueue />} />
      </Routes>
    </Router>
  );
}
