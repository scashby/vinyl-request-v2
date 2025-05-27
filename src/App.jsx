import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import EventsPage from './pages/events/EventsPage';
import EventDetail from './pages/events/EventDetail';
import BrowsePage from './pages/browse/BrowsePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import NowPlayingPage from './pages/now-playing/NowPlayingPage';

function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/events" />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/now-playing/:eventId" element={<NowPlayingPage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </Router>
  );
}
export default App;
