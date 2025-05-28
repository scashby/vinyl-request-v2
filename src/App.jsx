import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import EventsPage from './pages/events/EventsPage'
import EventDetail from './pages/events/EventDetail'
import BrowsePage from './pages/browse/BrowsePage'
import NowPlayingPage from './pages/now-playing/NowPlayingPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import EditQueue from './pages/admin/EditQueue'
import SetNowPlaying from './pages/admin/SetNowPlaying'
import ImportDiscogs from './pages/admin/ImportDiscogs'
import BlockSides from './pages/admin/BlockSides'
import Header from './components/Header'
import ImportCollection from './pages/admin/ImportCollection'

function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<EventsPage />} />
        <Route path="/event/:id" element={<EventDetail />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/now-playing" element={<NowPlayingPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/edit-queue" element={<EditQueue />} />
        <Route path="/admin/set-now-playing" element={<SetNowPlaying />} />
        <Route path="/admin/import-discogs" element={<ImportDiscogs />} />
        <Route path="/admin/block-sides" element={<BlockSides />} />
        <Route path="/admin/import" element={<ImportCollection />} />
      </Routes>
    </Router>
  )
}

export default App