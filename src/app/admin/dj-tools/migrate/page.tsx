// src/app/admin/dj-tools/migrate/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

type MigrationStats = {
  totalAlbums: number;
  albumsWithTracks: number;
  totalTracksInTable: number;
  albumsNeedingSync: number;
};

type IntegrityStats = {
  orphanedTracks: number;
  duplicatePositions: number;
  tracksWithoutPosition: number;
  tracksWithoutTitle: number;
};

type AlbumNeedingMigration = {
  id: number;
  artist: string;
  title: string;
  trackCount: number;
};

export default function MigratePage() {
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityStats | null>(null);
  const [albumsList, setAlbumsList] = useState<AlbumNeedingMigration[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, initial: 0 });
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [migratingAlbumId, setMigratingAlbumId] = useState<number | null>(null);

  useEffect(() => {
    loadStats();
    loadAlbumsList();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dj-tools/migration-stats');
      const data = await res.json();
      
      if (data.success) {
        setStats(data.stats);
        setIntegrity(data.integrity);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAlbumsList = async () => {
    try {
      const res = await fetch('/api/dj-tools/albums-needing-sync');
      const data = await res.json();
      
      if (data.success) {
        setAlbumsList(data.albums || []);
      }
    } catch (err) {
      console.error('Failed to load albums list:', err);
    }
  };

  const migrateSingleAlbum = async (albumId: number) => {
    console.log('🚀 Starting migration for album:', albumId);
    setMigratingAlbumId(albumId);
    setStatus(`Migrating album ${albumId}...`);
    
    try {
      console.log('  → Fetching /api/dj-tools/sync-single...');
      const res = await fetch('/api/dj-tools/sync-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId })
      });

      console.log('  → Response status:', res.status);
      const data = await res.json();
      console.log('  → Response data:', data);

      if (data.success) {
        const tracksAdded = data.result?.tracksAdded || 0;
        const tracksUpdated = data.result?.tracksUpdated || 0;
        setStatus(`✅ Album ${albumId} migrated! Added: ${tracksAdded}, Updated: ${tracksUpdated}`);
        console.log('  ✅ Migration successful');
        await loadStats();
        await loadAlbumsList();
      } else {
        const errorMsg = data.result?.error || data.error || 'Unknown error';
        setStatus(`❌ Failed to migrate album ${albumId}: ${errorMsg}`);
        console.error('  ❌ Migration failed:', errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown';
      setStatus(`❌ Error migrating album ${albumId}: ${errorMsg}`);
      console.error('  ❌ Exception during migration:', err);
    } finally {
      setMigratingAlbumId(null);
      console.log('  → Migration attempt complete');
    }
  };

  const startMigration = async () => {
    if (!albumsList.length) return;
    
    setMigrating(true);
    setErrors([]);
    setProgress({ processed: 0, initial: albumsList.length });
    setStatus('Starting migration...');

    const maxToProcess = 100;
    let totalProcessed = 0;
    const migrationErrors: string[] = [];
    let batchCount = 0;

    while (true) {
      batchCount++;
      
      try {
        const res = await fetch('/api/dj-tools/migrate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxToProcess })
        });

        const data = await res.json();

        if (!data.success) {
          setStatus(`❌ Failed: ${data.error}`);
          setMigrating(false);
          return;
        }

        if (data.processed === 0) {
          setStatus(`✅ Complete! Migrated ${totalProcessed} albums total`);
          setMigrating(false);
          await loadStats();
          await loadAlbumsList();
          return;
        }

        totalProcessed += data.processed;
        setProgress({ processed: totalProcessed, initial: progress.initial });

        const percent = progress.initial > 0 
          ? Math.min(100, Math.round((totalProcessed / progress.initial) * 100))
          : 100;

        setStatus(`Batch ${batchCount}: Migrated ${data.processed} albums (${totalProcessed} total, ${percent}%)`);

        if (data.results) {
          const batchErrors = data.results
            .filter((r: { success: boolean }) => !r.success)
            .map((r: { albumId: number; error?: string }) => 
              `Album ${r.albumId}: ${r.error}`
            );
          
          if (batchErrors.length > 0) {
            migrationErrors.push(...batchErrors);
            setErrors(migrationErrors);
          }
        }

        if (data.complete) {
          setStatus(`✅ Complete! Migrated ${totalProcessed} albums`);
          setMigrating(false);
          await loadStats();
          await loadAlbumsList();
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        setStatus(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
        setMigrating(false);
        return;
      }
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '32px auto', padding: 24, background: '#fff', borderRadius: 12 }}>
        <div style={{ textAlign: 'center', fontSize: 18, color: '#6b7280' }}>
          Loading migration status...
        </div>
      </div>
    );
  }

  const needsMigration = albumsList.length > 0;
  const hasIntegrityIssues = integrity && (
    integrity.orphanedTracks > 0 ||
    integrity.tracksWithoutPosition > 0 ||
    integrity.tracksWithoutTitle > 0
  );

  const progressPercent = progress.initial > 0
    ? Math.min(100, Math.round((progress.processed / progress.initial) * 100))
    : 0;

  return (
    <div style={{ maxWidth: 1200, margin: '32px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, paddingBottom: 16, borderBottom: '2px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 'bold', margin: '0 0 8px 0' }}>
              🔄 Track Migration
            </h1>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
              One-way migration: JSON → Database (Vinyl & 45s only)
            </p>
          </div>
          <Link href="/admin/dj-tools" style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            ← Back
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div style={{ padding: 20, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderRadius: 10 }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 4 }}>
            {stats?.totalAlbums.toLocaleString()}
          </div>
          <div style={{ opacity: 0.9, fontSize: 13 }}>Vinyl & 45s Albums</div>
        </div>

        <div style={{ padding: 20, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', borderRadius: 10 }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 4 }}>
            {stats?.albumsWithTracks.toLocaleString()}
          </div>
          <div style={{ opacity: 0.9, fontSize: 13 }}>With Tracklists</div>
        </div>

        <div style={{ padding: 20, background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', borderRadius: 10 }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 4 }}>
            {stats?.totalTracksInTable.toLocaleString()}
          </div>
          <div style={{ opacity: 0.9, fontSize: 13 }}>Tracks in Database</div>
        </div>

        <div style={{ padding: 20, background: needsMigration ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' : 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', color: 'white', borderRadius: 10 }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 4 }}>
            {albumsList.length}
          </div>
          <div style={{ opacity: 0.9, fontSize: 13 }}>
            {needsMigration ? 'Need Migration' : 'Fully Migrated'}
          </div>
        </div>
      </div>

      {/* Albums Needing Migration */}
      {albumsList.length > 0 && (
        <div style={{ background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#92400e', margin: '0 0 16px 0' }}>
            📋 Albums Needing Migration ({albumsList.length})
          </h2>
          <div style={{ maxHeight: 400, overflowY: 'auto', background: 'white', borderRadius: 8, padding: 12 }}>
            {albumsList.map(album => (
              <div key={album.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: 12,
                borderBottom: '1px solid #e5e7eb',
                fontSize: 14
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#111' }}>
                    {album.artist} - {album.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    ID: {album.id} • {album.trackCount === -1 ? 'Invalid JSON' : `${album.trackCount} tracks`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link
                    href={`/admin/edit-entry/${album.id}`}
                    target="_blank"
                    style={{
                      padding: '6px 12px',
                      background: '#3b82f6',
                      color: 'white',
                      borderRadius: 6,
                      textDecoration: 'none',
                      fontSize: 12,
                      fontWeight: 600
                    }}
                  >
                    View
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); migrateSingleAlbum(album.id); }}
                    disabled={migratingAlbumId === album.id}
                    style={{
                      padding: '6px 12px',
                      background: migratingAlbumId === album.id ? '#9ca3af' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: migratingAlbumId === album.id ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {migratingAlbumId === album.id ? 'Migrating...' : 'Migrate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Migration Control */}
      {needsMigration && (
        <div style={{ background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#92400e', margin: '0 0 16px 0' }}>
            ⚠️ Migration Required
          </h2>
          <p style={{ fontSize: 14, color: '#78350f', margin: '0 0 20px 0' }}>
            {albumsList.length} albums need migrating for DJ Tools features.
          </p>

          {!migrating && (
            <button 
              type="button" 
              onClick={(e) => { e.preventDefault(); startMigration(); }} 
              style={{ padding: '14px 28px', background: 'linear-gradient(135deg, #10b981, #047857)', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
            >
              🚀 Start Batch Migration
            </button>
          )}

          {migrating && (
            <div>
              <div style={{ background: 'white', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                  <span>Progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <div style={{ width: '100%', height: 24, background: '#e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', transition: 'width 0.3s' }} />
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
                  {progress.processed} / {progress.initial} albums
                </div>
              </div>

              <div style={{ padding: 12, background: '#dbeafe', border: '1px solid #3b82f6', borderRadius: 6, fontSize: 14, color: '#1e40af' }}>
                {status}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {!needsMigration && stats && (
        <div style={{ background: '#dcfce7', border: '2px solid #16a34a', borderRadius: 12, padding: 24, marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#15803d', margin: '0 0 8px 0' }}>
            All Tracks Migrated
          </h2>
          <p style={{ fontSize: 14, color: '#16a34a', margin: 0 }}>
            {stats.totalTracksInTable.toLocaleString()} tracks from {stats.albumsWithTracks.toLocaleString()} albums ready for DJ Tools.
          </p>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ background: '#fee2e2', border: '2px solid #dc2626', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#991b1b', margin: '0 0 12px 0' }}>
            ⚠️ Errors ({errors.length})
          </h3>
          <div style={{ maxHeight: 200, overflowY: 'auto', background: 'white', borderRadius: 6, padding: 12 }}>
            {errors.map((error, idx) => (
              <div key={idx} style={{ fontSize: 12, color: '#991b1b', marginBottom: 4, fontFamily: 'monospace' }}>
                {error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Integrity */}
      {integrity && hasIntegrityIssues && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#92400e', margin: '0 0 12px 0' }}>
            🔍 Data Integrity Issues
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#78350f' }}>
            {integrity.orphanedTracks > 0 && <div>❌ {integrity.orphanedTracks} orphaned tracks</div>}
            {integrity.tracksWithoutPosition > 0 && <div>❌ {integrity.tracksWithoutPosition} tracks without position</div>}
            {integrity.tracksWithoutTitle > 0 && <div>❌ {integrity.tracksWithoutTitle} tracks without title</div>}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button 
          type="button"
          onClick={(e) => { e.preventDefault(); loadStats(); loadAlbumsList(); }} 
          disabled={migrating} 
          style={{ padding: '10px 20px', background: migrating ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: migrating ? 'not-allowed' : 'pointer' }}
        >
          🔄 Refresh Stats
        </button>

        {!needsMigration && (
          <button 
            type="button" 
            onClick={(e) => { e.preventDefault(); startMigration(); }} 
            disabled={migrating} 
            style={{ padding: '10px 20px', background: migrating ? '#9ca3af' : '#f59e0b', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: migrating ? 'not-allowed' : 'pointer' }}
          >
            🔄 Re-migrate All
          </button>
        )}
      </div>

      {/* Info */}
      <div style={{ marginTop: 24, padding: 16, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#6b7280' }}>
        <strong>ℹ️ About Track Migration:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
          <li>Only migrates Vinyl and 45s albums (excludes CDs, sale items)</li>
          <li>JSON remains source of truth - database table is index for relationships</li>
          <li>Migration is one-way: JSON → Database (not bidirectional sync)</li>
          <li>Auto-migrates during imports/enrichments for Vinyl/45s</li>
          <li>Use &ldquo;View&rdquo; to inspect an album&apos;s tracklist JSON</li>
          <li>Use &ldquo;Migrate&rdquo; to manually migrate individual albums</li>
        </ul>
      </div>
    </div>
  );
}