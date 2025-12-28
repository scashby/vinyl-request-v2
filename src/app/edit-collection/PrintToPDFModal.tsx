// src/app/edit-collection/PrintToPDFModal.tsx
'use client';

import { useState } from 'react';
import { Album } from '../../types/album';

interface PrintToPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  allAlbums: Album[];
  currentListAlbums: Album[];
  checkedAlbumIds: Set<number>;
}

export function PrintToPDFModal({
  isOpen,
  onClose,
  allAlbums,
  currentListAlbums,
  checkedAlbumIds,
}: PrintToPDFModalProps) {
  const [whichAlbums, setWhichAlbums] = useState<'all' | 'current' | 'checkboxed'>('all');
  const [layout, setLayout] = useState<'portrait' | 'landscape'>('portrait');
  const [title, setTitle] = useState('My Albums');
  const [titleOnEveryPage, setTitleOnEveryPage] = useState(false);
  const [margins, setMargins] = useState('Medium');
  const [fontType, setFontType] = useState('Arial');
  const [fontSize, setFontSize] = useState('10');
  const [fontColor, setFontColor] = useState('#000000');
  const [maxAlbumsPerPage, setMaxAlbumsPerPage] = useState('5');
  const [maxAlbumsEnabled, setMaxAlbumsEnabled] = useState(false);
  const [pageNumbers, setPageNumbers] = useState(false);
  const [printDateTime, setPrintDateTime] = useState(false);
  const [printDateTimeEveryPage, setPrintDateTimeEveryPage] = useState(false);
  const [wrapInsideColumn, setWrapInsideColumn] = useState(true);
  const [coverThumbnails, setCoverThumbnails] = useState(false);
  const [columnFieldNames, setColumnFieldNames] = useState(true);
  const [columnFieldNamesEveryPage, setColumnFieldNamesEveryPage] = useState(false);
  const [rowShading, setRowShading] = useState(false);
  const [borders, setBorders] = useState<'none' | 'middle' | 'outside' | 'all'>('all');

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'white',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Black Header Bar */}
      <div
        style={{
          background: '#2A2A2A',
          color: 'white',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: 0,
          }}
        >
          ◀ Back
        </button>
        <div style={{ fontSize: '16px', fontWeight: 500 }}>Print to PDF</div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '28px',
            cursor: 'pointer',
            lineHeight: '1',
            padding: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'white',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Two Column Layout: Which Albums + Visible Columns/Sort Order */}
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* LEFT COLUMN: Which Albums */}
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>
                Which Albums
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: whichAlbums === 'all' ? '#E8E8E8' : 'white',
                    border: '1px solid #D8D8D8',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  <input
                    type="radio"
                    name="whichAlbums"
                    checked={whichAlbums === 'all'}
                    onChange={() => setWhichAlbums('all')}
                    style={{ marginRight: '12px' }}
                  />
                  <span>All Albums</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      background: '#888',
                      color: 'white',
                      padding: '3px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {allAlbums.length}
                  </span>
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: whichAlbums === 'current' ? '#E8E8E8' : 'white',
                    border: '1px solid #D8D8D8',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  <input
                    type="radio"
                    name="whichAlbums"
                    checked={whichAlbums === 'current'}
                    onChange={() => setWhichAlbums('current')}
                    style={{ marginRight: '12px' }}
                  />
                  <span>Current List</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      background: '#888',
                      color: 'white',
                      padding: '3px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {currentListAlbums.length}
                  </span>
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: whichAlbums === 'checkboxed' ? '#E8E8E8' : 'white',
                    border: '1px solid #D8D8D8',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  <input
                    type="radio"
                    name="whichAlbums"
                    checked={whichAlbums === 'checkboxed'}
                    onChange={() => setWhichAlbums('checkboxed')}
                    style={{ marginRight: '12px' }}
                  />
                  <span>Checkboxed</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      background: '#888',
                      color: 'white',
                      padding: '3px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {checkedAlbumIds.size}
                  </span>
                </label>
              </div>
            </div>

            {/* RIGHT COLUMN: Visible Columns + Sort Order */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Visible Columns */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>
                    Visible Columns
                  </div>
                  <button
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#0066cc',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0,
                    }}
                  >
                    Manage ⋮
                  </button>
                </div>
                <div
                  style={{
                    background: 'white',
                    border: '1px solid #D8D8D8',
                    borderRadius: '4px',
                    padding: '16px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#1a1a1a' }}>
                    My List View columns
                  </div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    Artist, Title, Release Date, Format, Discs, Tracks, Length, Genre, Label, Added Date
                  </div>
                </div>
              </div>

              {/* Sort Order */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>
                    Sort Order
                  </div>
                  <button
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#0066cc',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0,
                    }}
                  >
                    Manage ⋮
                  </button>
                </div>
                <div
                  style={{
                    background: 'white',
                    border: '1px solid #D8D8D8',
                    borderRadius: '4px',
                    padding: '16px',
                    fontSize: '14px',
                    color: '#1a1a1a',
                  }}
                >
                  Artist ⬆ | Title ⬆
                </div>
              </div>
            </div>
          </div>

          {/* Page Setup Section */}
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>
                Page Setup
              </div>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#0066cc',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                More settings ⋮
              </button>
            </div>

            <div
              style={{
                background: 'white',
                border: '1px solid #D8D8D8',
                borderRadius: '4px',
                padding: '24px',
              }}
            >
              {/* Top Row: Layout, Title, Checkboxes */}
              <div style={{ display: 'flex', gap: '32px', marginBottom: '24px' }}>
                {/* Layout */}
                <div style={{ flex: '0 0 auto' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                    Layout
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                      <input
                        type="radio"
                        checked={layout === 'portrait'}
                        onChange={() => setLayout('portrait')}
                      />
                      Portrait
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                      <input
                        type="radio"
                        checked={layout === 'landscape'}
                        onChange={() => setLayout('landscape')}
                      />
                      Landscape
                    </label>
                  </div>
                </div>

                {/* Title */}
                <div style={{ flex: '1' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                    Title
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{
                      width: '100%',
                      maxWidth: '300px',
                      padding: '6px 10px',
                      border: '1px solid #D8D8D8',
                      borderRadius: '4px',
                      fontSize: '14px',
                    }}
                  />
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '8px',
                      fontSize: '13px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={titleOnEveryPage}
                      onChange={(e) => setTitleOnEveryPage(e.target.checked)}
                    />
                    on every page
                  </label>
                </div>

                {/* Right side checkboxes */}
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={wrapInsideColumn}
                      onChange={(e) => setWrapInsideColumn(e.target.checked)}
                    />
                    Wrap inside column
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={coverThumbnails}
                      onChange={(e) => setCoverThumbnails(e.target.checked)}
                    />
                    Cover thumbnails
                  </label>
                </div>
              </div>

              {/* More controls in flowing layout */}
              <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                {/* Margins */}
                <div style={{ flex: '0 0 auto', minWidth: '150px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                    Margins
                  </div>
                  <select
                    value={margins}
                    onChange={(e) => setMargins(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: '1px solid #D8D8D8',
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: 'white',
                    }}
                  >
                    <option value="Small">Small</option>
                    <option value="Medium">Medium</option>
                    <option value="Large">Large</option>
                  </select>
                </div>

                {/* Font type */}
                <div style={{ flex: '0 0 auto', minWidth: '150px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                    Font type:
                  </div>
                  <select
                    value={fontType}
                    onChange={(e) => setFontType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: '1px solid #D8D8D8',
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: 'white',
                    }}
                  >
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times">Times</option>
                  </select>
                </div>

                {/* Font size */}
                <div style={{ flex: '0 0 auto', minWidth: '100px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                    Font size:
                  </div>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: '1px solid #D8D8D8',
                      borderRadius: '4px',
                      fontSize: '14px',
                      background: 'white',
                    }}
                  >
                    <option value="8">8</option>
                    <option value="9">9</option>
                    <option value="10">10</option>
                    <option value="11">11</option>
                    <option value="12">12</option>
                  </select>
                </div>

                {/* Color */}
                <div style={{ flex: '0 0 auto' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                    Color:
                  </div>
                  <input
                    type="color"
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                    style={{
                      width: '70px',
                      height: '38px',
                      border: '1px solid #D8D8D8',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  />
                </div>

                {/* More checkboxes */}
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={columnFieldNames}
                      onChange={(e) => setColumnFieldNames(e.target.checked)}
                    />
                    Column field names
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      marginLeft: '22px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={columnFieldNamesEveryPage}
                      onChange={(e) => setColumnFieldNamesEveryPage(e.target.checked)}
                      disabled={!columnFieldNames}
                    />
                    on every page
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={rowShading}
                      onChange={(e) => setRowShading(e.target.checked)}
                    />
                    Row shading
                  </label>
                </div>

                {/* Borders */}
                <div style={{ flex: '0 0 auto' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                    Borders
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* None */}
                    <label style={{ textAlign: 'center', cursor: 'pointer' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          border: '2px solid #ccc',
                          borderRadius: '4px',
                          marginBottom: '4px',
                          background: borders === 'none' ? '#e3f2fd' : 'white',
                        }}
                      />
                      <input
                        type="radio"
                        name="borders"
                        checked={borders === 'none'}
                        onChange={() => setBorders('none')}
                      />
                      <div style={{ fontSize: '10px' }}>None</div>
                    </label>

                    {/* Middle */}
                    <label style={{ textAlign: 'center', cursor: 'pointer' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          border: '2px solid #ccc',
                          borderRadius: '4px',
                          marginBottom: '4px',
                          background: borders === 'middle' ? '#e3f2fd' : 'white',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-evenly',
                          padding: '6px',
                        }}
                      >
                        <div style={{ borderBottom: '1px solid #666', height: '5px' }} />
                        <div style={{ borderBottom: '1px solid #666', height: '5px' }} />
                        <div style={{ borderBottom: '1px solid #666', height: '5px' }} />
                      </div>
                      <input
                        type="radio"
                        name="borders"
                        checked={borders === 'middle'}
                        onChange={() => setBorders('middle')}
                      />
                      <div style={{ fontSize: '10px' }}>Middle</div>
                    </label>

                    {/* Outside */}
                    <label style={{ textAlign: 'center', cursor: 'pointer' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          border: '2px solid #666',
                          borderRadius: '4px',
                          marginBottom: '4px',
                          background: borders === 'outside' ? '#e3f2fd' : 'white',
                        }}
                      />
                      <input
                        type="radio"
                        name="borders"
                        checked={borders === 'outside'}
                        onChange={() => setBorders('outside')}
                      />
                      <div style={{ fontSize: '10px' }}>Outside</div>
                    </label>

                    {/* All */}
                    <label style={{ textAlign: 'center', cursor: 'pointer' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          border: '2px solid #666',
                          borderRadius: '4px',
                          marginBottom: '4px',
                          background: borders === 'all' ? '#e3f2fd' : 'white',
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gridTemplateRows: '1fr 1fr',
                          gap: '2px',
                          padding: '6px',
                        }}
                      >
                        <div style={{ border: '1px solid #666' }} />
                        <div style={{ border: '1px solid #666' }} />
                        <div style={{ border: '1px solid #666' }} />
                        <div style={{ border: '1px solid #666' }} />
                      </div>
                      <input
                        type="radio"
                        name="borders"
                        checked={borders === 'all'}
                        onChange={() => setBorders('all')}
                      />
                      <div style={{ fontSize: '10px' }}>All</div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Additional checkboxes row */}
              <div style={{ display: 'flex', gap: '24px', marginTop: '16px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={maxAlbumsEnabled}
                    onChange={(e) => setMaxAlbumsEnabled(e.target.checked)}
                  />
                  Max albums per page:
                  <input
                    type="number"
                    value={maxAlbumsPerPage}
                    onChange={(e) => setMaxAlbumsPerPage(e.target.value)}
                    disabled={!maxAlbumsEnabled}
                    style={{
                      width: '60px',
                      padding: '4px 8px',
                      border: '1px solid #D8D8D8',
                      borderRadius: '4px',
                      fontSize: '13px',
                      marginLeft: '4px',
                    }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={pageNumbers}
                    onChange={(e) => setPageNumbers(e.target.checked)}
                  />
                  Page numbers
                </label>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={printDateTime}
                      onChange={(e) => setPrintDateTime(e.target.checked)}
                    />
                    Print date/time
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      marginLeft: '22px',
                      marginTop: '4px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={printDateTimeEveryPage}
                      onChange={(e) => setPrintDateTimeEveryPage(e.target.checked)}
                      disabled={!printDateTime}
                    />
                    on every page
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>
              Preview
            </div>
            <div
              style={{
                background: '#4A4A4A',
                border: '1px solid #D8D8D8',
                borderRadius: '4px',
                padding: '40px',
                textAlign: 'center',
                minHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  background: 'white',
                  width: '600px',
                  minHeight: '800px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  padding: '40px 30px',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px', textAlign: 'center' }}>
                  {title}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #333' }}>
                      <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>Artist</th>
                      <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>Title</th>
                      <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>Release Date</th>
                      <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>Format</th>
                      <th style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 600 }}>Discs</th>
                      <th style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 600 }}>Tracks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentListAlbums.slice(0, 5).map((album, idx) => (
                      <tr
                        key={album.id}
                        style={{
                          borderBottom: '1px solid #ddd',
                          background: rowShading && idx % 2 === 1 ? '#f5f5f5' : 'white',
                        }}
                      >
                        <td style={{ padding: '6px 4px' }}>{album.artist}</td>
                        <td style={{ padding: '6px 4px' }}>{album.title}</td>
                        <td style={{ padding: '6px 4px' }}>{album.year || '—'}</td>
                        <td style={{ padding: '6px 4px' }}>{album.format || '—'}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>{album.discs || '—'}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          {album.tracks?.filter(t => t.type === 'track').length || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div style={{ textAlign: 'center', paddingBottom: '40px' }}>
            <button
              style={{
                background: '#4FC3F7',
                color: 'white',
                border: 'none',
                padding: '12px 40px',
                borderRadius: '4px',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              Generate PDF file
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}