// src/components/CollectionTable.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ColumnId } from '../lib/collection-columns';

type Album = {
  id: number;
  artist: string;
  title: string;
  year: string | null;
  format: string;
  image_url: string | null;
  folder: string;
  media_condition: string;
  for_sale: boolean;
  sale_price: number | null;
  sale_platform: string | null;
  custom_tags: string[] | null;
  discogs_genres: string[] | null;
  discogs_styles: string[] | null;
  spotify_genres: string[] | null;
  apple_music_genres: string[] | null;
  spotify_label: string | null;
  apple_music_label: string | null;
  apple_music_genre: string | null;
  decade: number | null;
  tracklists: string | null;
  discogs_source: string | null;
  discogs_notes: string | null;
  sale_notes: string | null;
  pricing_notes: string | null;
  notes: string | null;
  is_1001: boolean;
  steves_top_200: boolean;
  this_weeks_top_10: boolean;
  inner_circle_preferred: boolean;
  discogs_master_id: string | null;
  discogs_release_id: string | null;
  master_release_id: string | null;
  spotify_id: string | null;
  apple_music_id: string | null;
  sides: number | { count: number } | string[] | null;
  is_box_set: boolean;
  parent_id: string | null;
  blocked: boolean;
  blocked_sides: string[] | null;
  child_album_ids: number[] | null;
  sell_price: string | null;
  date_added: string | null;
  master_release_date: string | null;
  spotify_url: string | null;
  spotify_popularity: number | null;
  spotify_release_date: string | null;
  spotify_total_tracks: number | null;
  spotify_image_url: string | null;
  apple_music_url: string | null;
  apple_music_release_date: string | null;
  apple_music_track_count: number | null;
  apple_music_artwork_url: string | null;
  last_enriched_at: string | null;
  enrichment_sources: string | null;
  artist_norm: string | null;
  album_norm: string | null;
  artist_album_norm: string | null;
  year_int: number | null;
  sale_quantity: number | null;
  wholesale_cost: number | null;
  discogs_price_min: number | null;
  discogs_price_median: number | null;
  discogs_price_max: number | null;
  discogs_price_updated_at: string | null;
  purchase_date: string | null;
  purchase_store: string | null;
  purchase_price: number | null;
  current_value: number | null;
  owner: string | null;
  last_cleaned_date: string | null;
  signed_by: string[] | null;
  play_count: number | null;
};

interface CollectionTableProps {
  albums: Album[];
  visibleColumns: ColumnId[];
  onAlbumClick: (albumId: number) => void;
  onSellClick: (album: Album) => void;
  selectedAlbumId: number | null;
}

type SortConfig = {
  key: ColumnId | null;
  direction: 'asc' | 'desc';
};

export default function CollectionTable({ albums, visibleColumns, onAlbumClick, onSellClick, selectedAlbumId }: CollectionTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });

  const handleSort = (columnId: ColumnId) => {
    setSortConfig(prev => ({
      key: columnId,
      direction: prev.key === columnId && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortableValue = (album: Album, columnId: ColumnId): string | number => {
    const value = album[columnId as keyof Album];
    
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (Array.isArray(value)) return value.length;
    return String(value);
  };

  const sortedAlbums = [...albums].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const aVal = getSortableValue(a, sortConfig.key);
    const bVal = getSortableValue(b, sortConfig.key);

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const getSidesDisplay = (sides: number | { count: number } | string[] | null): string => {
    if (!sides) return '—';
    if (typeof sides === 'number') return String(sides);
    if (typeof sides === 'object' && !Array.isArray(sides) && 'count' in sides) return String(sides.count);
    if (Array.isArray(sides)) return String(sides.length);
    return '—';
  };

  const renderCell = (album: Album, columnId: ColumnId) => {
    const value = album[columnId as keyof Album];

    switch (columnId) {
      case 'custom_tags':
        if (!album.custom_tags || album.custom_tags.length === 0) return <span style={{ color: '#9ca3af' }}>—</span>;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {album.custom_tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#8b5cf6', color: 'white', fontWeight: 600 }}>
                {tag}
              </span>
            ))}
            {album.custom_tags.length > 3 && (
              <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>+{album.custom_tags.length - 3}</span>
            )}
          </div>
        );

      case 'discogs_genres':
      case 'discogs_styles':
      case 'spotify_genres':
      case 'apple_music_genres':
      case 'signed_by':
        const arr = value as string[] | null;
        if (!arr || arr.length === 0) return <span style={{ color: '#9ca3af' }}>—</span>;
        return (
          <span style={{ fontSize: 13, color: '#374151' }}>
            {arr.slice(0, 2).join(', ')}
            {arr.length > 2 && <span style={{ color: '#6b7280' }}> +{arr.length - 2}</span>}
          </span>
        );

      case 'for_sale':
      case 'is_1001':
      case 'steves_top_200':
      case 'this_weeks_top_10':
      case 'inner_circle_preferred':
      case 'is_box_set':
      case 'blocked':
        return (
          <span style={{ fontSize: 16, color: value ? '#10b981' : '#d1d5db' }}>
            {value ? '✓' : '—'}
          </span>
        );

      case 'sale_price':
      case 'purchase_price':
      case 'current_value':
      case 'wholesale_cost':
      case 'discogs_price_min':
      case 'discogs_price_median':
      case 'discogs_price_max':
        const price = value as number | null;
        if (!price) return <span style={{ color: '#9ca3af' }}>—</span>;
        return <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>${price.toFixed(2)}</span>;

      case 'date_added':
      case 'purchase_date':
      case 'last_cleaned_date':
      case 'master_release_date':
      case 'spotify_release_date':
      case 'apple_music_release_date':
      case 'last_enriched_at':
      case 'discogs_price_updated_at':
        if (!value) return <span style={{ color: '#9ca3af' }}>—</span>;
        return <span style={{ fontSize: 13, color: '#374151' }}>{new Date(value as string).toLocaleDateString()}</span>;

      case 'media_condition':
        const condition = value as string | null;
        if (!condition) return <span style={{ color: '#9ca3af' }}>—</span>;
        const isMint = condition.includes('M') || condition.includes('NM');
        return <span style={{ fontSize: 13, color: isMint ? '#10b981' : '#374151', fontWeight: isMint ? 600 : 400 }}>{condition}</span>;

      case 'sides':
        return <span style={{ fontSize: 13, color: '#374151' }}>{getSidesDisplay(album.sides)}</span>;

      case 'decade':
        if (!album.decade) return <span style={{ color: '#9ca3af' }}>—</span>;
        return <span style={{ fontSize: 13, color: '#374151' }}>{album.decade}s</span>;

      case 'play_count':
      case 'spotify_popularity':
      case 'spotify_total_tracks':
      case 'apple_music_track_count':
      case 'sale_quantity':
      case 'year_int':
        if (value === null || value === undefined) return <span style={{ color: '#9ca3af' }}>—</span>;
        return <span style={{ fontSize: 13, color: '#374151' }}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>;

      default:
        if (value === null || value === undefined || value === '') return <span style={{ color: '#9ca3af' }}>—</span>;
        return <span style={{ fontSize: 13, color: '#374151' }}>{String(value)}</span>;
    }
  };

  if (albums.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
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
            {visibleColumns.map(columnId => (
              <th
                key={columnId}
                onClick={() => handleSort(columnId)}
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: 12,
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{columnId.replace(/_/g, ' ')}</span>
                  {sortConfig.key === columnId && (
                    <span style={{ fontSize: 10 }}>
                      {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </div>
              </th>
            ))}
            <th style={{
              padding: '12px 16px',
              textAlign: 'left',
              fontWeight: 600,
              fontSize: 12,
              color: '#374151',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              borderBottom: '2px solid #e5e7eb',
              position: 'sticky',
              right: 0,
              background: '#f9fafb',
              whiteSpace: 'nowrap'
            }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedAlbums.map(album => (
            <tr
              key={album.id}
              onClick={() => onAlbumClick(album.id)}
              style={{
                cursor: 'pointer',
                background: selectedAlbumId === album.id ? '#eff6ff' : album.id % 2 === 0 ? 'white' : '#fafafa',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => {
                if (selectedAlbumId !== album.id) {
                  e.currentTarget.style.background = '#f3f4f6';
                }
              }}
              onMouseLeave={e => {
                if (selectedAlbumId !== album.id) {
                  e.currentTarget.style.background = album.id % 2 === 0 ? 'white' : '#fafafa';
                }
              }}
            >
              {visibleColumns.map(columnId => (
                <td
                  key={columnId}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f3f4f6',
                    verticalAlign: 'middle'
                  }}
                >
                  {renderCell(album, columnId)}
                </td>
              ))}
              <td style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f3f4f6',
                verticalAlign: 'middle',
                position: 'sticky',
                right: 0,
                background: selectedAlbumId === album.id ? '#eff6ff' : album.id % 2 === 0 ? 'white' : '#fafafa'
              }}>
                <div style={{ display: 'flex', gap: 8, whiteSpace: 'nowrap' }}>
                  <Link
                    href={`/admin/edit-entry/${album.id}`}
                    onClick={e => e.stopPropagation()}
                    style={{
                      padding: '6px 12px',
                      background: '#3b82f6',
                      color: 'white',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-block'
                    }}
                  >
                    Edit
                  </Link>
                  {!album.for_sale && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onSellClick(album);
                      }}
                      style={{
                        padding: '6px 12px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      💰
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}