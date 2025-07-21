// src/app/admin/audio-recognition/page.tsx
'use client';
import Link from 'next/link';
import styles from 'styles/internal.module.css';

export default function AudioRecognitionDashboard() {
  return (
    <main className={styles.dashboardContainer}>
      <h1 className={styles.pageTitle}>Audio Recognition Admin</h1>
      <div className={styles.grid}>
        <Link href="/admin/audio-recognition/logs" className={styles.card}>Recognition Logs</Link>
        <Link href="/admin/audio-recognition/override" className={styles.card}>Manual Override</Link>
        <Link href="/admin/audio-recognition/collection" className={styles.card}>Match Collection</Link>
        <Link href="/admin/audio-recognition/sources" className={styles.card}>Sources Debug</Link>
        <Link href="/admin/audio-recognition/settings" className={styles.card}>Settings</Link>
        <Link href="/admin/audio-recognition/service-test" className={styles.card}>Service Test</Link>
      </div>
    </main>
  );
}
