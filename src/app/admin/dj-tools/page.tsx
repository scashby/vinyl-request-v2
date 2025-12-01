// src/app/admin/dj-tools/page.tsx - DJ Tools landing page
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Stats = {
  totalTracks: number;
  totalCrates: number;
  highlightedTracks: number;
  linkedTracks: number;
};

export default function DJToolsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    // TODO: Create stats API endpoint
    // For now, just placeholder data
    setStats({
      totalTracks: 0,
      totalCrates: 0,
      highlightedTracks: 0,
      linkedTracks: 0
    });
    setLoading(false);
  };

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
        <h1 style={{ fontSize: 32, fontWeight: 'bold', margin: '0 0 8px 0', color: '#111' }}>
          🎧 DJ Tools
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
          Professional tools for organizing, annotating, and preparing your vinyl collection for gigs
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        marginBottom: 32
      }}>
        {/* Migration Tool */}
        <Link
          href="/admin/dj-tools/migrate"
          style={{
            display: 'block',
            padding: 24,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: 12,
            textDecoration: 'none',
            boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔄</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0' }}>
            Track Migration
          </h3>
          <p style={{ fontSize: 13, opacity: 0.9, margin: 0 }}>
            Sync tracks from JSON to database (required for DJ Tools)
          </p>
        </Link>

        {/* Crates (Coming Soon) */}
        <div style={{
          padding: 24,
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white',
          borderRadius: 12,
          opacity: 0.6,
          boxShadow: '0 4px 6px rgba(240, 147, 251, 0.3)'
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0' }}>
            Crates
          </h3>
          <p style={{ fontSize: 13, margin: 0 }}>
            Coming soon: Organize albums for events and gigs
          </p>
        </div>

        {/* Annotations (Coming Soon) */}
        <div style={{
          padding: 24,
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          color: 'white',
          borderRadius: 12,
          opacity: 0.6,
          boxShadow: '0 4px 6px rgba(79, 172, 254, 0.3)'
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0' }}>
            Annotations
          </h3>
          <p style={{ fontSize: 13, margin: 0 }}>
            Coming soon: Highlight tracks, add tags and notes
          </p>
        </div>

        {/* Track Links (Coming Soon) */}
        <div style={{
          padding: 24,
          background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
          color: 'white',
          borderRadius: 12,
          opacity: 0.6,
          boxShadow: '0 4px 6px rgba(250, 112, 154, 0.3)'
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0' }}>
            Track Links
          </h3>
          <p style={{ fontSize: 13, margin: 0 }}>
            Coming soon: Link tracks that mix well together
          </p>
        </div>
      </div>

      {/* Stats */}
      {!loading && stats && (
        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 24,
          marginBottom: 24
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px 0', color: '#111' }}>
            📊 DJ Tools Stats
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 16
          }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#667eea' }}>
                {stats.totalTracks.toLocaleString()}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Total Tracks</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#f093fb' }}>
                {stats.totalCrates}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Crates</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#4facfe' }}>
                {stats.highlightedTracks}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Highlighted</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#fa709a' }}>
                {stats.linkedTracks}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Linked</div>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div style={{
        padding: 16,
        background: '#dbeafe',
        border: '1px solid #3b82f6',
        borderRadius: 8,
        fontSize: 13,
        color: '#1e40af'
      }}>
        <strong>💡 Getting Started:</strong> First, run the Track Migration to sync your collection. This enables all DJ Tools features like crates, annotations, and track linking.
      </div>
    </div>
  );
}