// src/app/edit-collection/components/CollectionInfoPanel.tsx
'use client';

import { memo, useState } from 'react';
import Image from 'next/image';
import { Album, toSafeStringArray } from '../../../types/album';

interface CollectionInfoPanelProps {
  album: Album | null;
  onClose?: () => void;
  onEditTags?: () => void;
  onMarkForSale?: () => void;
}

const CollectionInfoPanel = memo(function CollectionInfoPanel({ album, onClose, onEditTags, onMarkForSale }: CollectionInfoPanelProps) {
  const [imageIndex, setImageIndex] = useState(0);

  if (!album) {
    return <div className="py-20 text-center text-gray-400 text-sm italic">Select an album to view details</div>;
  }

  const getDiscRuntime = (discNumber: number): string => {
    if (!album.tracks) return '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const discTracks = (album.tracks as any[]).filter((t: any) => t.disc_number === discNumber && t.type !== 'header');
    let totalSeconds = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discTracks.forEach((track: any) => {
      if (track.duration) {
        const parts = track.duration.split(':');
        if (parts.length === 2) {
          totalSeconds += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
      }
    });
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTotalRuntime = (): string => {
    if (!album.tracks || (album.tracks as unknown[]).length === 0) {
      if (album.length_seconds) {
        const minutes = Math.floor(album.length_seconds / 60);
        const seconds = album.length_seconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      return '—';
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allTracks = (album.tracks as any[]).filter((t: any) => t.type === 'track');
    let totalSeconds = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allTracks.forEach((track: any) => {
      if (track.duration) {
        const parts = track.duration.split(':');
        if (parts.length === 2) {
          totalSeconds += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
      }
    });
    
    if (totalSeconds === 0) return '—';
    
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
             date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch {
      return dateStr;
    }
  };

  const getEbayUrl = (): string => {
    const query = `${album.artist} ${album.title}`.replace(/\s+/g, '+');
    return `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Sold=1&LH_Complete=1`;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalTracks = (album.tracks as any[])?.filter((t: any) => t.type === 'track').length || album.spotify_total_tracks || album.apple_music_track_count || 0;
  const totalRuntime = getTotalRuntime();

  // Combine canonical genres and styles for display
  const displayGenres = Array.from(new Set([
    ...toSafeStringArray(album.genres || []),
    ...toSafeStringArray(album.styles || [])
  ]));

  return (
    <div className="p-4 flex-1 overflow-y-auto bg-gradient-to-br from-[#f5f7fa] to-[#c3cfe2]">
      {/* Mobile Close Button */}
      {onClose && (
        <div className="lg:hidden flex justify-end mb-2">
            <button onClick={onClose} className="text-gray-500 font-bold text-xl">✕</button>
        </div>
      )}

      <div className="text-sm text-gray-800 mb-1 font-normal">{album.artist}</div>
      <div className="flex items-center gap-2 mb-4">
        <h4 className="text-[#2196F3] m-0 text-lg font-semibold">{album.title}</h4>
        <div className="bg-[#2196F3] text-white rounded px-1.5 py-0.5 text-xs flex items-center justify-center font-bold" title="Album owned">✓</div>
      </div>

      <div className="relative mb-4 group">
        {(imageIndex === 0 ? album.image_url : album.back_image_url) ? (
          <Image 
            src={(imageIndex === 0 ? album.image_url : album.back_image_url) || ''} 
            alt={`${album.artist} - ${album.title} ${imageIndex === 0 ? 'front' : 'back'}`}
            width={400}
            height={400}
            className="w-full h-auto aspect-square object-cover border border-gray-300 rounded shadow-sm"
            unoptimized
          />
        ) : (
          <div className="w-full aspect-square bg-white flex items-center justify-center text-gray-300 text-5xl border border-gray-200 rounded">🎵</div>
        )}
        
        {album.back_image_url && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            <div className={`w-2 h-2 rounded-full cursor-pointer ${imageIndex === 0 ? 'bg-[#333]' : 'bg-[#999]'}`} onClick={() => setImageIndex(0)} />
            <div className={`w-2 h-2 rounded-full cursor-pointer ${imageIndex === 1 ? 'bg-[#333]' : 'bg-[#999]'}`} onClick={() => setImageIndex(1)} />
          </div>
        )}
      </div>

      <div className="text-sm font-normal text-[#333] mb-2">
        {(album.labels && album.labels.length > 0 ? album.labels.join(', ') : (album.spotify_label || album.apple_music_label)) || 'Unknown Label'} 
        {album.year && ` (${album.year})`}
      </div>

      {displayGenres.length > 0 && (
        <div className="text-[13px] text-[#666] mb-3 font-normal">
          {displayGenres.join(' | ')}
        </div>
      )}

      <div className="text-xs text-[#333] mb-2 font-mono font-normal">||||| {album.barcode || '—'}</div>
      <div className="text-[13px] text-[#333] mb-2 font-normal">{album.country || '—'}</div>
      <div className="text-[13px] text-[#333] mb-3 font-normal">
        {album.format || '—'}
        {' | '}{album.discs ? `${album.discs} Disc${album.discs > 1 ? 's' : ''}` : '—'}
        {' | '}{totalTracks > 0 ? `${totalTracks} Tracks` : '—'}
        {' | '}{totalRuntime}
      </div>

      <div className="text-[13px] text-[#333] mb-3 font-normal">
         <span className="font-semibold">Location:</span> {album.location || 'Unknown'}
      </div>

      <div className="text-[13px] text-[#666] mb-3 font-normal">
        <span className="font-semibold">CAT NO</span> {album.cat_no || '—'}
      </div>

      <a href={getEbayUrl()} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#2196F3] mb-4 block no-underline font-normal hover:underline">
        Find solid listings on eBay
      </a>

      {(() => {
        if (!album.tracks || (album.tracks as unknown[]).length === 0) return null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const discMap = new Map<number, any[]>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (album.tracks as any[]).forEach((track: any) => {
          if (!discMap.has(track.disc_number)) {
            discMap.set(track.disc_number, []);
          }
          discMap.get(track.disc_number)!.push(track);
        });

        discMap.forEach(tracks => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tracks.sort((a: any, b: any) => parseInt(a.position) - parseInt(b.position));
        });

        const sortedDiscs = Array.from(discMap.entries()).sort(([a], [b]) => a - b);

        return (
          <div className="mb-4">
            {sortedDiscs.map(([discNumber, tracks]) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const discMeta = (album.disc_metadata as any[])?.find((d: any) => d.disc_number === discNumber);
              const discTitle = discMeta?.title || `Disc #${discNumber}`;
              const runtime = getDiscRuntime(discNumber);

              return (
                <div key={discNumber} className="mb-4">
                  <div className="text-xs font-bold text-white mb-1.5 p-2 px-3 bg-[#2196F3] rounded flex justify-between items-center shadow-sm uppercase tracking-wider">
                    <span>{discTitle}</span>
                    {runtime && <span className="font-mono">{runtime}</span>}
                  </div>
                  <div className="flex flex-col gap-px">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {tracks.map((track: any, idx: number) => {
                      if (track.type === 'header') {
                        return (
                          <div key={idx} className={`text-[11px] font-semibold text-gray-500 px-2 py-1.5 bg-gray-100 ${idx > 0 ? 'mt-1' : ''}`}>
                            {track.title}
                          </div>
                        );
                      }

                      return (
                        <div key={idx} className={`flex items-center px-2 py-1.5 text-[13px] font-normal ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <div className="min-w-[28px] text-gray-500 text-[13px]">{track.position}</div>
                          <div className="flex-1 text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap pr-2">{track.title}</div>
                          {track.duration && <div className="text-gray-500 text-[13px] min-w-[40px] text-right">{track.duration}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      <div className="mb-4">
        <div className="text-base font-bold text-[#2196F3] mb-3">Details</div>
        <div className="bg-white p-3 rounded">
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[180px]">Release Date</span>
            <span>{album.year || '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[180px]">Original Release Date</span>
            <span>{album.original_release_date ? formatDate(album.original_release_date) : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[180px]">Package/Sleeve Condition</span>
            <span>{album.package_sleeve_condition || '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[180px]">Media Condition</span>
            <span>{album.media_condition || '—'}</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-base font-bold text-[#2196F3] mb-3">Personal</div>
        <div className="bg-white p-3 rounded">
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Quantity</span>
            <span>1</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Index</span>
            <span>{album.index_number || '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Purchase Date</span>
            <span>{album.purchase_date ? formatDate(album.purchase_date) : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Purchase Store</span>
            <span>{album.purchase_store || '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Purchase Price</span>
            <span>{album.purchase_price ? `$${album.purchase_price.toFixed(2)}` : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Current Value</span>
            <span>{album.current_value ? `$${album.current_value.toFixed(2)}` : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Owner</span>
            <span>{album.owner || '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">My Rating</span>
            <div className="flex-1">
              {album.my_rating ? (
                <div className="flex gap-0.5 items-center">
                  {Array.from({ length: album.my_rating }).map((_, i) => (
                    <span key={i} className="text-yellow-400 text-sm">★</span>
                  ))}
                  {Array.from({ length: 10 - album.my_rating }).map((_, i) => (
                    <span key={i} className="text-gray-300 text-sm">★</span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Last Cleaned</span>
            <span>{album.last_cleaned_date ? formatDate(album.last_cleaned_date) : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Signed By</span>
            <span>
              {album.signed_by && Array.isArray(album.signed_by) && album.signed_by.length > 0 
                ? album.signed_by.join(', ') 
                : '—'}
            </span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Added Date</span>
            <span>{album.date_added ? formatDateTime(album.date_added) : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Modified Date</span>
            <span>{album.modified_date ? formatDateTime(album.modified_date) : '—'}</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-base font-bold text-[#2196F3] mb-3">Notes</div>
        <div className="text-[13px] text-gray-800 leading-relaxed bg-white p-3 rounded font-normal min-h-[40px]">{album.notes || '—'}</div>
      </div>

      <div>
        <div className="text-base font-bold text-[#2196F3] mb-3">Tags</div>
        {album.custom_tags && album.custom_tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {toSafeStringArray(album.custom_tags).map((tag) => (
              <span key={tag} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-full text-[13px] font-normal">{tag}</span>
            ))}
          </div>
        ) : (
          <div className="text-[13px] text-gray-400 font-normal">No tags</div>
        )}
      </div>
      
      {/* Edit/Sell Buttons from previous page.tsx */}
      <div className="p-4 border-t border-gray-200 flex gap-2">
        <button 
           onClick={onEditTags} // Using onEditTags as proxy for "Edit Album"
           className="flex-1 p-2.5 bg-blue-500 text-white border-none rounded-md text-[13px] font-semibold text-center no-underline cursor-pointer hover:bg-blue-600"
        >
          ✏️ Edit Album
        </button>
        {!album.for_sale && (
          <button 
            onClick={onMarkForSale} 
            className="flex-1 p-2.5 bg-emerald-500 text-white border-none rounded-md text-[13px] font-semibold cursor-pointer hover:bg-emerald-600"
          >
            💰 Sell
          </button>
        )}
      </div>
    </div>
  );
});

export default CollectionInfoPanel;