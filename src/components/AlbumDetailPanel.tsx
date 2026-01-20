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
  // ENRICHMENT FIELDS
  enrichment_summary: Record<string, string> | null;
  musicians: string[] | null;
  producers: string[] | null;
  companies: string[] | null;
  tempo_bpm: number | null;
  musical_key: string | null;
  energy: number | null;
  danceability: number | null;
  mood_acoustic: number | null;
  mood_happy: number | null;
  mood_sad: number | null;
  mood_party: number | null;
  mood_relaxed: number | null;
  mood_aggressive: number | null;
  mood_electronic: number | null;
  engineers: string[] | null;
};

interface AlbumDetailPanelProps {
  album: Album;
  onClose: () => void;
  onEditTags: () => void;
  onMarkForSale: () => void;
}

type TabId = 'main' | 'details' | 'enrichment' | 'personal' | 'tags' | 'notes' | 'ids';

export default function AlbumDetailPanel({ album, onClose, onEditTags, onMarkForSale }: AlbumDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('main');

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'main', label: 'Main', icon: '📋' },
    { id: 'details', label: 'Details', icon: '🎵' },
    { id: 'enrichment', label: 'Enrichment', icon: '⚡' },
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
      content = <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 no-underline font-medium hover:underline">{displayValue} →</a>;
    } else {
      content = <span>{displayValue}</span>;
    }

    return (
      <div className="mb-3">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.5px] mb-1">
          {label}
        </div>
        <div className="text-sm text-gray-800">
          {content}
        </div>
      </div>
    );
  };

  const renderArrayField = (label: string, values: string[] | null) => {
    if (!values || values.length === 0) return null;

    return (
      <div className="mb-3">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.5px] mb-1.5">
          {label}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {values.map((value, idx) => (
            <span key={idx} className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-700 font-medium">
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
    <div className="w-full md:w-[380px] h-full bg-white border-l border-gray-200 flex flex-col shrink-0">
      <div className="p-4 border-b border-gray-200 flex items-start gap-3">
        <Image src={album.image_url || '/images/coverplaceholder.png'} alt={album.title} width={80} height={80} className="rounded-md object-cover shrink-0" unoptimized />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-800 m-0 mb-1 line-clamp-2">
            {album.title}
          </h3>
          <p className="text-sm text-gray-500 m-0 mb-2">
            {album.artist}
          </p>
          <div className="flex gap-1.5 text-xs text-gray-400">
            {album.year && <span>{album.year}</span>}
            {album.format && <span>• {album.format}</span>}
          </div>
        </div>
        <button onClick={onClose} className="bg-transparent border-none text-xl text-gray-500 cursor-pointer p-1 leading-none shrink-0 hover:text-gray-700">
          ✕
        </button>
      </div>

      <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
        {tabs.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            className={`flex-none px-3 py-3 border-b-2 text-[11px] font-semibold cursor-pointer flex flex-col items-center gap-1 min-w-[60px] transition-all duration-200 ${
              activeTab === tab.id ? 'bg-white text-blue-500 border-blue-500' : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-100'
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'main' && (
          <div>
            {renderField('Format', album.format)}
            {renderField('Folder', album.folder)}
            {renderField('Condition', album.media_condition)}
            {renderField('Sides', getSidesCount(album.sides))}
            {renderField('Decade', album.decade ? `${album.decade}s` : null)}
            {renderField('Date Added', album.date_added ? new Date(album.date_added).toLocaleDateString() : null)}
            
            {album.blocked_sides && album.blocked_sides.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="text-xs font-semibold text-red-600 mb-1">
                  ⚠️ Blocked Sides
                </div>
                <div className="text-xs text-red-800">
                  {album.blocked_sides.join(', ')}
                </div>
              </div>
            )}

            {(album.for_sale || album.wholesale_cost) && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="text-xs font-semibold text-green-600 mb-2">
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
              <div className="p-5 text-center text-gray-400 text-[13px]">
                <div className="text-[32px] mb-2">📋</div>
                No detailed metadata available
              </div>
            )}
          </div>
        )}

        {activeTab === 'enrichment' && (
          <div className="flex flex-col gap-6">
            
            {/* 1. EXTERNAL FACTS */}
            {album.enrichment_summary && Object.keys(album.enrichment_summary).length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  External Facts
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-col gap-2">
                  {Object.entries(album.enrichment_summary).map(([source, text], idx) => (
                    <div key={idx} className="text-sm text-gray-800 border-b last:border-0 border-gray-200 pb-2 last:pb-0">
                      <span className="font-semibold text-gray-600 capitalize mr-1">
                        {source.replace(/_/g, ' ')}:
                      </span>
                      {text.includes('http') ? (
                        <span>
                          {text.split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
                            part.match(/^https?:\/\//) ? (
                              <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {part.includes('whosampled') ? 'WhoSampled' : 
                                 part.includes('secondhandsongs') ? 'SecondHandSongs' :
                                 part.includes('setlist') ? 'Setlist.fm' : 
                                 'Link'} →
                              </a>
                            ) : part
                          )}
                        </span>
                      ) : (
                        <span>{text}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. SONIC DNA */}
            {(album.tempo_bpm || album.musical_key || album.energy) && (
              <div>
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Sonic DNA
                </div>
                <div className="flex gap-3 mb-4">
                  {album.tempo_bpm && (
                    <div className="px-3 py-1.5 bg-gray-100 rounded-full text-xs font-semibold text-gray-700 border border-gray-200">
                      ⏱ {album.tempo_bpm} BPM
                    </div>
                  )}
                  {album.musical_key && (
                    <div className="px-3 py-1.5 bg-gray-100 rounded-full text-xs font-semibold text-gray-700 border border-gray-200">
                      🎹 {album.musical_key}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {[
                    { label: 'Energy', val: album.energy, color: 'bg-orange-500' },
                    { label: 'Danceability', val: album.danceability, color: 'bg-purple-500' },
                  ].map(feat => (
                    typeof feat.val === 'number' && (
                      <div key={feat.label} className="flex items-center gap-2 text-xs">
                        <div className="w-20 text-gray-500 font-medium">{feat.label}</div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${feat.color}`} 
                            style={{ width: `${feat.val * 100}%` }} 
                          />
                        </div>
                        <div className="w-8 text-right font-mono text-gray-500">
                          {Math.round(feat.val * 100)}%
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* 3. CREDITS (SIMPLE TEXT LISTS) */}
            {(album.musicians?.length || album.producers?.length || album.engineers?.length) && (
              <div>
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Credits
                </div>
                <div className="flex flex-col gap-3">
                  {album.musicians && album.musicians.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Musicians</div>
                      <div className="text-sm text-gray-800 leading-snug">{album.musicians.join(', ')}</div>
                    </div>
                  )}
                  {album.producers && album.producers.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Producers</div>
                      <div className="text-sm text-gray-800 leading-snug">{album.producers.join(', ')}</div>
                    </div>
                  )}
                  {album.engineers && album.engineers.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Engineers</div>
                      <div className="text-sm text-gray-800 leading-snug">{album.engineers.join(', ')}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Fallback */}
            {!album.enrichment_summary && !album.tempo_bpm && !album.musicians && (
              <div className="p-5 text-center text-gray-400 text-[13px]">
                <div className="text-[32px] mb-2">⚡</div>
                No enrichment data found.
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
              <div className="p-5 text-center text-gray-400 text-[13px]">
                <div className="text-[32px] mb-2">👤</div>
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

            <button onClick={onEditTags} className="mt-4 w-full p-2.5 bg-violet-500 text-white border-none rounded-md text-[13px] font-semibold cursor-pointer hover:bg-violet-600">
              ✏️ Edit Tags
            </button>
          </div>
        )}

        {activeTab === 'notes' && (
          <div>
            {album.notes && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.5px] mb-1.5">
                  General Notes
                </div>
                <div className="text-[13px] text-gray-700 leading-relaxed p-3 bg-gray-50 rounded-md whitespace-pre-wrap">
                  {album.notes}
                </div>
              </div>
            )}

            {album.discogs_notes && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.5px] mb-1.5">
                  Discogs Notes
                </div>
                <div className="text-[13px] text-gray-700 leading-relaxed p-3 bg-gray-50 rounded-md whitespace-pre-wrap">
                  {album.discogs_notes}
                </div>
              </div>
            )}

            {album.sale_notes && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.5px] mb-1.5">
                  Sale Notes
                </div>
                <div className="text-[13px] text-gray-700 leading-relaxed p-3 bg-gray-50 rounded-md whitespace-pre-wrap">
                  {album.sale_notes}
                </div>
              </div>
            )}

            {album.pricing_notes && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.5px] mb-1.5">
                  Pricing Notes
                </div>
                <div className="text-[13px] text-gray-700 leading-relaxed p-3 bg-gray-50 rounded-md whitespace-pre-wrap">
                  {album.pricing_notes}
                </div>
              </div>
            )}

            {(!album.notes && !album.discogs_notes && !album.sale_notes && !album.pricing_notes) && (
              <div className="p-5 text-center text-gray-400 text-[13px]">
                <div className="text-[32px] mb-2">📝</div>
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
              <div className="p-5 text-center text-gray-400 text-[13px]">
                <div className="text-[32px] mb-2">🔗</div>
                No external IDs available
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 flex gap-2">
        <Link href={`/admin/edit-entry/${album.id}`} className="flex-1 p-2.5 bg-blue-500 text-white border-none rounded-md text-[13px] font-semibold text-center no-underline cursor-pointer hover:bg-blue-600">
          ✏️ Edit Album
        </Link>
        {!album.for_sale && (
          <button onClick={onMarkForSale} className="flex-1 p-2.5 bg-emerald-500 text-white border-none rounded-md text-[13px] font-semibold cursor-pointer hover:bg-emerald-600">
            💰 Sell
          </button>
        )}
      </div>
    </div>
  );
}