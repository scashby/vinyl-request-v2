// src/app/edit-collection/tabs/MainTab.tsx
'use client';

import type { Album } from 'types/album';

interface MainTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null) => void;
}

export function MainTab({ album, onChange }: MainTabProps) {
  const inputStyle = {
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    width: '100%',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: '6px',
  };

  const sectionStyle = {
    marginBottom: '20px',
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <h3 style={{ 
        fontSize: '16px', 
        fontWeight: '700', 
        marginBottom: '20px',
        color: '#111',
      }}>
        Basic Information
      </h3>

      {/* Title */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Title *</label>
        <input
          type="text"
          value={album.title}
          onChange={(e) => onChange('title', e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Artist */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Artist *</label>
        <input
          type="text"
          value={album.artist}
          onChange={(e) => onChange('artist', e.target.value)}
          style={inputStyle}
        />
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
          Will be picker in Phase 3
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', ...sectionStyle }}>
        {/* Sort Title */}
        <div>
          <label style={labelStyle}>Sort Title</label>
          <input
            type="text"
            value={album.sort_title || ''}
            onChange={(e) => onChange('sort_title', e.target.value)}
            style={inputStyle}
            placeholder="The Beatles"
          />
        </div>

        {/* Subtitle */}
        <div>
          <label style={labelStyle}>Subtitle</label>
          <input
            type="text"
            value={album.subtitle || ''}
            onChange={(e) => onChange('subtitle', e.target.value)}
            style={inputStyle}
            placeholder="Deluxe Edition"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', ...sectionStyle }}>
        {/* Release Date */}
        <div>
          <label style={labelStyle}>Release Date</label>
          <input
            type="text"
            value={album.year}
            onChange={(e) => onChange('year', e.target.value)}
            style={inputStyle}
          />
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            Will be MM/DD/YYYY dropdowns in Phase 3
          </div>
        </div>

        {/* Original Release Date */}
        <div>
          <label style={labelStyle}>Original Release Date</label>
          <input
            type="text"
            value={album.master_release_date || ''}
            onChange={(e) => onChange('master_release_date', e.target.value)}
            style={inputStyle}
            placeholder="1967"
          />
        </div>
      </div>

      {/* Format */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Format *</label>
        <input
          type="text"
          value={album.format}
          onChange={(e) => onChange('format', e.target.value)}
          style={inputStyle}
        />
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
          Will be picker in Phase 3
        </div>
      </div>

      {/* Label */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Label</label>
        <input
          type="text"
          value={album.spotify_label || album.apple_music_label || ''}
          onChange={(e) => onChange('spotify_label', e.target.value)}
          style={inputStyle}
          placeholder="Record label"
        />
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
          Will be picker in Phase 3
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', ...sectionStyle }}>
        {/* Barcode */}
        <div>
          <label style={labelStyle}>Barcode</label>
          <input
            type="text"
            value={album.barcode || ''}
            onChange={(e) => onChange('barcode', e.target.value)}
            style={inputStyle}
            placeholder="UPC/EAN barcode"
          />
        </div>

        {/* Cat No */}
        <div>
          <label style={labelStyle}>Cat No</label>
          <input
            type="text"
            value={album.cat_no || ''}
            onChange={(e) => onChange('cat_no', e.target.value)}
            style={inputStyle}
            placeholder="Catalog number"
          />
        </div>
      </div>

      {/* Genre */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Genre</label>
        <input
          type="text"
          value={album.discogs_genres?.join(', ') || ''}
          onChange={(e) => onChange('discogs_genres', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          style={inputStyle}
          placeholder="Rock, Psychedelic"
        />
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
          Will be multi-select picker with tags in Phase 3
        </div>
      </div>
    </div>
  );
}