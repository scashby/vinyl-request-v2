// src/app/edit-collection/tabs/MainTab.tsx
'use client';

import type { Album } from 'types/album';

interface MainTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null | boolean) => void;
}

export function MainTab({ album, onChange }: MainTabProps) {
  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '13px',
    width: '100%',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: '6px',
  };

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gap: '20px',
      maxWidth: '1100px',
    }}>
      {/* LEFT COLUMN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Title */}
        <div>
          <label style={labelStyle}>Title</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={album.title}
              onChange={(e) => onChange('title', e.target.value)}
              style={inputStyle}
            />
            <span style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
              fontSize: '14px',
              pointerEvents: 'none',
            }}>
              Aa
            </span>
          </div>
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ 
              flex: 1,
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              background: '#f9fafb',
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
                  padding: '0 4px',
                  fontSize: '16px',
                }}
              >
                ×
              </button>
            </div>
            <button
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                fontSize: '16px',
                cursor: 'pointer',
                color: '#6b7280',
              }}
            >
              +
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            Artist picker will be added in Phase 3
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Release Date | Original Release Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Release Date</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                placeholder="YYYY"
                value={album.year}
                onChange={(e) => onChange('year', e.target.value)}
                style={{ ...inputStyle, width: '60px' }}
              />
              <input
                type="text"
                placeholder="MM"
                style={{ ...inputStyle, width: '45px' }}
              />
              <input
                type="text"
                placeholder="DD"
                style={{ ...inputStyle, width: '45px' }}
              />
              <button style={{
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '14px',
              }}>
                📅
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Original Release Date</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                placeholder="YYYY"
                value={album.master_release_date || ''}
                onChange={(e) => onChange('master_release_date', e.target.value)}
                style={{ ...inputStyle, width: '60px' }}
              />
              <input
                type="text"
                placeholder="MM"
                style={{ ...inputStyle, width: '45px' }}
              />
              <input
                type="text"
                placeholder="DD"
                style={{ ...inputStyle, width: '45px' }}
              />
              <button style={{
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '14px',
              }}>
                📅
              </button>
            </div>
          </div>
        </div>

        {/* Label | Recording Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Label</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={album.spotify_label || album.apple_music_label || ''}
                onChange={(e) => onChange('spotify_label', e.target.value)}
                style={inputStyle}
              />
              <span style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                fontSize: '14px',
                pointerEvents: 'none',
              }}>
                ▼
              </span>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Recording Date</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                placeholder="YYYY"
                style={{ ...inputStyle, width: '60px' }}
              />
              <input
                type="text"
                placeholder="MM"
                style={{ ...inputStyle, width: '45px' }}
              />
              <input
                type="text"
                placeholder="DD"
                style={{ ...inputStyle, width: '45px' }}
              />
              <button style={{
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '14px',
              }}>
                📅
              </button>
            </div>
          </div>
        </div>

        {/* Format | Barcode */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Format</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={album.format}
                onChange={(e) => onChange('format', e.target.value)}
                style={inputStyle}
              />
              <span style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                fontSize: '14px',
                pointerEvents: 'none',
              }}>
                ▼
              </span>
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

        {/* Empty | Cat No */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div></div>
          <div>
            <label style={labelStyle}>Cat No</label>
            <input
              type="text"
              value={album.cat_no || ''}
              onChange={(e) => onChange('cat_no', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Genre */}
        <div>
          <label style={labelStyle}>Genre</label>
          <div style={{
            padding: '8px 10px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            minHeight: '38px',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            {album.discogs_genres && album.discogs_genres.length > 0 ? (
              album.discogs_genres.map((genre, idx) => (
                <span
                  key={idx}
                  style={{
                    background: '#e5e7eb',
                    padding: '4px 8px',
                    borderRadius: '3px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
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
                      fontSize: '14px',
                      lineHeight: '1',
                    }}
                  >
                    ×
                  </button>
                </span>
              ))
            ) : (
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>No genres selected</span>
            )}
            <button
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: '14px',
                marginLeft: 'auto',
              }}
            >
              ▼
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
            Genre picker will be added in Phase 3
          </div>
        </div>
      </div>
    </div>
  );
}