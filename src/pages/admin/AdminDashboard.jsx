import { Link } from 'react-router-dom'

export default function AdminDashboard() {
  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <ul className="space-y-2">
        <li><Link to="/admin/edit-queue" className="text-blue-600 underline">Edit Queue</Link></li>
        <li><Link to="/admin/set-now-playing" className="text-blue-600 underline">Set Now Playing / Up Next</Link></li>
        <li><Link to="/admin/import-discogs" className="text-blue-600 underline">Import Discogs CSV</Link></li>
        <li><Link to="/admin/block-sides" className="text-blue-600 underline">Block Damaged Sides</Link></li>
      </ul>
    </div>
  )
}