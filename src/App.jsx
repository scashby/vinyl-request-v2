import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EventsPage from './pages/events/EventsPage';
import EventDetail from './pages/events/EventDetail';
import BrowsePage from './pages/browse/BrowsePage';
import NowPlayingPage from './pages/now-playing/NowPlayingPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import EditQueue from './pages/admin/EditQueue';
import SetNowPlaying from './pages/admin/SetNowPlaying';
import ImportDiscogs from './pages/admin/ImportDiscogs';
import BlockSides from './pages/admin/BlockSides';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from './auth/AuthProvider';
import ProtectedRoute from './auth/ProtectedRoute';
import Layout from './components/Layout';

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
