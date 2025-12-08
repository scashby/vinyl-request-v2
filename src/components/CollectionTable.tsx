// src/components/CollectionTable.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { Album } from '../types/album';
import { 
  ColumnId, 
  getVisibleColumns 
} from '../app/edit-collection/columnDefinitions';

interface CollectionTableProps {
  albums: Album[];
  onAlbumClick: (album: Album) => void;
  selectedAlbums: Set<string>;
  onSelectionChange: (albumIds: Set<string>) => void;
  visibleColumns: ColumnId[];
}

export default function CollectionTable({
  albums,
  onAlbumClick,
  selectedAlbums,
  onSelectionChange,
  visibleColumns
}: CollectionTableProps) {
  
  const columns = getVisibleColumns(visibleColumns);

  const handleSelectAlbum = (albumId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newSelected = new Set(selectedAlbums);
    if (e.target.checked) {
      newSelected.add(albumId);
    } else {
      newSelected.delete(albumId);
    }
    onSelectionChange(newSelected);
  };

  const getCellValue = (album: Album, columnId: ColumnId): React.ReactNode => {
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
      case 'image':
        return album.image_url ? (
          <Image 
            src={album.image_url} 
            alt="" 
            width={50}
            height={50}
            style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '2px' }}
          />
        ) : (
          <div style={{ width: '50px', height: '50px', background: '#f0f0f0', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            🎵
          </div>
        );
      case 'artist': return album.artist || '';
      case 'title': return album.title || '';
      case 'year': return album.year || '';
      case 'master_release': return album.master_release_date || '—';
      case 'format': return album.format || '';
      case 'discs': return album.discs ? String(album.discs) : '—';
      case 'tracks': return album.spotify_total_tracks ? String(album.spotify_total_tracks) : album.apple_music_track_count ? String(album.apple_music_track_count) : '—';
      case 'length': return '—';
      case 'genres': return album.discogs_genres || album.spotify_genres || '—';
      case 'label': return album.spotify_label || album.apple_music_label || '—';
      case 'added_date': return album.date_added ? new Date(album.date_added).toLocaleDateString() : '—';
      case 'catalog_number': return '—';
      case 'barcode': return album.barcode || '—';
      case 'media_condition': return album.media_condition || '—';
      case 'sleeve_condition': return '—';
      case 'country': return album.country || '—';
      case 'released': return album.year || '—';
      case 'spotify_popularity': return album.spotify_popularity ? String(album.spotify_popularity) : '—';
      case 'apple_music_popularity': return '—';
      case 'tags': return album.custom_tags && Array.isArray(album.custom_tags) ? album.custom_tags.join(', ') : '—';
      case 'notes': return album.notes || '—';
      case 'location': return album.folder || '—';
      case 'purchase_price': return album.purchase_price ? `$${album.purchase_price}` : '—';
      case 'current_value': return '—';
      case 'sale_price': return album.sale_price ? `$${album.sale_price}` : '—';
      case 'for_sale': return album.for_sale ? 'Yes' : 'No';
      default: return '—';
    }
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
                style={{
                  padding: '12px 8px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#495057',
                  borderBottom: '2px solid #dee2e6',
                  whiteSpace: 'nowrap',
                  minWidth: col.width,
                  width: col.width
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {albums.map((album, index) => (
            <tr
              key={album.id}
              onClick={() => onAlbumClick(album)}
              style={{
                cursor: 'pointer',
                backgroundColor: selectedAlbums.has(String(album.id)) ? '#eff6ff' : index % 2 === 0 ? 'white' : '#f8f9fa',
                borderBottom: '1px solid #e9ecef'
              }}
              onMouseEnter={(e) => {
                if (!selectedAlbums.has(String(album.id))) {
                  e.currentTarget.style.backgroundColor = '#f1f3f5';
                }
              }}
              onMouseLeave={(e) => {
                if (!selectedAlbums.has(String(album.id))) {
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
          ))}
        </tbody>
      </table>
    </div>
  );
}