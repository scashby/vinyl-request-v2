"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import Link from 'next/link';

interface DJSet {
  id: number;
  title: string;
  description?: string;
  file_url: string;
  download_url?: string;
  recorded_at: string;
  created_at: string;
  tags?: string[];
  events?: {
    title: string;
    date: string;
  };
}

interface EventOption {
  id: number;
  title: string;
  date: string;
}

interface DJSetFormData {
  title: string;
  description: string;
  event_id: string;
  recorded_at: string;
  tags: string;
  track_listing: string;
  google_drive_url: string;
}

export default function ManageDJSetsPage() {
  const [djSets, setDjSets] = useState<DJSet[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  // Form state
  const [formData, setFormData] = useState<DJSetFormData>({
    title: '',
    description: '',
    event_id: '',
    recorded_at: '',
    tags: '',
    track_listing: '',
    google_drive_url: ''
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
      setDjSets((data as unknown as DJSet[]) || []);
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

  const extractGoogleDriveFileId = (url: string): string | null => {
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/,
      /folders\/([a-zA-Z0-9-_]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const generateGoogleDriveLinks = (url: string) => {
    const fileId = extractGoogleDriveFileId(url);
    if (!fileId) return { viewLink: url, downloadLink: url };

    return {
      viewLink: `https://drive.google.com/file/d/${fileId}/view`,
      downloadLink: `https://drive.google.com/uc?export=download&id=${fileId}`
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.google_drive_url) {
      setStatus('Please provide a Google Drive link');
      return;
    }

    if (!formData.title) {
      setStatus('Please provide a title');
      return;
    }

    setSaving(true);
    setStatus('Saving DJ set information...');

    try {
      const tags = formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [];
      const trackListing = formData.track_listing ? 
        formData.track_listing.split('\n').map(track => track.trim()).filter(Boolean) : [];

      const { viewLink, downloadLink } = generateGoogleDriveLinks(formData.google_drive_url);
      const fileId = extractGoogleDriveFileId(formData.google_drive_url);

      const { error: dbError } = await supabase
        .from('dj_sets')
        .insert({
          title: formData.title,
          description: formData.description,
          event_id: formData.event_id ? parseInt(formData.event_id) : null,
          file_url: viewLink,
          download_url: downloadLink,
          google_drive_id: fileId,
          recorded_at: formData.recorded_at || new Date().toISOString(),
          tags,
          track_listing: trackListing,
          storage_provider: 'google_drive'
        });

      if (dbError) throw dbError;

      setStatus('DJ set added successfully!');
      
      setFormData({
        title: '',
        description: '',
        event_id: '',
        recorded_at: '',
        tags: '',
        track_listing: '',
        google_drive_url: ''
      });

      loadDJSets();

    } catch (error: unknown) {
      console.error('Save error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteDJSet = async (id: number) => {
    if (!confirm('Are you sure you want to delete this DJ set? This cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('dj_sets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setStatus('DJ set deleted successfully');
      loadDJSets();
    } catch (error: unknown) {
      console.error('Delete error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Delete failed: ${msg}`);
    }
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
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 'bold', margin: '0 0 8px 0' }}>
            🎧 Manage DJ Sets
          </h1>
          <p style={{ color: '#666', fontSize: 16, margin: 0 }}>
            Add DJ sets by uploading to Google Drive first, then entering the details here
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

      <div style={{
        background: '#f0f9ff',
        border: '1px solid #0ea5e9',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24
      }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}>How to Add DJ Sets:</h3>
        <ol style={{ margin: 0, paddingLeft: 20, color: '#0c4a6e' }}>
          <li>Upload your DJ set MP3 to Google Drive</li>
          <li>Right-click the file → Share → Change to &quot;Anyone with the link&quot;</li>
          <li>Copy the Google Drive link</li>
          <li>Fill out the form below with the link and details</li>
        </ol>
      </div>

      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 24,
        marginBottom: 32
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
          Add New DJ Set
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                Google Drive Link *
              </label>
              <input
                type="url"
                value={formData.google_drive_url}
                onChange={(e) => setFormData(prev => ({ ...prev, google_drive_url: e.target.value }))}
                placeholder="https://drive.google.com/file/d/..."
                disabled={saving}
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
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Live Jukebox at Devil's Purse"
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the set..."
                disabled={saving}
                rows={3}
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
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="vinyl, house, disco"
                disabled={saving}
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
                placeholder="Artist - Track"
                disabled={saving}
                rows={4}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  width: '100%',
                  fontSize: 14,
                  fontFamily: 'monospace'
                }}
              />
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: saving ? '#9ca3af' : '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Saving...' : 'Add DJ Set'}
            </button>
          </div>
        </form>

        {status && (
          <div style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 6,
            background: status.includes('Error') || status.includes('failed') ? '#fee2e2' : '#dcfce7',
            color: status.includes('Error') || status.includes('failed') ? '#dc2626' : '#059669',
            fontWeight: 600
          }}>
            {status}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>
          DJ Sets ({djSets.length})
        </div>
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {djSets.map((set) => (
              <div key={set.id} style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <strong>{set.title}</strong>
                    <div style={{ fontSize: 12, color: '#666' }}>{new Date(set.recorded_at || set.created_at).toLocaleDateString()}</div>
                </div>
                <button 
                    onClick={() => deleteDJSet(set.id)}
                    style={{ background: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }}
                >
                    Delete
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}