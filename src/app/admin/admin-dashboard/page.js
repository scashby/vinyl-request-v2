// src/app/admin/admin-dashboard/page.js - UPDATED WITHOUT AUDIO RECOGNITION
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from 'src/lib/supabaseClient';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalAlbums: 0,
    totalEvents: 0,
    upcomingEvents: 0
  });
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState('checking');
  const [dbTestResults, setDbTestResults] = useState({
    collection: 'pending',
    events: 'pending'
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    
    try {
      // Check authentication status first
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        setAuthStatus('error');
        console.error('Auth error:', authError);
      } else if (session) {
        setAuthStatus('authenticated');
      } else {
        setAuthStatus('unauthenticated');
      }

      // Test database connections
      const dbTests = {
        collection: 'pending',
        events: 'pending'
      };

      // Test collection table
      try {
        await supabase.from('collection').select('id', { head: true, count: 'exact' }).limit(1);
        dbTests.collection = 'success';
      } catch (error) {
        dbTests.collection = 'error';
        console.error('Collection DB test failed:', error);
      }

      // Test events table
      try {
        await supabase.from('events').select('id', { head: true, count: 'exact' }).limit(1);
        dbTests.events = 'success';
      } catch (error) {
        dbTests.events = 'error';
        console.error('Events DB test failed:', error);
      }

      setDbTestResults(dbTests);

      // Get collection stats
      const { count: albumCount } = await supabase
        .from('collection')
        .select('id', { count: 'exact', head: true });

      // Get events stats
      const { count: totalEventsCount } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true });

      // Get upcoming events (next 30 days)
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

      setUpcomingEvents(upcomingEventsData || []);

    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
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

  return (
    <div className="p-6 bg-slate-50 min-h-screen max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-base text-gray-500">
          Welcome back! Here&apos;s what&apos;s happening with Dead Wax Dialogues.
        </p>
      </div>

      {/* External Tools Quick Access */}
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        color: 'white',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24
      }}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            marginBottom: 8
          }}>
            🔗 External Admin Tools
          </h3>
          <p style={{
            margin: 0,
            opacity: 0.9,
            fontSize: 14
          }}>
            Quick access to all your external services and platforms
          </p>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12
        }}>
          <Link
            href="https://blog.deadwaxdialogues.com/wp-admin/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
          >
            📝 WordPress Admin
          </Link>
          <Link
            href="https://console.hetzner.com/projects"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
          >
            🖥️ Hetzner Console
          </Link>
          <Link
            href="https://business.facebook.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
          >
            📘 Facebook Business
          </Link>
          <Link
            href="https://login.buffer.com/login?plan=free&cycle=year&cta=bufferSite-globalNav-login-1"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
          >
            📱 Buffer
          </Link>
          <Link
            href="https://supabase.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
          >
            🗄️ Supabase
          </Link>
          <Link
            href="https://vercel.com/scashbys-projects/vinyl-request-v2"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
          >
            ▲ Vercel
          </Link>
          <Link
            href="https://admin.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
          >
            🔍 Google Admin
          </Link>
          <Link
            href="https://login.squarespace.com/api/1/login/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
          >
            ⬛ Squarespace
          </Link>
          <Link
            href="https://app.dub.co/login"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              padding: '10px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
          >
            🔗 Dub.co
          </Link>
        </div>
      </div>

      {/* System Health & Authentication Status */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}>
          <h3 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: '#1f2937'
          }}>
            🔧 System Health Monitor
          </h3>
          <button
            onClick={loadDashboardData}
            style={{
              padding: '4px 8px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12
        }}>
          {/* Authentication Status */}
          <div style={{
            padding: 12,
            background: authStatus === 'authenticated' ? '#f0fdf4' : 
                       authStatus === 'error' ? '#fef2f2' : '#fef3c7',
            border: `1px solid ${authStatus === 'authenticated' ? '#22c55e' : 
                                  authStatus === 'error' ? '#ef4444' : '#f59e0b'}`,
            borderRadius: 6
          }}>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: authStatus === 'authenticated' ? '#15803d' : 
                     authStatus === 'error' ? '#dc2626' : '#d97706',
              marginBottom: 4
            }}>
              {authStatus === 'authenticated' ? '✅ Authentication' : 
               authStatus === 'error' ? '❌ Auth Error' : 
               authStatus === 'unauthenticated' ? '⚠️ Not Logged In' : '🔄 Checking Auth'}
            </div>
            <div style={{
              fontSize: 12,
              color: authStatus === 'authenticated' ? '#16a34a' : 
                     authStatus === 'error' ? '#dc2626' : '#92400e'
            }}>
              {authStatus === 'authenticated' ? 'Admin session active' : 
               authStatus === 'error' ? 'Authentication failed' : 
               authStatus === 'unauthenticated' ? 'Please log in to admin' : 'Verifying session...'}
            </div>
          </div>

          {/* Database Health Checks */}
          <div style={{
            padding: 12,
            background: dbTestResults.collection === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${dbTestResults.collection === 'success' ? '#22c55e' : '#ef4444'}`,
            borderRadius: 6
          }}>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: dbTestResults.collection === 'success' ? '#15803d' : '#dc2626',
              marginBottom: 4
            }}>
              {dbTestResults.collection === 'success' ? '✅ Collection DB' : '❌ Collection DB'}
            </div>
            <div style={{
              fontSize: 12,
              color: dbTestResults.collection === 'success' ? '#16a34a' : '#dc2626'
            }}>
              {dbTestResults.collection === 'success' ? 'Database accessible' : 'Connection failed'}
            </div>
          </div>

          <div style={{
            padding: 12,
            background: dbTestResults.events === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${dbTestResults.events === 'success' ? '#22c55e' : '#ef4444'}`,
            borderRadius: 6
          }}>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: dbTestResults.events === 'success' ? '#15803d' : '#dc2626',
              marginBottom: 4
            }}>
              {dbTestResults.events === 'success' ? '✅ Events DB' : '❌ Events DB'}
            </div>
            <div style={{
              fontSize: 12,
              color: dbTestResults.events === 'success' ? '#16a34a' : '#dc2626'
            }}>
              {dbTestResults.events === 'success' ? 'Database accessible' : 'Connection failed'}
            </div>
          </div>
        </div>

        {/* Show specific help for authentication issues */}
        {authStatus !== 'authenticated' && (
          <div style={{
            marginTop: 12,
            padding: 12,
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: 6,
            fontSize: 12,
            color: '#92400e'
          }}>
            <strong>Authentication Issue:</strong> Please ensure you&apos;re logged into the admin system. 
            <Link href="/admin/login" style={{ color: '#d97706', marginLeft: 4 }}>
              Go to login page →
            </Link>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 20,
        marginBottom: 32
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: 24,
          borderRadius: 12,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 4 }}>
            {stats.totalAlbums.toLocaleString()}
          </div>
          <div style={{ opacity: 0.9, fontSize: 14 }}>Total Albums</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white',
          padding: 24,
          borderRadius: 12,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 4 }}>
            {stats.upcomingEvents}
          </div>
          <div style={{ opacity: 0.9, fontSize: 14 }}>Upcoming Events</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          color: 'white',
          padding: 24,
          borderRadius: 12,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 4 }}>
            {stats.totalEvents}
          </div>
          <div style={{ opacity: 0.9, fontSize: 14 }}>Total Events</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 24,
        marginBottom: 32
      }}>
        {/* Left Column - Recent Activity Placeholder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 24
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: 18,
              fontWeight: 600,
              color: '#1f2937'
            }}>
              📊 Recent Activity
            </h3>
            <div style={{
              textAlign: 'center',
              color: '#6b7280',
              padding: 24,
              fontStyle: 'italic'
            }}>
              Activity tracking coming soon
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Quick Actions */}
          <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 24
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: 18,
              fontWeight: 600,
              color: '#1f2937'
            }}>
              ⚡ Quick Actions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {authStatus === 'authenticated' ? (
                <>
                  <Link
                    href="/admin/import-discogs"
                    style={{
                      display: 'block',
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                      color: 'white',
                      borderRadius: 8,
                      textDecoration: 'none',
                      fontWeight: 600,
                      textAlign: 'center',
                      fontSize: 14
                    }}
                  >
                    📥 Import from Discogs
                  </Link>
                  <Link
                    href="/admin/manage-events"
                    style={{
                      display: 'block',
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, #10b981, #047857)',
                      color: 'white',
                      borderRadius: 8,
                      textDecoration: 'none',
                      fontWeight: 600,
                      textAlign: 'center',
                      fontSize: 14
                    }}
                  >
                    📅 Manage Events
                  </Link>
                  <Link
                    href="/admin/edit-collection"
                    style={{
                      display: 'block',
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                      color: 'white',
                      borderRadius: 8,
                      textDecoration: 'none',
                      fontWeight: 600,
                      textAlign: 'center',
                      fontSize: 14
                    }}
                  >
                    📚 Browse Collection
                  </Link>
                  <Link
                    href="/admin/diagnostics"
                    style={{
                      display: 'block',
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: 'white',
                      borderRadius: 8,
                      textDecoration: 'none',
                      fontWeight: 600,
                      textAlign: 'center',
                      fontSize: 14
                    }}
                  >
                    🔍 Data Diagnostics
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/admin/login"
                    style={{
                      display: 'block',
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                      color: 'white',
                      borderRadius: 8,
                      textDecoration: 'none',
                      fontWeight: 600,
                      textAlign: 'center',
                      fontSize: 14
                    }}
                  >
                    🔑 Login Required
                  </Link>
                  <div style={{
                    padding: '8px 12px',
                    background: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#92400e',
                    textAlign: 'center'
                  }}>
                    Please log in to access admin features
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Upcoming Events */}
          <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 24
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: 18,
              fontWeight: 600,
              color: '#1f2937'
            }}>
              📅 Upcoming Events
            </h3>

            {upcomingEvents.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#6b7280',
                padding: 16,
                fontStyle: 'italic'
              }}>
                No upcoming events
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {upcomingEvents.map((event) => (
                  <div key={event.id} style={{
                    padding: 12,
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1f2937',
                      marginBottom: 4
                    }}>
                      {event.title}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: '#6b7280',
                      marginBottom: 4
                    }}>
                      {formatDate(event.date)} {event.time && `• ${event.time}`}
                    </div>
                    {event.location && (
                      <div style={{
                        fontSize: 12,
                        color: '#9ca3af'
                      }}>
                        📍 {event.location}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/admin/manage-events"
              style={{
                display: 'block',
                textAlign: 'center',
                marginTop: 16,
                padding: '8px 16px',
                color: '#3b82f6',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500
              }}
            >
              View All Events →
            </Link>
          </div>
        </div>
      </div>

      {/* System Status Footer */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: 4
          }}>
            System Status
          </div>
          <div style={{
            fontSize: 14,
            color: '#6b7280'
          }}>
            All systems operational • Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#22c55e'
          }}></div>
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#22c55e'
          }}>
            ONLINE
          </span>
        </div>
      </div>
    </div>
  );
}