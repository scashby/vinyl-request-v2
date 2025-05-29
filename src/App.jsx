
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EventsPage from './pages/events/EventsPage.jsx';
import EventDetail from './pages/events/EventDetail.jsx';
import BrowsePage from './pages/browse/BrowsePage.jsx';
import NowPlayingPage from './pages/now-playing/NowPlayingPage.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<EventsPage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/now-playing" element={<NowPlayingPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
