// src/app/admin/dj-tools/migrate/page.tsx - Track migration admin interface
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

export default function MigratePage() {
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0 });
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    loadStats();
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
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const startMigration = async () => {
    if (!stats) return;
    
    setMigrating(true);
    setComplete(false);
    setErrors([]);
    setProgress({ current: 0, total: stats.albumsNeedingSync, percent: 0 });
    setStatus('Starting migration...');

    let cursor = 0;
    const batchSize = 20; // Smaller batches for better progress updates
    let totalProcessed = 0;
    const migrationErrors: string[] = [];

    while (true) {
      try {
        const res = await fetch('/api/dj-tools/migrate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursor, batchSize })
        });

        const data = await res.json();

        if (!data.success) {
          setStatus(`❌ Migration failed: ${data.error}`);
          setMigrating(false);
          return;
        }

        totalProcessed += data.processed;
        cursor = data.nextCursor;

        const percent = stats.albumsNeedingSync > 0 
          ? Math.round((totalProcessed / stats.albumsNeedingSync) * 100)
          : 100;

        setProgress({
          current: totalProcessed,
          total: stats.albumsNeedingSync,
          percent
        });

        setStatus(`Migrating... ${totalProcessed} / ${stats.albumsNeedingSync} albums (${percent}%)`);

        // Collect errors
        if (data.results) {
          const batchErrors = data.results
            .filter((r: { success: boolean; error?: string }) => !r.success)
            .map((r: { albumId: number; error?: string }) => `Album ${r.albumId}: ${r.error}`);
          
          if (batchErrors.length > 0) {
            migrationErrors.push(...batchErrors);
            setErrors(migrationErrors);
          }
        }

        if (data.complete) {
          setStatus(`✅ Migration complete! Processed ${totalProcessed} albums`);
          setComplete(true);
          setMigrating(false);
          
          // Reload stats
          await loadStats();
          return;
        }

        // Small delay between batches to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        setStatus(`❌ Migration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setMigrating(false);
        return;
      }
    }
  };

  if (loading) {
    return (
      <div style={{
        maxWidth: 1200,
        margin: '32px auto',
        padding: 24,
        background: '#fff',
        borderRadius: 12,
        color: '#222'
      }}>
        <div style={{ textAlign: 'center', fontSize: 18, color: '#6b7280' }}>
          Loading migration status...
        </div>
      </div>
    );
  }

  const needsMigration = stats && stats.albumsNeedingSync > 0;
  const hasIntegrityIssues = integrity && (
    integrity.orphanedTracks > 0 ||
    integrity.tracksWithoutPosition > 0 ||
    integrity.tracksWithoutTitle > 0
  );

  return (
    <div style={{
      maxWidth: 1200,
      margin: '32px auto',
      padding: 24,
      background: '#fff',
      borderRadius: 12,
      color: '#222',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32, paddingBottom: 16, borderBottom: '2px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 'bold', margin: '0 0 8px 0', color: '#111' }}>
              🔄 Track Migration
            </h1>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
              Sync tracks from JSON to database for DJ Tools features (Vinyl & 45s only)
            </p>
          </div>
          <Link
            href="/admin/dj-tools"
            style={{
              padding: '10px 20px',
              background: '#f3f4f6',
              color: '#374151',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
              border: '2px solid #d1d5db'
            }}
          >
            ← Back to DJ Tools
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 32
      }}>
        <div style={{
          padding: 20,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 10,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 4 }}>
            {stats?.totalAlbums.toLocaleString()}
          </div>
          <div style={{ opacity: 0.9, fontSize: 13 }}>Vinyl & 45s Albums</div>
        </div>

        <div style={{
          padding: 20,
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white',
          borderRadius: 10,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 4 }}>
            {stats?.albumsWithTracks.toLocaleString()}
          </div>
          <div style={{ opacity: 0.9, fontSize: 13 }}>Albums with Tracklists</div>
        </div>

        <div style={{
          padding: 20,
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          color: 'white',
          borderRadius: 10,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 4 }}>
            {stats?.totalTracksInTable.toLocaleString()}
          </div>
          <div style={{ opacity: 0.9, fontSize: 13 }}>Tracks in Database</div>
        </div>

        <div style={{
          padding: 20,
          background: needsMigration 
            ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
            : 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
          color: 'white',
          borderRadius: 10,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 4 }}>
            {stats?.albumsNeedingSync.toLocaleString()}
          </div>
          <div style={{ opacity: 0.9, fontSize: 13 }}>
            {needsMigration ? 'Need Migration' : 'Fully Synced'}
          </div>
        </div>
      </div>

      {/* Migration Control */}
      {needsMigration && (
        <div style={{
          background: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: 12,
          padding: 24,
          marginBottom: 24
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#92400e',
            margin: '0 0 16px 0'
          }}>
            ⚠️ Migration Required
          </h2>
          <p style={{ fontSize: 14, color: '#78350f', margin: '0 0 20px 0' }}>
            {stats?.albumsNeedingSync} Vinyl/45s albums have tracklists in JSON but haven&apos;t been synced to the tracks table yet.
            This is required for DJ Tools features like crates, annotations, and track linking.
          </p>

          {!migrating && !complete && (
            <button
              onClick={startMigration}
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #10b981, #047857)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)'
              }}
            >
              🚀 Start Migration
            </button>
          )}

          {migrating && (
            <div>
              <div style={{
                background: 'white',
                borderRadius: 8,
                padding: 16,
                marginBottom: 16
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#1f2937'
                }}>
                  <span>Progress</span>
                  <span>{progress.percent}%</span>
                </div>
                <div style={{
                  width: '100%',
                  height: 24,
                  background: '#e5e7eb',
                  borderRadius: 12,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress.percent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #10b981, #059669)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <div style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: '#6b7280',
                  textAlign: 'center'
                }}>
                  {progress.current} / {progress.total} albums
                </div>
              </div>

              <div style={{
                padding: 12,
                background: '#dbeafe',
                border: '1px solid #3b82f6',
                borderRadius: 6,
                fontSize: 14,
                color: '#1e40af',
                fontWeight: 500
              }}>
                {status}
              </div>
            </div>
          )}

          {complete && (
            <div style={{
              padding: 16,
              background: '#dcfce7',
              border: '2px solid #16a34a',
              borderRadius: 8,
              fontSize: 15,
              color: '#15803d',
              fontWeight: 600
            }}>
              ✅ {status}
            </div>
          )}
        </div>
      )}

      {/* Success State */}
      {!needsMigration && stats && (
        <div style={{
          background: '#dcfce7',
          border: '2px solid #16a34a',
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#15803d',
            margin: '0 0 8px 0'
          }}>
            All Tracks Synced
          </h2>
          <p style={{ fontSize: 14, color: '#16a34a', margin: 0 }}>
            Your Vinyl & 45s collection is fully synced. {stats.totalTracksInTable.toLocaleString()} tracks from {stats.albumsWithTracks.toLocaleString()} albums are ready for DJ Tools.
          </p>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{
          background: '#fee2e2',
          border: '2px solid #dc2626',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24
        }}>
          <h3 style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#991b1b',
            margin: '0 0 12px 0'
          }}>
            ⚠️ Errors During Migration ({errors.length})
          </h3>
          <div style={{
            maxHeight: 200,
            overflowY: 'auto',
            background: 'white',
            borderRadius: 6,
            padding: 12
          }}>
            {errors.map((error, idx) => (
              <div key={idx} style={{
                fontSize: 12,
                color: '#991b1b',
                marginBottom: 4,
                fontFamily: 'monospace'
              }}>
                {error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Integrity */}
      {integrity && hasIntegrityIssues && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24
        }}>
          <h3 style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#92400e',
            margin: '0 0 12px 0'
          }}>
            🔍 Data Integrity Issues
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#78350f' }}>
            {integrity.orphanedTracks > 0 && (
              <div>❌ {integrity.orphanedTracks} orphaned tracks (references deleted albums)</div>
            )}
            {integrity.tracksWithoutPosition > 0 && (
              <div>❌ {integrity.tracksWithoutPosition} tracks without position</div>
            )}
            {integrity.tracksWithoutTitle > 0 && (
              <div>❌ {integrity.tracksWithoutTitle} tracks without title</div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap'
      }}>
        <button
          onClick={loadStats}
          disabled={migrating}
          style={{
            padding: '10px 20px',
            background: migrating ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: migrating ? 'not-allowed' : 'pointer'
          }}
        >
          🔄 Refresh Stats
        </button>

        {!needsMigration && (
          <button
            onClick={startMigration}
            disabled={migrating}
            style={{
              padding: '10px 20px',
              background: migrating ? '#9ca3af' : '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: migrating ? 'not-allowed' : 'pointer'
            }}
          >
            🔄 Re-sync All Tracks
          </button>
        )}
      </div>

      {/* Info Box */}
      <div style={{
        marginTop: 24,
        padding: 16,
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        fontSize: 13,
        color: '#6b7280'
      }}>
        <strong style={{ color: '#374151' }}>ℹ️ About Track Sync:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
          <li>Only syncs <strong>Vinyl</strong> and <strong>45s</strong> albums (excludes CDs, cassettes, 8-tracks, sale items)</li>
          <li>Tracks are extracted from the <code style={{ background: '#e5e7eb', padding: '2px 4px', borderRadius: 3 }}>collection.tracklists</code> JSON column</li>
          <li>The JSON remains the source of truth - the tracks table is an index for relationships</li>
          <li>Sync happens automatically during imports and enrichments for Vinyl/45s</li>
          <li>You can manually re-sync anytime if data gets out of sync</li>
        </ul>
      </div>
    </div>
  );
}