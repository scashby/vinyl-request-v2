// src/components/EventDJSets.tsx
"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';

interface DJSet {
  id: number;
  title: string;
  description?: string;
  file_url: string;
  download_url?: string;
  google_drive_id?: string;
  recorded_at: string;
  tags?: string[];
  track_listing?: string[];
  file_size?: number;
  duration?: number;
  download_count: number;
}

interface EventDJSetsProps {
  eventId: number;
}

export default function EventDJSets({ eventId }: EventDJSetsProps) {
  const [djSets, setDjSets] = useState<DJSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    const loadEventDJSets = async () => {
      try {
        const { data, error } = await supabase
          .from('dj_sets')
          .select('*')
          .eq('event_id', eventId)
          .order('recorded_at', { ascending: false });

        if (error) {
          console.error('Error loading DJ sets:', error);
          return;
        }

        setDjSets(data || []);
      } catch (error) {
        console.error('Error loading DJ sets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEventDJSets();
  }, [eventId]);

  const handleDownload = async (setId: number, fileUrl: string, title: string) => {
    try {
      // Track download
      await supabase
        .from('dj_sets')
        .update({ download_count: djSets.find(s => s.id === setId)?.download_count + 1 || 1 })
        .eq('id', setId);

      // Trigger download
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = `${title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="event-section">
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          <div>Loading DJ sets...</div>
        </div>
      </div>
    );
  }

  if (djSets.length === 0) {
    return null; // Don't show anything if no sets
  }

  return (
    <div className="event-section">
      <h3 style={{ 
        fontSize: '1.5rem', 
        fontWeight: 600, 
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        🎧 DJ Sets from This Event
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {djSets.map((set) => (
          <div
            key={set.id}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.5rem',
              transition: 'all 0.2s ease'
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ 
                fontSize: '1.25rem', 
                fontWeight: 600, 
                margin: '0 0 0.5rem 0',
                color: '#1f2937'
              }}>
                {set.title}
              </h4>
              
              {set.description && (
                <p style={{ 
                  color: '#6b7280', 
                  fontSize: '0.9rem', 
                  margin: '0 0 0.5rem 0',
                  lineHeight: 1.5
                }}>
                  {set.description}
                </p>
              )}

              <div style={{ 
                fontSize: '0.8rem', 
                color: '#9ca3af',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <span>📅 {formatDate(set.recorded_at)}</span>
                {set.file_size && <span>📁 {formatFileSize(set.file_size)}</span>}
                {set.duration && <span>⏱️ {formatDuration(set.duration)}</span>}
                {set.download_count > 0 && <span>⬇️ {set.download_count} downloads</span>}
              </div>
            </div>

            {/* Tags */}
            {set.tags && set.tags.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                {set.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: 'inline-block',
                      background: '#e0f2fe',
                      color: '#0369a1',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '1rem',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      marginRight: '0.5rem',
                      marginBottom: '0.25rem'
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Audio Player for Direct Playback */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
              marginBottom: '1rem'
            }}>
              {/* HTML5 Audio Player - Uses direct download URL */}
              <audio
                controls
                style={{
                  flex: 1,
                  minWidth: '300px',
                  height: '40px'
                }}
                preload="metadata"
              >
                <source src={set.download_url || set.file_url} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </div>

            {/* Playback & Download Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              {/* Play in Google Drive */}
              <a
                href={set.file_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#4285f4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'background 0.2s ease',
                  flex: 1,
                  minWidth: '200px',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#3367d6'}
                onMouseOut={(e) => e.currentTarget.style.background = '#4285f4'}
              >
                ▶️ Play in Google Drive
              </a>

              {/* Download Button */}
              <a
                href={set.download_url || set.file_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleDownload(set.id, set.file_url, set.title)}
                style={{
                  background: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#047857'}
                onMouseOut={(e) => e.currentTarget.style.background = '#059669'}
              >
                ⬇️ Download
              </a>
            </div>

            {/* Track Listing */}
            {set.track_listing && set.track_listing.length > 0 && (
              <details style={{ marginTop: '1rem' }}>
                <summary style={{
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: '0.9rem',
                  padding: '0.5rem 0'
                }}>
                  🎵 Track Listing ({set.track_listing.length} tracks)
                </summary>
                <div style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginTop: '0.5rem'
                }}>
                  <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
                    {set.track_listing.map((track, index) => (
                      <li
                        key={index}
                        style={{
                          fontSize: '0.85rem',
                          color: '#4b5563',
                          marginBottom: '0.25rem',
                          fontFamily: 'monospace'
                        }}
                      >
                        {track}
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
            )}

            {/* Google Drive Storage Indicator */}
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: '#4285f4',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '1rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              📁 Google Drive
            </div>
          </div>
        ))}
      </div>

      {/* CSS for details styling */}
      <style jsx>{`
        details summary::-webkit-details-marker {
          display: none;
        }
        
        details summary::before {
          content: '▶ ';
          margin-right: 0.5rem;
        }
        
        details[open] summary::before {
          content: '▼ ';
        }
      `}</style>
    </div>
  );
}