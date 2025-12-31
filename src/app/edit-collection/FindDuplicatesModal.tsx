// src/app/edit-collection/FindDuplicatesModal.tsx
'use client';

import { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Album } from '../../types/album';
import styles from './EditCollection.module.css';
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

  const selectedFavorite = columnFavorites.find(f => f.id === selectedFavoriteId);
  const displayColumns = selectedFavorite?.columns || ['Artist', 'Title', 'Release Date', 'Format', 'Discs', 'Tracks', 'Length', 'Genre', 'Label', 'Added Date'];

  const getColumnValue = (album: Album, columnName: string): string => {
    switch (columnName) {
      case 'Artist': return album.artist || '—';
      case 'Title': return album.title || '—';
      case 'Release Date':
      case 'Release Year': return album.year || '—';
      case 'Format': return album.format || '—';
      case 'Discs': return String(album.discs || 1);
      case 'Tracks': return String(album.spotify_total_tracks || album.apple_music_track_count || '—');
      case 'Length': 
        if (!album.length_seconds) return '—';
        return `${Math.floor(album.length_seconds / 60)}:${(album.length_seconds % 60).toString().padStart(2, '0')}`;
      case 'Genre': 
        return album.discogs_genres ? (Array.isArray(album.discogs_genres) ? album.discogs_genres[0] : album.discogs_genres) : '—';
      case 'Label': 
        return album.labels ? (Array.isArray(album.labels) ? album.labels[0] : album.labels) : album.spotify_label || album.apple_music_label || '—';
      case 'Added Date': 
        return album.date_added ? new Date(album.date_added).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
      case 'Barcode': return album.barcode || '—';
      case 'Cat No': return album.cat_no || '—';
      case 'Country': return album.country || '—';
      case 'Original Release Date': return album.original_release_date || '—';
      case 'Index': return String(album.index_number || '—');
      case 'Purchase Date': 
        return album.purchase_date ? new Date(album.purchase_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
      case 'Purchase Price': return album.purchase_price ? `$${album.purchase_price.toFixed(2)}` : '—';
      case 'Current Value': return album.current_value ? `$${album.current_value.toFixed(2)}` : '—';
      case 'My Rating': return album.my_rating ? String(album.my_rating) : '—';
      case 'Media Condition': return album.media_condition || '—';
      case 'Package/Sleeve Condition': return album.package_sleeve_condition || '—';
      default: return '—';
    }
  };

  return (
    <>
      <div className={styles.duplicatesWrapper}>
        <Header />
        
        <div className={styles.duplicatesNavBar}>
          <button onClick={onClose} className={styles.duplicatesBackButton}>
            ← Back
          </button>
          <span className={styles.duplicatesTitle}>🔍 Find Duplicates</span>
        </div>

        <div className={styles.duplicatesToolbar}>
          <span className={styles.duplicatesToolbarLabel}>Find duplicates based on</span>
          <div className={styles.duplicatesDropdownWrapper}>
            <button onClick={() => setShowMethodDropdown(!showMethodDropdown)} className={styles.duplicatesDropdownButton}>
              <span>{selectedMethodLabel}</span>
              <span className={styles.duplicatesDropdownArrow}>▼</span>
            </button>

            {showMethodDropdown && (
              <>
                <div onClick={() => setShowMethodDropdown(false)} className={styles.dropdownOverlay} />
                <div className={styles.duplicatesDropdownMenu}>
                  {detectionMethods.map(method => (
                    <button key={method.value} onClick={() => {
                      setDetectionMethod(method.value);
                      setShowMethodDropdown(false);
                    }} className={detectionMethod === method.value ? styles.duplicatesDropdownItemActive : styles.duplicatesDropdownItem}>
                      {method.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={handleFindDuplicates} disabled={loading} className={styles.duplicatesFindButton}>
            Find Duplicates
          </button>
          {searched && duplicateGroups.length > 0 && (
            <span className={styles.duplicatesCount}>
              {duplicateGroups.length} duplicates found:
            </span>
          )}
          <div className={styles.duplicatesToolbarSpacer} />
          <button onClick={() => setShowColumnFavoritesModal(true)} className={styles.duplicatesColumnButton} title="Manage Column Favorites">
            ⊞
          </button>
        </div>

        <div className={styles.duplicatesContent}>
          {searched && duplicateGroups.length > 0 && (
            <>
              <div className={styles.duplicatesTableWrapper}>
                <table className={styles.duplicatesTable}>
                  <thead>
                    <tr className={styles.duplicatesTableHeaderRow}>
                      {displayColumns.map(col => (
                        <th key={col} className={styles.duplicatesTableHeaderCell}>{col}</th>
                      ))}
                      <th className={styles.duplicatesTableHeaderCell}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicateGroups.map((group, groupIdx) => (
                      <>
                        <tr key={`group-${groupIdx}`} className={styles.duplicatesGroupRow}>
                          <td colSpan={displayColumns.length + 1} className={styles.duplicatesGroupCell}>
                            <div className={styles.duplicatesGroupHeader}>
                              <span className={styles.duplicatesGroupName}>{group.displayName}</span>
                              <div className={styles.duplicatesGroupActions}>
                                <button className={styles.duplicatesKeepButton}>
                                  Keep {group.keepCount}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {group.albums.map((album) => (
                          <tr key={`album-${album.id}`} className={styles.duplicatesAlbumRow}>
                            {displayColumns.map(col => (
                              <td key={col} className={styles.duplicatesTableCell}>{getColumnValue(album, col)}</td>
                            ))}
                            <td className={styles.duplicatesTableCell}>
                              <button onClick={() => handleRemoveAlbum(groupIdx, album.id)} className={styles.duplicatesRemoveButton}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                        {groupIdx < duplicateGroups.length - 1 && (
                          <tr key={`separator-${groupIdx}`} className={styles.duplicatesSeparator}>
                            <td colSpan={displayColumns.length + 1}></td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.duplicatesFooterActions}>
                <button onClick={handleRemoveAllAutomatically} disabled={loading || totalToRemove === 0} className={styles.duplicatesRemoveAllButton}>
                  Remove all duplicates automatically
                </button>
              </div>
            </>
          )}

          {loading && (
            <div className={styles.duplicatesLoadingInterstitial}>
              <div className={styles.duplicatesLoadingContent}>
                <div className={styles.duplicatesLoadingSpinner} />
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