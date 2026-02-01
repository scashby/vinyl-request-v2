// src/app/admin/admin-dashboard/page.tsx
"use client";

import { useEffect, useState, CSSProperties } from 'react';
import Link from 'next/link';
import { supabase } from 'lib/supabaseClient';

interface DashboardStats {
  totalAlbums: number;
  totalEvents: number;
  upcomingEvents: number;
}

interface DashboardEvent {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  [key: string]: unknown; 
}

interface DbTestResults {
  inventory: 'pending' | 'success' | 'error';
  events: 'pending' | 'success' | 'error';
}

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated' | 'error';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAlbums: 0,
    totalEvents: 0,
    upcomingEvents: 0
  });
  const [upcomingEvents, setUpcomingEvents] = useState<DashboardEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [dbTestResults, setDbTestResults] = useState<DbTestResults>({
    inventory: 'pending',
    events: 'pending'
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        setAuthStatus('error');
        console.error('Auth error:', authError);
      } else if (session) {
        setAuthStatus('authenticated');
      } else {
        setAuthStatus('unauthenticated');
      }

      const dbTests: DbTestResults = { inventory: 'pending', events: 'pending' };

      try {
        await supabase.from('inventory').select('id', { count: 'exact', head: true }).limit(1);
        dbTests.inventory = 'success';
      } catch (error) {
        dbTests.inventory = 'error';
        console.error('Inventory DB test failed:', error);
      }

      try {
        await supabase.from('events').select('id', { count: 'exact', head: true }).limit(1);
        dbTests.events = 'success';
      } catch (error) {
        dbTests.events = 'error';
        console.error('Events DB test failed:', error);
      }

      setDbTestResults(dbTests);

      const { count: albumCount } = await supabase.from('inventory').select('id', { count: 'exact', head: true });
      const { count: totalEventsCount } = await supabase.from('events').select('id', { count: 'exact', head: true });

      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data: upcomingEventsData, count: upcomingCount } = await supabase
        .from('events')
        .select('*', { count: 'exact' })
        .gte('date', today)
        .lte('date', nextMonth)
        .order('date', { ascending: true })
        .limit(5);

      setStats({
        totalAlbums: albumCount || 0,
        totalEvents: totalEventsCount || 0,
        upcomingEvents: upcomingCount || 0
      });

      setUpcomingEvents((upcomingEventsData as unknown as DashboardEvent[]) || []);

    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-500 animate-pulse font-medium">Loading dashboard...</div>
      </div>
    );
  }

  // Styles (Compact for brevity)
  const externalToolWrapperStyle: CSSProperties = { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: 'white', borderRadius: 16, padding: 24, marginBottom: 24 };
  const externalLinkStyle: CSSProperties = { background: 'rgba(255,255,255,0.15)', color: 'white', padding: '10px 16px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13, textAlign: 'center', border: '1px solid rgba(255,255,255,0.2)', transition: 'all 0.2s' };
  const contentBoxStyle: CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 };
  const actionLinkBaseStyle: CSSProperties = { display: 'block', padding: '12px 16px', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 600, textAlign: 'center', fontSize: 14 };

  return (
    <div className="p-6 bg-slate-50 min-h-screen max-w-7xl mx-auto font-sans">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-base text-gray-500">Welcome back! Here&apos;s what&apos;s happening with Dead Wax Dialogues.</p>
      </div>

      <div style={externalToolWrapperStyle}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, marginBottom: 8 }}>🔗 External Admin Tools</h3>
          <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>Quick access to all your external services and platforms</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <Link href="https://blog.deadwaxdialogues.com/wp-admin/" target="_blank" style={externalLinkStyle}>📝 WordPress Admin</Link>
          <Link href="https://console.hetzner.com/projects" target="_blank" style={externalLinkStyle}>🖥️ Hetzner Console</Link>
          <Link href="https://business.facebook.com/" target="_blank" style={externalLinkStyle}>📘 Facebook Business</Link>
          <Link href="https://login.buffer.com/login" target="_blank" style={externalLinkStyle}>📱 Buffer</Link>
          <Link href="https://supabase.com/" target="_blank" style={externalLinkStyle}>🗄️ Supabase</Link>
          <Link href="https://vercel.com/" target="_blank" style={externalLinkStyle}>▲ Vercel</Link>
          <Link href="https://admin.google.com/" target="_blank" style={externalLinkStyle}>🔍 Google Admin</Link>
          <Link href="https://login.squarespace.com/" target="_blank" style={externalLinkStyle}>⬛ Squarespace</Link>
          <Link href="https://app.dub.co/login" target="_blank" style={externalLinkStyle}>🔗 Dub.co</Link>
        </div>
      </div>

      {/* System Health */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1f2937' }}>🔧 System Health Monitor</h3>
          <button onClick={loadDashboardData} style={{ padding: '4px 8px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Refresh</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ padding: 12, background: authStatus === 'authenticated' ? '#f0fdf4' : '#fef2f2', borderRadius: 6, border: `1px solid ${authStatus === 'authenticated' ? '#22c55e' : '#ef4444'}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: authStatus === 'authenticated' ? '#15803d' : '#dc2626' }}>{authStatus === 'authenticated' ? '✅ Authentication' : '❌ Auth Error'}</div>
          </div>
          <div style={{ padding: 12, background: dbTestResults.inventory === 'success' ? '#f0fdf4' : '#fef2f2', borderRadius: 6, border: `1px solid ${dbTestResults.inventory === 'success' ? '#22c55e' : '#ef4444'}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: dbTestResults.inventory === 'success' ? '#15803d' : '#dc2626' }}>{dbTestResults.inventory === 'success' ? '✅ Inventory DB' : '❌ Inventory DB'}</div>
          </div>
          <div style={{ padding: 12, background: dbTestResults.events === 'success' ? '#f0fdf4' : '#fef2f2', borderRadius: 6, border: `1px solid ${dbTestResults.events === 'success' ? '#22c55e' : '#ef4444'}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: dbTestResults.events === 'success' ? '#15803d' : '#dc2626' }}>{dbTestResults.events === 'success' ? '✅ Events DB' : '❌ Events DB'}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: 24, borderRadius: 12 }}>
          <div style={{ fontSize: 32, fontWeight: 'bold' }}>{stats.totalAlbums.toLocaleString()}</div>
          <div style={{ opacity: 0.9, fontSize: 14 }}>Total Albums</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', padding: 24, borderRadius: 12 }}>
          <div style={{ fontSize: 32, fontWeight: 'bold' }}>{stats.upcomingEvents}</div>
          <div style={{ opacity: 0.9, fontSize: 14 }}>Upcoming Events</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', padding: 24, borderRadius: 12 }}>
          <div style={{ fontSize: 32, fontWeight: 'bold' }}>{stats.totalEvents}</div>
          <div style={{ opacity: 0.9, fontSize: 14 }}>Total Events</div>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Left: Recent Activity */}
        <div style={contentBoxStyle}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 600, color: '#1f2937' }}>📊 Recent Activity</h3>
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 24, fontStyle: 'italic' }}>Activity tracking coming soon</div>
        </div>

        {/* Right: Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={contentBoxStyle}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 600, color: '#1f2937' }}>⚡ Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {authStatus === 'authenticated' ? (
                <>
                  <Link href="/admin/manage-events" style={{ ...actionLinkBaseStyle, background: 'linear-gradient(135deg, #10b981, #047857)' }}>📅 Manage Events</Link>
                  <Link href="/admin/edit-collection" style={{ ...actionLinkBaseStyle, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>📚 Collection Command Center</Link>
                  <Link href="/admin/diagnostics" style={{ ...actionLinkBaseStyle, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>🔍 Data Diagnostics</Link>
                </>
              ) : (
                <Link href="/admin/login" style={{ ...actionLinkBaseStyle, background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>🔑 Login Required</Link>
              )}
            </div>
          </div>

          {/* Upcoming Events List */}
          <div style={contentBoxStyle}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 600, color: '#1f2937' }}>📅 Upcoming Events</h3>
            {upcomingEvents.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6b7280', padding: 16 }}>No upcoming events</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {upcomingEvents.map((event) => (
                  <div key={event.id} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>{event.title}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(event.date)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
