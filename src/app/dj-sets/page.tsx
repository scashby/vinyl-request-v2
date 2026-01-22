// src/app/admin/dj-tools/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from 'lib/supabaseClient';

type Stats = {
  totalTracks: number;
  totalCrates: number;
  manualCrates: number;
  smartCrates: number;
};

export default function DJToolsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Get crate stats from the new 'crates' table
      const { data: crates, error } = await supabase
        .from('crates')
        .select('is_smart');
      
      if (error) throw error;

      // Get track count from collection
      const { count: trackCount } = await supabase
        .from('collection')
        .select('id', { count: 'exact', head: true });

      const totalCrates = crates?.length || 0;
      const smartCrates = crates?.filter(c => c.is_smart).length || 0;
      const manualCrates = totalCrates - smartCrates;

      setStats({
        totalTracks: trackCount || 0,
        totalCrates,
        manualCrates,
        smartCrates
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
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
          Manage your crates and library for events.
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
            📊 Library Stats
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
              <div style={{ fontSize: 13, color: '#6b7280' }}>Total Albums</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#f093fb' }}>
                {stats.totalCrates}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Total Crates</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#4facfe' }}>
                {stats.smartCrates}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Smart Crates</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#fa709a' }}>
                {stats.manualCrates}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Manual Crates</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}