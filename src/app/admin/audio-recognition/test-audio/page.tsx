// src/app/admin/audio-recognition/test-audio/page.tsx

'use client';

import AudioTestInterface from 'components/AudioTestInterface';
import Link from 'next/link';

export default function AudioTestPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '1rem'
    }}>
      {/* Breadcrumb Navigation */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        marginBottom: '1rem'
      }}>
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '14px',
          color: '#6b7280'
        }}>
          <Link 
            href="/admin/admin-dashboard"
            style={{ color: '#2563eb', textDecoration: 'none' }}
          >
            Admin Dashboard
          </Link>
          <span>›</span>
          <Link 
            href="/admin/audio-recognition"
            style={{ color: '#2563eb', textDecoration: 'none' }}
          >
            Audio Recognition
          </Link>
          <span>›</span>
          <span style={{ color: '#374151', fontWeight: '500' }}>Audio Test</span>
        </nav>
      </div>

      {/* Phase 1 Status Banner */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
          color: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                margin: '0 0 0.5rem 0'
              }}>
                🎵 Phase 1: Audio Capture Testing
              </h2>
              <p style={{
                margin: 0,
                opacity: 0.9,
                fontSize: '1rem'
              }}>
                Test your turntable line-in setup and verify audio recognition pipeline
              </p>
            </div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              Status: Active Development
            </div>
          </div>
        </div>
      </div>

      {/* Main Test Interface */}
      <AudioTestInterface />

      {/* Phase Overview */}
      <div style={{
        maxWidth: '1200px',
        margin: '2rem auto 0',
        padding: '2rem',
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          margin: '0 0 1.5rem 0',
          color: '#1f2937'
        }}>
          🗺️ Development Roadmap
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* Phase 1 - Current */}
          <div style={{
            padding: '1.5rem',
            border: '2px solid #2563eb',
            borderRadius: '8px',
            background: '#eff6ff'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}>
              <span style={{
                background: '#2563eb',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '4px 8px',
                borderRadius: '12px'
              }}>
                CURRENT
              </span>
              <h4 style={{
                margin: 0,
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#1e40af'
              }}>
                Phase 1: Audio Capture
              </h4>
            </div>
            <ul style={{
              margin: 0,
              paddingLeft: '1.25rem',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#1e40af'
            }}>
              <li>✅ Web Audio API setup</li>
              <li>✅ Line-in device selection</li>
              <li>✅ Real-time audio monitoring</li>
              <li>✅ Basic fingerprinting</li>
              <li>🔄 Testing & validation</li>
            </ul>
          </div>

          {/* Phase 2 - Next */}
          <div style={{
            padding: '1.5rem',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            background: '#fffbeb'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}>
              <span style={{
                background: '#f59e0b',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '4px 8px',
                borderRadius: '12px'
              }}>
                NEXT
              </span>
              <h4 style={{
                margin: 0,
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#d97706'
              }}>
                Phase 2: Collection Matching
              </h4>
            </div>
            <ul style={{
              margin: 0,
              paddingLeft: '1.25rem',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#d97706'
            }}>
              <li>Fuzzy search algorithms</li>
              <li>Vinyl → Cassette → 45s priority</li>
              <li>Confidence scoring</li>
              <li>Collection fingerprint matching</li>
            </ul>
          </div>

          {/* Phase 3 - Future */}
          <div style={{
            padding: '1.5rem',
            border: '2px solid #10b981',
            borderRadius: '8px',
            background: '#f0fdf4'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}>
              <span style={{
                background: '#10b981',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '4px 8px',
                borderRadius: '12px'
              }}>
                FUTURE
              </span>
              <h4 style={{
                margin: 0,
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#047857'
              }}>
                Phase 3: External APIs
              </h4>
            </div>
            <ul style={{
              margin: 0,
              paddingLeft: '1.25rem',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#047857'
            }}>
              <li>Spotify Web API integration</li>
              <li>AcoustID/MusicBrainz</li>
              <li>Last.fm metadata enrichment</li>
              <li>"Customer vinyl" tagging</li>
            </ul>
          </div>
        </div>

        {/* Quick Links */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <Link
            href="/admin/audio-recognition"
            style={{
              padding: '0.75rem 1.5rem',
              background: '#6b7280',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            ← Back to Recognition Dashboard
          </Link>
          <Link
            href="/admin/audio-recognition/collection"
            style={{
              padding: '0.75rem 1.5rem',
              background: '#2563eb',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Collection Match Tool
          </Link>
          <Link
            href="/now-playing-tv"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '0.75rem 1.5rem',
              background: '#7c3aed',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            🖥️ TV Display ↗
          </Link>
        </div>
      </div>
    </div>
  );
}