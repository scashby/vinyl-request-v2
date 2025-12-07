// src/components/CollectionTable.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { Album } from '../types/album';
import { 
  ColumnId, 
  ColumnDefinition,
  getVisibleColumns 
} from '../app/edit-collection/columnDefinitions';

interface CollectionTableProps {
  albums: Album[];
  onAlbumClick: (album: Album) => void;
  selectedAlbums: Set<string>;
  onSelectionChange: (albumIds: Set<string>) => void;
  visibleColumns: ColumnId[];
}

type SortConfig = {
  key: keyof Album | null;
  direction: 'asc' | 'desc';
};

export default function CollectionTable({
  albums,
  onAlbumClick,
  selectedAlbums,
  onSelectionChange,
  visibleColumns
}: CollectionTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'artist',
    direction: 'asc'
  });

  const columnDefs = useMemo(() => 
    getVisibleColumns(visibleColumns), 
    [visibleColumns]
  );

  const handleSort = (column: ColumnDefinition) => {
    if (!column.sortable) return;

    setSortConfig(current => ({
      key: column.field as keyof Album,
      direction: 
        current.key === column.field && current.direction === 'asc' 
          ? 'desc' 
          : 'asc'
    }));
  };

  const sortedAlbums = useMemo(() => {
    if (!sortConfig.key) return albums;

    return [...albums].sort((a, b) => {
      const aVal = a[sortConfig.key!];
      const bVal = b[sortConfig.key!];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [albums, sortConfig]);

  const handleSelectAlbum = (albumId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newSelection = new Set(selectedAlbums);
    if (e.target.checked) {
      newSelection.add(albumId);
    } else {
      newSelection.delete(albumId);
    }
    onSelectionChange(newSelection);
  };

  const formatLength = (seconds: number | null): string => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatGenres = (genres: string[] | null): string => {
    if (!genres || genres.length === 0) return '—';
    return genres.join(', ');
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatYear = (dateString: string | null): string => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.getFullYear().toString();
  };

  const renderCellContent = (album: Album, column: ColumnDefinition) => {
    switch (column.id) {
      // System columns
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={selectedAlbums.has(String(album.id))}
            onChange={(e) => handleSelectAlbum(String(album.id), e)}
            onClick={(e) => e.stopPropagation()}
          />
        );

      case 'owned':
        return ''; // TODO: Add owned field to Album type

      case 'for_sale':
        return ''; // TODO: Add for_sale field to Album type

      // Main columns
      case 'artist':
        return album.artist || '—';

      case 'title':
        return (
          <span
            style={{
              color: '#3b82f6',
              cursor: 'pointer',
              textDecoration: 'none'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onAlbumClick(album);
            }}
          >
            {album.title}
          </span>
        );

      case 'release_date':
        return album.year || '—';

      case 'genre':
        return formatGenres(album.discogs_genres);

      case 'format':
        return album.format || '—';

      case 'label':
        return album.spotify_label || '—';

      case 'barcode':
        return album.barcode || '—';

      case 'cat_no':
        return '—';

      case 'sort_title':
        return album.title || '—';

      case 'subtitle':
        return '—';

      // Edition columns
      case 'discs':
        return album.discs || '—';

      case 'tracks':
        return album.spotify_total_tracks || '—';

      case 'length':
        return formatLength(album.length_seconds);

      // Personal columns
      case 'added_date':
        return formatDate(album.date_added);

      case 'added_year':
        return formatYear(album.date_added);

      case 'collection_status':
        return '—'; // TODO: Add owned field to Album type

      case 'modified_date':
        return formatDate(album.date_added);

      case 'notes':
        return album.notes ? album.notes.substring(0, 50) + '...' : '—';

      case 'tags':
        return '—';

      // Details columns (placeholders - add real fields when available)
      case 'box_set':
      case 'country':
      case 'is_live':
      case 'media_condition':
      case 'packaging':
      case 'studio':
      case 'vinyl_color':
      case 'vinyl_weight':
      case 'current_value':
      case 'ebay_link':
      case 'last_played':
      case 'location':
      case 'my_rating':
      case 'owner':
      case 'play_count':
      case 'purchase_date':
      case 'purchase_price':
      case 'purchase_store':
      case 'purchase_year':
      case 'quantity':
        return '—';

      default:
        return '—';
    }
  };

  const getSortIndicator = (column: ColumnDefinition) => {
    if (!column.sortable) return null;
    if (sortConfig.key !== column.field) return null;
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div style={{ 
      width: '100%', 
      overflowX: 'auto',
      border: '1px solid #e5e7eb',
      borderRadius: '4px'
    }}>
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        fontSize: '12px'
      }}>
        <thead>
          <tr>
            {columnDefs.map((column) => (
              <th
                key={column.id}
                onClick={() => handleSort(column)}
                style={{
                  padding: '6px',
                  textAlign: column.align || 'left',
                  backgroundColor: '#fafafa',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  borderRight: '1px solid #e5e7eb',
                  borderBottom: '1px solid #e5e7eb',
                  cursor: column.sortable ? 'pointer' : 'default',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  whiteSpace: 'nowrap'
                }}
              >
                {column.label}
                {getSortIndicator(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedAlbums.map((album) => (
            <tr
              key={album.id}
              style={{
                cursor: 'pointer',
                backgroundColor: selectedAlbums.has(String(album.id)) ? '#eff6ff' : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (!selectedAlbums.has(String(album.id))) {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (!selectedAlbums.has(String(album.id))) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {columnDefs.map((column) => (
                <td
                  key={column.id}
                  style={{
                    padding: '6px',
                    textAlign: column.align || 'left',
                    fontSize: '12px',
                    borderRight: '1px solid #f3f4f6',
                    borderBottom: '1px solid #f3f4f6',
                    whiteSpace: column.id === 'title' || column.id === 'notes' ? 'normal' : 'nowrap',
                    overflow: column.id === 'title' || column.id === 'notes' ? 'visible' : 'hidden',
                    textOverflow: column.id === 'title' || column.id === 'notes' ? 'clip' : 'ellipsis'
                  }}
                >
                  {renderCellContent(album, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}