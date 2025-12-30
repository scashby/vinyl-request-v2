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
}

export default function FindDuplicatesModal({ isOpen, onClose, onDuplicatesRemoved }: FindDuplicatesModalProps) {
  const [detectionMethod, setDetectionMethod] = useState<DetectionMethod>('title');
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [stage, setStage] = useState<'select' | 'results'>('select');

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
      // Load all albums
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

      // Group by detection method
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
            if (!album.barcode) return; // Skip albums without barcode
            key = album.barcode.trim();
            break;
          case 'index':
            if (!album.index_number) return; // Skip albums without index
            key = String(album.index_number);
            break;
        }

        if (!key) return;

        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(album);
      });

      // Filter to only groups with duplicates (2+ albums)
      const duplicates: DuplicateGroup[] = [];
      groupMap.forEach((albums, key) => {
        if (albums.length > 1) {
          // Sort by date added (oldest first)
          albums.sort((a, b) => {
            const aDate = a.date_added || '';
            const bDate = b.date_added || '';
            return aDate.localeCompare(bDate);
          });

          duplicates.push({
            key,
            displayName: detectionMethod === 'title_artist' 
              ? `${albums[0].artist} - ${albums[0].title}`
              : detectionMethod === 'title'
              ? albums[0].title
              : detectionMethod === 'barcode'
              ? `Barcode: ${albums[0].barcode}`
              : `Index: ${albums[0].index_number}`,
            albums,
            keepCount: albums.length - 1, // Default: keep all but oldest
          });
        }
      });

      // Sort by number of duplicates (most first)
      duplicates.sort((a, b) => b.albums.length - a.albums.length);

      setDuplicateGroups(duplicates);
      setStage('results');
    } catch (err) {
      console.error('Error finding duplicates:', err);
      alert('Failed to find duplicates');
    } finally {
      setLoading(false);
    }
  };

  const handleKeepCountChange = (groupIndex: number, newKeepCount: number) => {
    setDuplicateGroups(prev => {
      const updated = [...prev];
      const group = updated[groupIndex];
      // Keep count must be between 1 and total albums
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

      // Remove from UI
      setDuplicateGroups(prev => {
        const updated = [...prev];
        const group = updated[groupIndex];
        const newAlbums = group.albums.filter(a => a.id !== albumId);
        
        if (newAlbums.length <= 1) {
          // No longer a duplicate group, remove it
          return updated.filter((_, idx) => idx !== groupIndex);
        }
        
        updated[groupIndex] = {
          ...group,
          albums: newAlbums,
          keepCount: Math.min(group.keepCount, newAlbums.length - 1)
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
        // Remove the oldest albums (they're already sorted by date)
        for (let i = 0; i < toRemove; i++) {
          albumsToRemove.push(group.albums[i].id);
        }
      });

      // Delete in batches of 100
      for (let i = 0; i < albumsToRemove.length; i += 100) {
        const batch = albumsToRemove.slice(i, i + 100);
        const { error } = await supabase
          .from('collection')
          .delete()
          .in('id', batch);

        if (error) {
          console.error('Delete error:', error);
          // Continue with other batches
        }
      }

      alert(`Successfully removed ${albumsToRemove.length} duplicate albums`);
      setDuplicateGroups([]);
      setStage('select');
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
    <>
      <div className={styles.sidebarOverlay} onClick={onClose}>
        <div className={stage === 'select' ? styles.duplicatesModalSelect : styles.duplicatesModalResults} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className={styles.duplicatesModalHeader}>
            <div className={styles.headerTitle}>
              <span className={styles.headerIcon}>🔍</span>
              <h2 className={styles.headerText}>Find Duplicates</h2>
            </div>
            <button onClick={onClose} className={styles.importModalCloseButton}>×</button>
          </div>

          {/* Content */}
          <div className={styles.importModalContent}>
            {stage === 'select' && (
              <div className={styles.importModalInner}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Find duplicates based on
                  </label>
                  
                  <div className={styles.dropdownWrapper}>
                    <button onClick={() => setShowMethodDropdown(!showMethodDropdown)} className={styles.dropdownButton}>
                      <span>{selectedMethodLabel}</span>
                      <span className={styles.dropdownArrow}>▼</span>
                    </button>

                    {showMethodDropdown && (
                      <>
                        <div onClick={() => setShowMethodDropdown(false)} className={styles.dropdownOverlay} />
                        <div className={styles.dropdownMenu}>
                          {detectionMethods.map(method => (
                            <button key={method.value} onClick={() => {
                              setDetectionMethod(method.value);
                              setShowMethodDropdown(false);
                            }} className={detectionMethod === method.value ? styles.dropdownItemActive : styles.dropdownItem}>
                              <span>{method.label}</span>
                              {detectionMethod === method.value && (
                                <span className={styles.dropdownCheckmark}>✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <button onClick={handleFindDuplicates} disabled={loading} className={styles.importConfirmButton}>
                  {loading ? 'Searching...' : 'Find Duplicates'}
                </button>
              </div>
            )}

            {stage === 'results' && (
              <div className={styles.importModalInner}>
                {duplicateGroups.length === 0 ? (
                  <div className={styles.duplicatesEmpty}>
                    <div className={styles.duplicatesEmptyIcon}>✓</div>
                    <div className={styles.duplicatesEmptyTitle}>No duplicates found</div>
                    <div className={styles.duplicatesEmptyText}>Your collection has no duplicate albums based on {selectedMethodLabel}.</div>
                  </div>
                ) : (
                  <>
                    <div className={styles.duplicatesAlert}>
                      <strong>{duplicateGroups.length} duplicate groups found</strong> with a total of <strong>{totalToRemove} albums</strong> to remove.
                    </div>

                    <div className={styles.duplicatesTableCard}>
                      {/* Table Header */}
                      <div className={styles.duplicatesTableHeader}>
                        <div>Artist</div>
                        <div>Title</div>
                        <div>Release Date</div>
                        <div>Format</div>
                        <div className={styles.duplicatesTableHeaderCenter}>Discs</div>
                        <div className={styles.duplicatesTableHeaderCenter}>Action</div>
                      </div>

                      {/* Duplicate Groups */}
                      <div className={styles.duplicatesTableBody}>
                        {duplicateGroups.map((group, groupIdx) => (
                          <div key={groupIdx} className={styles.duplicatesGroup}>
                            {/* Group Header */}
                            <div className={styles.duplicatesGroupHeader}>
                              <div>{group.displayName}</div>
                              <div className={styles.duplicatesGroupActions}>
                                <span className={styles.duplicatesKeepBadge}>
                                  Keep {group.keepCount}
                                </span>
                                <select value={group.keepCount} onChange={(e) => handleKeepCountChange(groupIdx, parseInt(e.target.value))} className={styles.duplicatesKeepSelect}>
                                  {Array.from({ length: group.albums.length }, (_, i) => i + 1).map(num => (
                                    <option key={num} value={num}>Keep {num}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Albums in Group */}
                            {group.albums.map((album, albumIdx) => (
                              <div key={album.id} className={albumIdx % 2 === 0 ? styles.duplicatesAlbumRow : styles.duplicatesAlbumRowAlt}>
                                <div className={styles.duplicatesAlbumCell}>{album.artist}</div>
                                <div className={styles.duplicatesAlbumCell}>{album.title}</div>
                                <div className={styles.duplicatesAlbumCellSecondary}>{album.year || '—'}</div>
                                <div className={styles.duplicatesAlbumCellSecondary}>{album.format || '—'}</div>
                                <div className={styles.duplicatesAlbumCellCenter}>{album.discs || 1}</div>
                                <div className={styles.duplicatesAlbumCellCenter}>
                                  <button onClick={() => handleRemoveAlbum(groupIdx, album.id)} className={styles.duplicatesRemoveButton}>
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className={styles.importButtonContainer}>
                      <button onClick={() => {
                        setStage('select');
                        setDuplicateGroups([]);
                      }} className={styles.importCancelButton}>
                        Back
                      </button>
                      <button onClick={handleRemoveAllAutomatically} disabled={loading || totalToRemove === 0} className={styles.importConfirmButton} style={{ opacity: loading || totalToRemove === 0 ? 0.6 : 1 }}>
                        {loading ? 'Removing...' : `Remove all duplicates automatically (${totalToRemove})`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {loading && stage === 'results' && (
            <div className={styles.duplicatesLoadingOverlay}>
              <div className={styles.duplicatesLoadingContent}>
                <div className={styles.duplicatesLoadingSpinner} />
                <div className={styles.duplicatesLoadingTitle}>Processing...</div>
                <div className={styles.duplicatesLoadingText}>Please wait</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}