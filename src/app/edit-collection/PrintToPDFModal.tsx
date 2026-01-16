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

    // Dynamic import jsPDF and autoTable
    Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]).then(([jsPDFModule, autoTableModule]) => {
      const { default: jsPDF } = jsPDFModule;
      const autoTable = autoTableModule.default;
      
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
        let fontFamily = fontType.toLowerCase();
        if (fontFamily === 'arial') fontFamily = 'helvetica'; // jsPDF uses helvetica for Arial
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
          
          // Use autoTable for table generation
          autoTable(doc, {
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
  };

  if (!isOpen) return null;

  const selectedColumnFavorite = columnFavorites.find(f => f.id === selectedColumnFavoriteId);
  const selectedSortFavorite = sortFavorites.find(f => f.id === selectedSortFavoriteId);

  return (
    <>
      <div className="fixed inset-0 bg-white z-[10000] flex flex-col overflow-hidden">
        {/* Black Header Bar */}
        <div className="bg-[#2A2A2A] text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="bg-transparent border-none text-white cursor-pointer text-[15px] flex items-center gap-2 p-0 hover:text-white/80"
          >
            ◀ Back
          </button>
          <div className="text-base font-medium">Print to PDF</div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-white text-3xl cursor-pointer leading-none p-0 hover:text-white/80"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-white p-6">
          <div className="max-w-[1400px] mx-auto">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 mb-6">
              {/* LEFT: Which Albums */}
              <div>
                <div className="text-base font-semibold text-gray-900 mb-3">
                  Which Albums
                </div>
                <div className="flex flex-col gap-1.5">
                  {[
                    { value: 'all' as const, label: 'All Albums', count: allAlbums.length },
                    { value: 'current' as const, label: 'Current List', count: currentListAlbums.length },
                    { value: 'checkboxed' as const, label: 'Checkboxed', count: checkedAlbumIds.size }
                  ].map(option => (
                    <label
                      key={option.value}
                      className={`flex items-center p-3 px-4 rounded border transition-colors cursor-pointer text-sm ${
                        whichAlbums === option.value 
                          ? 'bg-gray-100 border-gray-300' 
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="whichAlbums"
                        checked={whichAlbums === option.value}
                        onChange={() => setWhichAlbums(option.value)}
                        className="mr-3 cursor-pointer accent-blue-500"
                      />
                      <span className="text-gray-900 font-medium">{option.label}</span>
                      <span className="ml-auto bg-gray-500 text-white px-3 py-0.5 rounded-full text-xs font-semibold">
                        {option.count}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* RIGHT: Visible Columns + Sort Order */}
              <div className="flex flex-col gap-6">
                {/* Visible Columns */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-base font-semibold text-gray-900">
                      Visible Columns
                    </div>
                    <button
                      onClick={() => setShowManageColumnFavorites(true)}
                      className="bg-transparent border-none text-blue-600 text-sm cursor-pointer p-0 hover:underline"
                    >
                      Manage ⋮
                    </button>
                  </div>
                  <div className="bg-white border border-gray-200 rounded p-4 shadow-sm">
                    <div className="text-[13px] font-semibold text-gray-900 mb-1.5">
                      {selectedColumnFavorite?.name || 'My List View columns'}
                    </div>
                    <div className="text-[13px] text-gray-500 leading-relaxed">
                      {selectedColumnFavorite?.columns.join(', ') || ''}
                    </div>
                  </div>
                </div>

                {/* Sort Order */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-base font-semibold text-gray-900">
                      Sort Order
                    </div>
                    <button
                      onClick={() => setShowManageSortFavorites(true)}
                      className="bg-transparent border-none text-blue-600 text-sm cursor-pointer p-0 hover:underline"
                    >
                      Manage ⋮
                    </button>
                  </div>
                  <div className="bg-white border border-gray-200 rounded p-4 text-sm text-gray-900 shadow-sm">
                    {selectedSortFavorite?.fields.map((sf, idx) => (
                      <span key={idx} className="inline-flex items-center">
                        {idx > 0 && <span className="mx-2 text-gray-300">|</span>}
                        {sf.field} <span className="ml-1 text-gray-400">{sf.direction === 'asc' ? '⬆' : '⬇'}</span>
                      </span>
                    )) || 'Artist ⬆ | Title ⬆'}
                  </div>
                </div>
              </div>
            </div>

            {/* Page Setup */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <div className="text-base font-semibold text-gray-900">
                  Page Setup
                </div>
                <button
                  onClick={() => setShowMoreSettings(!showMoreSettings)}
                  className="bg-transparent border-none text-blue-600 text-sm cursor-pointer p-0 hover:underline"
                >
                  More settings ⋮
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded p-6 shadow-sm">
                <div className="flex flex-col md:flex-row gap-8 items-start mb-5">
                  {/* Layout */}
                  <div className="shrink-0">
                    <div className="text-[13px] font-semibold text-gray-900 mb-2">Layout</div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
                        <input type="radio" checked={layout === 'portrait'} onChange={() => setLayout('portrait')} className="accent-blue-500" />
                        Portrait
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
                        <input type="radio" checked={layout === 'landscape'} onChange={() => setLayout('landscape')} className="accent-blue-500" />
                        Landscape
                      </label>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-900 mb-2">Title</div>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full max-w-xs px-2.5 py-1.5 border border-gray-200 rounded text-sm text-gray-900 outline-none focus:border-blue-400 transition-colors"
                    />
                    <label className="flex items-center gap-2 mt-2 text-[13px] text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={titleOnEveryPage} onChange={(e) => setTitleOnEveryPage(e.target.checked)} className="accent-blue-500" />
                      on every page
                    </label>
                  </div>

                  {/* Right checkboxes */}
                  <div className="shrink-0 space-y-2 pt-1">
                    <label className="flex items-center gap-2 text-[13px] text-gray-900 cursor-pointer">
                      <input type="checkbox" checked={wrapInsideColumn} onChange={(e) => setWrapInsideColumn(e.target.checked)} className="accent-blue-500" />
                      Wrap inside column
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-gray-900 cursor-pointer">
                      <input type="checkbox" checked={coverThumbnails} onChange={(e) => setCoverThumbnails(e.target.checked)} className="accent-blue-500" />
                      Cover thumbnails
                    </label>
                  </div>
                </div>

                {showMoreSettings && (
                  <div className="flex gap-8 flex-wrap pt-5 border-t border-gray-100">
                    <div className="w-[150px]">
                      <div className="text-[13px] font-semibold text-gray-900 mb-2">Margins</div>
                      <select value={margins} onChange={(e) => setMargins(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm text-gray-900 bg-white outline-none focus:border-blue-400 transition-colors cursor-pointer">
                        {['Small', 'Medium', 'Large'].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>

                    <div className="w-[150px]">
                      <div className="text-[13px] font-semibold text-gray-900 mb-2">Font type:</div>
                      <select value={fontType} onChange={(e) => setFontType(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm text-gray-900 bg-white outline-none focus:border-blue-400 transition-colors cursor-pointer">
                        {['Arial', 'Helvetica', 'Times'].map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>

                    <div className="w-[100px]">
                      <div className="text-[13px] font-semibold text-gray-900 mb-2">Font size:</div>
                      <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm text-gray-900 bg-white outline-none focus:border-blue-400 transition-colors cursor-pointer">
                        {['8', '9', '10', '11', '12'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div className="w-[70px]">
                      <div className="text-[13px] font-semibold text-gray-900 mb-2">Color:</div>
                      <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} className="w-full h-9 border border-gray-200 rounded p-1 cursor-pointer" />
                    </div>

                    <div className="flex-1 space-y-2 pt-1 min-w-[180px]">
                      <label className="flex items-center gap-2 text-[13px] text-gray-900 cursor-pointer">
                        <input type="checkbox" checked={columnFieldNames} onChange={(e) => setColumnFieldNames(e.target.checked)} className="accent-blue-500" />
                        Column field names
                      </label>
                      <label className={`flex items-center gap-2 text-[13px] text-gray-600 ml-5 cursor-pointer ${!columnFieldNames ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input type="checkbox" checked={columnFieldNamesEveryPage} onChange={(e) => setColumnFieldNamesEveryPage(e.target.checked)} disabled={!columnFieldNames} className="accent-blue-500" />
                        on every page
                      </label>
                      <label className="flex items-center gap-2 text-[13px] text-gray-900 cursor-pointer">
                        <input type="checkbox" checked={rowShading} onChange={(e) => setRowShading(e.target.checked)} className="accent-blue-500" />
                        Row shading
                      </label>
                    </div>

                    <div className="shrink-0 pt-1">
                      <div className="text-[13px] font-semibold text-gray-900 mb-3">Borders</div>
                      <div className="flex gap-4">
                        {(['none', 'middle', 'outside', 'all'] as const).map((borderType) => (
                          <label key={borderType} className="flex flex-col items-center cursor-pointer group">
                            <div className={`w-11 h-11 border-2 rounded mb-1.5 transition-colors flex items-center justify-center p-1 ${
                              borders === borderType ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white group-hover:border-gray-300'
                            }`}>
                              {borderType === 'middle' && (
                                <div className="w-full flex flex-col gap-1.5">
                                  <div className="border-b border-gray-400 h-px w-full" />
                                  <div className="border-b border-gray-400 h-px w-full" />
                                  <div className="border-b border-gray-400 h-px w-full" />
                                </div>
                              )}
                              {borderType === 'outside' && <div className="border-2 border-gray-400 w-full h-full" />}
                              {borderType === 'all' && (
                                <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full">
                                  <div className="border border-gray-400" /><div className="border border-gray-400" />
                                  <div className="border border-gray-400" /><div className="border border-gray-400" />
                                </div>
                              )}
                              {borderType === 'none' && <div className="text-gray-300 text-xs">/</div>}
                            </div>
                            <input type="radio" name="borders" checked={borders === borderType} onChange={() => setBorders(borderType)} className="sr-only" />
                            <div className={`text-[10px] font-medium ${borders === borderType ? 'text-blue-600' : 'text-gray-500'}`}>
                              {borderType.charAt(0).toUpperCase() + borderType.slice(1)}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-8 mt-5 flex-wrap items-center">
                  <label className="flex items-center gap-2 text-[13px] text-gray-900 cursor-pointer">
                    <input type="checkbox" checked={maxAlbumsEnabled} onChange={(e) => setMaxAlbumsEnabled(e.target.checked)} className="accent-blue-500" />
                    <span>Max albums per page:</span>
                    <input type="number" value={maxAlbumsPerPage} onChange={(e) => setMaxAlbumsPerPage(e.target.value)} disabled={!maxAlbumsEnabled} className="w-16 px-2 py-1 border border-gray-200 rounded text-[13px] text-gray-900 outline-none focus:border-blue-400 disabled:opacity-50 disabled:bg-gray-50 transition-colors" />
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-gray-900 cursor-pointer">
                    <input type="checkbox" checked={pageNumbers} onChange={(e) => setPageNumbers(e.target.checked)} className="accent-blue-500" />
                    Page numbers
                  </label>
                  <div className="flex gap-6 items-center">
                    <label className="flex items-center gap-2 text-[13px] text-gray-900 cursor-pointer">
                      <input type="checkbox" checked={printDateTime} onChange={(e) => setPrintDateTime(e.target.checked)} className="accent-blue-500" />
                      Print date/time
                    </label>
                    <label className={`flex items-center gap-2 text-[13px] text-gray-600 cursor-pointer ${!printDateTime ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input type="checkbox" checked={printDateTimeEveryPage} onChange={(e) => setPrintDateTimeEveryPage(e.target.checked)} disabled={!printDateTime} className="accent-blue-500" />
                      on every page
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="mb-6">
              <div className="text-base font-semibold text-gray-900 mb-3">Preview</div>
              <div className="bg-[#4A4A4A] border border-gray-300 rounded-lg p-10 flex items-center justify-center min-h-[500px] shadow-inner">
                <div className="bg-white w-[600px] min-h-[800px] shadow-2xl p-10 text-left scale-90 md:scale-100 origin-center transition-transform">
                  <div className="text-xl font-bold mb-6 text-center text-gray-900 tracking-tight">{title}</div>
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b-2 border-gray-900">
                        {(selectedColumnFavorite?.columns || []).slice(0, 6).map(col => (
                          <th key={col} className="text-left py-2 px-1 font-bold text-gray-900">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentListAlbums.slice(0, maxAlbumsEnabled ? parseInt(maxAlbumsPerPage) || 10 : 10).map((album, idx) => (
                        <tr key={album.id} className={`border-b border-gray-200 ${rowShading && idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                          <td className="py-2 px-1 text-gray-900 truncate">{album.artist}</td>
                          <td className="py-2 px-1 text-gray-900 truncate">{album.title}</td>
                          <td className="py-2 px-1 text-gray-800">{album.year || '—'}</td>
                          <td className="py-2 px-1 text-gray-800">{album.format || '—'}</td>
                          <td className="py-2 px-1 text-gray-800">{album.discs || '—'}</td>
                          <td className="py-2 px-1 text-gray-800">{album.tracks?.filter(t => t.type === 'track').length || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="text-center pb-10">
              <button 
                onClick={generatePDF}
                className="bg-[#4FC3F7] hover:bg-[#3fb0e3] text-white border-none px-10 py-3 rounded text-[15px] font-semibold cursor-pointer shadow-md hover:shadow-lg transition-all active:scale-95"
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