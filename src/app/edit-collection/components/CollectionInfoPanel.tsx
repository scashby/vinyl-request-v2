// src/app/edit-collection/components/CollectionInfoPanel.tsx
'use client';

import { memo } from 'react';
import Image from 'next/image';
import type { Album } from '../../../types/album';
import { toSafeStringArray } from '../../../types/album';

interface CollectionInfoPanelProps {
  album: Album | null;
  onClose?: () => void;
}

const CollectionInfoPanel = memo(function CollectionInfoPanel({ album, onClose }: CollectionInfoPanelProps) {
  if (!album) {
    return <div className="py-20 text-center text-gray-400 text-sm italic">Select an album to view details</div>;
  }

  type ReleaseTrack = NonNullable<NonNullable<Album['release']>['release_tracks']>[number];

  const releaseTracks = album.release?.release_tracks ?? [];
  const fallbackTracks = album.tracks ?? [];

  const formatDuration = (totalSeconds: number | null): string => {
    if (!totalSeconds || totalSeconds <= 0) return '—';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const parseDurationToSeconds = (duration?: string | null): number => {
    if (!duration) return 0;
    const parts = duration.split(':').map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) return 0;
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const getTotalRuntime = (): string => {
    if (releaseTracks.length === 0 && fallbackTracks.length === 0) return '—';
    if (releaseTracks.length > 0) {
      const totalSeconds = releaseTracks.reduce((sum, track) => sum + (track.recording?.duration_seconds ?? 0), 0);
      return formatDuration(totalSeconds);
    }
    const totalSeconds = fallbackTracks.reduce((sum, track) => {
      return sum + parseDurationToSeconds(track.duration);
    }, 0);
    return formatDuration(totalSeconds);
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

  const buildFormatLabel = (): string => {
    if (!album.release) return '—';
    const parts = [album.release.media_type, ...(album.release.format_details ?? [])].filter(Boolean);
    const base = parts.join(', ');
    const qty = album.release.qty ?? 1;
    if (!base) return '—';
    return qty > 1 ? `${qty}x${base}` : base;
  };

  const artistName = album.artist ?? album.release?.master?.artist?.name ?? 'Unknown Artist';
  const albumTitle = album.title ?? album.release?.master?.title ?? 'Untitled';
  const coverImage = album.image_url ?? album.release?.master?.cover_image_url ?? null;
  const releaseYear = album.release?.release_year ?? album.release?.master?.original_release_year ?? null;
  const totalTracks = album.release?.track_count ?? (releaseTracks.length > 0 ? releaseTracks.length : fallbackTracks.length);
  const totalRuntime = getTotalRuntime();
  const notes = album.personal_notes ?? album.release?.notes ?? album.release?.master?.notes ?? album.master_notes ?? null;

  // Combine canonical genres and styles for display
  const displayGenres = Array.from(new Set([
    ...toSafeStringArray(album.release?.master?.genres ?? []),
    ...toSafeStringArray(album.release?.master?.styles ?? [])
  ]));

  const tagNames = Array.from(new Set(
    (album.release?.master?.master_tag_links ?? [])
      .map((link) => link.master_tags?.name ?? '')
      .filter(Boolean)
  ));

  const getEbayUrl = (): string => {
    const query = `${artistName} ${albumTitle}`.replace(/\s+/g, '+');
    return `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Sold=1&LH_Complete=1`;
  };

  const normalizeBarcodeDigits = (value?: string | null) => {
    if (!value) return null;
    const cleaned = value.replace(/[^0-9Xx]/g, '');
    if (!cleaned) return null;
    if (cleaned.length >= 13) return cleaned.slice(0, 13);
    return cleaned.padStart(13, '0');
  };

  const formatBarcodeDisplay = (value?: string | null) => {
    const digits = normalizeBarcodeDigits(value);
    if (!digits) return '—';
    if (digits.length === 13) {
      return `${digits[0]} ${digits.slice(1, 6)} ${digits.slice(6, 11)} ${digits.slice(11)}`;
    }
    return digits;
  };

  const getDiscNumber = (track: ReleaseTrack, fallbackIndex: number): number => {
    const credits = track.recording?.credits as Record<string, unknown> | undefined;
    const creditDisc = credits?.disc_number;
    if (typeof creditDisc === 'number' && creditDisc > 0) return creditDisc;
    if (typeof creditDisc === 'string' && creditDisc.trim()) {
      const parsed = Number(creditDisc);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    const sideLabel = (track.side ?? track.position ?? '').trim().toUpperCase();
    const sideMatch = sideLabel.match(/^([A-Z])\d*/);
    if (sideMatch?.[1]) {
      const code = sideMatch[1].charCodeAt(0) - 64;
      return Math.max(1, Math.ceil(code / 2));
    }
    const discMatch = (track.position ?? '').match(/^(\d+)[-.:]/);
    if (discMatch?.[1]) {
      const parsed = Number(discMatch[1]);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    return fallbackIndex > 0 ? 1 : 1;
  };

  const getTrackOrder = (track: ReleaseTrack, fallbackIndex: number): number => {
    const position = (track.position ?? '').trim();
    const numberMatch = position.match(/(\d+)/g);
    if (numberMatch && numberMatch.length > 0) {
      const last = Number(numberMatch[numberMatch.length - 1]);
      if (!Number.isNaN(last)) return last;
    }
    return fallbackIndex + 1;
  };

  const getTrackNumber = (position: string | null | undefined, fallbackIndex: number): number => {
    const value = (position ?? '').trim();
    const matches = value.match(/\d+/g);
    if (matches?.length) {
      const parsed = Number(matches[matches.length - 1]);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    return fallbackIndex + 1;
  };

  const getTrackSide = (side: string | null | undefined, position: string | null | undefined): string | null => {
    const fromSide = (side ?? '').trim().toUpperCase();
    if (fromSide) return fromSide;
    const fromPosition = (position ?? '').trim().toUpperCase().match(/^([A-Z])/);
    return fromPosition?.[1] ?? null;
  };

  const getSideOrder = (side: string): number => {
    const code = side.charCodeAt(0);
    if (!Number.isFinite(code) || code < 65 || code > 90) return Number.MAX_SAFE_INTEGER;
    return code;
  };

  const buildDiscGroups = () => {
    if (releaseTracks.length > 0) {
      const withSort = releaseTracks.map((track, index) => {
        const discNumber = getDiscNumber(track, index);
        const side = getTrackSide(track.side ?? null, track.position ?? null);
        const order = getTrackOrder(track, index);
        return { track, discNumber, side, order, index };
      });

      withSort.sort((a, b) => {
        if (a.discNumber !== b.discNumber) return a.discNumber - b.discNumber;
        if (a.side && b.side && a.side !== b.side) return getSideOrder(a.side) - getSideOrder(b.side);
        if (a.side && !b.side) return -1;
        if (!a.side && b.side) return 1;
        if (a.order !== b.order) return a.order - b.order;
        return a.index - b.index;
      });

      const groups = new Map<number, { totalSeconds: number; sides: Map<string, { totalSeconds: number; items: Array<{ track: ReleaseTrack; order: number; index: number }> }>; ungrouped: Array<{ track: ReleaseTrack; order: number; index: number }> }>();
      withSort.forEach(({ track, discNumber, side, order, index }) => {
        const existing = groups.get(discNumber) ?? {
          totalSeconds: 0,
          sides: new Map<string, { totalSeconds: number; items: Array<{ track: ReleaseTrack; order: number; index: number }> }>(),
          ungrouped: [] as Array<{ track: ReleaseTrack; order: number; index: number }>,
        };
        const seconds = track.recording?.duration_seconds ?? 0;
        existing.totalSeconds += seconds;
        if (side) {
          const sideGroup = existing.sides.get(side) ?? { totalSeconds: 0, items: [] };
          sideGroup.totalSeconds += seconds;
          sideGroup.items.push({ track, order, index });
          existing.sides.set(side, sideGroup);
        } else {
          existing.ungrouped.push({ track, order, index });
        }
        groups.set(discNumber, existing);
      });

      return Array.from(groups.entries()).map(([disc, info]) => ({
        disc,
        totalSeconds: info.totalSeconds,
        sideGroups: Array.from(info.sides.entries())
          .sort((a, b) => getSideOrder(a[0]) - getSideOrder(b[0]))
          .map(([side, sideData]) => ({
            side,
            totalSeconds: sideData.totalSeconds,
            tracks: sideData.items
              .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.index - b.index))
              .map(({ track }) => track),
          })),
        ungroupedTracks: info.ungrouped
          .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.index - b.index))
          .map(({ track }) => track),
      }));
    }

    if (fallbackTracks.length > 0) {
      const groups = new Map<number, { totalSeconds: number; sides: Map<string, { totalSeconds: number; items: Array<{ track: typeof fallbackTracks[number]; order: number; index: number }> }>; ungrouped: Array<{ track: typeof fallbackTracks[number]; order: number; index: number }> }>();
      fallbackTracks.forEach((track, index) => {
        const discMatch = (track.position ?? '').match(/^(\d+)[-.:]/);
        const disc = discMatch?.[1] ? Number(discMatch[1]) : 1;
        const existing = groups.get(disc) ?? {
          totalSeconds: 0,
          sides: new Map<string, { totalSeconds: number; items: Array<{ track: typeof fallbackTracks[number]; order: number; index: number }> }>(),
          ungrouped: [] as Array<{ track: typeof fallbackTracks[number]; order: number; index: number }>,
        };
        const side = getTrackSide(track.side ?? null, track.position ?? null);
        const seconds = parseDurationToSeconds(track.duration);
        const order = getTrackNumber(track.position, index);
        existing.totalSeconds += seconds;
        if (side) {
          const sideGroup = existing.sides.get(side) ?? { totalSeconds: 0, items: [] };
          sideGroup.totalSeconds += seconds;
          sideGroup.items.push({ track, order, index });
          existing.sides.set(side, sideGroup);
        } else {
          existing.ungrouped.push({ track, order, index });
        }
        groups.set(disc, existing);
      });
      return Array.from(groups.entries()).map(([disc, info]) => ({
        disc,
        totalSeconds: info.totalSeconds,
        sideGroups: Array.from(info.sides.entries())
          .sort((a, b) => getSideOrder(a[0]) - getSideOrder(b[0]))
          .map(([side, sideData]) => ({
            side,
            totalSeconds: sideData.totalSeconds,
            tracks: sideData.items
              .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.index - b.index))
              .map(({ track }) => track),
          })),
        ungroupedTracks: info.ungrouped
          .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.index - b.index))
          .map(({ track }) => track),
      }));
    }

    return [];
  };

  const discGroups = buildDiscGroups();

  return (
    <div className="p-4 flex-1 overflow-y-auto bg-white">
      {/* Mobile Close Button */}
      {onClose && (
        <div className="lg:hidden flex justify-end mb-2">
            <button onClick={onClose} className="text-gray-500 font-bold text-xl">✕</button>
        </div>
      )}

      <div className="text-sm text-gray-800 mb-1 font-normal">{artistName}</div>
      <div className="flex items-center gap-2 mb-4">
        <h4 className="text-[#2196F3] m-0 text-lg font-semibold">{albumTitle}</h4>
        <div className="bg-[#2196F3] text-white rounded px-1.5 py-0.5 text-xs flex items-center justify-center font-bold" title="Album owned">✓</div>
      </div>

      <div className="relative mb-4 group">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={`${artistName} - ${albumTitle} cover`}
            width={400}
            height={400}
            className="w-full h-auto aspect-square object-cover border border-gray-300 rounded shadow-sm"
            unoptimized
          />
        ) : (
          <div className="w-full aspect-square bg-white flex items-center justify-center text-gray-300 text-5xl border border-gray-200 rounded">🎵</div>
        )}
      </div>

      <div className="text-sm font-normal text-[#333] mb-2">
        {album.release?.label ?? 'Unknown Label'} 
        {releaseYear && ` (${releaseYear})`}
      </div>

      {displayGenres.length > 0 && (
        <div className="text-[13px] text-[#666] mb-3 font-normal">
          {displayGenres.join(' | ')}
        </div>
      )}

      <div className="mb-2">
        {normalizeBarcodeDigits(album.release?.barcode) ? (
          <div className="flex flex-col items-start">
            <span className="barcode-font">{normalizeBarcodeDigits(album.release?.barcode)}</span>
            <span className="font-mono text-xs tracking-widest text-[#333]">
              {formatBarcodeDisplay(album.release?.barcode)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-[#999]">—</span>
        )}
      </div>
      <div className="text-[13px] text-[#333] mb-2 font-normal">{album.release?.country || '—'}</div>
      <div className="text-[13px] text-[#333] mb-3 font-normal">
        {buildFormatLabel()}
        {' | '}{album.release?.qty ? `${album.release.qty} Disc${album.release.qty > 1 ? 's' : ''}` : '—'}
        {' | '}{totalTracks > 0 ? `${totalTracks} Tracks` : '—'}
        {' | '}{totalRuntime}
      </div>

      <div className="text-[13px] text-[#333] mb-3 font-normal">
         <span className="font-semibold">Location:</span> {album.location || 'Unknown'}
      </div>

      <div className="text-[13px] text-[#666] mb-3 font-normal">
        <span className="font-semibold">CAT NO</span> {album.release?.catalog_number || '—'}
      </div>

      <a href={getEbayUrl()} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#2196F3] mb-4 block no-underline font-normal hover:underline">
        Find sold listings on eBay
      </a>

      {discGroups.length > 0 && (
        <div className="mb-4">
          {discGroups.map((group) => (
            <div key={`disc-${group.disc}`} className="mb-4">
              <div className="text-xs font-bold text-white mb-1.5 p-2 px-3 bg-[#2196F3] rounded flex justify-between items-center shadow-sm uppercase tracking-wider">
                <span>{`Disc #${group.disc}`}</span>
                <span>{formatDuration(group.totalSeconds)}</span>
              </div>
              {group.sideGroups.map((sideGroup) => (
                <div key={`disc-${group.disc}-side-${sideGroup.side}`} className="mb-2">
                  <div className="text-[11px] font-semibold text-[#1f2937] bg-[#eef6ff] border border-[#d6e9ff] rounded px-2 py-1 mb-1 flex items-center justify-between">
                    <span>{`Side ${sideGroup.side}`}</span>
                    <span>{formatDuration(sideGroup.totalSeconds)}</span>
                  </div>
                  <div className="flex flex-col gap-px">
                    {sideGroup.tracks.map((track, idx) => {
                      if ('recording' in track) {
                        const title = track.title_override ?? track.recording?.title ?? 'Untitled';
                        const duration = formatDuration(track.recording?.duration_seconds ?? null);
                        const rawPosition = (track.position ?? '').trim();
                        const side = getTrackSide(track.side ?? null, rawPosition) ?? sideGroup.side;
                        const numericPosition = getTrackNumber(rawPosition, idx);
                        const positionLabel = `${side}${numericPosition}`;
                        return (
                          <div key={track.id ?? `${track.position}-${idx}`} className={`flex items-center px-2 py-1.5 text-[13px] font-normal ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <div className="min-w-[42px] text-gray-500 text-[13px]">{positionLabel}</div>
                            <div className="flex-1 text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap pr-2">{title}</div>
                            {duration !== '—' && <div className="text-gray-500 text-[13px] min-w-[40px] text-right">{duration}</div>}
                          </div>
                        );
                      }
                      const fallback = track as NonNullable<Album['tracks']>[number];
                      const side = getTrackSide(fallback.side ?? null, fallback.position ?? null) ?? sideGroup.side;
                      const numericPosition = getTrackNumber(fallback.position, idx);
                      const fallbackLabel = `${side}${numericPosition}`;
                      return (
                        <div key={`${fallback.position}-${idx}`} className={`flex items-center px-2 py-1.5 text-[13px] font-normal ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <div className="min-w-[42px] text-gray-500 text-[13px]">{fallbackLabel}</div>
                          <div className="flex-1 text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap pr-2">{fallback.title}</div>
                          {fallback.duration && <div className="text-gray-500 text-[13px] min-w-[40px] text-right">{fallback.duration}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {group.ungroupedTracks.length > 0 && (
                <div className="flex flex-col gap-px">
                  {group.ungroupedTracks.map((track, idx) => {
                    if ('recording' in track) {
                      const title = track.title_override ?? track.recording?.title ?? 'Untitled';
                      const duration = formatDuration(track.recording?.duration_seconds ?? null);
                      const rawPosition = (track.position ?? '').trim();
                      const numericPosition = getTrackNumber(rawPosition, idx);
                      return (
                        <div key={track.id ?? `${track.position}-${idx}`} className={`flex items-center px-2 py-1.5 text-[13px] font-normal ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <div className="min-w-[42px] text-gray-500 text-[13px]">{numericPosition}</div>
                          <div className="flex-1 text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap pr-2">{title}</div>
                          {duration !== '—' && <div className="text-gray-500 text-[13px] min-w-[40px] text-right">{duration}</div>}
                        </div>
                      );
                    }
                    const fallback = track as NonNullable<Album['tracks']>[number];
                    return (
                      <div key={`${fallback.position}-${idx}`} className={`flex items-center px-2 py-1.5 text-[13px] font-normal ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <div className="min-w-[42px] text-gray-500 text-[13px]">{getTrackNumber(fallback.position, idx)}</div>
                        <div className="flex-1 text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap pr-2">{fallback.title}</div>
                        {fallback.duration && <div className="text-gray-500 text-[13px] min-w-[40px] text-right">{fallback.duration}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mb-4">
        <div className="text-base font-bold text-[#2196F3] mb-3">Details</div>
        <div className="bg-white p-3 rounded">
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[180px]">Release Date</span>
            <span>{album.release?.release_date ? formatDate(album.release.release_date) : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[180px]">Original Release Date</span>
            <span>{album.release?.master?.original_release_year ?? '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[180px]">Sleeve Condition</span>
            <span>{album.sleeve_condition || '—'}</span>
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
            <span className="font-semibold min-w-[140px]">Purchase Date</span>
            <span>{album.purchase_date ? formatDate(album.purchase_date) : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Purchase Store</span>
            <span>—</span>
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
            <span className="font-semibold min-w-[140px]">Play Count</span>
            <span>{album.play_count ?? '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Last Played</span>
            <span>{album.last_played_at ? formatDateTime(album.last_played_at) : '—'}</span>
          </div>
          <div className="text-[13px] text-gray-800 mb-2 flex font-normal">
            <span className="font-semibold min-w-[140px]">Added Date</span>
            <span>{album.date_added ? formatDateTime(album.date_added) : '—'}</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-base font-bold text-[#2196F3] mb-3">Notes</div>
        <div className="text-[13px] text-gray-800 leading-relaxed bg-white p-3 rounded font-normal min-h-[40px]">{notes || '—'}</div>
      </div>

      <div>
        <div className="text-base font-bold text-[#2196F3] mb-3">Tags</div>
        {tagNames.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {toSafeStringArray(tagNames).map((tag) => (
              <span key={tag} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-full text-[13px] font-normal">{tag}</span>
            ))}
          </div>
        ) : (
          <div className="text-[13px] text-gray-400 font-normal">No tags</div>
        )}
      </div>
    </div>
  );
});

export default CollectionInfoPanel;
// AUDIT: updated for UI parity with CLZ reference.
