// src/app/edit-collection/tabs/MainTab.tsx
'use client';

import type { Album } from 'types/album';

interface MainTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null | boolean) => void;
}

export function MainTab({ album, onChange }: MainTabProps) {
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: '6px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: 'white',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: 'white',
    appearance: 'none',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'%3E%3Cpath fill=\'%23666\' d=\'M0 0l5 6 5-6z\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: '32px',
  };

  const dateInputStyle: React.CSSProperties = {
    padding: '8px 8px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    textAlign: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: 'white',
  };

  const listButtonStyle: React.CSSProperties = {
    width: '32px',
    height: '36px',
    padding: 0,
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
    flexShrink: 0,
  };

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gap: '20px',
      maxWidth: '100%',
    }}>
      {/* LEFT COLUMN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Title with Aa */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ ...labelStyle, marginBottom: '0' }}>Title</label>
            <span style={{ color: '#9ca3af', fontSize: '13px', fontWeight: '400' }}>Aa</span>
          </div>
          <input
            type="text"
            value={album.title}
            onChange={(e) => onChange('title', e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Sort Title */}
        <div>
          <label style={labelStyle}>Sort Title</label>
          <input
            type="text"
            value={album.sort_title || ''}
            onChange={(e) => onChange('sort_title', e.target.value)}
            style={inputStyle}
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
          />
        </div>

        {/* Artist */}
        <div>
          <label style={labelStyle}>Artist</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ 
              flex: 1,
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>{album.artist}</span>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '18px',
                  lineHeight: '1',
                  fontWeight: '300',
                }}
              >
                ×
              </button>
            </div>
            <button
              style={{
                width: '36px',
                height: '36px',
                padding: 0,
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '20px',
                lineHeight: '1',
                cursor: 'pointer',
                color: '#6b7280',
                fontWeight: '300',
                flexShrink: 0,
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Row 1: Release Date | Original Release Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: '0' }}>Release Date</label>
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6b7280' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                value={album.year || ''}
                onChange={(e) => onChange('year', e.target.value)}
                placeholder="YYYY"
                style={{ ...dateInputStyle, width: '70px', borderRadius: '4px' }}
              />
              <div style={{ width: '8px', height: '1px', backgroundColor: '#d1d5db' }} />
              <input
                type="text"
                placeholder="MM"
                style={{ ...dateInputStyle, width: '50px', borderRadius: '4px' }}
              />
              <div style={{ width: '8px', height: '1px', backgroundColor: '#d1d5db' }} />
              <input
                type="text"
                placeholder="DD"
                style={{ ...dateInputStyle, width: '50px', borderRadius: '4px' }}
              />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: '0' }}>Original Release Date</label>
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6b7280' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                value={album.master_release_date || ''}
                onChange={(e) => onChange('master_release_date', e.target.value)}
                placeholder="YYYY"
                style={{ ...dateInputStyle, width: '70px', borderRadius: '4px' }}
              />
              <div style={{ width: '8px', height: '1px', backgroundColor: '#d1d5db' }} />
              <input
                type="text"
                placeholder="MM"
                style={{ ...dateInputStyle, width: '50px', borderRadius: '4px' }}
              />
              <div style={{ width: '8px', height: '1px', backgroundColor: '#d1d5db' }} />
              <input
                type="text"
                placeholder="DD"
                style={{ ...dateInputStyle, width: '50px', borderRadius: '4px' }}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Label | Recording Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Label</label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
              <select 
                value={album.spotify_label || album.apple_music_label || ''}
                onChange={(e) => onChange('spotify_label', e.target.value)}
                style={{ ...selectStyle, flex: 1, height: '36px' }}
              >
                <option value="">{album.spotify_label || album.apple_music_label || 'Select label'}</option>
              </select>
              <button style={listButtonStyle}>☰</button>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: '0' }}>Recording Date</label>
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6b7280' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="YYYY"
                style={{ ...dateInputStyle, width: '70px', borderRadius: '4px' }}
              />
              <div style={{ width: '8px', height: '1px', backgroundColor: '#d1d5db' }} />
              <input
                type="text"
                placeholder="MM"
                style={{ ...dateInputStyle, width: '50px', borderRadius: '4px' }}
              />
              <div style={{ width: '8px', height: '1px', backgroundColor: '#d1d5db' }} />
              <input
                type="text"
                placeholder="DD"
                style={{ ...dateInputStyle, width: '50px', borderRadius: '4px' }}
              />
            </div>
          </div>
        </div>

        {/* Row 3: Format | Barcode */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Format</label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
              <select 
                value={album.format}
                onChange={(e) => onChange('format', e.target.value)}
                style={{ ...selectStyle, flex: 1, height: '36px' }}
              >
                <option>{album.format}</option>
              </select>
              <button style={listButtonStyle}>☰</button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Barcode</label>
            <input
              type="text"
              value={album.barcode || ''}
              onChange={(e) => onChange('barcode', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Row 4: Cat No - FULL WIDTH */}
        <div>
          <label style={labelStyle}>Cat No</label>
          <input
            type="text"
            value={album.cat_no || ''}
            onChange={(e) => onChange('cat_no', e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Row 5: Genre - FULL WIDTH */}
        <div>
          <label style={labelStyle}>Genre</label>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
            <div style={{
              flex: 1,
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              minHeight: '36px',
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              alignItems: 'center',
              backgroundColor: 'white',
            }}>
              {album.discogs_genres && album.discogs_genres.length > 0 ? (
                <>
                  {album.discogs_genres.map((genre, idx) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: '#e5e7eb',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#374151',
                      }}
                    >
                      {genre}
                      <button
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#6b7280',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '16px',
                          lineHeight: '1',
                          fontWeight: '300',
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </>
              ) : null}
            </div>
            <button style={listButtonStyle}>☰</button>
          </div>
        </div>
      </div>
    </div>
  );
}