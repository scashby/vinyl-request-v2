// src/components/AlbumDetailPanel.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Album } from '@/types/album';

interface AlbumDetailPanelProps {
  album: Album;
  onClose: () => void;
  onEditTags: () => void;
}

type TabId = 'main' | 'details' | 'enrichment' | 'personal' | 'tags' | 'notes' | 'ids';

export default function AlbumDetailPanel({ album, onClose, onEditTags }: AlbumDetailPanelProps) {
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

  const renderField = (label: string, value: string | number | null | undefined, linkUrl?: string) => {
    if (value === null || value === undefined || value === '') return null;

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

  const renderArrayField = (label: string, values: string[] | null | undefined) => {
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
            {renderField('Location', album.location)}
            {renderField('Condition', album.media_condition)}
            {renderField('Sleeve', album.sleeve_condition)}
            {renderField('Date Added', album.date_added ? new Date(album.date_added).toLocaleDateString() : null)}
            {renderField('Country', album.country)}

          </div>
        )}

        {activeTab === 'details' && (
          <div>
            {renderArrayField('Genres', album.genres)}
            {renderArrayField('Styles', album.styles)}
            {renderField('Catalog #', album.release?.catalog_number)}
            {renderField('Barcode', album.barcode)}
            {renderField('Country', album.country)}
          </div>
        )}

        {activeTab === 'enrichment' && (
          <div className="p-5 text-center text-gray-500 text-[13px]">
            <div className="text-[32px] mb-2">⚡</div>
            Use the Edit modal → Enrichment tab to pull Discogs metadata, tracklists, and cover art.
          </div>
        )}

        {activeTab === 'personal' && (
          <div>
            {renderField('Purchase Price', album.purchase_price ? `$${album.purchase_price.toFixed(2)}` : null)}
            {renderField('Current Value', album.current_value ? `$${album.current_value.toFixed(2)}` : null)}
            {renderField('Owner', album.owner)}
            
            {(!album.owner && !album.purchase_price) && (
              <div className="p-5 text-center text-gray-400 text-[13px]">
                <div className="text-[32px] mb-2">👤</div>
                No personal tracking info
              </div>
            )}
          </div>
        )}

        {activeTab === 'tags' && (
          <div>
            {album.release?.master?.master_tag_links && album.release?.master?.master_tag_links.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {album.release?.master?.master_tag_links
                  ?.map((link) => link.master_tags?.name)
                  .filter((name): name is string => Boolean(name))
                  .map((tag, idx) => (
                    <span key={`${tag}-${idx}`} style={{ fontSize: 13, padding: '8px 14px', borderRadius: 6, background: '#8b5cf6', color: 'white', fontWeight: 600 }}>
                      {tag}
                    </span>
                  ))}
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏷️</div>
                No tags
              </div>
            )}

            <button onClick={onEditTags} className="mt-4 w-full p-2.5 bg-violet-500 text-white border-none rounded-md text-[13px] font-semibold cursor-pointer hover:bg-violet-600">
              ✏️ Edit Tags
            </button>
          </div>
        )}

        {activeTab === 'notes' && (
          <div>
            {album.personal_notes && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.5px] mb-1.5">
                  Personal Notes
                </div>
                <div className="text-[13px] text-gray-700 leading-relaxed p-3 bg-gray-50 rounded-md whitespace-pre-wrap">
                  {album.personal_notes}
                </div>
              </div>
            )}

            {album.release_notes && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.5px] mb-1.5">
                  Release Notes
                </div>
                <div className="text-[13px] text-gray-700 leading-relaxed p-3 bg-gray-50 rounded-md whitespace-pre-wrap">
                  {album.release_notes}
                </div>
              </div>
            )}

            {(!album.personal_notes && !album.release_notes) && (
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
            {renderField('Spotify Album ID', album.spotify_album_id)}
            {renderField('MusicBrainz Release Group ID', album.release?.master?.musicbrainz_release_group_id)}

            {(!album.discogs_master_id && !album.discogs_release_id && !album.spotify_album_id && !album.release?.master?.musicbrainz_release_group_id) && (
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
      </div>
    </div>
  );
}
