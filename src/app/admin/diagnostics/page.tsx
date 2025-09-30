// src/app/admin/diagnostics/page.tsx - Data health check and cleanup
"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';

type DataIssue = {
  id: number;
  artist: string;
  title: string;
  issues: string[];
  severity: 'critical' | 'warning' | 'info';
};

export default function DataDiagnosticsPage() {
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<DataIssue[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    missingArtist: 0,
    missingTitle: 0,
    missingYear: 0,
    missingMasterDate: 0,
    missingGenres: 0,
    missingStyles: 0,
    missingDecade: 0,
    missingImage: 0,
    missingTracklist: 0,
    missingDiscogsId: 0,
    emptyRows: 0,
  });

  useEffect(() => {
    runDiagnostics();
  }, []);

  async function runDiagnostics() {
    setLoading(true);
    
    // Fetch all rows
    const { data: rows, error } = await supabase
      .from('collection')
      .select('*')
      .order('id');

    if (error || !rows) {
      console.error('Error fetching data:', error);
      setLoading(false);
      return;
    }

    const foundIssues: DataIssue[] = [];
    const newStats = {
      total: rows.length,
      missingArtist: 0,
      missingTitle: 0,
      missingYear: 0,
      missingMasterDate: 0,
      missingGenres: 0,
      missingStyles: 0,
      missingDecade: 0,
      missingImage: 0,
      missingTracklist: 0,
      missingDiscogsId: 0,
      emptyRows: 0,
    };

    rows.forEach(row => {
      const rowIssues: string[] = [];
      let severity: 'critical' | 'warning' | 'info' = 'info';

      // Critical issues - core data missing
      if (!row.artist || row.artist.trim() === '') {
        rowIssues.push('Missing artist');
        newStats.missingArtist++;
        severity = 'critical';
      }
      if (!row.title || row.title.trim() === '') {
        rowIssues.push('Missing title');
        newStats.missingTitle++;
        severity = 'critical';
      }

      // Check for completely empty rows (fragments)
      const hasNoData = !row.artist && !row.title && !row.year && !row.discogs_release_id;
      if (hasNoData) {
        rowIssues.push('EMPTY ROW - Fragment to delete');
        newStats.emptyRows++;
        severity = 'critical';
      }

      // Warning issues - important metadata missing
      if (!row.discogs_release_id) {
        rowIssues.push('No Discogs Release ID');
        newStats.missingDiscogsId++;
        if (severity !== 'critical') severity = 'warning';
      }
      if (!row.year) {
        rowIssues.push('Missing year');
        newStats.missingYear++;
        if (severity !== 'critical') severity = 'warning';
      }
      if (!row.master_release_date) {
        rowIssues.push('Missing master release date');
        newStats.missingMasterDate++;
        if (severity !== 'critical') severity = 'warning';
      }
      if (!row.discogs_genres || row.discogs_genres.length === 0) {
        rowIssues.push('Missing genres');
        newStats.missingGenres++;
        if (severity !== 'critical') severity = 'warning';
      }
      if (!row.discogs_styles || row.discogs_styles.length === 0) {
        rowIssues.push('Missing styles');
        newStats.missingStyles++;
        if (severity !== 'critical') severity = 'warning';
      }
      if (!row.decade) {
        rowIssues.push('Missing decade');
        newStats.missingDecade++;
      }
      
      // Info issues - nice to have
      if (!row.image_url) {
        rowIssues.push('Missing image');
        newStats.missingImage++;
      }
      if (!row.tracklists || row.tracklists === '[]' || row.tracklists === 'null') {
        rowIssues.push('Missing tracklist');
        newStats.missingTracklist++;
      }

      if (rowIssues.length > 0) {
        foundIssues.push({
          id: row.id,
          artist: row.artist || '(no artist)',
          title: row.title || '(no title)',
          issues: rowIssues,
          severity
        });
      }
    });

    setIssues(foundIssues);
    setStats(newStats);
    setLoading(false);
  }

  async function deleteEmptyRows() {
    if (!confirm('Delete all empty/fragment rows? This cannot be undone.')) return;

    setLoading(true);
    const emptyRowIds = issues
      .filter(issue => issue.issues.includes('EMPTY ROW - Fragment to delete'))
      .map(issue => issue.id);

    if (emptyRowIds.length === 0) {
      alert('No empty rows to delete');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('collection')
      .delete()
      .in('id', emptyRowIds);

    if (error) {
      alert(`Error deleting: ${error.message}`);
    } else {
      alert(`Deleted ${emptyRowIds.length} empty rows`);
      runDiagnostics(); // Refresh
    }
    setLoading(false);
  }

  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const warningIssues = issues.filter(i => i.severity === 'warning');
  const infoIssues = issues.filter(i => i.severity === 'info');

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>
        📊 Collection Data Diagnostics
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 32 }}>
        Identify missing metadata, empty rows, and data quality issues
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Loading diagnostics...</div>
      ) : (
        <>
          {/* Stats Dashboard */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 32
          }}>
            <StatCard label="Total Albums" value={stats.total} color="#3b82f6" />
            <StatCard label="Empty Rows" value={stats.emptyRows} color="#dc2626" />
            <StatCard label="Missing Artist" value={stats.missingArtist} color="#dc2626" />
            <StatCard label="Missing Title" value={stats.missingTitle} color="#dc2626" />
            <StatCard label="No Discogs ID" value={stats.missingDiscogsId} color="#f59e0b" />
            <StatCard label="Missing Genres" value={stats.missingGenres} color="#f59e0b" />
            <StatCard label="Missing Styles" value={stats.missingStyles} color="#f59e0b" />
            <StatCard label="Missing Master Date" value={stats.missingMasterDate} color="#f59e0b" />
            <StatCard label="Missing Decade" value={stats.missingDecade} color="#f59e0b" />
            <StatCard label="Missing Image" value={stats.missingImage} color="#8b5cf6" />
            <StatCard label="Missing Tracklist" value={stats.missingTracklist} color="#8b5cf6" />
          </div>

          {/* Action Buttons */}
          {stats.emptyRows > 0 && (
            <div style={{
              background: '#fee2e2',
              border: '2px solid #dc2626',
              borderRadius: 8,
              padding: 16,
              marginBottom: 24
            }}>
              <h3 style={{ color: '#991b1b', margin: '0 0 8px 0' }}>
                ⚠️ Found {stats.emptyRows} Empty Rows
              </h3>
              <p style={{ color: '#7f1d1d', marginBottom: 12, fontSize: 14 }}>
                These are likely abandoned fragments with no useful data. Safe to delete.
              </p>
              <button
                onClick={deleteEmptyRows}
                style={{
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🗑️ Delete All Empty Rows
              </button>
            </div>
          )}

          {/* Critical Issues */}
          {criticalIssues.length > 0 && (
            <IssueSection
              title="🚨 Critical Issues"
              subtitle="Missing core data - needs immediate attention"
              issues={criticalIssues}
              bgColor="#fee2e2"
              borderColor="#dc2626"
            />
          )}

          {/* Warning Issues */}
          {warningIssues.length > 0 && (
            <IssueSection
              title="⚠️ Warnings"
              subtitle="Missing important metadata - should be addressed"
              issues={warningIssues}
              bgColor="#fef3c7"
              borderColor="#f59e0b"
            />
          )}

          {/* Info Issues */}
          {infoIssues.length > 0 && (
            <IssueSection
              title="ℹ️ Info"
              subtitle="Missing nice-to-have metadata"
              issues={infoIssues}
              bgColor="#dbeafe"
              borderColor="#3b82f6"
            />
          )}

          {issues.length === 0 && (
            <div style={{
              background: '#dcfce7',
              border: '2px solid #16a34a',
              borderRadius: 8,
              padding: 24,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#15803d' }}>
                All Clear! No data issues found.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'white',
      border: `2px solid ${color}`,
      borderRadius: 8,
      padding: 16,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: 32, fontWeight: 'bold', color, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

function IssueSection({ 
  title, 
  subtitle, 
  issues, 
  bgColor, 
  borderColor 
}: { 
  title: string; 
  subtitle: string; 
  issues: DataIssue[];
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 8,
      padding: 16,
      marginBottom: 24
    }}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 600 }}>
        {title} ({issues.length})
      </h3>
      <p style={{ margin: '0 0 16px 0', fontSize: 13, opacity: 0.8 }}>
        {subtitle}
      </p>
      
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {issues.map(issue => (
          <div key={issue.id} style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: 12,
            marginBottom: 8
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                #{issue.id}: {issue.artist} - {issue.title}
              </div>
              <a
                href={`/admin/edit-entry/${issue.id}`}
                style={{
                  color: '#2563eb',
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: 500
                }}
              >
                Edit →
              </a>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {issue.issues.map((iss, idx) => (
                <span key={idx} style={{
                  background: '#f3f4f6',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  color: '#374151'
                }}>
                  {iss}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}