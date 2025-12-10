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
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: '6px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const dropdownStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: '30px',
  };

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gap: '16px',
      maxWidth: '100%',
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
              fontSize: '12px',
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ 
              flex: 1,
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              background: 'white',
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
                fontSize: '18px',
                lineHeight: '1',
                cursor: 'pointer',
                color: '#6b7280',
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Row 1: Release Date | Original Release Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Release Date</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <select style={{ ...dropdownStyle, width: '70px', padding: '8px 6px' }}>
                <option>{album.year || 'YYYY'}</option>
              </select>
              <select style={{ ...dropdownStyle, width: '55px', padding: '8px 6px' }}>
                <option>MM</option>
              </select>
              <select style={{ ...dropdownStyle, width: '55px', padding: '8px 6px' }}>
                <option>DD</option>
              </select>
              <button style={{
                padding: '7px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '13px',
                lineHeight: '1',
              }}>
                📅
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Original Release Date</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <select style={{ ...dropdownStyle, width: '70px', padding: '8px 6px' }}>
                <option>{album.master_release_date || 'YYYY'}</option>
              </select>
              <select style={{ ...dropdownStyle, width: '55px', padding: '8px 6px' }}>
                <option>MM</option>
              </select>
              <select style={{ ...dropdownStyle, width: '55px', padding: '8px 6px' }}>
                <option>DD</option>
              </select>
              <button style={{
                padding: '7px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '13px',
                lineHeight: '1',
              }}>
                📅
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Label | Recording Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Label</label>
            <select 
              value={album.spotify_label || album.apple_music_label || ''}
              onChange={(e) => onChange('spotify_label', e.target.value)}
              style={dropdownStyle}
            >
              <option value="">{album.spotify_label || album.apple_music_label || 'Select label'}</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Recording Date</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input type="text" placeholder="YYYY" style={{ ...inputStyle, width: '70px', padding: '8px 6px' }} />
              <input type="text" placeholder="MM" style={{ ...inputStyle, width: '55px', padding: '8px 6px' }} />
              <input type="text" placeholder="DD" style={{ ...inputStyle, width: '55px', padding: '8px 6px' }} />
              <button style={{
                padding: '7px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '13px',
                lineHeight: '1',
              }}>
                📅
              </button>
            </div>
          </div>
        </div>

        {/* Row 3: Format | Barcode */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Format</label>
            <select 
              value={album.format}
              onChange={(e) => onChange('format', e.target.value)}
              style={dropdownStyle}
            >
              <option>{album.format}</option>
            </select>
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

        {/* Row 4: Empty | Cat No */}
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

        {/* Row 5: Genre (full width on right side) */}
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
            background: 'white',
          }}>
            {album.discogs_genres && album.discogs_genres.length > 0 ? (
              <>
                {album.discogs_genres.map((genre, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: '#e5e7eb',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      fontSize: '12px',
                      display: 'inline-flex',
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
                ))}
              </>
            ) : (
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>No genres</span>
            )}
            <button
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: '14px',
                marginLeft: 'auto',
                padding: '4px',
              }}
            >
              ▼
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}