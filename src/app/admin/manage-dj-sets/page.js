// src/app/admin/manage-dj-sets/page.js
"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import Link from 'next/link';

export default function ManageDJSetsPage() {
  const [djSets, setDjSets] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_id: '',
    recorded_at: '',
    tags: '',
    track_listing: '',
    file: null
  });

  useEffect(() => {
    loadDJSets();
    loadEvents();
  }, []);

  const loadDJSets = async () => {
    try {
      const { data, error } = await supabase
        .from('dj_sets')
        .select(`
          *,
          events(title, date)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDjSets(data || []);
    } catch (error) {
      console.error('Error loading DJ sets:', error);
      setStatus('Error loading DJ sets');
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, date')
        .order('date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type (MP3, WAV, etc.)
      const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a'];
      if (!validTypes.includes(file.type)) {
        setStatus('Please select a valid audio file (MP3, WAV, M4A)');
        return;
      }
      
      setFormData(prev => ({ ...prev, file }));
      
      // Auto-populate title from filename if empty
      if (!formData.title) {
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        setFormData(prev => ({ ...prev, title: fileName }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.file) {
      setStatus('Please select an audio file');
      return;
    }

    setUploading(true);
    setStatus('Uploading DJ set...');
    setUploadProgress(0);

    try {
      // Generate unique filename
      const fileExt = formData.file.name.split('.').pop();
      const fileName = `${Date.now()}-${formData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${fileExt}`;

      // Upload file to Supabase storage - FIXED: removed unused uploadData variable
      const { error: uploadError } = await supabase.storage
        .from('dj-sets')
        .upload(fileName, formData.file, {
          onUploadProgress: (progress) => {
            setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
          }
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('dj-sets')
        .getPublicUrl(fileName);

      // Parse tags and track listing
      const tags = formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [];
      const trackListing = formData.track_listing ? 
        formData.track_listing.split('\n').map(track => track.trim()).filter(Boolean) : [];

      // Save metadata to database
      const { error: dbError } = await supabase
        .from('dj_sets')
        .insert({
          title: formData.title,
          description: formData.description,
          event_id: formData.event_id || null,
          file_url: publicUrl,
          file_size: formData.file.size,
          recorded_at: formData.recorded_at || new Date().toISOString(),
          tags,
          track_listing: trackListing
        });

      if (dbError) throw dbError;

      setStatus('DJ set uploaded successfully!');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        event_id: '',
        recorded_at: '',
        tags: '',
        track_listing: '',
        file: null
      });
      
      // Reset file input
      const fileInput = document.getElementById('audio-file');
      if (fileInput) fileInput.value = '';

      // Reload DJ sets
      loadDJSets();

    } catch (error) {
      console.error('Upload error:', error);
      setStatus(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteDJSet = async (id, fileUrl) => {
    if (!confirm('Are you sure you want to delete this DJ set? This cannot be undone.')) {
      return;
    }

    try {
      // Extract filename from URL
      const fileName = fileUrl.split('/').pop();
      
      // Delete file from storage
      await supabase.storage
        .from('dj-sets')
        .remove([fileName]);

      // Delete from database
      const { error } = await supabase
        .from('dj_sets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setStatus('DJ set deleted successfully');
      loadDJSets();
    } catch (error) {
      console.error('Delete error:', error);
      setStatus(`Delete failed: ${error.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h1>Loading DJ Sets...</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#fff', color: '#222', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 'bold', margin: '0 0 8px 0' }}>
            🎧 Manage DJ Sets
          </h1>
          <p style={{ color: '#666', fontSize: 16, margin: 0 }}>
            Upload and manage recordings from your Reloop Tape
          </p>
        </div>
        <Link
          href="/admin/admin-dashboard"
          style={{
            background: '#6b7280',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600
          }}
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Upload Form */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 24,
        marginBottom: 32
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
          Upload New DJ Set
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                Audio File *
              </label>
              <input
                id="audio-file"
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                disabled={uploading}
                style={{
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  width: '100%',
                  fontSize: 14
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Vinyl Night Set - January 2025"
                disabled={uploading}
                required
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  width: '100%',
                  fontSize: 14
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                Event (Optional)
              </label>
              <select
                value={formData.event_id}
                onChange={(e) => setFormData(prev => ({ ...prev, event_id: e.target.value }))}
                disabled={uploading}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  width: '100%',
                  fontSize: 14,
                  background: 'white'
                }}
              >
                <option value="">No associated event</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {new Date(event.date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                Recorded Date
              </label>
              <input
                type="datetime-local"
                value={formData.recorded_at}
                onChange={(e) => setFormData(prev => ({ ...prev, recorded_at: e.target.value }))}
                disabled={uploading}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  width: '100%',
                  fontSize: 14
                }}
              />
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the set, venue, vibe, or special moments..."
                disabled={uploading}
                rows={3}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  width: '100%',
                  fontSize: 14,
                  resize: 'vertical'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="vinyl, house, disco, underground"
                disabled={uploading}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  width: '100%',
                  fontSize: 14
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                Track Listing (one per line)
              </label>
              <textarea
                value={formData.track_listing}
                onChange={(e) => setFormData(prev => ({ ...prev, track_listing: e.target.value }))}
                placeholder="Artist - Track Title&#10;Another Artist - Another Track&#10;..."
                disabled={uploading}
                rows={4}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  width: '100%',
                  fontSize: 14,
                  resize: 'vertical',
                  fontFamily: 'monospace'
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
            <button
              type="submit"
              disabled={uploading || !formData.file || !formData.title}
              style={{
                background: uploading ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              {uploading ? (
                <>
                  <span>Uploading... {uploadProgress}%</span>
                  <div style={{
                    width: 16,
                    height: 16,
                    border: '2px solid #fff',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                </>
              ) : (
                '🎧 Upload DJ Set'
              )}
            </button>
          </div>
        </form>

        {status && (
          <div style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 6,
            background: status.includes('Error') || status.includes('failed') ? '#fee2e2' : '#dcfce7',
            border: `1px solid ${status.includes('Error') || status.includes('failed') ? '#fca5a5' : '#22c55e'}`,
            color: status.includes('Error') || status.includes('failed') ? '#dc2626' : '#059669',
            fontSize: 14,
            fontWeight: 600
          }}>
            {status}
          </div>
        )}
      </div>

      {/* DJ Sets List */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        overflow: 'hidden'
      }}>
        <div style={{
          background: '#f9fafb',
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          fontWeight: 600,
          fontSize: 16
        }}>
          Uploaded DJ Sets ({djSets.length})
        </div>

        {djSets.length === 0 ? (
          <div style={{
            padding: 40,
            textAlign: 'center',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎧</div>
            <div style={{ fontSize: 16 }}>No DJ sets uploaded yet</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              Upload your first recording from the Reloop Tape above
            </div>
          </div>
        ) : (
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {djSets.map((set, index) => (
              <div key={set.id} style={{
                padding: '16px 24px',
                borderBottom: index < djSets.length - 1 ? '1px solid #f3f4f6' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 16
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 16 }}>
                    {set.title}
                  </div>
                  {set.description && (
                    <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>
                      {set.description}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {set.events?.title && `${set.events.title} • `}
                    {new Date(set.recorded_at || set.created_at).toLocaleDateString()} • 
                    {formatFileSize(set.file_size)} • 
                    {formatDuration(set.duration)}
                  </div>
                  {set.tags && set.tags.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {set.tags.map(tag => (
                        <span key={tag} style={{
                          display: 'inline-block',
                          background: '#e0f2fe',
                          color: '#0369a1',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          marginRight: 4,
                          marginTop: 2
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <audio controls style={{ width: 200 }}>
                    <source src={set.file_url} type="audio/mpeg" />
                  </audio>
                  
                  <a
                    href={set.file_url}
                    download
                    style={{
                      background: '#059669',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: 6,
                      textDecoration: 'none',
                      fontSize: 12,
                      fontWeight: 600
                    }}
                  >
                    Download
                  </a>

                  <button
                    onClick={() => deleteDJSet(set.id, set.file_url)}
                    style={{
                      background: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CSS for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}