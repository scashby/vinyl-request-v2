// src/components/CollectionTable.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Album } from '../types/album';
import { ColumnId } from '../app/edit-collection/columnDefinitions';

interface CollectionTableProps {
  albums: Album[];
  visibleColumns: ColumnId[];
  onAlbumClick: (albumId: number) => void;
  onSellClick: (album: Album) => void;
  selectedAlbumId: number | null;
}

type SortField = 'artist' | 'title' | 'year' | 'format' | 'date_added';
type SortDirection = 'asc' | 'desc';

export default function CollectionTable({ 
  albums, 
  visibleColumns,
  onAlbumClick, 
  selectedAlbumId 
}: CollectionTableProps) {
  const [sortField, setSortField] = useState<SortField>('artist');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedAlbums = [...albums].sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';

    switch (sortField) {
      case 'artist':
        aVal = (a.artist || '').toLowerCase();
        bVal = (b.artist || '').toLowerCase();
        break;
      case 'title':
        aVal = (a.title || '').toLowerCase();
        bVal = (b.title || '').toLowerCase();
        break;
      case 'year':
        aVal = a.year_int || 0;
        bVal = b.year_int || 0;
        break;
      case 'format':
        aVal = (a.format || '').toLowerCase();
        bVal = (b.format || '').toLowerCase();
        break;
      case 'date_added':
        aVal = a.date_added || '';
        bVal = b.date_added || '';
        break;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  // Render header cell
  const renderHeaderCell = (columnId: ColumnId) => {
    const baseStyle = {
      padding: '12px 8px',
      textAlign: 'center' as const,
      fontWeight: 600,
      fontSize: 11,
      color: '#6b7280',
      borderBottom: '2px solid #e5e7eb'
    };

    const leftStyle = {
      ...baseStyle,
      textAlign: 'left' as const,
      padding: '12px 16px'
    };

    const sortableStyle = {
      ...leftStyle,
      cursor: 'pointer',
      userSelect: 'none' as const
    };

    switch (columnId) {
      case 'checkbox':
        return (
          <th key={columnId} style={{ ...baseStyle, width: 40 }}>
            <input type="checkbox" style={{ cursor: 'pointer' }} />
          </th>
        );
      case 'owned':
        return <th key={columnId} style={{ ...baseStyle, width: 40 }}>✓</th>;
      case 'for_sale':
        return <th key={columnId} style={{ ...baseStyle, width: 40 }}>$</th>;
      case 'image':
        return <th key={columnId} style={{ ...baseStyle, width: 60 }}></th>;
      case 'artist':
        return (
          <th key={columnId} onClick={() => handleSort('artist')} style={sortableStyle}>
            Artist{getSortIcon('artist')}
          </th>
        );
      case 'title':
        return (
          <th key={columnId} onClick={() => handleSort('title')} style={sortableStyle}>
            Title{getSortIcon('title')}
          </th>
        );
      case 'release_date':
        return <th key={columnId} style={leftStyle}>Release Date</th>;
      case 'format':
        return (
          <th key={columnId} onClick={() => handleSort('format')} style={sortableStyle}>
            Format{getSortIcon('format')}
          </th>
        );
      case 'discs':
        return <th key={columnId} style={{ ...baseStyle, width: 60 }}>Discs</th>;
      case 'tracks':
        return <th key={columnId} style={{ ...baseStyle, width: 70 }}>Tracks</th>;
      case 'length':
        return <th key={columnId} style={{ ...leftStyle, width: 80 }}>Length</th>;
      case 'genre':
        return <th key={columnId} style={{ ...leftStyle, width: 120 }}>Genre</th>;
      case 'label':
        return <th key={columnId} style={{ ...leftStyle, width: 140 }}>Label</th>;
      case 'added_date':
        return (
          <th key={columnId} onClick={() => handleSort('date_added')} style={{ ...sortableStyle, width: 120 }}>
            Added Date{getSortIcon('date_added')}
          </th>
        );
      default:
        return null;
    }
  };

  // Render data cell
  const renderDataCell = (columnId: ColumnId, album: Album) => {
    const baseCell = {
      padding: '8px',
      textAlign: 'center' as const,
      borderBottom: '1px solid #f3f4f6'
    };

    const leftCell = {
      padding: '12px 16px',
      borderBottom: '1px solid #f3f4f6'
    };

    switch (columnId) {
      case 'checkbox':
        return (
          <td key={columnId} style={baseCell}>
            <input 
              type="checkbox" 
              onClick={(e) => e.stopPropagation()}
              style={{ cursor: 'pointer' }}
            />
          </td>
        );
      
      case 'owned':
        return (
          <td key={columnId} style={baseCell}>
            <span style={{ color: '#10b981', fontSize: 16 }}>✓</span>
          </td>
        );
      
      case 'for_sale':
        return (
          <td key={columnId} style={baseCell}>
            {album.for_sale && (
              <span style={{ color: '#10b981', fontSize: 14 }}>$</span>
            )}
          </td>
        );
      
      case 'image':
        return (
          <td key={columnId} style={baseCell}>
            {album.image_url ? (
              <div style={{
                width: 40,
                height: 40,
                backgroundImage: `url(${album.image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: 2,
                border: '1px solid #e5e7eb'
              }} />
            ) : (
              <div style={{
                width: 40,
                height: 40,
                background: '#f3f4f6',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                fontSize: 18
              }}>
                🎵
              </div>
            )}
          </td>
        );
      
      case 'artist':
        return (
          <td key={columnId} style={leftCell}>
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
              {album.artist}
            </span>
          </td>
        );
      
      case 'title':
        return (
          <td key={columnId} style={leftCell}>
            <Link
              href={`/admin/edit-entry/${album.id}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                color: '#2563eb',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              {album.title}
            </Link>
          </td>
        );
      
      case 'release_date':
        return (
          <td key={columnId} style={leftCell}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {album.year || '—'}
            </span>
          </td>
        );
      
      case 'format':
        return (
          <td key={columnId} style={leftCell}>
            <span style={{ fontSize: 13, color: '#374151' }}>
              {album.format}
            </span>
          </td>
        );
      
      case 'discs':
        return (
          <td key={columnId} style={{ ...leftCell, textAlign: 'center' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {album.discs || '—'}
            </span>
          </td>
        );
      
      case 'tracks':
        return (
          <td key={columnId} style={{ ...leftCell, textAlign: 'center' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {album.spotify_total_tracks || album.apple_music_track_count || '—'}
            </span>
          </td>
        );
      
      case 'length':
        return (
          <td key={columnId} style={leftCell}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {album.length_seconds ? 
                `${Math.floor(album.length_seconds / 60)}:${String(album.length_seconds % 60).padStart(2, '0')}` 
                : '—'}
            </span>
          </td>
        );
      
      case 'genre':
        return (
          <td key={columnId} style={leftCell}>
            <span style={{ fontSize: 13, color: '#374151' }}>
              {album.discogs_genres && album.discogs_genres.length > 0 
                ? album.discogs_genres[0]
                : album.spotify_genres && album.spotify_genres.length > 0
                ? album.spotify_genres[0]
                : '—'}
            </span>
          </td>
        );
      
      case 'label':
        return (
          <td key={columnId} style={leftCell}>
            <span style={{ fontSize: 13, color: '#374151' }}>
              {album.spotify_label || album.apple_music_label || '—'}
            </span>
          </td>
        );
      
      case 'added_date':
        return (
          <td key={columnId} style={leftCell}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {album.date_added 
                ? new Date(album.date_added).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })
                : '—'}
            </span>
          </td>
        );
      
      default:
        return null;
    }
  };

  if (albums.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 14 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
        <div>No albums found</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', height: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 10 }}>
          <tr>
            {visibleColumns.map(col => renderHeaderCell(col))}
          </tr>
        </thead>
        <tbody>
          {sortedAlbums.map((album, index) => (
            <tr
              key={album.id}
              onClick={() => onAlbumClick(album.id)}
              style={{
                cursor: 'pointer',
                background: selectedAlbumId === album.id ? '#eff6ff' : index % 2 === 0 ? 'white' : '#fafafa',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => {
                if (selectedAlbumId !== album.id) {
                  e.currentTarget.style.background = '#f3f4f6';
                }
              }}
              onMouseLeave={e => {
                if (selectedAlbumId !== album.id) {
                  e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#fafafa';
                }
              }}
            >
              {visibleColumns.map(col => renderDataCell(col, album))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}