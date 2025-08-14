// Admin Dashboard page ("/admin/admin-dashboard")
// Main landing page for admin users; links to all admin features.

import 'styles/internal.css';
import Link from 'next/link';

export default function Page() {
  return (
    <div className="admin-dashboard" style={{ backgroundColor: '#f9f9f9', minHeight: '100vh', padding: '2rem' }}>
      <h1 style={{ color: '#222', marginBottom: '1.5rem' }}>Admin Dashboard</h1>
      <div className="grid">
        <Link href="/admin/manage-events" className="card">Manage Events</Link>
        <Link href="/admin/edit-queue" className="card">Edit Queue</Link>
        <Link href="/admin/edit-collection" className="card">Edit Collection</Link>
        <Link href="/admin/most-wanted" className="card">Most Wanted</Link>
        <Link href="/admin/socials" className="card">Social Embeds</Link>
        <Link href="/admin/import-discogs" className="card">Import from Discogs</Link>
        <Link href="/admin/add-customer-vinyl" className="card">Add Customer Vinyl</Link>
        <Link href="/admin/add-album" className="card">Add Album Manually</Link>
      </div>
    </div>
  );
}