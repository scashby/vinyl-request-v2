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
    color: '#374151',
    marginBottom: '6px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: 'white',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: 'white',
    appearance: 'none',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'%3E%3Cpath fill=\'%23666\' d=\'M0 0l5 6 5-6z\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: '32px',
  };

  const dateInputStyle: React.CSSProperties = {
    padding: '7px 6px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '13px',
    textAlign: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: 'white',
  };

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gap: '16px',
      maxWidth: '100%',
    }}>
      {/* LEFT COLUMN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              fontSize: '11px',
              fontWeight: '600',
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
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ 
              flex: 1,
              padding: '7px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
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
                  fontSize: '16px',
                  lineHeight: '1',
                  fontWeight: '300',
                }}
              >
                ×
              </button>
            </div>
            <button
              style={{
                width: '32px',
                height: '32px',
                padding: 0,
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '18px',
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Row 1: Release Date | Original Release Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Release Date</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="text"
                value={album.year || ''}
                onChange={(e) => onChange('year', e.target.value)}
                placeholder="YYYY"
                style={{ ...dateInputStyle, width: '62px' }}
              />
              <input
                type="text"
                placeholder="MM"
                style={{ ...dateInputStyle, width: '48px' }}
              />
              <input
                type="text"
                placeholder="DD"
                style={{ ...dateInputStyle, width: '48px' }}
              />
              <button style={{
                width: '32px',
                height: '32px',
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
                flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="11" rx="1" stroke="#6b7280" strokeWidth="1.5"/>
                  <path d="M2 6h12" stroke="#6b7280" strokeWidth="1.5"/>
                  <path d="M5 2v2M11 2v2" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Original Release Date</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="text"
                value={album.master_release_date || ''}
                onChange={(e) => onChange('master_release_date', e.target.value)}
                placeholder="YYYY"
                style={{ ...dateInputStyle, width: '62px' }}
              />
              <input
                type="text"
                placeholder="MM"
                style={{ ...dateInputStyle, width: '48px' }}
              />
              <input
                type="text"
                placeholder="DD"
                style={{ ...dateInputStyle, width: '48px' }}
              />
              <button style={{
                width: '32px',
                height: '32px',
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
                flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="11" rx="1" stroke="#6b7280" strokeWidth="1.5"/>
                  <path d="M2 6h12" stroke="#6b7280" strokeWidth="1.5"/>
                  <path d="M5 2v2M11 2v2" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Label | Recording Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Label</label>
            <div style={{ position: 'relative' }}>
              <select 
                value={album.spotify_label || album.apple_music_label || ''}
                onChange={(e) => onChange('spotify_label', e.target.value)}
                style={selectStyle}
              >
                <option value="">{album.spotify_label || album.apple_music_label || 'Select label'}</option>
              </select>
              <button
                style={{
                  position: 'absolute',
                  right: '28px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '13px',
                  padding: '4px',
                  lineHeight: '1',
                  pointerEvents: 'none',
                }}
              >
                ☰
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Recording Date</label>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="YYYY"
                style={{ ...dateInputStyle, width: '62px' }}
              />
              <input
                type="text"
                placeholder="MM"
                style={{ ...dateInputStyle, width: '48px' }}
              />
              <input
                type="text"
                placeholder="DD"
                style={{ ...dateInputStyle, width: '48px' }}
              />
              <button style={{
                width: '32px',
                height: '32px',
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
                flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="11" rx="1" stroke="#6b7280" strokeWidth="1.5"/>
                  <path d="M2 6h12" stroke="#6b7280" strokeWidth="1.5"/>
                  <path d="M5 2v2M11 2v2" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Row 3: Format | Barcode */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Format</label>
            <div style={{ position: 'relative' }}>
              <select 
                value={album.format}
                onChange={(e) => onChange('format', e.target.value)}
                style={selectStyle}
              >
                <option>{album.format}</option>
              </select>
              <button
                style={{
                  position: 'absolute',
                  right: '28px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '13px',
                  padding: '4px',
                  lineHeight: '1',
                  pointerEvents: 'none',
                }}
              >
                ☰
              </button>
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

        {/* Row 5: Genre (full width) */}
        <div>
          <label style={labelStyle}>Genre</label>
          <div style={{
            padding: '6px 10px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            minHeight: '32px',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            alignItems: 'center',
            backgroundColor: 'white',
            position: 'relative',
          }}>
            {album.discogs_genres && album.discogs_genres.length > 0 ? (
              <>
                {album.discogs_genres.map((genre, idx) => (
                  <span
                    key={idx}
                    style={{
                      backgroundColor: '#e5e7eb',
                      padding: '3px 8px',
                      borderRadius: '3px',
                      fontSize: '12px',
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
                        fontSize: '14px',
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
            <button
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: '13px',
                padding: '4px',
                lineHeight: '1',
              }}
            >
              ☰
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}