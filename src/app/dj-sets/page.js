// src/app/dj-sets/page.js
"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import InternalLayout from 'src/layouts/InternalLayout';

export default function DJSetsPage() {
  const [djSets, setDjSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');

  useEffect(() => {
    loadDJSets();
  }, []);

  const loadDJSets = async () => {
    try {
      const { data, error } = await supabase
        .from('dj_sets')
        .select(`
          *,
          events(title, date, location)
        `)
        .order('recorded_at', { ascending: false });

      if (error) throw error;
      setDjSets(data || []);
    } catch (error) {
      console.error('Error loading DJ sets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (setId, fileUrl, title) => {
    try {
      // Track download
      await supabase
        .from('dj_sets')
        .update({ download_count: (djSets.find(s => s.id === setId)?.download_count || 0) + 1 })
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredSets = djSets.filter(set => {
    const matchesSearch = set.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         set.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         set.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filterBy === 'all') return matchesSearch;
    if (filterBy === 'events') return matchesSearch && set.events;
    if (filterBy === 'standalone') return matchesSearch && !set.events;
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <InternalLayout title="DJ Sets">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Loading DJ Sets...</h2>
        </div>
      </InternalLayout>
    );
  }

  return (
    <InternalLayout title="DJ Sets">
      {/* Search and Filter */}
      <div style={{
        padding: '2rem',
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <input
          type="text"
          placeholder="Search sets, events, tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: '300px',
            maxWidth: '400px',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px solid #ccc',
            fontSize: '1rem'
          }}
        />
        <select
          value={filterBy}
          onChange={(e) => setFilterBy(e.target.value)}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px solid #ccc',
            fontSize: '1rem',
            minWidth: '150px'
          }}
        >
          <option value="all">All Sets</option>
          <option value="events">Event Sets</option>
          <option value="standalone">Standalone Sets</option>
        </select>
      </div>

      {/* DJ Sets Grid */}
      <div style={{ padding: '0 2rem 2rem' }}>
        {filteredSets.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            color: '#666'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎧</div>
            <h2>No DJ sets found</h2>
            <p>Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '2rem',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
            {filteredSets.map((set) => (
              <div
                key={set.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '2rem',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
              >
                {/* Header */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 600, 
                    marginBottom: '0.5rem',
                    color: '#1f2937'
                  }}>
                    {set.title}
                  </h3>
                  
                  {set.events && (
                    <div style={{ 
                      color: '#4285f4', 
                      fontSize: '0.9rem',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      📍 {set.events.title}
                      {set.events.location && ` • ${set.events.location}`}
                    </div>
                  )}

                  <div style={{ 
                    fontSize: '0.85rem', 
                    color: '#6b7280'
                  }}>
                    {formatDate(set.recorded_at || set.created_at)}
                    {set.download_count > 0 && ` • ${set.download_count} downloads`}
                  </div>
                </div>

                {/* Description */}
                {set.description && (
                  <p style={{ 
                    fontSize: '0.9rem', 
                    lineHeight: 1.6, 
                    marginBottom: '1.5rem',
                    color: '#4b5563'
                  }}>
                    {set.description}
                  </p>
                )}

                {/* Tags */}
                {set.tags && set.tags.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
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

                {/* Play Controls */}
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}>
                  {/* Large Play Button */}
                  <a
                    href={set.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '1rem 2rem',
                      fontSize: '1rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      transition: 'all 0.2s ease',
                      flex: 1,
                      minWidth: '180px',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(66, 133, 244, 0.3)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(66, 133, 244, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(66, 133, 244, 0.3)';
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>▶</span>
                    Play in Google Drive
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
                      padding: '0.75rem 1.5rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#047857'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#059669'}
                  >
                    ⬇ Download
                  </a>
                </div>

                {/* Track Listing */}
                {set.track_listing && set.track_listing.length > 0 && (
                  <details style={{ marginTop: '1.5rem' }}>
                    <summary style={{
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: '#374151',
                      fontSize: '0.9rem',
                      padding: '0.5rem 0',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      🎵 Track Listing ({set.track_listing.length} tracks)
                    </summary>
                    <div style={{
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginTop: '0.5rem',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
                        {set.track_listing.map((track, index) => (
                          <li
                            key={index}
                            style={{
                              fontSize: '0.8rem',
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
              </div>
            ))}
          </div>
        )}
      </div>
    </InternalLayout>
  );
}