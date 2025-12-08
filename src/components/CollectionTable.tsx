// src/components/CollectionTable.tsx
'use client';

import React, { memo, useCallback } from 'react';
import Link from 'next/link';
import { Album } from '../types/album';
import { 
  ColumnId, 
  getVisibleColumns,
  SortState 
} from '../app/edit-collection/columnDefinitions';

interface CollectionTableProps {
  albums: Album[];
  onAlbumClick: (album: Album) => void;
  selectedAlbums: Set<string>;
  onSelectionChange: (albumIds: Set<string>) => void;
  visibleColumns: ColumnId[];
  sortState: SortState;
  onSortChange: (column: ColumnId) => void;
}

// Performance: Memoize individual row to prevent re-renders
const TableRow = memo(function TableRow({
  album,
  index,
  columns,
  isSelected,
  onAlbumClick,
  getCellValue
}: {
  album: Album;
  index: number;
  columns: ReturnType<typeof getVisibleColumns>;
  isSelected: boolean;
  onAlbumClick: (album: Album) => void;
  getCellValue: (album: Album, columnId: ColumnId) => React.ReactNode;
}) {
  return (
    <tr
      onClick={() => onAlbumClick(album)}
      style={{
        cursor: 'pointer',
        backgroundColor: isSelected ? '#eff6ff' : index % 2 === 0 ? 'white' : '#f8f9fa',
        borderBottom: '1px solid #e9ecef'
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = '#f1f3f5';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#f8f9fa';
        }
      }}
    >
      {columns.map(col => (
        <td
          key={col.id}
          style={{
            padding: '8px',
            color: '#212529',
            whiteSpace: 'nowrap',
            minWidth: col.width,
            width: col.width
          }}
        >
          {getCellValue(album, col.id)}
        </td>
      ))}
    </tr>
  );
});

export default function CollectionTable({
  albums,
  onAlbumClick,
  selectedAlbums,
  onSelectionChange,
  visibleColumns,
  sortState,
  onSortChange
}: CollectionTableProps) {
  
  const columns = getVisibleColumns(visibleColumns);

  const handleSelectAlbum = useCallback((albumId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newSelected = new Set(selectedAlbums);
    if (e.target.checked) {
      newSelected.add(albumId);
    } else {
      newSelected.delete(albumId);
    }
    onSelectionChange(newSelected);
  }, [selectedAlbums, onSelectionChange]);

  // CRITICAL FIX #2: Select-all checkbox functionality
  const handleSelectAll = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.target.checked) {
      // Select all visible albums
      const allIds = new Set(albums.map(album => String(album.id)));
      onSelectionChange(allIds);
    } else {
      // Deselect all
      onSelectionChange(new Set());
    }
  }, [albums, onSelectionChange]);

  const allSelected = albums.length > 0 && selectedAlbums.size === albums.length;
  const someSelected = selectedAlbums.size > 0 && selectedAlbums.size < albums.length;

  const formatLength = (seconds: number | null | undefined): string => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return '—';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  const formatCurrency = (value: number | null | undefined): string => {
    if (!value) return '—';
    return `$${value.toFixed(2)}`;
  };

  const formatArray = (arr: string[] | null | undefined): string => {
    if (!arr || arr.length === 0) return '—';
    return arr.join(', ');
  };

  const getCellValue = useCallback((album: Album, columnId: ColumnId): React.ReactNode => {
    switch (columnId) {
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={selectedAlbums.has(String(album.id))}
            onChange={(e) => handleSelectAlbum(String(album.id), e)}
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: 'pointer' }}
          />
        );
      case 'owned':
        return <span style={{ color: '#22c55e', fontSize: '16px' }}>✓</span>;
      case 'for_sale_indicator':
        return album.for_sale ? <span style={{ color: '#f59e0b', fontSize: '16px' }}>$</span> : null;
      case 'menu':
        return <span style={{ color: '#999', fontSize: '16px' }}>☰</span>;
      case 'artist':
        return album.artist || '—';
      case 'title':
        return (
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAlbumClick(album);
            }}
            style={{ color: '#0066cc', textDecoration: 'none' }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            {album.title || '—'}
          </Link>
        );
      case 'year':
        return album.year || '—';
      case 'barcode':
        return album.barcode || '—';
      case 'cat_no':
        return album.cat_no || '—';
      case 'sort_title':
        return album.sort_title || '—';
      case 'subtitle':
        return album.subtitle || '—';
      case 'index_number':
        return album.index_number || '—';
      case 'format':
        return album.format || '—';
      case 'discs':
        return album.discs || '—';
      case 'tracks':
        return album.spotify_total_tracks || album.apple_music_track_count || '—';
      case 'length':
        return formatLength(album.length_seconds);
      case 'box_set':
        return album.is_box_set ? 'Yes' : 'No';
      case 'country':
        return album.country || '—';
      case 'extra':
        return album.extra || '—';
      case 'is_live':
        return album.is_live ? 'Yes' : 'No';
      case 'media_condition':
        return album.media_condition || '—';
      case 'package_sleeve_condition':
        return album.package_sleeve_condition || '—';
      case 'packaging':
        return album.packaging || '—';
      case 'rpm':
        return album.rpm || '—';
      case 'sound':
        return album.sound || '—';
      case 'spars_code':
        return album.spars_code || '—';
      case 'storage_device_slot':
        return album.storage_device_slot || '—';
      case 'studio':
        return album.studio || '—';
      case 'vinyl_color':
        return album.vinyl_color || '—';
      case 'vinyl_weight':
        return album.vinyl_weight || '—';
      case 'genres':
        return formatArray(album.discogs_genres || album.spotify_genres);
      case 'styles':
        return formatArray(album.discogs_styles);
      case 'label':
        return album.spotify_label || album.apple_music_label || '—';
      case 'original_release_date':
        return formatDate(album.original_release_date);
      case 'original_release_year':
        return album.original_release_year || '—';
      case 'recording_date':
        return formatDate(album.recording_date);
      case 'recording_year':
        return album.recording_year || '—';
      case 'master_release_date':
        return album.master_release_date || '—';
      case 'chorus':
        return album.chorus || '—';
      case 'composer':
        return album.composer || '—';
      case 'composition':
        return album.composition || '—';
      case 'conductor':
        return album.conductor || '—';
      case 'orchestra':
        return album.orchestra || '—';
      case 'engineers':
        return formatArray(album.engineers);
      case 'musicians':
        return formatArray(album.musicians);
      case 'producers':
        return formatArray(album.producers);
      case 'songwriters':
        return formatArray(album.songwriters);
      case 'added_date':
        return formatDate(album.date_added);
      case 'collection_status':
        return album.collection_status || '—';
      case 'folder':
        return album.folder || '—';
      case 'location':
        return album.location || '—';
      case 'my_rating':
        return album.my_rating ? '⭐'.repeat(album.my_rating) : '—';
      case 'notes':
        return album.notes || '—';
      case 'owner':
        return album.owner || '—';
      case 'play_count':
        return album.play_count || 0;
      case 'last_played_date':
        return formatDate(album.last_played_date);
      case 'last_cleaned_date':
        return formatDate(album.last_cleaned_date);
      case 'signed_by':
        return formatArray(album.signed_by);
      case 'custom_tags':
        return formatArray(album.custom_tags);
      case 'modified_date':
        return formatDate(album.modified_date);
      case 'due_date':
        return formatDate(album.due_date);
      case 'loan_date':
        return formatDate(album.loan_date);
      case 'loaned_to':
        return album.loaned_to || '—';
      case 'for_sale':
        return album.for_sale ? 'Yes' : 'No';
      case 'purchase_date':
        return formatDate(album.purchase_date);
      case 'purchase_store':
        return album.purchase_store || '—';
      case 'purchase_price':
        return formatCurrency(album.purchase_price);
      case 'current_value':
        return formatCurrency(album.current_value);
      case 'sale_price':
        return formatCurrency(album.sale_price);
      case 'sale_platform':
        return album.sale_platform || '—';
      case 'sale_quantity':
        return album.sale_quantity || '—';
      case 'wholesale_cost':
        return formatCurrency(album.wholesale_cost);
      case 'discogs_price_min':
        return formatCurrency(album.discogs_price_min);
      case 'discogs_price_median':
        return formatCurrency(album.discogs_price_median);
      case 'discogs_price_max':
        return formatCurrency(album.discogs_price_max);
      case 'pricing_notes':
        return album.pricing_notes || '—';
      case 'spotify_popularity':
        return album.spotify_popularity || '—';
      default:
        return '—';
    }
  }, [selectedAlbums, handleSelectAlbum, onAlbumClick]);

  // CRITICAL FIX #3: Implement actual sorting functionality
  const handleHeaderClick = (columnId: ColumnId, sortable?: boolean) => {
    if (sortable) {
      onSortChange(columnId);
    }
  };

  const getSortIndicator = (columnId: ColumnId) => {
    if (sortState.column !== columnId) return null;
    return sortState.direction === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        fontSize: '13px'
      }}>
        <thead style={{ 
          position: 'sticky', 
          top: 0, 
          background: '#f8f9fa', 
          zIndex: 10,
          borderBottom: '2px solid #dee2e6'
        }}>
          <tr>
            {columns.map(col => (
              <th
                key={col.id}
                onClick={() => handleHeaderClick(col.id, col.sortable)}
                style={{
                  padding: '12px 8px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#495057',
                  borderBottom: '2px solid #dee2e6',
                  whiteSpace: 'nowrap',
                  minWidth: col.width,
                  width: col.width,
                  cursor: col.sortable ? 'pointer' : 'default'
                }}
              >
                {/* CRITICAL FIX #1: Render select-all checkbox in empty label */}
                {col.id === 'checkbox' ? (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={input => {
                      if (input) {
                        input.indeterminate = someSelected;
                      }
                    }}
                    onChange={handleSelectAll}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'pointer' }}
                  />
                ) : (
                  <>
                    {col.label}
                    {col.sortable && getSortIndicator(col.id)}
                  </>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {albums.map((album, index) => (
            <TableRow
              key={album.id}
              album={album}
              index={index}
              columns={columns}
              isSelected={selectedAlbums.has(String(album.id))}
              onAlbumClick={onAlbumClick}
              getCellValue={getCellValue}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}