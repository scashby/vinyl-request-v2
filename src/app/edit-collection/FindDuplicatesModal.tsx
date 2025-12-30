// src/app/edit-collection/FindDuplicatesModal.tsx
'use client';

import { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Album } from '../../types/album';
import styles from './EditCollection.module.css';

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
  expanded: boolean;
}

export default function FindDuplicatesModal({ isOpen, onClose, onDuplicatesRemoved }: FindDuplicatesModalProps) {
  const [detectionMethod, setDetectionMethod] = useState<DetectionMethod>('title');
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [searched, setSearched] = useState(false);

  const detectionMethods = [
    { value: 'title' as DetectionMethod, label: 'Title' },
    { value: 'title_artist' as DetectionMethod, label: 'Title & Artist' },
    { value: 'barcode' as DetectionMethod, label: 'UPC (Barcode)' },
    { value: 'index' as DetectionMethod, label: 'Index' },
  ];

  const selectedMethodLabel = detectionMethods.find(m => m.value === detectionMethod)?.label || 'Title';

  const handleFindDuplicates = async () => {
    setLoading(true);
    
    try {
      let allAlbums: Album[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('collection')
          .select('*')
          .range(from, from + batchSize - 1);

        if (error) throw error;
        if (!batch || batch.length === 0) break;

        allAlbums = allAlbums.concat(batch as Album[]);
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
            expanded: false,
          });
        }
      });

      duplicates.sort((a, b) => b.albums.length - a.albums.length);

      setDuplicateGroups(duplicates);
      setSearched(true);
    } catch (err) {
      console.error('Error finding duplicates:', err);
      alert('Failed to find duplicates');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupIndex: number) => {
    setDuplicateGroups(prev => {
      const updated = [...prev];
      updated[groupIndex] = {
        ...updated[groupIndex],
        expanded: !updated[groupIndex].expanded
      };
      return updated;
    });
  };

  const handleKeepCountChange = (groupIndex: number, newKeepCount: number) => {
    setDuplicateGroups(prev => {
      const updated = [...prev];
      const group = updated[groupIndex];
      updated[groupIndex] = {
        ...group,
        keepCount: Math.max(1, Math.min(group.albums.length, newKeepCount))
      };
      return updated;
    });
  };

  const handleRemoveAlbum = async (groupIndex: number, albumId: number) => {
    try {
      const { error } = await supabase
        .from('collection')
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
          .from('collection')
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

  return (
    <div className={styles.clzDuplicatesOverlay}>
      <div className={styles.clzDuplicatesHeader}>
        <button onClick={onClose} className={styles.clzDuplicatesBackButton}>
          ← Back
        </button>
        <div className={styles.clzDuplicatesTitle}>
          🔍 Find Duplicates
        </div>
        <button onClick={onClose} className={styles.clzDuplicatesCloseButton}>×</button>
      </div>

      <div className={styles.clzDuplicatesToolbar}>
        <span className={styles.clzDuplicatesToolbarLabel}>Find duplicates based on</span>
        <div className={styles.clzDuplicatesDropdownWrapper}>
          <button onClick={() => setShowMethodDropdown(!showMethodDropdown)} className={styles.clzDuplicatesDropdownButton}>
            <span>{selectedMethodLabel}</span>
            <span className={styles.clzDuplicatesDropdownArrow}>▼</span>
          </button>

          {showMethodDropdown && (
            <>
              <div onClick={() => setShowMethodDropdown(false)} className={styles.dropdownOverlay} />
              <div className={styles.clzDuplicatesDropdownMenu}>
                {detectionMethods.map(method => (
                  <button key={method.value} onClick={() => {
                    setDetectionMethod(method.value);
                    setShowMethodDropdown(false);
                  }} className={detectionMethod === method.value ? styles.clzDuplicatesDropdownItemActive : styles.clzDuplicatesDropdownItem}>
                    {method.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button onClick={handleFindDuplicates} disabled={loading} className={styles.clzDuplicatesFindButton}>
          {loading ? 'Searching...' : 'Find Duplicates'}
        </button>
        {searched && duplicateGroups.length > 0 && (
          <div className={styles.clzDuplicatesCount}>
            {duplicateGroups.length} duplicates found:
          </div>
        )}
        <div className={styles.clzDuplicatesToolbarSpacer} />
        <button className={styles.clzDuplicatesColumnButton} title="Manage Column Favorites">
          ⊞
        </button>
      </div>

      <div className={styles.clzDuplicatesContent}>
        {loading && !searched && (
          <div className={styles.clzDuplicatesLoading}>
            <div className={styles.clzDuplicatesLoadingSpinner} />
            <div>Loading...</div>
            <div>Please wait</div>
          </div>
        )}

        {!loading && searched && duplicateGroups.length === 0 && (
          <div className={styles.clzDuplicatesEmpty}>
            <div className={styles.clzDuplicatesEmptyIcon}>✓</div>
            <div className={styles.clzDuplicatesEmptyTitle}>No duplicates found</div>
            <div className={styles.clzDuplicatesEmptyText}>Your collection has no duplicate albums based on {selectedMethodLabel}.</div>
          </div>
        )}

        {searched && duplicateGroups.length > 0 && (
          <>
            <div className={styles.clzDuplicatesTableWrapper}>
              <table className={styles.clzDuplicatesTable}>
                <thead>
                  <tr className={styles.clzDuplicatesTableHeaderRow}>
                    <th className={styles.clzDuplicatesTableHeaderCell}>Artist</th>
                    <th className={styles.clzDuplicatesTableHeaderCell}>Title</th>
                    <th className={styles.clzDuplicatesTableHeaderCell}>Release Date</th>
                    <th className={styles.clzDuplicatesTableHeaderCell}>Format</th>
                    <th className={styles.clzDuplicatesTableHeaderCell}>Discs</th>
                    <th className={styles.clzDuplicatesTableHeaderCell}>Tracks</th>
                    <th className={styles.clzDuplicatesTableHeaderCell}>Length</th>
                    <th className={styles.clzDuplicatesTableHeaderCell}>Genre</th>
                    <th className={styles.clzDuplicatesTableHeaderCell}>Label</th>
                    <th className={styles.clzDuplicatesTableHeaderCell}>Added Date</th>
                    <th className={styles.clzDuplicatesTableHeaderCell}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicateGroups.map((group, groupIdx) => (
                    <>
                      <tr key={`group-${groupIdx}`} className={styles.clzDuplicatesGroupRow}>
                        <td colSpan={11} className={styles.clzDuplicatesGroupCell}>
                          <div className={styles.clzDuplicatesGroupHeader}>
                            <button onClick={() => toggleGroup(groupIdx)} className={styles.clzDuplicatesGroupToggle}>
                              {group.expanded ? '▼' : '▶'}
                            </button>
                            <span className={styles.clzDuplicatesGroupName}>{group.displayName}</span>
                            <div className={styles.clzDuplicatesGroupActions}>
                              <button className={styles.clzDuplicatesKeepButton}>
                                Keep {group.keepCount}
                              </button>
                              <select value={group.keepCount} onChange={(e) => handleKeepCountChange(groupIdx, parseInt(e.target.value))} className={styles.clzDuplicatesKeepSelect}>
                                {Array.from({ length: group.albums.length }, (_, i) => i + 1).map(num => (
                                  <option key={num} value={num}>Keep {num}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {group.expanded && group.albums.map((album) => (
                        <tr key={`album-${album.id}`} className={styles.clzDuplicatesAlbumRow}>
                          <td className={styles.clzDuplicatesTableCell}>{album.artist}</td>
                          <td className={styles.clzDuplicatesTableCell}>{album.title}</td>
                          <td className={styles.clzDuplicatesTableCell}>{album.year || '—'}</td>
                          <td className={styles.clzDuplicatesTableCell}>{album.format || '—'}</td>
                          <td className={styles.clzDuplicatesTableCell}>{album.discs || 1}</td>
                          <td className={styles.clzDuplicatesTableCell}>{album.spotify_total_tracks || album.apple_music_track_count || '—'}</td>
                          <td className={styles.clzDuplicatesTableCell}>
                            {album.length_seconds ? `${Math.floor(album.length_seconds / 60)}:${(album.length_seconds % 60).toString().padStart(2, '0')}` : '—'}
                          </td>
                          <td className={styles.clzDuplicatesTableCell}>
                            {album.discogs_genres ? (Array.isArray(album.discogs_genres) ? album.discogs_genres[0] : album.discogs_genres) : '—'}
                          </td>
                          <td className={styles.clzDuplicatesTableCell}>
                            {album.labels ? (Array.isArray(album.labels) ? album.labels[0] : album.labels) : album.spotify_label || album.apple_music_label || '—'}
                          </td>
                          <td className={styles.clzDuplicatesTableCell}>
                            {album.date_added ? new Date(album.date_added).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td className={styles.clzDuplicatesTableCell}>
                            <button onClick={() => handleRemoveAlbum(groupIdx, album.id)} className={styles.clzDuplicatesRemoveButton}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                      {groupIdx < duplicateGroups.length - 1 && (
                        <tr key={`separator-${groupIdx}`} className={styles.clzDuplicatesSeparator}>
                          <td colSpan={11}></td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.clzDuplicatesFooterActions}>
              <button onClick={handleRemoveAllAutomatically} disabled={loading || totalToRemove === 0} className={styles.clzDuplicatesRemoveAllButton}>
                Remove all duplicates automatically ({totalToRemove})
              </button>
            </div>
          </>
        )}
      </div>

      <div className={styles.clzDuplicatesFooter}>
        CLZoom Web © Copyright 2000-2025 · Terms of Use · Privacy Policy
      </div>
    </div>
  );
}