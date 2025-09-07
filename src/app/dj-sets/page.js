// src/app/dj-sets/page.js
"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import InternalLayout from 'src/layouts/InternalLayout';
import 'src/styles/dj-sets.css';

export default function DJSetsPage() {
  const [djSets, setDjSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [filter, setFilter] = useState('all'); // all, recent, event-based
  const [search, setSearch] = useState('');

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

  const handlePlay = (setId) => {
    setCurrentlyPlaying(setId);
  };

  const handleDownload = async (setId) => {
    // Track download count
    try {
      await supabase
        .from('dj_sets')
        .update({ 
          download_count: supabase.raw('download_count + 1') 
        })
        .eq('id', setId);
    } catch (error) {
      console.error('Error tracking download:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown length';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    return `${mb} MB`;
  };

  // Filter and search logic
  const filteredSets = djSets.filter(set => {
    const matchesSearch = !search || 
      set.title.toLowerCase().includes(search.toLowerCase()) ||
      set.description?.toLowerCase().includes(search.toLowerCase()) ||
      set.events?.title?.toLowerCase().includes(search.toLowerCase()) ||
      set.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()));

    const matchesFilter = filter === 'all' || 
      (filter === 'recent' && new Date(set.recorded_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) ||
      (filter === 'event-based' && set.event_id);

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <InternalLayout title="DJ Sets">
        <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.2rem' }}>
          Loading sets...
        </div>
      </InternalLayout>
    );
  }

  return (
    <InternalLayout title="Live Sessions & DJ Sets">
      <div className="dj-sets-container">
        {/* Search and Filter Bar */}
        <div className="dj-sets-filter-bar">
          <input
            type="text"
            placeholder="Search sets, events, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Sets</option>
            <option value="recent">Recent (30 days)</option>
            <option value="event-based">Event Recordings</option>
          </select>
        </div>

        {/* Sets Grid */}
        {filteredSets.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎧</div>
            <h3>No DJ sets found</h3>
            <p>
              {search ? 
                'Try adjusting your search or filter criteria.' :
                'Check back soon for live recordings and DJ sets!'
              }
            </p>
          </div>
        ) : (
          <div className="dj-sets-grid">
            {filteredSets.map((set) => (
              <div key={set.id} className="dj-set-card">
                {/* Header */}
                <div className="set-header">
                  <h3 className="set-title">{set.title}</h3>
                  {set.events && (
                    <div className="set-event">
                      📍 {set.events.title}
                      {set.events.location && ` • ${set.events.location}`}
                    </div>
                  )}
                  <div className="set-date">
                    {formatDate(set.recorded_at || set.created_at)}
                  </div>
                </div>

                {/* Description */}
                {set.description && (
                  <div className="set-description">
                    {set.description}
                  </div>
                )}

                {/* Tags */}
                {set.tags && set.tags.length > 0 && (
                  <div className="set-tags">
                    {set.tags.map(tag => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Audio Player */}
                <div className="audio-player-section">
                  <audio
                    controls
                    className="audio-player"
                    onPlay={() => handlePlay(set.id)}
                    preload="metadata"
                  >
                    <source src={set.file_url} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </div>

                {/* Track Listing */}
                {set.track_listing && set.track_listing.length > 0 && (
                  <details className="track-listing">
                    <summary>Track Listing ({set.track_listing.length} tracks)</summary>
                    <ol className="track-list">
                      {set.track_listing.map((track, index) => (
                        <li key={index} className="track-item">
                          {track}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}

                {/* Footer */}
                <div className="set-footer">
                  <div className="set-stats">
                    {formatDuration(set.duration)} • {formatFileSize(set.file_size)}
                    {set.download_count > 0 && ` • ${set.download_count} downloads`}
                  </div>
                  
                  <a
                    href={set.file_url}
                    download
                    onClick={() => handleDownload(set.id)}
                    className="download-button"
                  >
                    ⬇️ Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Currently Playing Indicator */}
        {currentlyPlaying && (
          <div className="now-playing-indicator">
            <div className="now-playing-content">
              <div className="now-playing-icon">🎵</div>
              <div>
                Now Playing: {djSets.find(s => s.id === currentlyPlaying)?.title}
              </div>
            </div>
          </div>
        )}
      </div>
    </InternalLayout>
  );
}