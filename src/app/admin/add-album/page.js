// Admin Add Album page ("/admin/add-album")
// Allows admin to add a new album manually, including Discogs lookup and Supabase submission.
"use client";

import { useState } from 'react';
import { supabase } from 'lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

async function fetchDiscogsRelease(releaseId) {
  const res = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function Page() {
  const router = useRouter();
  const [form, setForm] = useState({
    artist: '', title: '', year: '', folder: '', format: '',
    discogs_release_id: '', image_url: '', media_condition: ''
  });
  const [status, setStatus] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function lookupDiscogs() {
    if (!form.discogs_release_id.trim()) {
      setStatus('Please enter a Discogs Release ID first');
      return;
    }
    
    setIsLookingUp(true);
    setStatus('Looking up Discogs data...');
    
    try {
      const discogs = await fetchDiscogsRelease(form.discogs_release_id);
      setForm(f => ({
        ...f,
        artist: discogs.artists?.[0]?.name || f.artist,
        title: discogs.title || f.title,
        year: discogs.year?.toString() || f.year,
        format: discogs.formats?.[0]?.name || f.format,
        image_url: discogs.images?.[0]?.uri || f.image_url
      }));
      setStatus('Discogs data loaded successfully!');
    } catch {
      setStatus('Failed to fetch data from Discogs. Please check the Release ID.');
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    // Basic validation
    if (!form.artist.trim() || !form.title.trim()) {
      setStatus('Artist and Title are required fields');
      return;
    }
    
    setIsSubmitting(true);
    setStatus('Adding album to collection...');
    
    try {
      const { error } = await supabase.from('collection').insert([{ ...form }]);
      
      if (error) {
        setStatus(`Error: ${error.message}`);
      } else {
        setStatus('Album added successfully!');
        // Reset form after successful submission
        setForm({ 
          artist: '', title: '', year: '', folder: '', format: '', 
          discogs_release_id: '', image_url: '', media_condition: '' 
        });
        
        // Optional: redirect to collection after a delay
        setTimeout(() => {
          router.push('/admin/edit-collection');
        }, 1500);
      }
    } catch (err) {
      setStatus(`Unexpected error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputStyle = {
    padding: '12px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: 8,
    fontWeight: '600',
    color: '#374151',
    fontSize: '14px'
  };

  const buttonStyle = {
    padding: '12px 24px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#f9fafb',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontWeight: '500'
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    background: '#2563eb',
    color: 'white',
    border: '1px solid #2563eb'
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    background: '#059669',
    color: 'white',
    border: '1px solid #059669'
  };

  return (
    <div style={{ 
      maxWidth: 800, 
      margin: '32px auto', 
      padding: 32, 
      background: '#fff', 
      borderRadius: 12, 
      color: "#222",
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32, paddingBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ 
          color: "#222", 
          margin: 0, 
          fontSize: '28px', 
          fontWeight: '700',
          marginBottom: 8
        }}>
          Add New Album
        </h2>
        <p style={{ 
          color: "#6b7280", 
          margin: 0, 
          fontSize: '16px' 
        }}>
          Add a new album to your collection manually or lookup from Discogs
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Discogs Lookup Section */}
        <div style={{ 
          marginBottom: 32, 
          padding: 24, 
          background: '#f0f9ff', 
          borderRadius: 10, 
          border: '1px solid #0369a1' 
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            margin: '0 0 16px 0', 
            color: '#0c4a6e' 
          }}>
            Discogs Lookup (Optional)
          </h3>
          <p style={{ 
            color: '#0369a1', 
            fontSize: '14px', 
            marginBottom: 16 
          }}>
            Enter a Discogs Release ID to automatically populate album information
          </p>
          
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Discogs Release ID</label>
              <input 
                style={inputStyle}
                value={form.discogs_release_id} 
                onChange={e => setForm(f => ({ ...f, discogs_release_id: e.target.value }))}
                placeholder="e.g. 1234567"
              />
            </div>
            <button 
              type="button" 
              onClick={lookupDiscogs}
              disabled={isLookingUp}
              style={{
                ...secondaryButtonStyle,
                opacity: isLookingUp ? 0.6 : 1,
                cursor: isLookingUp ? 'not-allowed' : 'pointer'
              }}
            >
              {isLookingUp ? 'Looking up...' : 'Lookup from Discogs'}
            </button>
          </div>
        </div>

        {/* Album Information Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: 24, 
          marginBottom: 32 
        }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={labelStyle}>Artist *</label>
              <input 
                style={inputStyle}
                value={form.artist} 
                onChange={e => setForm(f => ({ ...f, artist: e.target.value }))}
                placeholder="Enter artist name"
                required
              />
            </div>
            
            <div>
              <label style={labelStyle}>Album Title *</label>
              <input 
                style={inputStyle}
                value={form.title} 
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Enter album title"
                required
              />
            </div>
            
            <div>
              <label style={labelStyle}>Year</label>
              <input 
                style={inputStyle}
                value={form.year} 
                onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                placeholder="e.g. 1969"
              />
            </div>
            
            <div>
              <label style={labelStyle}>Format</label>
              <input 
                style={inputStyle}
                value={form.format} 
                onChange={e => setForm(f => ({ ...f, format: e.target.value }))}
                placeholder="e.g. Vinyl, LP, 12 inch"
              />
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={labelStyle}>Folder</label>
              <input 
                style={inputStyle}
                value={form.folder} 
                onChange={e => setForm(f => ({ ...f, folder: e.target.value }))}
                placeholder="Collection folder/section"
              />
            </div>
            
            <div>
              <label style={labelStyle}>Media Condition</label>
              <input 
                style={inputStyle}
                value={form.media_condition} 
                onChange={e => setForm(f => ({ ...f, media_condition: e.target.value }))}
                placeholder="e.g. VG+, NM, M"
              />
            </div>
            
            <div>
              <label style={labelStyle}>Cover Image URL</label>
              <input 
                style={inputStyle}
                value={form.image_url} 
                onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                placeholder="Direct link to album cover"
              />
            </div>
            
            {/* Image Preview */}
            {form.image_url && (
              <div style={{ 
                padding: 16, 
                background: '#f9fafb', 
                borderRadius: 8, 
                display: 'flex', 
                justifyContent: 'center',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: 8 }}>
                    Preview
                  </div>
                  <Image
                    src={form.image_url}
                    alt="Album cover preview"
                    width={120}
                    height={120}
                    style={{ 
                      borderRadius: 8, 
                      objectFit: 'cover', 
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
                    }}
                    unoptimized
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ 
          paddingTop: 24, 
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              type="submit"
              disabled={isSubmitting}
              style={{
                ...primaryButtonStyle,
                padding: '16px 32px',
                fontSize: '16px',
                opacity: isSubmitting ? 0.6 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? 'Adding Album...' : 'Add Album'}
            </button>
            
            <button 
              type="button"
              onClick={() => router.push('/admin/edit-collection')}
              style={{
                ...buttonStyle,
                padding: '16px 24px',
                fontSize: '16px'
              }}
            >
              Back to Collection
            </button>
          </div>

          {/* Status Message */}
          {status && (
            <div style={{ 
              color: status.includes('Error') || status.includes('Failed') 
                ? '#dc2626' 
                : status.includes('successfully') || status.includes('added') 
                ? '#059669' 
                : '#374151',
              fontWeight: '500',
              fontSize: '14px',
              maxWidth: 300,
              textAlign: 'right'
            }}>
              {status}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}