// src/app/admin/edit-collection/page.tsx - Complete with all metadata filters
"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from 'src/lib/supabaseClient';
import Image from 'next/image';

interface CollectionRow {
  id: number;
  image_url?: string | null;
  artist?: string;
  title?: string;
  year?: string;
  folder?: string;
  format?: string;
  media_condition?: string;
  sell_price?: string | null;
  steves_top_200?: boolean | null;
  this_weeks_top_10?: boolean | null;
  inner_circle_preferred?: boolean | null;
  tracklists?: string | { position?: string; title?: string }[];
  blocked?: boolean;
  discogs_genres?: string[] | null;
  discogs_styles?: string[] | null;
  decade?: number | null;
  master_release_date?: string | null;
}

type SortColumn = 'id' | 'artist' | 'title' | 'year' | 'folder' | 'format' | 'media_condition' | 'sell_price';
type SortDirection = 'asc' | 'desc';

const STORAGE_KEY = 'editCollection_state';

interface PageState {
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  query: string;
  showMissingImages: boolean;
  showMissingTracklists: boolean;
  showMissingGenres: boolean;
  showMissingStyles: boolean;
  showMissingDecade: boolean;
  showMissingMasterDate: boolean;
  showForSale: boolean;
  showTop200Only: boolean;
  showTop10Only: boolean;
  showInnerCircleOnly: boolean;
  scrollPosition: number;
}

export default function EditCollectionPage() {
  const [data, setData] = useState<CollectionRow[]>([]);
  const [query, setQuery] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showMissingImages, setShowMissingImages] = useState<boolean>(false);
  const [showMissingTracklists, setShowMissingTracklists] = useState<boolean>(false);
  const [showMissingGenres, setShowMissingGenres] = useState<boolean>(false);
  const [showMissingStyles, setShowMissingStyles] = useState<boolean>(false);
  const [showMissingDecade, setShowMissingDecade] = useState<boolean>(false);
  const [showMissingMasterDate, setShowMissingMasterDate] = useState<boolean>(false);
  const [showForSale, setShowForSale] = useState<boolean>(false);
  const [showTop200Only, setShowTop200Only] = useState<boolean>(false);
  const [showTop10Only, setShowTop10Only] = useState<boolean>(false);
  const [showInnerCircleOnly, setShowInnerCircleOnly] = useState<boolean>(false);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  const [updatingRow, setUpdatingRow] = useState<number | null>(null);

  // Save state to localStorage
  const saveState = useCallback(() => {
    const state: PageState = {
      sortColumn,
      sortDirection,
      query,
      showMissingImages,
      showMissingTracklists,
      showMissingGenres,
      showMissingStyles,
      showMissingDecade,
      showMissingMasterDate,
      showForSale,
      showTop200Only,
      showTop10Only,
      showInnerCircleOnly,
      scrollPosition: window.scrollY
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [sortColumn, sortDirection, query, showMissingImages, showMissingTracklists, showMissingGenres, showMissingStyles, showMissingDecade, showMissingMasterDate, showForSale, showTop200Only, showTop10Only, showInnerCircleOnly]);

  // Load state from localStorage
  const loadState = useCallback(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const state: PageState = JSON.parse(savedState);
        setSortColumn(state.sortColumn || 'id');
        setSortDirection(state.sortDirection || 'asc');
        setQuery(state.query || '');
        setShowMissingImages(state.showMissingImages || false);
        setShowMissingTracklists(state.showMissingTracklists || false);
        setShowMissingGenres(state.showMissingGenres || false);
        setShowMissingStyles(state.showMissingStyles || false);
        setShowMissingDecade(state.showMissingDecade || false);
        setShowMissingMasterDate(state.showMissingMasterDate || false);
        setShowForSale(state.showForSale || false);
        setShowTop200Only(state.showTop200Only || false);
        setShowTop10Only(state.showTop10Only || false);
        setShowInnerCircleOnly(state.showInnerCircleOnly || false);
        
        setTimeout(() => {
          window.scrollTo(0, state.scrollPosition || 0);
        }, 100);
      }
    } catch (error) {
      console.warn('Failed to load saved state:', error);
    }
  }, []);

  useEffect(() => {
    loadState();
    fetchAllRows();
  }, [loadState]);

  useEffect(() => {
    saveState();
  }, [saveState]);

  async function fetchAllRows() {
    setStatus('Loading...');
    let allRows: CollectionRow[] = [];
    let from = 0;
    const batchSize = 1000;
    let keepGoing = true;
    
    while (keepGoing) {
      const { data: batch, error } = await supabase
        .from('collection')
        .select('*')
        .range(from, from + batchSize - 1);
      
      if (error) {
        setStatus('Error loading collection');
        setData([]);
        return;
      }
      
      if (!batch || batch.length === 0) break;
      allRows = allRows.concat(batch as CollectionRow[]);
      keepGoing = batch.length === batchSize;
      from += batchSize;
    }
    
    setStatus('');
    setData(allRows);
  }

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function sortData(dataToSort: CollectionRow[]): CollectionRow[] {
    return [...dataToSort].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortColumn) {
        case 'id':
          aVal = a.id || 0;
          bVal = b.id || 0;
          break;
        case 'artist':
          aVal = (a.artist || '').toLowerCase();
          bVal = (b.artist || '').toLowerCase();
          break;
        case 'title':
          aVal = (a.title || '').toLowerCase();
          bVal = (b.title || '').toLowerCase();
          break;
        case 'year':
          aVal = (a.year || '').toLowerCase();
          bVal = (b.year || '').toLowerCase();
          break;
        case 'folder':
          aVal = (a.folder || '').toLowerCase();
          bVal = (b.folder || '').toLowerCase();
          break;
        case 'format':
          aVal = (a.format || '').toLowerCase();
          bVal = (b.format || '').toLowerCase();
          break;
        case 'media_condition':
          aVal = (a.media_condition || '').toLowerCase();
          bVal = (b.media_condition || '').toLowerCase();
          break;
        case 'sell_price':
          const priceA = a.sell_price;
          const priceB = b.sell_price;
          
          if (!priceA && !priceB) return 0;
          if (!priceA) return 1;
          if (!priceB) return -1;
          
          if (priceA === 'NFS' && priceB !== 'NFS') return 1;
          if (priceB === 'NFS' && priceA !== 'NFS') return -1;
          if (priceA === 'NFS' && priceB === 'NFS') return 0;
          
          const numA = parseFloat(priceA.replace(/[^0-9.]/g, ''));
          const numB = parseFloat(priceB.replace(/[^0-9.]/g, ''));
          
          if (!isNaN(numA) && !isNaN(numB)) {
            aVal = numA;
            bVal = numB;
          } else {
            aVal = priceA.toLowerCase();
            bVal = priceB.toLowerCase();
          }
          break;
        default:
          aVal = '';
          bVal = '';
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function hasValidImage(row: CollectionRow): boolean {
    return !!(row.image_url && row.image_url !== "null" && row.image_url !== "");
  }

  function hasValidTracklist(row: CollectionRow): boolean {
    if (!row.tracklists) return false;
    try {
      const arr = typeof row.tracklists === 'string' 
        ? (JSON.parse(row.tracklists) as { position?: string; title?: string }[])
        : row.tracklists;
      return Array.isArray(arr) && arr.length > 0;
    } catch {
      return false;
    }
  }

  const filtered = data.filter(row => {
    const matchesQuery = !query || 
      (row.title || '').toLowerCase().includes(query.toLowerCase()) ||
      (row.artist || '').toLowerCase().includes(query.toLowerCase());

    const matchesImageFilter = !showMissingImages || !hasValidImage(row);
    const matchesTracklistFilter = !showMissingTracklists || !hasValidTracklist(row);
    const matchesGenresFilter = !showMissingGenres || !row.discogs_genres || row.discogs_genres.length === 0;
    const matchesStylesFilter = !showMissingStyles || !row.discogs_styles || row.discogs_styles.length === 0;
    const matchesDecadeFilter = !showMissingDecade || !row.decade;
    const matchesMasterDateFilter = !showMissingMasterDate || !row.master_release_date;
    const matchesForSaleFilter = !showForSale || (row.sell_price && row.sell_price !== '');
    const matchesTop200Filter = !showTop200Only || !!row.steves_top_200;
    const matchesTop10Filter = !showTop10Only || !!row.this_weeks_top_10;
    const matchesInnerCircleFilter = !showInnerCircleOnly || !!row.inner_circle_preferred;

    return matchesQuery && matchesImageFilter && matchesTracklistFilter && 
           matchesGenresFilter && matchesStylesFilter && matchesDecadeFilter && matchesMasterDateFilter &&
           matchesForSaleFilter && matchesTop200Filter && matchesTop10Filter && matchesInnerCircleFilter;
  });

  const sortedAndFiltered = sortData(filtered);

  function parseTracklistShort(tracklists: string | { position?: string; title?: string }[] | undefined): string {
    if (!tracklists) return '';
    try {
      const arr =
        typeof tracklists === 'string'
          ? (JSON.parse(tracklists) as { position?: string; title?: string }[])
          : tracklists;
      if (!Array.isArray(arr) || arr.length === 0) return '';
      return arr
        .slice(0, 3)
        .map((t) => [t.position, t.title].filter(Boolean).join(': '))
        .join(' | ') + (arr.length > 3 ? ` (+${arr.length - 3})` : '');
    } catch {
      return 'Invalid';
    }
  }

  function getSortIcon(column: SortColumn): string {
    if (sortColumn !== column) return ' ↕️';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  async function updateBadge(rowId: number, badgeType: 'steves_top_200' | 'this_weeks_top_10' | 'inner_circle_preferred', newValue: boolean) {
    setUpdatingRow(rowId);
    try {
      const { error } = await supabase
        .from('collection')
        .update({ [badgeType]: newValue })
        .eq('id', rowId);

      if (error) throw error;

      setData(prevData => 
        prevData.map(row => 
          row.id === rowId 
            ? { ...row, [badgeType]: newValue }
            : row
        )
      );

      const badgeNames = {
        steves_top_200: "Steve's Top 200",
        this_weeks_top_10: "This Week's Top 10", 
        inner_circle_preferred: "Inner Circle Preferred"
      };

      setStatus(`${newValue ? 'Added' : 'Removed'} ${badgeNames[badgeType]} for ID ${rowId}`);
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      console.error('Error updating badge:', error);
      setStatus(`Error updating badge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUpdatingRow(null);
    }
  }

  async function updateSellPrice(rowId: number, newPrice: string) {
    setUpdatingRow(rowId);
    try {
      const priceValue = newPrice.trim() === '' ? null : newPrice.trim();
      
      const { error } = await supabase
        .from('collection')
        .update({ sell_price: priceValue })
        .eq('id', rowId);

      if (error) throw error;

      setData(prevData => 
        prevData.map(row => 
          row.id === rowId 
            ? { ...row, sell_price: priceValue }
            : row
        )
      );

      setStatus(`Updated sell price for ID ${rowId}`);
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      console.error('Error updating sell price:', error);
      setStatus(`Error updating price: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUpdatingRow(null);
      setEditingPrice(null);
    }
  }

  async function deleteRow(row: CollectionRow) {
    const confirmMessage = `Are you sure you want to DELETE this item?\n\n${row.artist} - ${row.title}\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;

    setUpdatingRow(row.id);
    try {
      const { error } = await supabase
        .from('collection')
        .delete()
        .eq('id', row.id);

      if (error) throw error;

      setData(prevData => prevData.filter(r => r.id !== row.id));
      setStatus(`Deleted: ${row.artist} - ${row.title}`);
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      console.error('Error deleting row:', error);
      setStatus(`Error deleting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUpdatingRow(null);
    }
  }

  const startEditingPrice = (rowId: number, currentPrice: string | null) => {
    setEditingPrice(rowId);
    setTempPrice(currentPrice || '');
  };

  const cancelEditingPrice = () => {
    setEditingPrice(null);
    setTempPrice('');
  };

  const savePrice = (rowId: number) => {
    updateSellPrice(rowId, tempPrice);
  };

  const clearPrice = (rowId: number) => {
    updateSellPrice(rowId, '');
  };

  const exportToPrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Collection Export - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; margin-bottom: 20px; }
            .filters { margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 5px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .badge { font-size: 9px; padding: 1px 3px; border-radius: 2px; margin-right: 2px; }
            .top200 { background: #fee2e2; color: #dc2626; }
            .top10 { background: #fed7aa; color: #ea580c; }
            .inner { background: #e9d5ff; color: #7c3aed; }
            @media print {
              body { margin: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Dead Wax Dialogues Collection</h1>
          <div class="filters">
            <strong>Export Date:</strong> ${new Date().toLocaleString()}<br/>
            <strong>Total Items:</strong> ${sortedAndFiltered.length} of ${data.length}<br/>
            <strong>Filters Applied:</strong> 
            ${query ? `Search: "${query}" • ` : ''}
            ${showMissingImages ? 'Missing Images • ' : ''}
            ${showMissingTracklists ? 'Missing Tracklists • ' : ''}
            ${showMissingGenres ? 'Missing Genres • ' : ''}
            ${showMissingStyles ? 'Missing Styles • ' : ''}
            ${showMissingDecade ? 'Missing Decade • ' : ''}
            ${showMissingMasterDate ? 'Missing Master Date • ' : ''}
            ${showForSale ? 'For Sale Only • ' : ''}
            ${showTop200Only ? 'Steve\'s Top 200 Only • ' : ''}
            ${showTop10Only ? 'This Week\'s Top 10 Only • ' : ''}
            ${showInnerCircleOnly ? 'Inner Circle Preferred Only • ' : ''}
            ${!query && !showMissingImages && !showMissingTracklists && !showMissingGenres && !showMissingStyles && !showMissingDecade && !showMissingMasterDate && !showForSale && !showTop200Only && !showTop10Only && !showInnerCircleOnly ? 'None' : ''}
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 30%">Title</th>
                <th style="width: 25%">Artist</th>
                <th style="width: 20%">Format / Folder</th>
                <th style="width: 15%">Price</th>
                <th style="width: 10%">Badges</th>
              </tr>
            </thead>
            <tbody>
              ${sortedAndFiltered.map(row => `
                <tr>
                  <td>${row.title || ''}</td>
                  <td>${row.artist || ''}</td>
                  <td>${[row.format, row.folder].filter(Boolean).join(' / ')}</td>
                  <td>${row.sell_price || ''}</td>
                  <td>
                    ${row.steves_top_200 ? '<span class="badge top200">⭐T200</span>' : ''}
                    ${row.this_weeks_top_10 ? '<span class="badge top10">🔥T10</span>' : ''}
                    ${row.inner_circle_preferred ? '<span class="badge inner">💎IC</span>' : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; font-size: 10px; color: #666;">
            Generated from Dead Wax Dialogues collection management system
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const forSaleCount = data.filter(row => row.sell_price && row.sell_price !== '').length;
  const top200Count = data.filter(row => row.steves_top_200).length;
  const top10Count = data.filter(row => row.this_weeks_top_10).length; 
  const innerCircleCount = data.filter(row => row.inner_circle_preferred).length;
  const badgedCount = top200Count + top10Count + innerCircleCount;

  return (
    <div style={{ padding: 24, background: "#fff", color: "#222", minHeight: "100vh" }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: "#222", margin: 0 }}>Edit Collection</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link
            href="/admin/inner-circle-results"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 4px rgba(124, 58, 237, 0.2)'
            }}
          >
            💎 Inner Circle Results
          </Link>
          <div style={{ fontSize: 14, color: '#666' }}>
            💾 Sort & filter state automatically saved
          </div>
        </div>
      </div>
      
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            placeholder="Search title/artist"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ minWidth: 200, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          />
          <button 
            onClick={fetchAllRows}
            style={{ padding: '4px 8px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Reload
          </button>
          <button 
            onClick={exportToPrint}
            style={{ padding: '4px 12px', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
            title="Export current view to PDF/Print"
          >
            📄 Export PDF
          </button>
          <span style={{ color: "#222" }}>{status}</span>
        </div>
        
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: "#222", fontSize: 14 }}>
            <input
              type="checkbox"
              checked={showMissingImages}
              onChange={e => setShowMissingImages(e.target.checked)}
            />
            Missing images
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: "#222", fontSize: 14 }}>
            <input
              type="checkbox"
              checked={showMissingTracklists}
              onChange={e => setShowMissingTracklists(e.target.checked)}
            />
            Missing tracklists
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: "#222", fontSize: 14 }}>
            <input
              type="checkbox"
              checked={showMissingGenres}
              onChange={e => setShowMissingGenres(e.target.checked)}
            />
            Missing genres
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: "#222", fontSize: 14 }}>
            <input
              type="checkbox"
              checked={showMissingStyles}
              onChange={e => setShowMissingStyles(e.target.checked)}
            />
            Missing styles
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: "#222", fontSize: 14 }}>
            <input
              type="checkbox"
              checked={showMissingDecade}
              onChange={e => setShowMissingDecade(e.target.checked)}
            />
            Missing decade
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: "#222", fontSize: 14 }}>
            <input
              type="checkbox"
              checked={showMissingMasterDate}
              onChange={e => setShowMissingMasterDate(e.target.checked)}
            />
            Missing master date
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: "#222", fontSize: 14 }}>
            <input
              type="checkbox"
              checked={showForSale}
              onChange={e => setShowForSale(e.target.checked)}
            />
            For sale only ({forSaleCount})
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: "#222", fontSize: 14 }}>
            <input
              type="checkbox"
              checked={showTop200Only}
              onChange={e => setShowTop200Only(e.target.checked)}
            />
            <span style={{ color: '#dc2626', fontWeight: 'bold' }}>⭐ Top 200 only ({top200Count})</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: "#222", fontSize: 14 }}>
            <input
              type="checkbox"
              checked={showTop10Only}
              onChange={e => setShowTop10Only(e.target.checked)}
            />
            <span style={{ color: '#ea580c', fontWeight: 'bold' }}>🔥 Top 10 only ({top10Count})</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: "#222", fontSize: 14 }}>
            <input
              type="checkbox"
              checked={showInnerCircleOnly}
              onChange={e => setShowInnerCircleOnly(e.target.checked)}
            />
            <span style={{ color: '#7c3aed', fontWeight: 'bold' }}>💎 Inner Circle only ({innerCircleCount})</span>
          </label>
        </div>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 700, border: '1px solid #ddd' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead style={{ background: '#f5f5f5', position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ color: "#222" }}>
              <th style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 4px', borderBottom: '1px solid #ddd', textAlign: 'left' }}
                  onClick={() => handleSort('id')}>
                ID{getSortIcon('id')}
              </th>
              <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Image</th>
              <th style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 4px', borderBottom: '1px solid #ddd', textAlign: 'left' }}
                  onClick={() => handleSort('artist')}>
                Artist{getSortIcon('artist')}
              </th>
              <th style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 4px', borderBottom: '1px solid #ddd', textAlign: 'left' }}
                  onClick={() => handleSort('title')}>
                Title{getSortIcon('title')}
              </th>
              <th style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 4px', borderBottom: '1px solid #ddd', textAlign: 'left' }}
                  onClick={() => handleSort('year')}>
                Year{getSortIcon('year')}
              </th>
              <th style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 4px', borderBottom: '1px solid #ddd', textAlign: 'left' }}
                  onClick={() => handleSort('format')}>
                Format{getSortIcon('format')}
              </th>
              <th style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 4px', borderBottom: '1px solid #ddd', textAlign: 'left' }}
                  onClick={() => handleSort('media_condition')}>
                Condition{getSortIcon('media_condition')}
              </th>
              <th style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 4px', borderBottom: '1px solid #ddd', textAlign: 'left' }}
                  onClick={() => handleSort('sell_price')}>
                💰 Sell Price{getSortIcon('sell_price')}
              </th>
              <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd', fontSize: 11, textAlign: 'center' }}
                  title="Steve's Top 200">
                ⭐<br/>T200
              </th>
              <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd', fontSize: 11, textAlign: 'center' }}
                  title="This Week's Top 10">
                🔥<br/>T10
              </th>
              <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd', fontSize: 11, textAlign: 'center' }}
                  title="Inner Circle Preferred">
                💎<br/>IC
              </th>
              <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Tracklist</th>
              <th style={{ padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedAndFiltered.map((row: CollectionRow) => (
              <tr key={row.id} style={{
                background: row.blocked ? '#fee2e2' : '',
                color: "#222",
                height: 40,
                borderBottom: '1px solid #f0f0f0'
              }}>
                <td style={{ padding: '4px', fontWeight: 'bold' }}>{row.id}</td>
                <td style={{ padding: '4px' }}>
                  {hasValidImage(row)
                    ? <Image src={row.image_url!} alt="cover" width={32} height={32} style={{ objectFit: 'cover', borderRadius: 3 }} unoptimized />
                    : <div style={{ width: 32, height: 32, background: "#e0e0e0", borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#999' }}>
                        NO IMG
                      </div>}
                </td>
                <td style={{ padding: '4px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.artist}</td>
                <td style={{ padding: '4px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.title}</td>
                <td style={{ padding: '4px' }}>{row.year}</td>
                <td style={{ padding: '4px', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.format}</td>
                <td style={{ padding: '4px' }}>{row.media_condition}</td>
                <td style={{ padding: '4px', minWidth: 100 }}>
                  {editingPrice === row.id ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={tempPrice}
                        onChange={e => setTempPrice(e.target.value)}
                        placeholder="$25.00 or NFS"
                        style={{ width: 80, padding: '2px 4px', fontSize: 12, border: '1px solid #ccc', borderRadius: 2 }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') savePrice(row.id);
                          if (e.key === 'Escape') cancelEditingPrice();
                        }}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <div
                        onClick={() => startEditingPrice(row.id, row.sell_price)}
                        style={{
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: 2,
                          background: row.sell_price ? (row.sell_price === 'NFS' ? '#fef3c7' : '#dcfce7') : '#f9fafb',
                          border: '1px solid ' + (row.sell_price ? (row.sell_price === 'NFS' ? '#f59e0b' : '#22c55e') : '#e5e7eb'),
                          minHeight: 20,
                          display: 'flex',
                          alignItems: 'center',
                          fontSize: 12,
                          fontWeight: row.sell_price ? 'bold' : 'normal',
                          color: row.sell_price ? '#000' : '#999',
                          flex: 1
                        }}
                        title="Click to edit price"
                      >
                        {updatingRow === row.id ? '...' : (row.sell_price || 'Click to set')}
                      </div>
                      {row.sell_price && (
                        <button
                          onClick={() => clearPrice(row.id)}
                          disabled={updatingRow === row.id}
                          style={{ 
                            padding: '2px 4px', 
                            fontSize: 10, 
                            background: '#dc2626', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: 2, 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Clear price"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td style={{ padding: '4px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={!!row.steves_top_200}
                    onChange={e => updateBadge(row.id, 'steves_top_200', e.target.checked)}
                    disabled={updatingRow === row.id}
                    style={{ 
                      transform: 'scale(1.2)',
                      cursor: updatingRow === row.id ? 'not-allowed' : 'pointer'
                    }}
                    title="Steve's Top 200"
                  />
                </td>
                <td style={{ padding: '4px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={!!row.this_weeks_top_10}
                    onChange={e => updateBadge(row.id, 'this_weeks_top_10', e.target.checked)}
                    disabled={updatingRow === row.id}
                    style={{ 
                      transform: 'scale(1.2)',
                      cursor: updatingRow === row.id ? 'not-allowed' : 'pointer'
                    }}
                    title="This Week's Top 10"
                  />
                </td>
                <td style={{ padding: '4px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={!!row.inner_circle_preferred}
                    onChange={e => updateBadge(row.id, 'inner_circle_preferred', e.target.checked)}
                    disabled={updatingRow === row.id}
                    style={{ 
                      transform: 'scale(1.2)',
                      cursor: updatingRow === row.id ? 'not-allowed' : 'pointer'
                    }}
                    title="Inner Circle Preferred"
                  />
                </td>
                <td style={{ color: hasValidTracklist(row) ? '#222' : '#999', fontStyle: hasValidTracklist(row) ? 'normal' : 'italic', padding: '4px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {hasValidTracklist(row) ? parseTracklistShort(row.tracklists) : 'No tracklist'}
                </td>
                <td style={{ padding: '4px' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Link
                      href={`/admin/edit-entry/${row.id}`}
                      style={{ color: '#2563eb', fontWeight: 500, cursor: 'pointer', textDecoration: 'none', fontSize: 12 }}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => deleteRow(row)}
                      disabled={updatingRow === row.id}
                      style={{ 
                        color: '#dc2626', 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        fontSize: 12,
                        padding: '2px 4px',
                        borderRadius: 2
                      }}
                      title="Delete item"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div style={{ color: "#222", marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          Showing {sortedAndFiltered.length} / {data.length} rows.
          {showMissingImages && ` (${data.filter(row => !hasValidImage(row)).length} missing images)`}
          {showMissingTracklists && ` (${data.filter(row => !hasValidTracklist(row)).length} missing tracklists)`}
          {showMissingGenres && ` (${data.filter(row => !row.discogs_genres || row.discogs_genres.length === 0).length} missing genres)`}
          {showMissingStyles && ` (${data.filter(row => !row.discogs_styles || row.discogs_styles.length === 0).length} missing styles)`}
          {showMissingDecade && ` (${data.filter(row => !row.decade).length} missing decade)`}
          {showMissingMasterDate && ` (${data.filter(row => !row.master_release_date).length} missing master date)`}
          {showForSale && ` (${forSaleCount} for sale)`}
          {showTop200Only && ` (${top200Count} top 200)`}
          {showTop10Only && ` (${top10Count} top 10)`}
          {showInnerCircleOnly && ` (${innerCircleCount} inner circle)`}
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          💡 Click price field to edit (Enter to save, Esc to cancel) • ✕ button to clear prices • Check boxes to toggle badges<br/>
          📊 Badges: ⭐{top200Count} • 🔥{top10Count} • 💎{innerCircleCount} • Total: {badgedCount}<br/>
          📄 Export current filtered view to PDF/Print with title, artist, format/folder, and price
        </div>
      </div>
    </div>
  );
}