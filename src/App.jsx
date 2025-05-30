import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import EventsPage from './pages/events/EventsPage';
import AlbumGatefoldPage from './pages/AlbumGatefoldPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/album-demo" element={<AlbumGatefoldPage />} />
      </Routes>
    </Router>
  );
}

export default App;