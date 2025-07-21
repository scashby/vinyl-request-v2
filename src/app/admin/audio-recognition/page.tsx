'use client';
import Link from 'next/link';
import React from 'react';

export default function AudioRecognitionAdminPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Audio Recognition Admin</h1>
      <ul style={{ marginTop: '1rem' }}>
        <li><Link href="/admin/audio-recognition/collection">Collection Matches</Link></li>
        <li><Link href="/admin/audio-recognition/override">Manual Override</Link></li>
        <li><Link href="/admin/audio-recognition/logs">Recognition Logs</Link></li>
        <li><Link href="/admin/audio-recognition/sources">Source Debug</Link></li>
        <li><Link href="/admin/audio-recognition/settings">Recognition Settings</Link></li>
        <li><Link href="/admin/audio-recognition/service-test">Test Services</Link></li>
      </ul>
    </div>
  );
}
