import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EventsPage from './pages/events/EventsPage.jsx';
import EventDetail from './pages/events/EventDetail.jsx';
import BrowsePage from './pages/browse/BrowsePage.jsx';
import NowPlayingPage from './pages/now-playing/NowPlayingPage.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import EditQueue from './pages/admin/EditQueue.jsx';
import SetNowPlaying from './pages/admin/SetNowPlaying.jsx';
import ImportDiscogs from './pages/admin/ImportDiscogs.jsx';
import BlockSides from './pages/admin/BlockSides.jsx';
import LoginPage from './pages/admin/LoginPage.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Layout>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<EventsPage />} />
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/now-playing" element={<NowPlayingPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/edit-queue" element={
              <ProtectedRoute>
                <EditQueue />
              </ProtectedRoute>
            } />
            <Route path="/admin/set-now-playing" element={
              <ProtectedRoute>
                <SetNowPlaying />
              </ProtectedRoute>
            } />
            <Route path="/admin/import-discogs" element={
              <ProtectedRoute>
                <ImportDiscogs />
              </ProtectedRoute>
            } />
            <Route path="/admin/block-sides" element={
              <ProtectedRoute>
                <BlockSides />
              </ProtectedRoute>
            } />
          </Routes>
        </Layout>
      </AuthProvider>
    </Router>
  );
}
