// Admin Dashboard page ("/admin/admin-dashboard")
// Main landing page for admin users; links to all admin features.

import 'styles/internal.css';
import Link from 'next/link';

export default function Page() {
  return (
    <div className="admin-dashboard" style={{ backgroundColor: '#f9f9f9', minHeight: '100vh', padding: '2rem' }}>
      <h1 style={{ color: '#222', marginBottom: '1.5rem' }}>Admin Dashboard</h1>
      <ul style={{ listStyle: 'none', padding: 0, fontSize: '1.1rem' }}>
        <li style={{ marginBottom: '1rem' }}>
          <Link href="/admin/manage-events" style={{ color: '#2563eb', textDecoration: 'none' }}>Manage Events</Link>
        </li>
        <li style={{ marginBottom: '1rem' }}>
          <Link href="/admin/edit-queue" style={{ color: '#2563eb', textDecoration: 'none' }}>Manage Queues</Link>
        </li>
        <li style={{ marginBottom: '1rem' }}>
          <Link href="/admin/import-discogs" style={{ color: '#2563eb', textDecoration: 'none' }}>Import from Discogs</Link>
        </li>
        <li style={{ marginBottom: '1rem' }}>
          <Link href="/admin/edit-collection" style={{ color: '#2563eb', textDecoration: 'none' }}>Edit Collection</Link>
        </li>
        <li style={{ marginBottom: '1rem' }}>
          <Link href="/admin/add-album" style={{ color: '#2563eb', textDecoration: 'none' }}>Add Album Manually</Link>
        </li>
      </ul>
    </div>
  );
}
