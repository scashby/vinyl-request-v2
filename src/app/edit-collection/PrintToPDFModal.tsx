// src/app/edit-collection/PrintToPDFModal.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Album } from 'types/album';
import { ColumnId, COLUMN_DEFINITIONS } from './columnDefinitions';
import { ManageColumnFavoritesModal } from './ManageColumnFavoritesModal';
import { ManageSortFavoritesModal } from './ManageSortFavoritesModal';
import { generatePDF } from 'lib/pdfGenerator';

interface PrintToPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  allAlbums: Album[];
  currentListAlbums: Album[];
  checkedAlbumIds: Set<number>;
}

type AlbumSource = 'all' | 'current' | 'checked';
type BorderStyle = 'none' | 'middle' | 'outside' | 'all';

interface ColumnFavorite {
  id: string;
  name: string;
  columns: ColumnId[];
}

interface SortField {
  column: ColumnId;
  direction: 'asc' | 'desc';
}

interface SortFavorite {
  id: string;
  name: string;
  fields: SortField[];
}

const DEFAULT_COLUMN_FAVORITES: ColumnFavorite[] = [
  {
    id: 'my-list-view',
    name: 'My List View columns',
    columns: ['artist', 'title', 'master_release_date', 'format', 'discs', 'tracks', 'length', 'genres', 'label', 'added_date']
  },
  {
    id: 'find-duplicates',
    name: 'My Find Duplicates columns',
    columns: ['artist', 'title', 'master_release_date', 'label', 'discs', 'tracks', 'added_date']
  },
  {
    id: 'print-export',
    name: 'My Print / Export columns',
    columns: ['artist', 'title', 'master_release_date', 'discs', 'tracks', 'length', 'barcode', 'cat_no', 'format', 'genres', 'label', 'original_release_date', 'original_release_year', 'recording_date', 'recording_year', 'master_release_date', 'box_set', 'country', 'extra', 'is_live', 'media_condition', 'package_sleeve_condition', 'packaging', 'rpm', 'sound', 'spars_code', 'storage_device_slot', 'studio', 'vinyl_color', 'vinyl_weight', 'chorus', 'composer', 'composition', 'conductor', 'orchestra', 'engineers', 'musicians', 'producers', 'songwriters', 'added_date', 'collection_status', 'current_value', 'folder', 'location', 'modified_date', 'my_rating', 'notes', 'owner', 'play_count', 'last_played_date', 'last_cleaned_date', 'signed_by', 'custom_tags', 'due_date', 'loan_date', 'loaned_to', 'artist', 'sort_title', 'storage_device']
  }
];

const DEFAULT_SORT_FAVORITES: SortFavorite[] = [
  {
    id: 'artist-title',
    name: 'Artist ↑ / Title ↑',
    fields: [
      { column: 'artist', direction: 'asc' },
      { column: 'title', direction: 'asc' }
    ]
  },
  {
    id: 'added-date',
    name: 'Added Date/Time ↓',
    fields: [
      { column: 'added_date', direction: 'desc' }
    ]
  }
];

export function PrintToPDFModal({ isOpen, onClose, allAlbums, currentListAlbums, checkedAlbumIds }: PrintToPDFModalProps) {
  const [albumSource, setAlbumSource] = useState<AlbumSource>('all');
  const [columnFavorites, setColumnFavorites] = useState<ColumnFavorite[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pdf-column-favorites');
      return stored ? JSON.parse(stored) : DEFAULT_COLUMN_FAVORITES;
    }
    return DEFAULT_COLUMN_FAVORITES;
  });
  const [selectedColumnFavorite, setSelectedColumnFavorite] = useState<string>('my-list-view');
  const [sortFavorites, setSortFavorites] = useState<SortFavorite[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pdf-sort-favorites');
      return stored ? JSON.parse(stored) : DEFAULT_SORT_FAVORITES;
    }
    return DEFAULT_SORT_FAVORITES;
  });
  const [selectedSortFavorite, setSelectedSortFavorite] = useState<string>('artist-title');
  
  // Page Setup
  const [layout, setLayout] = useState<'portrait' | 'landscape'>('portrait');
  const [title, setTitle] = useState('My Albums');
  const [margins, setMargins] = useState('medium');
  const [fontType, setFontType] = useState('arial');
  const [fontSize, setFontSize] = useState(10);
  const [fontColor, setFontColor] = useState('#000000');
  const [titleOnEveryPage, setTitleOnEveryPage] = useState(false);
  const [maxAlbumsPerPage, setMaxAlbumsPerPage] = useState<number | null>(null);
  const [pageNumbers, setPageNumbers] = useState(false);
  const [printDateTime, setPrintDateTime] = useState(false);
  const [coverThumbnails, setCoverThumbnails] = useState(false);
  const [columnFieldNames, setColumnFieldNames] = useState(true);
  const [rowShading, setRowShading] = useState(false);
  const [borderStyle, setBorderStyle] = useState<BorderStyle>('all');
  
  const [showManageColumns, setShowManageColumns] = useState(false);
  const [showManageSort, setShowManageSort] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    localStorage.setItem('pdf-column-favorites', JSON.stringify(columnFavorites));
  }, [columnFavorites]);

  useEffect(() => {
    localStorage.setItem('pdf-sort-favorites', JSON.stringify(sortFavorites));
  }, [sortFavorites]);

  const selectedAlbums = useMemo(() => {
    switch (albumSource) {
      case 'all':
        return allAlbums;
      case 'current':
        return currentListAlbums;
      case 'checked':
        return allAlbums.filter(a => checkedAlbumIds.has(a.id));
      default:
        return allAlbums;
    }
  }, [albumSource, allAlbums, currentListAlbums, checkedAlbumIds]);

  const currentColumnFavorite = columnFavorites.find(f => f.id === selectedColumnFavorite);
  const currentSortFavorite = sortFavorites.find(f => f.id === selectedSortFavorite);

  const handleGeneratePDF = async () => {
    if (!currentColumnFavorite || !currentSortFavorite) return;
    
    setGenerating(true);
    try {
      await generatePDF({
        albums: selectedAlbums,
        columns: currentColumnFavorite.columns,
        sortFields: currentSortFavorite.fields,
        layout,
        title,
        margins,
        fontType,
        fontSize,
        fontColor,
        titleOnEveryPage,
        maxAlbumsPerPage,
        pageNumbers,
        printDateTime,
        coverThumbnails,
        columnFieldNames,
        rowShading,
        borderStyle
      });
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 30000,
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          borderRadius: '4px',
          width: '900px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 30001,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div style={{
          backgroundColor: '#2C2C2C',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '4px 4px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>◀ Back</span>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Print to PDF
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: '1',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
        }}>
          {/* Which Albums */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '12px' }}>
              Which Albums
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={albumSource === 'all'}
                  onChange={() => setAlbumSource('all')}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: '#333' }}>
                  All Albums <span style={{ color: '#999' }}>({allAlbums.length})</span>
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={albumSource === 'current'}
                  onChange={() => setAlbumSource('current')}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: '#333' }}>
                  Current List <span style={{ color: '#999' }}>({currentListAlbums.length})</span>
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={albumSource === 'checked'}
                  onChange={() => setAlbumSource('checked')}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: '#333' }}>
                  Checkboxed <span style={{ color: '#999' }}>({checkedAlbumIds.size})</span>
                </span>
              </label>
            </div>
          </div>

          {/* Visible Columns */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#333', margin: 0 }}>
                Visible Columns
              </h3>
              <button
                onClick={() => setShowManageColumns(true)}
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#f0f0f0',
                  border: '1px solid #d0d0d0',
                  borderRadius: '3px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Manage
              </button>
            </div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              {currentColumnFavorite?.name || 'Select columns'}
            </div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              {currentColumnFavorite?.columns.map(colId => COLUMN_DEFINITIONS[colId]?.label).join(', ')}
            </div>
          </div>

          {/* Sort Order */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#333', margin: 0 }}>
                Sort Order
              </h3>
              <button
                onClick={() => setShowManageSort(true)}
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#f0f0f0',
                  border: '1px solid #d0d0d0',
                  borderRadius: '3px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Manage
              </button>
            </div>
            <div style={{ fontSize: '13px', color: '#666' }}>
              {currentSortFavorite?.name || 'Select sort order'}
            </div>
          </div>

          {/* Page Setup */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#333', margin: 0 }}>
                Page Setup
              </h3>
              <button
                style={{
                  padding: '4px 12px',
                  backgroundColor: '#f0f0f0',
                  border: '1px solid #d0d0d0',
                  borderRadius: '3px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                More settings
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Left Column */}
              <div>
                {/* Layout */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '4px' }}>
                    Layout
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        checked={layout === 'portrait'}
                        onChange={() => setLayout('portrait')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px' }}>Portrait</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        checked={layout === 'landscape'}
                        onChange={() => setLayout('landscape')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px' }}>Landscape</span>
                    </label>
                  </div>
                </div>

                {/* Title */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '4px' }}>
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #d0d0d0',
                      borderRadius: '3px',
                      fontSize: '13px',
                    }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={titleOnEveryPage}
                      onChange={(e) => setTitleOnEveryPage(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12px', color: '#666' }}>on every page</span>
                  </label>
                </div>

                {/* Margins */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '4px' }}>
                    Margins
                  </label>
                  <select
                    value={margins}
                    onChange={(e) => setMargins(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #d0d0d0',
                      borderRadius: '3px',
                      fontSize: '13px',
                    }}
                  >
                    <option value="none">None</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>

                {/* Font Type */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '4px' }}>
                    Font type
                  </label>
                  <select
                    value={fontType}
                    onChange={(e) => setFontType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #d0d0d0',
                      borderRadius: '3px',
                      fontSize: '13px',
                    }}
                  >
                    <option value="arial">Arial</option>
                    <option value="helvetica">Helvetica</option>
                    <option value="times">Times New Roman</option>
                    <option value="courier">Courier</option>
                  </select>
                </div>

                {/* Font Size & Color */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '4px' }}>
                      Font size
                    </label>
                    <select
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        border: '1px solid #d0d0d0',
                        borderRadius: '3px',
                        fontSize: '13px',
                      }}
                    >
                      {[8, 9, 10, 11, 12, 14, 16, 18, 20].map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '4px' }}>
                      Color
                    </label>
                    <input
                      type="color"
                      value={fontColor}
                      onChange={(e) => setFontColor(e.target.value)}
                      style={{
                        width: '100%',
                        height: '32px',
                        border: '1px solid #d0d0d0',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div>
                {/* Checkboxes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!maxAlbumsPerPage}
                      onChange={(e) => setMaxAlbumsPerPage(e.target.checked ? 5 : null)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: '#666' }}>Max albums per page:</span>
                    <input
                      type="number"
                      value={maxAlbumsPerPage || 5}
                      onChange={(e) => setMaxAlbumsPerPage(Number(e.target.value))}
                      disabled={!maxAlbumsPerPage}
                      style={{
                        width: '50px',
                        padding: '2px 4px',
                        border: '1px solid #d0d0d0',
                        borderRadius: '3px',
                        fontSize: '13px',
                      }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={pageNumbers}
                      onChange={(e) => setPageNumbers(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: '#666' }}>Page numbers</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={printDateTime}
                      onChange={(e) => setPrintDateTime(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: '#666' }}>Print date/time</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={coverThumbnails}
                      onChange={(e) => setCoverThumbnails(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: '#666' }}>Cover thumbnails</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={columnFieldNames}
                      onChange={(e) => setColumnFieldNames(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: '#666' }}>Column field names</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={rowShading}
                      onChange={(e) => setRowShading(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: '#666' }}>Row shading</span>
                  </label>
                </div>

                {/* Borders */}
                <div>
                  <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '8px' }}>
                    Borders
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {(['none', 'middle', 'outside', 'all'] as BorderStyle[]).map(style => (
                      <label
                        key={style}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '8px',
                          border: borderStyle === style ? '2px solid #5BA3D0' : '1px solid #d0d0d0',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          backgroundColor: borderStyle === style ? '#f0f8ff' : 'white',
                        }}
                      >
                        <input
                          type="radio"
                          checked={borderStyle === style}
                          onChange={() => setBorderStyle(style)}
                          style={{ cursor: 'pointer' }}
                        />
                        <div style={{
                          width: '32px',
                          height: '32px',
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '2px',
                        }}>
                          {style === 'none' && (
                            <div style={{ gridColumn: '1 / -1', gridRow: '1 / -1', border: 'none', backgroundColor: '#f5f5f5' }} />
                          )}
                          {style === 'middle' && (
                            <>
                              <div style={{ border: '1px solid #999', borderRight: 'none', borderBottom: 'none' }} />
                              <div style={{ border: '1px solid #999', borderLeft: 'none', borderBottom: 'none' }} />
                              <div style={{ border: '1px solid #999', borderRight: 'none', borderTop: 'none' }} />
                              <div style={{ border: '1px solid #999', borderLeft: 'none', borderTop: 'none' }} />
                            </>
                          )}
                          {style === 'outside' && (
                            <div style={{ gridColumn: '1 / -1', gridRow: '1 / -1', border: '2px solid #999' }} />
                          )}
                          {style === 'all' && (
                            <>
                              <div style={{ border: '1px solid #999' }} />
                              <div style={{ border: '1px solid #999' }} />
                              <div style={{ border: '1px solid #999' }} />
                              <div style={{ border: '1px solid #999' }} />
                            </>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', textTransform: 'capitalize' }}>{style}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '12px' }}>
              Preview
            </h3>
            <div style={{
              border: '1px solid #d0d0d0',
              borderRadius: '4px',
              padding: '16px',
              backgroundColor: '#f9f9f9',
              minHeight: '200px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: '13px',
            }}>
              Preview will appear here after generation
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <button
            onClick={handleGeneratePDF}
            disabled={generating}
            style={{
              padding: '10px 32px',
              backgroundColor: generating ? '#ccc' : '#5BA3D0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? 'Generating...' : 'Generate PDF file'}
          </button>
        </div>
      </div>

      {/* Manage Modals */}
      {showManageColumns && (
        <ManageColumnFavoritesModal
          isOpen={showManageColumns}
          onClose={() => setShowManageColumns(false)}
          favorites={columnFavorites}
          onSave={(newFavorites) => {
            setColumnFavorites(newFavorites);
            setShowManageColumns(false);
          }}
          selectedId={selectedColumnFavorite}
          onSelect={setSelectedColumnFavorite}
        />
      )}

      {showManageSort && (
        <ManageSortFavoritesModal
          isOpen={showManageSort}
          onClose={() => setShowManageSort(false)}
          favorites={sortFavorites}
          onSave={(newFavorites) => {
            setSortFavorites(newFavorites);
            setShowManageSort(false);
          }}
          selectedId={selectedSortFavorite}
          onSelect={setSelectedSortFavorite}
        />
      )}
    </>
  );
}