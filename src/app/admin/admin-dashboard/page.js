// src/app/admin/admin-dashboard/page.js
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from 'lib/supabaseClient';
import AudioRecognitionStatus from 'components/AudioRecognitionStatus';
import 'styles/internal.css';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalAlbums: 0,
    totalEvents: 0,
    upcomingEvents: 0,
    recentRecognitions: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [recentRecognitions, setRecentRecognitions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    
    try {
      // Get collection stats
      const { count: albumCount } = await supabase
        .from('collection')
        .select('*', { count: 'exact', head: true });

      // Get events stats
      const { count: totalEventsCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });

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

      // Get recent audio recognitions (last 24 hours) - with error handling
      let recentRecognitionsData = [];
      let recentRecognitionsCount = 0;
      
      try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const result = await supabase
          .from('audio_recognition_logs')
          .select('*', { count: 'exact' })
          .gte('created_at', yesterday)
          .eq('confirmed', true)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (!result.error) {
          recentRecognitionsData = result.data || [];
          recentRecognitionsCount = result.count || 0;
        }
      } catch (error) {
        console.log('Audio recognition logs table not available:', error);
      }

      // Build recent activity feed
      const activityItems = [];
      
      // Add recent recognitions to activity
      if (recentRecognitionsData) {
        recentRecognitionsData.slice(0, 5).forEach(recognition => {
          activityItems.push({
            type: 'recognition',
            icon: '🎵',
            title: `Recognized: ${recognition.artist} - ${recognition.title}`,
            subtitle: `${Math.round((recognition.confidence || 0) * 100)}% confidence via ${recognition.service}`,
            time: recognition.created_at,
            color: 'text-purple-600'
          });
        });
      }

      // Sort activity by time
      activityItems.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      setStats({
        totalAlbums: albumCount || 0,
        totalEvents: totalEventsCount || 0,
        upcomingEvents: upcomingCount || 0,
        recentRecognitions: recentRecognitionsCount
      });

      setUpcomingEvents(upcomingEventsData || []);
      setRecentRecognitions(recentRecognitionsData);
      setRecentActivity(activityItems);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
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



  const getTimeAgo = (dateString) => {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  if (loading) {
    return (
      <div style={{
        padding: 24,
        background: '#f8fafc',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ fontSize: 18, color: '#6b7280' }}>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div style={{
      padding: 24,
      background: '#f8fafc',
      minHeight: '100vh',
      maxWidth: 1400,
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 'bold',
          color: '#1f2937',
          margin: '0 0 8px 0'
        }}>
          Admin Dashboard
        </h1>
        <p style={{
          color: '#6b7280',
          fontSize: 16,
          margin: 0
        }}>
          Welcome back! Here&apos;s what&apos;s happening with Dead Wax Dialogues.
        </p>
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

        <div style={{
          background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
          color: 'white',
          padding: 24,
          borderRadius: 12,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 4 }}>
            {stats.recentRecognitions}
          </div>
          <div style={{ opacity: 0.9, fontSize: 14 }}>Recognitions (24h)</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 24,
        marginBottom: 32
      }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Audio Recognition Status */}
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
              🎵 Audio Recognition System
            </h3>
            {stats.recentRecognitions > 0 ? (
              <AudioRecognitionStatus />
            ) : (
              <div style={{
                textAlign: 'center',
                padding: 24,
                background: '#f9fafb',
                borderRadius: 8,
                border: '2px dashed #d1d5db'
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎧</div>
                <div style={{ color: '#6b7280', marginBottom: 8 }}>
                  Audio Recognition Not Set Up
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
                  The audio recognition tables need to be created in your database
                </div>
                <Link
                  href="/admin/audio-recognition"
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    background: '#8b5cf6',
                    color: 'white',
                    borderRadius: 6,
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  Set Up Audio Recognition
                </Link>
              </div>
            )}
          </div>

          {/* Recent Activity */}
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

            {recentActivity.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#6b7280',
                padding: 24,
                fontStyle: 'italic'
              }}>
                No recent activity
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recentActivity.map((item, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: 12,
                    background: '#f9fafb',
                    borderRadius: 8,
                    border: '1px solid #f3f4f6'
                  }}>
                    <div style={{
                      fontSize: 20,
                      marginRight: 12,
                      width: 32,
                      textAlign: 'center'
                    }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#1f2937',
                        marginBottom: 2
                      }}>
                        {item.title}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: '#6b7280'
                      }}>
                        {item.subtitle}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: '#9ca3af',
                      textAlign: 'right'
                    }}>
                      {getTimeAgo(item.time)}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              <Link
                href="/admin/audio-recognition"
                style={{
                  display: 'block',
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                  color: 'white',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontWeight: 600,
                  textAlign: 'center',
                  fontSize: 14
                }}
              >
                🎧 Audio Recognition Control
              </Link>
              <Link
                href="/admin/add-album"
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
                ➕ Add New Album
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
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: 'white',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontWeight: 600,
                  textAlign: 'center',
                  fontSize: 14
                }}
              >
                📚 Edit Collection
              </Link>
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

          {/* Recent Recognitions */}
          {recentRecognitions.length > 0 ? (
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
                🎵 Recent Recognitions
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentRecognitions.slice(0, 5).map((recognition, index) => (
                  <div key={index} style={{
                    padding: 8,
                    background: '#faf5ff',
                    borderRadius: 6,
                    border: '1px solid #e9d5ff'
                  }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#7c3aed',
                      marginBottom: 2
                    }}>
                      {recognition.artist} - {recognition.title}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: '#8b5cf6'
                    }}>
                      {Math.round((recognition.confidence || 0) * 100)}% • {getTimeAgo(recognition.created_at)}
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/admin/audio-recognition"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  marginTop: 12,
                  padding: '6px 12px',
                  color: '#7c3aed',
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 500
                }}
              >
                View Recognition Panel →
              </Link>
            </div>
          ) : stats.recentRecognitions === 0 && (
            <div style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 24
            }}>
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: 18,
                fontWeight: 600,
                color: '#1f2937'
              }}>
                🎵 Audio Recognition Setup
              </h3>
              <div style={{
                padding: 16,
                background: '#fef3c7',
                borderRadius: 8,
                border: '1px solid #f59e0b',
                fontSize: 14,
                color: '#92400e'
              }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  Database Setup Required
                </div>
                <div style={{ marginBottom: 12 }}>
                  The audio recognition system needs database tables to be created. 
                  Run the provided SQL in your Supabase dashboard to get started.
                </div>
                <Link
                  href="/admin/audio-recognition"
                  style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    background: '#d97706',
                    color: 'white',
                    borderRadius: 4,
                    textDecoration: 'none',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  View Setup Instructions
                </Link>
              </div>
            </div>
          )}
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