// src/app/edit-collection/PrintToPDFModal.tsx
'use client';

import { useState } from 'react';
import { Album } from '../../types/album';
import { ManageSortFavoritesModal, SortFavorite } from './ManageSortFavoritesModal';
import { ManageColumnFavoritesModal, ColumnFavorite } from './ManageColumnFavoritesModal';

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
  const [showMoreSettings, setShowMoreSettings] = useState(false);

  // Column favorites
  const [columnFavorites, setColumnFavorites] = useState<ColumnFavorite[]>([
    {
      id: '1',
      name: 'My List View columns',
      columns: ['Artist', 'Title', 'Release Date', 'Format', 'Discs', 'Tracks', 'Length', 'Genre', 'Label', 'Added Date']
    },
    {
      id: '2',
      name: 'My Find Duplicates columns',
      columns: ['Artist', 'Title', 'Release Date', 'Label', 'Discs', 'Tracks', 'Added Date']
    }
  ]);
  const [selectedColumnFavoriteId, setSelectedColumnFavoriteId] = useState('1');
  const [showManageColumnFavorites, setShowManageColumnFavorites] = useState(false);

  // Sort favorites
  const [sortFavorites, setSortFavorites] = useState<SortFavorite[]>([
    {
      id: '1',
      name: 'Artist | Title',
      fields: [
        { field: 'Artist', direction: 'asc' },
        { field: 'Title', direction: 'asc' }
      ]
    },
    {
      id: '2',
      name: 'Added Date/Time',
      fields: [{ field: 'Added Date', direction: 'desc' }]
    }
  ]);
  const [selectedSortFavoriteId, setSelectedSortFavoriteId] = useState('1');
  const [showManageSortFavorites, setShowManageSortFavorites] = useState(false);

  const generatePDF = () => {
    // Determine which albums to include
    let albumsToInclude: Album[];
    if (whichAlbums === 'all') {
      albumsToInclude = allAlbums;
    } else if (whichAlbums === 'current') {
      albumsToInclude = currentListAlbums;
    } else {
      albumsToInclude = allAlbums.filter(album => checkedAlbumIds.has(album.id));
    }

    // Apply sort order
    const sortedAlbums = [...albumsToInclude].sort((a, b) => {
      if (!selectedSortFavorite) return 0;
      
      for (const sortField of selectedSortFavorite.fields) {
        const fieldKey = sortField.field.toLowerCase().replace(/ /g, '_') as keyof Album;
        const aVal = a[fieldKey] || '';
        const bVal = b[fieldKey] || '';
        
        const comparison = String(aVal).localeCompare(String(bVal));
        if (comparison !== 0) {
          return sortField.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });

    // Dynamic import jsPDF
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(() => {
        const doc = new jsPDF({
          orientation: layout === 'portrait' ? 'portrait' : 'landscape',
          unit: 'mm',
          format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // Set margins
        let marginSize = 10;
        if (margins === 'Small') marginSize = 5;
        if (margins === 'Large') marginSize = 15;

        // Set font
        const fontFamily = fontType.toLowerCase();
        doc.setFont(fontFamily);
        
        let currentY = marginSize;
        let pageNumber = 1;

        // Add title on first page (and every page if enabled)
        const addTitle = () => {
          doc.setFontSize(16);
          doc.setTextColor(fontColor);
          doc.text(title, pageWidth / 2, currentY, { align: 'center' });
          currentY += 10;
        };

        // Add date/time
        const addDateTime = () => {
          const now = new Date().toLocaleString();
          doc.setFontSize(8);
          doc.text(now, pageWidth - marginSize, currentY, { align: 'right' });
        };

        // Add page number
        const addPageNumber = () => {
          doc.setFontSize(8);
          doc.text(`Page ${pageNumber}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
        };

        addTitle();
        if (printDateTime) {
          addDateTime();
          currentY += 5;
        }

        // Prepare table data
        const columns = selectedColumnFavorite?.columns || [];
        const tableData = sortedAlbums.map(album => {
          return columns.map(col => {
            const key = col.toLowerCase().replace(/ /g, '_') as keyof Album;
            if (col === 'Tracks') {
              return String(album.tracks?.filter(t => t.type === 'track').length || '—');
            }
            return String(album[key] || '—');
          });
        });

        // Split data into pages if max albums per page is set
        const albumsPerPage = maxAlbumsEnabled ? parseInt(maxAlbumsPerPage) || 20 : tableData.length;
        let startIndex = 0;

        while (startIndex < tableData.length) {
          const pageData = tableData.slice(startIndex, startIndex + albumsPerPage);
          
          // Use autoTable for table generation (jspdf-autotable extends jsPDF at runtime)
          type AutoTableDoc = typeof doc & {
            autoTable: (options: {
              head?: string[][];
              body: string[][];
              startY: number;
              margin?: { left: number; right: number; bottom: number };
              styles?: Record<string, unknown>;
              headStyles?: Record<string, unknown>;
              alternateRowStyles?: Record<string, unknown>;
              tableLineColor?: number[];
              tableLineWidth?: number;
              didDrawCell?: (data: { row: { index: number }; column: { index: number }; section: string; cell: { x: number; y: number; width: number; height: number } }) => void;
            }) => void;
          };
          
          (doc as unknown as AutoTableDoc).autoTable({
            head: columnFieldNames ? [columns] : [],
            body: pageData,
            startY: currentY,
            margin: { left: marginSize, right: marginSize, bottom: marginSize + 10 },
            styles: {
              fontSize: parseInt(fontSize),
              font: fontFamily,
              textColor: fontColor,
              cellPadding: 2,
              overflow: wrapInsideColumn ? 'linebreak' : 'hidden',
            },
            headStyles: {
              fillColor: [240, 240, 240],
              textColor: [0, 0, 0],
              fontStyle: 'bold',
            },
            alternateRowStyles: rowShading ? {
              fillColor: [245, 245, 245]
            } : undefined,
            tableLineColor: [200, 200, 200],
            tableLineWidth: borders === 'none' ? 0 : 0.1,
            didDrawCell: (data: { row: { index: number }; column: { index: number }; section: string; cell: { x: number; y: number; width: number; height: number } }) => {
              if (borders === 'outside' && data.row.index > 0 && data.row.index < pageData.length - 1) {
                // Only draw outside borders
                if (data.column.index !== 0 && data.column.index !== columns.length - 1) {
                  return;
                }
              } else if (borders === 'middle') {
                // Only draw middle borders (between rows)
                if (data.section === 'body') {
                  const { x, y, width, height } = data.cell;
                  doc.setDrawColor(200, 200, 200);
                  doc.line(x, y + height, x + width, y + height);
                }
              }
            }
          });

          startIndex += albumsPerPage;

          // Add page number if enabled
          if (pageNumbers) {
            addPageNumber();
          }

          // Add new page if there's more data
          if (startIndex < tableData.length) {
            doc.addPage();
            pageNumber++;
            currentY = marginSize;
            
            if (titleOnEveryPage) {
              addTitle();
            }
            if (printDateTime && printDateTimeEveryPage) {
              addDateTime();
              currentY += 5;
            }
          }
        }

        // Save the PDF
        const filename = `${title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
      });
    });
  };

  if (!isOpen) return null;

  const selectedColumnFavorite = columnFavorites.find(f => f.id === selectedColumnFavoriteId);
  const selectedSortFavorite = sortFavorites.find(f => f.id === selectedSortFavoriteId);

  return (
    <>
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
          <div style={{ fontSize: '16px', fontWeight: 500, color: 'white' }}>Print to PDF</div>
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
            {/* Two Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', marginBottom: '24px' }}>
              {/* LEFT: Which Albums */}
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>
                  Which Albums
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { value: 'all' as const, label: 'All Albums', count: allAlbums.length },
                    { value: 'current' as const, label: 'Current List', count: currentListAlbums.length },
                    { value: 'checkboxed' as const, label: 'Checkboxed', count: checkedAlbumIds.size }
                  ].map(option => (
                    <label
                      key={option.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: whichAlbums === option.value ? '#E8E8E8' : 'white',
                        border: '1px solid #D8D8D8',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#1a1a1a',
                      }}
                    >
                      <input
                        type="radio"
                        name="whichAlbums"
                        checked={whichAlbums === option.value}
                        onChange={() => setWhichAlbums(option.value)}
                        style={{ marginRight: '12px' }}
                      />
                      <span style={{ color: '#1a1a1a' }}>{option.label}</span>
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
                        {option.count}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* RIGHT: Visible Columns + Sort Order */}
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
                      onClick={() => setShowManageColumnFavorites(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#0066cc',
                        fontSize: '14px',
                        cursor: 'pointer',
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
                      {selectedColumnFavorite?.name || 'My List View columns'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      {selectedColumnFavorite?.columns.join(', ') || ''}
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
                      onClick={() => setShowManageSortFavorites(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#0066cc',
                        fontSize: '14px',
                        cursor: 'pointer',
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
                    {selectedSortFavorite?.fields.map((sf, idx) => (
                      <span key={idx}>
                        {idx > 0 && ' | '}
                        {sf.field} {sf.direction === 'asc' ? '⬆' : '⬇'}
                      </span>
                    )) || 'Artist ⬆ | Title ⬆'}
                  </div>
                </div>
              </div>
            </div>

            {/* Page Setup */}
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
                  onClick={() => setShowMoreSettings(!showMoreSettings)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#0066cc',
                    fontSize: '14px',
                    cursor: 'pointer',
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
                <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', marginBottom: '20px' }}>
                  {/* Layout */}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>Layout</div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#1a1a1a' }}>
                        <input type="radio" checked={layout === 'portrait'} onChange={() => setLayout('portrait')} />
                        Portrait
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#1a1a1a' }}>
                        <input type="radio" checked={layout === 'landscape'} onChange={() => setLayout('landscape')} />
                        Landscape
                      </label>
                    </div>
                  </div>

                  {/* Title */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>Title</div>
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
                        color: '#1a1a1a',
                      }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '13px', color: '#1a1a1a' }}>
                      <input type="checkbox" checked={titleOnEveryPage} onChange={(e) => setTitleOnEveryPage(e.target.checked)} />
                      on every page
                    </label>
                  </div>

                  {/* Right checkboxes */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1a1a1a', marginBottom: '8px' }}>
                      <input type="checkbox" checked={wrapInsideColumn} onChange={(e) => setWrapInsideColumn(e.target.checked)} />
                      Wrap inside column
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1a1a1a' }}>
                      <input type="checkbox" checked={coverThumbnails} onChange={(e) => setCoverThumbnails(e.target.checked)} />
                      Cover thumbnails
                    </label>
                  </div>
                </div>

                {showMoreSettings && (
                  <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', paddingTop: '20px', borderTop: '1px solid #E8E8E8' }}>
                    <div style={{ flex: '0 0 auto', minWidth: '150px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>Margins</div>
                      <select value={margins} onChange={(e) => setMargins(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #D8D8D8', borderRadius: '4px', fontSize: '14px', background: 'white', color: '#1a1a1a' }}>
                        {['Small', 'Medium', 'Large'].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>

                    <div style={{ flex: '0 0 auto', minWidth: '150px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>Font type:</div>
                      <select value={fontType} onChange={(e) => setFontType(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #D8D8D8', borderRadius: '4px', fontSize: '14px', background: 'white', color: '#1a1a1a' }}>
                        {['Arial', 'Helvetica', 'Times'].map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>

                    <div style={{ flex: '0 0 auto', minWidth: '100px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>Font size:</div>
                      <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #D8D8D8', borderRadius: '4px', fontSize: '14px', background: 'white', color: '#1a1a1a' }}>
                        {['8', '9', '10', '11', '12'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div style={{ flex: '0 0 auto' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>Color:</div>
                      <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} style={{ width: '70px', height: '38px', border: '1px solid #D8D8D8', borderRadius: '4px', cursor: 'pointer' }} />
                    </div>

                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1a1a1a' }}>
                        <input type="checkbox" checked={columnFieldNames} onChange={(e) => setColumnFieldNames(e.target.checked)} />
                        Column field names
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginLeft: '22px', color: '#1a1a1a' }}>
                        <input type="checkbox" checked={columnFieldNamesEveryPage} onChange={(e) => setColumnFieldNamesEveryPage(e.target.checked)} disabled={!columnFieldNames} />
                        on every page
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1a1a1a' }}>
                        <input type="checkbox" checked={rowShading} onChange={(e) => setRowShading(e.target.checked)} />
                        Row shading
                      </label>
                    </div>

                    <div style={{ flex: '0 0 auto' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1a1a1a' }}>Borders</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(['none', 'middle', 'outside', 'all'] as const).map((borderType) => (
                          <label key={borderType} style={{ textAlign: 'center', cursor: 'pointer' }}>
                            <div style={{ width: '44px', height: '44px', border: '2px solid #ccc', borderRadius: '4px', marginBottom: '4px', background: borders === borderType ? '#e3f2fd' : 'white', display: borderType === 'middle' ? 'flex' : borderType === 'all' ? 'grid' : 'block', flexDirection: 'column', justifyContent: 'space-evenly', gridTemplateColumns: borderType === 'all' ? '1fr 1fr' : undefined, gridTemplateRows: borderType === 'all' ? '1fr 1fr' : undefined, gap: borderType === 'all' ? '2px' : undefined, padding: '6px' }}>
                              {borderType === 'middle' && <><div style={{ borderBottom: '1px solid #666', height: '5px' }} /><div style={{ borderBottom: '1px solid #666', height: '5px' }} /><div style={{ borderBottom: '1px solid #666', height: '5px' }} /></>}
                              {borderType === 'outside' && <div style={{ border: '2px solid #666', width: '100%', height: '100%' }} />}
                              {borderType === 'all' && <><div style={{ border: '1px solid #666' }} /><div style={{ border: '1px solid #666' }} /><div style={{ border: '1px solid #666' }} /><div style={{ border: '1px solid #666' }} /></>}
                            </div>
                            <input type="radio" name="borders" checked={borders === borderType} onChange={() => setBorders(borderType)} />
                            <div style={{ fontSize: '10px', color: '#1a1a1a', marginTop: '2px' }}>{borderType.charAt(0).toUpperCase() + borderType.slice(1)}</div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '24px', marginTop: '16px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1a1a1a' }}>
                    <input type="checkbox" checked={maxAlbumsEnabled} onChange={(e) => setMaxAlbumsEnabled(e.target.checked)} />
                    Max albums per page:
                    <input type="number" value={maxAlbumsPerPage} onChange={(e) => setMaxAlbumsPerPage(e.target.value)} disabled={!maxAlbumsEnabled} style={{ width: '60px', padding: '4px 8px', border: '1px solid #D8D8D8', borderRadius: '4px', fontSize: '13px', marginLeft: '4px', color: '#1a1a1a' }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1a1a1a' }}>
                    <input type="checkbox" checked={pageNumbers} onChange={(e) => setPageNumbers(e.target.checked)} />
                    Page numbers
                  </label>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1a1a1a' }}>
                      <input type="checkbox" checked={printDateTime} onChange={(e) => setPrintDateTime(e.target.checked)} />
                      Print date/time
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginLeft: '22px', marginTop: '4px', color: '#1a1a1a' }}>
                      <input type="checkbox" checked={printDateTimeEveryPage} onChange={(e) => setPrintDateTimeEveryPage(e.target.checked)} disabled={!printDateTime} />
                      on every page
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>Preview</div>
              <div style={{ background: '#4A4A4A', border: '1px solid #D8D8D8', borderRadius: '4px', padding: '40px', textAlign: 'center', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: 'white', width: '600px', minHeight: '800px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', padding: '40px 30px', textAlign: 'left' }}>
                  <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px', textAlign: 'center', color: '#1a1a1a' }}>{title}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #333' }}>
                        {(selectedColumnFavorite?.columns || []).slice(0, 6).map(col => (
                          <th key={col} style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600, color: '#1a1a1a' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentListAlbums.slice(0, maxAlbumsEnabled ? parseInt(maxAlbumsPerPage) || 10 : 10).map((album, idx) => (
                        <tr key={album.id} style={{ borderBottom: '1px solid #ddd', background: rowShading && idx % 2 === 1 ? '#f5f5f5' : 'white' }}>
                          <td style={{ padding: '6px 4px', color: '#1a1a1a' }}>{album.artist}</td>
                          <td style={{ padding: '6px 4px', color: '#1a1a1a' }}>{album.title}</td>
                          <td style={{ padding: '6px 4px', color: '#1a1a1a' }}>{album.year || '—'}</td>
                          <td style={{ padding: '6px 4px', color: '#1a1a1a' }}>{album.format || '—'}</td>
                          <td style={{ padding: '6px 4px', color: '#1a1a1a' }}>{album.discs || '—'}</td>
                          <td style={{ padding: '6px 4px', color: '#1a1a1a' }}>{album.tracks?.filter(t => t.type === 'track').length || '—'}</td>
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
                onClick={generatePDF}
                style={{ background: '#4FC3F7', color: 'white', border: 'none', padding: '12px 40px', borderRadius: '4px', fontSize: '15px', fontWeight: 500, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
              >
                Generate PDF file
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Manage Modals */}
      <ManageSortFavoritesModal
        isOpen={showManageSortFavorites}
        onClose={() => setShowManageSortFavorites(false)}
        favorites={sortFavorites}
        onSave={(updated) => {
          setSortFavorites(updated);
          setShowManageSortFavorites(false);
        }}
        selectedId={selectedSortFavoriteId}
        onSelect={setSelectedSortFavoriteId}
      />

      <ManageColumnFavoritesModal
        isOpen={showManageColumnFavorites}
        onClose={() => setShowManageColumnFavorites(false)}
        favorites={columnFavorites}
        onSave={(updated) => {
          setColumnFavorites(updated);
          setShowManageColumnFavorites(false);
        }}
        selectedId={selectedColumnFavoriteId}
        onSelect={setSelectedColumnFavoriteId}
      />
    </>
  );
}