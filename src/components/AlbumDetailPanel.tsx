// src/components/AlbumDetailPanel.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

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

interface AlbumDetailPanelProps {
  album: Album;
  onClose: () => void;
  onEditTags: () => void;
  onMarkForSale: () => void;
}

type TabId = 'main' | 'details' | 'personal' | 'tags' | 'notes' | 'ids';

export default function AlbumDetailPanel({ album, onClose, onEditTags, onMarkForSale }: AlbumDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('main');

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'main', label: 'Main', icon: '📋' },
    { id: 'details', label: 'Details', icon: '🎵' },
    { id: 'personal', label: 'Personal', icon: '👤' },
    { id: 'tags', label: 'Tags', icon: '🏷️' },
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'ids', label: 'IDs', icon: '🔗' }
  ];

  const renderField = (label: string, value: string | number | null, linkUrl?: string) => {
    if (!value) return null;

    const displayValue = String(value);
    
    let content;
    if (linkUrl) {
      content = <a href={linkUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>{displayValue} →</a>;
    } else {
      content = <span>{displayValue}</span>;
    }

    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, color: '#1f2937' }}>
          {content}
        </div>
      </div>
    );
  };

  const renderArrayField = (label: string, values: string[] | null) => {
    if (!values || values.length === 0) return null;

    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
          {label}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {values.map((value, idx) => (
            <span key={idx} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, background: '#f3f4f6', color: '#374151', fontWeight: 500 }}>
              {value}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const getSidesCount = (sides: number | { count: number } | string[] | null): string | null => {
    if (!sides) return null;
    if (typeof sides === 'number') return String(sides);
    if (typeof sides === 'object' && !Array.isArray(sides) && 'count' in sides) return String(sides.count);
    if (Array.isArray(sides)) return String(sides.length);
    return null;
};

  return (
    <div style={{ width: 380, height: '100%', background: 'white', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Image src={album.image_url || '/images/placeholder.png'} alt={album.title} width={80} height={80} style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} unoptimized />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 'bold', color: '#1f2937', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {album.title}
          </h3>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 8px 0' }}>
            {album.artist}
          </p>
          <div style={{ display: 'flex', gap: 6, fontSize: 12, color: '#9ca3af' }}>
            {album.year && <span>{album.year}</span>}
            {album.format && <span>• {album.format}</span>}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#6b7280', cursor: 'pointer', padding: 4, lineHeight: 1, flexShrink: 0 }}>
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: '0 0 auto', padding: '12px 12px', border: 'none', background: activeTab === tab.id ? 'white' : 'transparent', color: activeTab === tab.id ? '#3b82f6' : '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 60 }}>
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {activeTab === 'main' && (
          <div>
            {renderField('Format', album.format)}
            {renderField('Folder', album.folder)}
            {renderField('Condition', album.media_condition)}
            {renderField('Sides', getSidesCount(album.sides))}
            {renderField('Decade', album.decade ? `${album.decade}s` : null)}
            {renderField('Date Added', album.date_added ? new Date(album.date_added).toLocaleDateString() : null)}
            
            {album.blocked_sides && album.blocked_sides.length > 0 && (
              <div style={{ marginTop: 16, padding: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
                  ⚠️ Blocked Sides
                </div>
                <div style={{ fontSize: 12, color: '#991b1b' }}>
                  {album.blocked_sides.join(', ')}
                </div>
              </div>
            )}

            {(album.for_sale || album.wholesale_cost) && (
              <div style={{ marginTop: 16, padding: 12, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginBottom: 8 }}>
                  💰 Sale Info
                </div>
                {album.for_sale && album.sale_price && renderField('Sale Price', `$${album.sale_price.toFixed(2)}`)}
                {album.sale_platform && renderField('Platform', album.sale_platform)}
                {album.wholesale_cost && renderField('Wholesale Cost', `$${album.wholesale_cost.toFixed(2)}`)}
                {album.sale_quantity && renderField('Quantity', album.sale_quantity)}
              </div>
            )}
          </div>
        )}

        {activeTab === 'details' && (
          <div>
            {renderField('Spotify Label', album.spotify_label)}
            {renderField('Apple Music Label', album.apple_music_label)}
            {renderField('Apple Genre', album.apple_music_genre)}
            {renderField('Spotify Popularity', album.spotify_popularity)}
            {renderArrayField('Discogs Genres', album.discogs_genres)}
            {renderArrayField('Discogs Styles', album.discogs_styles)}
            {renderArrayField('Spotify Genres', album.spotify_genres)}
            {renderArrayField('Apple Music Genres', album.apple_music_genres)}

            {(!album.spotify_label && !album.discogs_genres?.length && !album.spotify_genres?.length) && (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                No detailed metadata available
              </div>
            )}
          </div>
        )}

        {activeTab === 'personal' && (
          <div>
            {renderField('Purchase Date', album.purchase_date ? new Date(album.purchase_date).toLocaleDateString() : null)}
            {renderField('Purchase Store', album.purchase_store)}
            {album.purchase_price && renderField('Purchase Price', `$${album.purchase_price.toFixed(2)}`)}
            {album.current_value && renderField('Current Value', `$${album.current_value.toFixed(2)}`)}
            {renderField('Owner', album.owner)}
            {album.play_count !== null && renderField('Play Count', album.play_count)}
            {renderField('Last Cleaned', album.last_cleaned_date ? new Date(album.last_cleaned_date).toLocaleDateString() : null)}
            {renderArrayField('Signed By', album.signed_by)}

            {(!album.purchase_date && !album.purchase_store && !album.owner && !album.play_count) && (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
                No personal tracking info
              </div>
            )}
          </div>
        )}

        {activeTab === 'tags' && (
          <div>
            {album.custom_tags && album.custom_tags.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {album.custom_tags.map((tag, idx) => (
                  <span key={idx} style={{ fontSize: 13, padding: '8px 14px', borderRadius: 6, background: '#8b5cf6', color: 'white', fontWeight: 600 }}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏷️</div>
                No custom tags
              </div>
            )}

            <button onClick={onEditTags} style={{ marginTop: 16, width: '100%', padding: '10px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ✏️ Edit Tags
            </button>
          </div>
        )}

        {activeTab === 'notes' && (
          <div>
            {album.notes && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  General Notes
                </div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, padding: 12, background: '#f9fafb', borderRadius: 6, whiteSpace: 'pre-wrap' }}>
                  {album.notes}
                </div>
              </div>
            )}

            {album.discogs_notes && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  Discogs Notes
                </div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, padding: 12, background: '#f9fafb', borderRadius: 6, whiteSpace: 'pre-wrap' }}>
                  {album.discogs_notes}
                </div>
              </div>
            )}

            {album.sale_notes && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  Sale Notes
                </div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, padding: 12, background: '#f9fafb', borderRadius: 6, whiteSpace: 'pre-wrap' }}>
                  {album.sale_notes}
                </div>
              </div>
            )}

            {album.pricing_notes && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  Pricing Notes
                </div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, padding: 12, background: '#f9fafb', borderRadius: 6, whiteSpace: 'pre-wrap' }}>
                  {album.pricing_notes}
                </div>
              </div>
            )}

            {(!album.notes && !album.discogs_notes && !album.sale_notes && !album.pricing_notes) && (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                No notes available
              </div>
            )}
          </div>
        )}

        {activeTab === 'ids' && (
          <div>
            {renderField('Discogs Master ID', album.discogs_master_id, album.discogs_master_id ? `https://www.discogs.com/master/${album.discogs_master_id}` : undefined)}
            {renderField('Discogs Release ID', album.discogs_release_id, album.discogs_release_id ? `https://www.discogs.com/release/${album.discogs_release_id}` : undefined)}
            {renderField('Spotify ID', album.spotify_id, album.spotify_url || undefined)}
            {renderField('Apple Music ID', album.apple_music_id, album.apple_music_url || undefined)}

            {(!album.discogs_master_id && !album.discogs_release_id && !album.spotify_id && !album.apple_music_id) && (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔗</div>
                No external IDs available
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8 }}>
        <Link href={`/admin/edit-entry/${album.id}`} style={{ flex: 1, padding: '10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, textAlign: 'center', textDecoration: 'none', cursor: 'pointer' }}>
          ✏️ Edit Album
        </Link>
        {!album.for_sale && (
          <button onClick={onMarkForSale} style={{ flex: 1, padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            💰 Sell
          </button>
        )}
      </div>
    </div>
  );
}