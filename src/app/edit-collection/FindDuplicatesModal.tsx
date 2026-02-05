// src/app/edit-collection/FindDuplicatesModal.tsx
'use client';

import { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Album } from '../../types/album';
import type { Database } from '../../types/supabase';
import { ManageColumnFavoritesModal, ColumnFavorite } from './ManageColumnFavoritesModal';
import Header from './Header';

interface FindDuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDuplicatesRemoved: () => void;
}

type DetectionMethod = 'title' | 'title_artist' | 'barcode' | 'index';

interface DuplicateGroup {
  key: string;
  displayName: string;
  albums: Album[];
  keepCount: number;
}

type InventoryRow = Database['public']['Tables']['inventory']['Row'];
type ReleaseRow = Database['public']['Tables']['releases']['Row'];
type MasterRow = Database['public']['Tables']['masters']['Row'];
type ArtistRow = Database['public']['Tables']['artists']['Row'];

type MasterTagLinkRow = {
  master_tags?: { name: string | null } | null;
};

type InventoryQueryRow = InventoryRow & {
  release?: (ReleaseRow & {
    master?: (MasterRow & {
      artist?: ArtistRow | null;
      master_tag_links?: MasterTagLinkRow[] | null;
    }) | null;
  }) | null;
};

export default function FindDuplicatesModal({ isOpen, onClose, onDuplicatesRemoved }: FindDuplicatesModalProps) {
  const [detectionMethod, setDetectionMethod] = useState<DetectionMethod>('title');
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [searched, setSearched] = useState(false);
  const [showColumnFavoritesModal, setShowColumnFavoritesModal] = useState(false);
  const [columnFavorites, setColumnFavorites] = useState<ColumnFavorite[]>([
    {
      id: 'default',
      name: 'Default',
      columns: ['Artist', 'Title', 'Release Date', 'Format', 'Discs', 'Tracks', 'Length', 'Genre', 'Label', 'Added Date']
    }
  ]);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState('default');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  const detectionMethods = [
    { value: 'title' as DetectionMethod, label: 'Title' },
    { value: 'title_artist' as DetectionMethod, label: 'Title & Artist' },
    { value: 'barcode' as DetectionMethod, label: 'UPC (Barcode)' },
    { value: 'index' as DetectionMethod, label: 'Index' },
  ];

  const selectedMethodLabel = detectionMethods.find(m => m.value === detectionMethod)?.label || 'Title';

  const buildFormatLabel = (release?: ReleaseRow | null) => {
    if (!release) return '';
    const parts = [release.media_type, ...(release.format_details ?? [])].filter(Boolean);
    const base = parts.join(', ');
    const qty = release.qty ?? 1;
    if (!base) return '';
    return qty > 1 ? `${qty}x${base}` : base;
  };

  const extractTagNames = (links?: MasterTagLinkRow[] | null) => {
    if (!links) return [];
    return links
      .map((link) => link.master_tags?.name)
      .filter((name): name is string => Boolean(name));
  };

  const mapInventoryToAlbum = (row: InventoryQueryRow): Album => {
    const release = row.release ?? null;
    const master = release?.master ?? null;
    const artist = master?.artist?.name ?? 'Unknown Artist';
    const label = release?.label ?? null;
    const tags = extractTagNames(master?.master_tag_links ?? null);
    const status = row.status ?? 'active';

    return {
      release,
      id: row.id,
      inventory_id: row.id,
      index_number: row.id,
      release_id: release?.id ?? null,
      master_id: master?.id ?? null,
      artist,
      title: master?.title ?? 'Untitled',
      year: master?.original_release_year ? String(master.original_release_year) : null,
      year_int: master?.original_release_year ?? null,
      image_url: master?.cover_image_url ?? null,
      format: buildFormatLabel(release),
      discs: release?.qty ?? null,
      status,
      location: row.location ?? null,
      country: release?.country ?? null,
      date_added: row.date_added ?? null,
      personal_notes: row.personal_notes ?? null,
      release_notes: release?.notes ?? null,
      media_condition: row.media_condition ?? '',
      package_sleeve_condition: row.sleeve_condition ?? null,
      barcode: release?.barcode ?? null,
      catalog_number: release?.catalog_number ?? null,
      label,
      genres: master?.genres ?? null,
      styles: master?.styles ?? null,
      tags: tags.length > 0 ? tags : null,
      discogs_release_id: release?.discogs_release_id ?? null,
      discogs_master_id: master?.discogs_master_id ?? null,
      spotify_album_id: release?.spotify_album_id ?? null,
      owner: row.owner ?? null,
      purchase_price: row.purchase_price ?? null,
      current_value: row.current_value ?? null,
      purchase_date: row.purchase_date ?? null,
      play_count: row.play_count ?? null,
    };
  };

  const handleFindDuplicates = async () => {
    setLoading(true);
    
    try {
      let allAlbums: Album[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('inventory')
          .select(`
            id,
            status,
            location,
            media_condition,
            sleeve_condition,
            date_added,
            purchase_price,
            current_value,
            purchase_date,
            owner,
            personal_notes,
            play_count,
            release:releases (
              id,
              media_type,
              format_details,
              qty,
              label,
              catalog_number,
              barcode,
              country,
              release_date,
              discogs_release_id,
              spotify_album_id,
              notes,
              release_tracks:release_tracks (
                recording:recordings (
                  duration_seconds
                )
              ),
              master:masters (
                title,
                original_release_year,
                cover_image_url,
                discogs_master_id,
                genres,
                styles,
                artist:artists (
                  name
                ),
                master_tag_links (
                  master_tags (
                    name
                  )
                )
              )
            )
          `)
          .range(from, from + batchSize - 1);

        if (error) throw error;
        if (!batch || batch.length === 0) break;

        const mapped = (batch as unknown as InventoryQueryRow[]).map(mapInventoryToAlbum);
        allAlbums = allAlbums.concat(mapped);
        from += batchSize;
        hasMore = batch.length === batchSize;
      }

      const groupMap = new Map<string, Album[]>();

      allAlbums.forEach(album => {
        let key = '';
        
        switch (detectionMethod) {
          case 'title':
            key = (album.title || '').toLowerCase().trim();
            break;
          case 'title_artist':
            key = `${(album.artist || '').toLowerCase().trim()}|${(album.title || '').toLowerCase().trim()}`;
            break;
          case 'barcode':
            if (!album.barcode) return;
            key = album.barcode.trim();
            break;
          case 'index':
            if (!album.index_number) return;
            key = String(album.index_number);
            break;
        }

        if (!key) return;

        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(album);
      });

      const duplicates: DuplicateGroup[] = [];
      groupMap.forEach((albums, key) => {
        if (albums.length > 1) {
          albums.sort((a, b) => {
            const aDate = a.date_added || '';
            const bDate = b.date_added || '';
            return aDate.localeCompare(bDate);
          });

          duplicates.push({
            key,
            displayName: detectionMethod === 'title_artist' 
              ? albums[0].title
              : detectionMethod === 'title'
              ? albums[0].title
              : detectionMethod === 'barcode'
              ? `Barcode: ${albums[0].barcode}`
              : `Index: ${albums[0].index_number}`,
            albums,
            keepCount: albums.length,
          });
        }
      });

      duplicates.sort((a, b) => b.albums.length - a.albums.length);

      setDuplicateGroups(duplicates);
      setSearched(true);
      setCollapsedGroups(new Set());
    } catch (err) {
      console.error('Error finding duplicates:', err);
      alert('Failed to find duplicates');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupCollapse = (groupIndex: number) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupIndex)) {
        newSet.delete(groupIndex);
      } else {
        newSet.add(groupIndex);
      }
      return newSet;
    });
  };

  const handleRemoveAlbum = async (groupIndex: number, albumId: number) => {
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', albumId);

      if (error) throw error;

      setDuplicateGroups(prev => {
        const updated = [...prev];
        const group = updated[groupIndex];
        const newAlbums = group.albums.filter(a => a.id !== albumId);
        
        if (newAlbums.length <= 1) {
          return updated.filter((_, idx) => idx !== groupIndex);
        }
        
        updated[groupIndex] = {
          ...group,
          albums: newAlbums,
          keepCount: Math.min(group.keepCount, newAlbums.length)
        };
        return updated;
      });

      onDuplicatesRemoved();
    } catch (err) {
      console.error('Error removing album:', err);
      alert('Failed to remove album');
    }
  };

  const handleRemoveAllAutomatically = async () => {
    if (!confirm(`This will remove ${totalToRemove} duplicate albums. Are you sure?`)) {
      return;
    }

    setLoading(true);
    
    try {
      const albumsToRemove: number[] = [];
      
      duplicateGroups.forEach(group => {
        const toRemove = group.albums.length - group.keepCount;
        for (let i = 0; i < toRemove; i++) {
          albumsToRemove.push(group.albums[i].id);
        }
      });

      for (let i = 0; i < albumsToRemove.length; i += 100) {
        const batch = albumsToRemove.slice(i, i + 100);
        const { error } = await supabase
          .from('inventory')
          .delete()
          .in('id', batch);

        if (error) {
          console.error('Delete error:', error);
        }
      }

      alert(`Successfully removed ${albumsToRemove.length} duplicate albums`);
      setDuplicateGroups([]);
      setSearched(false);
      onDuplicatesRemoved();
    } catch (err) {
      console.error('Error removing duplicates:', err);
      alert('Failed to remove some duplicates');
    } finally {
      setLoading(false);
    }
  };

  const totalToRemove = useMemo(() => {
    return duplicateGroups.reduce((sum, group) => {
      return sum + (group.albums.length - group.keepCount);
    }, 0);
  }, [duplicateGroups]);

  if (!isOpen) return null;

  const selectedFavorite = columnFavorites.find(f => f.id === selectedFavoriteId);
  const displayColumns = selectedFavorite?.columns || ['Artist', 'Title', 'Release Date', 'Format', 'Discs', 'Tracks', 'Length', 'Genre', 'Label', 'Added Date'];

  const getColumnValue = (album: Album, columnName: string): string => {
    switch (columnName) {
      case 'Artist': return album.artist || '—';
      case 'Title': return album.title || '—';
      case 'Release Date':
      case 'Release Year':
        return album.release?.release_date
          ? new Date(album.release.release_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : (album.year ? String(album.year) : '—');
      case 'Format': return album.format || '—';
      case 'Discs': return String(album.discs || 1);
      case 'Tracks': {
        const trackCount = album.release?.release_tracks?.length;
        return trackCount ? String(trackCount) : '—';
      }
      case 'Length': {
        const totalSeconds = (album.release?.release_tracks ?? [])
          .reduce((sum, track) => sum + (track.recording?.duration_seconds ?? 0), 0);
        if (!totalSeconds) return '—';
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      case 'Genre': 
        return album.genres ? (Array.isArray(album.genres) ? album.genres[0] : album.genres) : '—';
      case 'Label': return album.label || '—';
      case 'Added Date': 
        return album.date_added ? new Date(album.date_added).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
      case 'Barcode': return album.barcode || '—';
      case 'Cat No': return album.catalog_number || '—';
      case 'Country': return album.country || '—';
      case 'Index': return String(album.index_number || '—');
      case 'Purchase Date': 
        return album.purchase_date ? new Date(album.purchase_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
      case 'Purchase Price': return album.purchase_price ? `$${album.purchase_price.toFixed(2)}` : '—';
      case 'Current Value': return album.current_value ? `$${album.current_value.toFixed(2)}` : '—';
      case 'Media Condition': return album.media_condition || '—';
      case 'Package/Sleeve Condition': return album.package_sleeve_condition || '—';
      default: return '—';
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-white z-[30000] flex flex-col overflow-hidden">
        <Header />
        
        <div className="bg-[#2C2C2C] h-[50px] px-5 flex items-center gap-4 shrink-0">
          <button onClick={onClose} className="bg-transparent border-none text-white text-sm cursor-pointer p-2 flex items-center hover:opacity-80">
            ← Back
          </button>
          <span className="text-base font-semibold text-white leading-none m-0 p-0">🔍 Find Duplicates</span>
        </div>

        <div className="bg-[#2C2C2C] text-white h-[56px] px-5 flex items-center gap-3 shrink-0 border-b border-[#444]">
          {/* ... (rest of the render remains the same) ... */}
          <span className="text-sm text-white whitespace-nowrap">Find duplicates based on</span>
          <div className="relative">
            <button onClick={() => setShowMethodDropdown(!showMethodDropdown)} className="bg-white border border-[#ddd] px-3 py-1.5 text-sm cursor-pointer flex items-center gap-2 rounded text-black">
              <span>{selectedMethodLabel}</span>
              <span className="text-[10px] text-[#666]">▼</span>
            </button>

            {showMethodDropdown && (
              <>
                <div onClick={() => setShowMethodDropdown(false)} className="fixed inset-0 z-[99]" />
                <div className="absolute top-full left-0 mt-1 bg-white border border-[#ddd] rounded shadow-lg z-[100] min-w-[180px]">
                  {detectionMethods.map(method => (
                    <button key={method.value} onClick={() => {
                      setDetectionMethod(method.value);
                      setShowMethodDropdown(false);
                    }} className={`w-full px-3 py-2.5 border-none cursor-pointer text-sm text-left hover:bg-gray-100 ${detectionMethod === method.value ? 'bg-[#E3F2FD] text-black' : 'bg-white text-black'}`}>
                      {method.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={handleFindDuplicates} disabled={loading} className="bg-[#4FC3F7] text-white border-none px-4 py-1.5 text-sm font-medium cursor-pointer rounded hover:bg-[#29B6F6] disabled:opacity-60 disabled:cursor-not-allowed">
            Find Duplicates
          </button>
          {searched && duplicateGroups.length > 0 && (
            <span className="text-white text-sm ml-5">
              {duplicateGroups.length} duplicates found:
            </span>
          )}
          <div className="flex-1" />
          <button onClick={() => setShowColumnFavoritesModal(true)} className="bg-transparent border border-[#666] text-white text-base cursor-pointer px-3 py-1 rounded hover:bg-[#444]" title="Manage Column Favorites">
            ⊞
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white relative min-h-[400px]">
          {searched && duplicateGroups.length > 0 && (
            <>
              <div className="p-0">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#f3f4f6] sticky top-0 z-10">
                      {displayColumns.map(col => (
                        <th key={col} className="px-3 py-2.5 text-left font-bold text-black border-x border-l-black border-r-black border-b border-b-gray-200">{col}</th>
                      ))}
                      <th className="px-3 py-2.5 text-left font-bold text-black border-x border-l-black border-r-black border-b border-b-gray-200">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicateGroups.map((group, groupIdx) => (
                      <>
                        <tr key={`group-${groupIdx}`} className="bg-[#e5e7eb]">
                          <td colSpan={displayColumns.length + 1} className="p-0">
                            <div className="flex items-center justify-between px-3 py-2.5">
                              <button onClick={() => toggleGroupCollapse(groupIdx)} className="bg-transparent border-none text-[#666] text-xs cursor-pointer p-1 flex items-center justify-center w-5 h-5 shrink-0 hover:text-black">
                                {collapsedGroups.has(groupIdx) ? '▶' : '▼'}
                              </button>
                              <span className="font-bold text-black flex-1 ml-1">{group.displayName}</span>
                              <div className="flex items-center gap-2">
                                <button className="bg-[#4FC3F7] text-white border-none px-3 py-1.5 text-[13px] font-medium cursor-pointer rounded">
                                  Keep {group.keepCount}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {!collapsedGroups.has(groupIdx) && group.albums.map((album) => (
                          <tr key={`album-${album.id}`} className="bg-white">
                            {displayColumns.map(col => (
                              <td key={col} className="px-3 py-2 border border-black text-black bg-white">{getColumnValue(album, col)}</td>
                            ))}
                            <td className="px-3 py-2 border border-black text-black bg-white">
                              <button onClick={() => handleRemoveAlbum(groupIdx, album.id)} className="bg-red-500 text-white border-none px-3 py-1 text-xs font-medium cursor-pointer rounded hover:bg-red-600">
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                        {groupIdx < duplicateGroups.length - 1 && (
                          <tr key={`separator-${groupIdx}`} className="h-2 bg-[#f3f4f6]">
                            <td colSpan={displayColumns.length + 1}></td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-5 flex justify-end border-t border-gray-200 bg-white">
                <button onClick={handleRemoveAllAutomatically} disabled={loading || totalToRemove === 0} className="bg-[#4FC3F7] text-white border-none px-5 py-2.5 text-sm font-medium cursor-pointer rounded hover:bg-[#29B6F6] disabled:opacity-60 disabled:cursor-not-allowed">
                  Remove all duplicates automatically
                </button>
              </div>
            </>
          )}

          {loading && (
            <div className="absolute inset-0 bg-white/95 flex items-center justify-center z-[100]">
              <div className="flex flex-col items-center gap-3 text-[#666]">
                <div className="w-10 h-10 border-4 border-gray-100 border-t-[#4FC3F7] rounded-full animate-spin" />
                <div>Loading...</div>
                <div>Please wait</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ManageColumnFavoritesModal
        isOpen={showColumnFavoritesModal}
        onClose={() => setShowColumnFavoritesModal(false)}
        favorites={columnFavorites}
        onSave={(newFavorites) => {
          setColumnFavorites(newFavorites);
          setShowColumnFavoritesModal(false);
        }}
        selectedId={selectedFavoriteId}
        onSelect={setSelectedFavoriteId}
      />
    </>
  );
}
// AUDIT: inspected, no changes.
