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
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#F5F5F5',
          width: '1000px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        {/* Orange Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%)',
            color: 'white',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', left: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>☰</span>
            <span style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '0.5px' }}>CLZ MUSIC WEB</span>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 500 }}>scashby&apos;s music</div>
          <div style={{ position: 'absolute', right: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', cursor: 'pointer' }}>⊞</span>
            <span style={{ fontSize: '20px', cursor: 'pointer' }}>👤</span>
          </div>
        </div>

        {/* Black Sub-Header */}
        <div
          style={{
            background: '#2A2A2A',
            color: 'white',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ◀ Back
            </button>
            <span style={{ fontSize: '16px', fontWeight: 500 }}>Print to PDF</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              lineHeight: '1',
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
            padding: '24px',
          }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Which Albums Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>
                Which Albums
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 14px',
                    background: whichAlbums === 'all' ? '#E8E8E8' : 'white',
                    border: '1px solid #ddd',
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
                    style={{ marginRight: '10px' }}
                  />
                  <span>All Albums</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      background: '#999',
                      color: 'white',
                      padding: '2px 12px',
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
                    padding: '10px 14px',
                    background: whichAlbums === 'current' ? '#E8E8E8' : 'white',
                    border: '1px solid #ddd',
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
                    style={{ marginRight: '10px' }}
                  />
                  <span>Current List</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      background: '#999',
                      color: 'white',
                      padding: '2px 12px',
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
                    padding: '10px 14px',
                    background: whichAlbums === 'checkboxed' ? '#E8E8E8' : 'white',
                    border: '1px solid #ddd',
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
                    style={{ marginRight: '10px' }}
                  />
                  <span>Checkboxed</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      background: '#999',
                      color: 'white',
                      padding: '2px 12px',
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

            {/* Visible Columns Section */}
            <div style={{ marginBottom: '20px' }}>
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
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Manage ⋮
                </button>
              </div>
              <div
                style={{
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '14px',
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

            {/* Sort Order Section */}
            <div style={{ marginBottom: '20px' }}>
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
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Manage ⋮
                </button>
              </div>
              <div
                style={{
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '14px',
                  fontSize: '14px',
                  color: '#1a1a1a',
                }}
              >
                Cat No ⬆ | Original Release Date ⬇
              </div>
            </div>

            {/* Page Setup Section */}
            <div style={{ marginBottom: '20px' }}>
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
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  More settings ⋮
                </button>
              </div>

              <div
                style={{
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '20px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                  {/* Left Column */}
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                        Layout
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                          <input
                            type="radio"
                            checked={layout === 'portrait'}
                            onChange={() => setLayout('portrait')}
                          />
                          Portrait
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                          <input
                            type="radio"
                            checked={layout === 'landscape'}
                            onChange={() => setLayout('landscape')}
                          />
                          Landscape
                        </label>
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                        Margins
                      </div>
                      <select
                        value={margins}
                        onChange={(e) => setMargins(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                          background: 'white',
                        }}
                      >
                        <option value="Small">Small</option>
                        <option value="Medium">Medium</option>
                        <option value="Large">Large</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                        Font type:
                      </div>
                      <select
                        value={fontType}
                        onChange={(e) => setFontType(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                          background: 'white',
                        }}
                      >
                        <option value="Arial">Arial</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times">Times</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                        Font size:
                      </div>
                      <select
                        value={fontSize}
                        onChange={(e) => setFontSize(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
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

                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                        Color:
                      </div>
                      <input
                        type="color"
                        value={fontColor}
                        onChange={(e) => setFontColor(e.target.value)}
                        style={{
                          width: '70px',
                          height: '36px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                  </div>

                  {/* Middle Column */}
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                        Title
                      </div>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                        }}
                      />
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '6px',
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

                    <div style={{ marginBottom: '16px' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={maxAlbumsEnabled}
                          onChange={(e) => setMaxAlbumsEnabled(e.target.checked)}
                        />
                        Max albums per page:
                      </label>
                      <input
                        type="number"
                        value={maxAlbumsPerPage}
                        onChange={(e) => setMaxAlbumsPerPage(e.target.value)}
                        disabled={!maxAlbumsEnabled}
                        style={{
                          width: '60px',
                          padding: '4px 8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                          marginTop: '4px',
                          marginLeft: '22px',
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={pageNumbers}
                          onChange={(e) => setPageNumbers(e.target.checked)}
                        />
                        Page numbers
                      </label>
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                        }}
                      >
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
                          marginTop: '6px',
                          fontSize: '13px',
                          marginLeft: '22px',
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

                  {/* Right Column */}
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={wrapInsideColumn}
                          onChange={(e) => setWrapInsideColumn(e.target.checked)}
                        />
                        Wrap inside column
                      </label>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={coverThumbnails}
                          onChange={(e) => setCoverThumbnails(e.target.checked)}
                        />
                        Cover thumbnails
                      </label>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                        }}
                      >
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
                          marginTop: '6px',
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
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={rowShading}
                          onChange={(e) => setRowShading(e.target.checked)}
                        />
                        Row shading
                      </label>
                    </div>

                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>
                        Borders
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {/* None */}
                        <label style={{ textAlign: 'center', cursor: 'pointer' }}>
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
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
                            style={{ marginRight: '4px' }}
                          />
                          <div style={{ fontSize: '11px' }}>None</div>
                        </label>

                        {/* Middle */}
                        <label style={{ textAlign: 'center', cursor: 'pointer' }}>
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
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
                            <div style={{ borderBottom: '1px solid #666', height: '6px' }} />
                            <div style={{ borderBottom: '1px solid #666', height: '6px' }} />
                            <div style={{ borderBottom: '1px solid #666', height: '6px' }} />
                          </div>
                          <input
                            type="radio"
                            name="borders"
                            checked={borders === 'middle'}
                            onChange={() => setBorders('middle')}
                            style={{ marginRight: '4px' }}
                          />
                          <div style={{ fontSize: '11px' }}>Middle</div>
                        </label>

                        {/* Outside */}
                        <label style={{ textAlign: 'center', cursor: 'pointer' }}>
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
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
                            style={{ marginRight: '4px' }}
                          />
                          <div style={{ fontSize: '11px' }}>Outside</div>
                        </label>

                        {/* All */}
                        <label style={{ textAlign: 'center', cursor: 'pointer' }}>
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
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
                            style={{ marginRight: '4px' }}
                          />
                          <div style={{ fontSize: '11px' }}>All</div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Section */}
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#1a1a1a',
                  marginBottom: '12px',
                }}
              >
                Preview
              </div>
              <div
                style={{
                  background: '#2A2A2A',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '60px 40px',
                  textAlign: 'center',
                  minHeight: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{
                  background: 'white',
                  width: '400px',
                  height: '520px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  border: '1px solid #ccc',
                }} />
              </div>
            </div>

            {/* Generate Button */}
            <div style={{ textAlign: 'center', paddingBottom: '20px' }}>
              <button
                style={{
                  background: '#4FC3F7',
                  color: 'white',
                  border: 'none',
                  padding: '12px 36px',
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
    </div>
  );
}