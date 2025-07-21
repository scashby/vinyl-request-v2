// src/app/admin/audio-recognition/page.tsx
'use client';
import Link from 'next/link';
import 'src/styles/internal.css';

export default function AudioRecognitionDashboard() {
  return (
    <main className="admin-dashboard">
      <h1 className="page-title">Audio Recognition Admin</h1>
      <div className="grid">
        <Link href="/admin/audio-recognition/logs" className="card">Recognition Logs</Link>
        <Link href="/admin/audio-recognition/override" className="card">Manual Override</Link>
        <Link href="/admin/audio-recognition/collection" className="card">Match Collection</Link>
        <Link href="/admin/audio-recognition/sources" className="card">Sources Debug</Link>
        <Link href="/admin/audio-recognition/settings" className="card">Settings</Link>
        <Link href="/admin/audio-recognition/service-test" className="card">Service Test</Link>
      </div>
    </main>
  );
}
