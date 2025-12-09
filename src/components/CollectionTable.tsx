// src/components/CollectionTable.tsx
'use client';

import React, { memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Album } from '../types/album';
import { 
  ColumnId, 
  getVisibleColumns,
  splitColumnsByLock,
  SortState 
} from '../app/edit-collection/columnDefinitions';

interface CollectionTableProps {
  albums: Album[];
  onAlbumClick: (album: Album) => void;
  selectedAlbums: Set<string>;
  onSelectionChange: (albumIds: Set<string>) => void;
  visibleColumns: ColumnId[];
  lockedColumns: ColumnId[];
  onColumnLockToggle: (columnId: ColumnId) => void;
  sortState: SortState;
  onSortChange: (column: ColumnId) => void;
}

const ROW_HEIGHT = 32;

const CollectionTable = memo(function CollectionTable({
  albums,
  onAlbumClick,
  selectedAlbums,
  onSelectionChange,
  visibleColumns,
  lockedColumns,
  onColumnLockToggle,
  sortState,
  onSortChange
}: CollectionTableProps) {
  const scrollableRef = useRef<HTMLDivElement>(null);
  const lockedHeaderRef = useRef<HTMLDivElement>(null);
  const scrollableHeaderRef = useRef<HTMLDivElement>(null);
  
  const allColumns = useMemo(() => getVisibleColumns(visibleColumns), [visibleColumns]);
  const { locked, unlocked } = useMemo(
    () => splitColumnsByLock(allColumns, lockedColumns),
    [allColumns, lockedColumns]
  );

  const virtualizer = useVirtualizer({
    count: albums.length,
    getScrollElement: () => scrollableRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  // Sync horizontal scroll between scrollable header and body
  useEffect(() => {
    const scrollableElement = scrollableRef.current;
    const headerElement = scrollableHeaderRef.current;
    
    if (!scrollableElement || !headerElement) return;

    const handleScroll = () => {
      headerElement.scrollLeft = scrollableElement.scrollLeft;
    };

    scrollableElement.addEventListener('scroll', handleScroll);
    return () => scrollableElement.removeEventListener('scroll', handleScroll);
  }, []);

  const formatters = useMemo(() => {
    const formatLength = (seconds: number | null | undefined): string => {
      if (!seconds) return '—';
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    const formatDate = (date: string | Date | null | undefined): string => {
      if (!date) return '—';
      try {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return '—';
      }
    };

    const formatCurrency = (value: number | null | undefined): string => {
      if (!value) return '—';
      return `$${value.toFixed(2)}`;
    };

    const formatArray = (arr: string[] | null | undefined): string => {
      if (!arr || arr.length === 0) return '—';
      return arr.join(', ');
    };

    return {
      checkbox: () => null,
      owned: () => <span style={{ color: '#22c55e', fontSize: '14px' }}>✓</span>,
      for_sale_indicator: (album: Album) => album.for_sale ? <span style={{ color: '#f59e0b', fontSize: '14px' }}>$</span> : null,
      menu: () => <span style={{ color: '#2196F3', fontSize: '14px', cursor: 'pointer' }}>✏</span>,
      artist: (album: Album) => album.artist || '—',
      title: (album: Album) => (
        <span 
          style={{ color: '#0066cc', textDecoration: 'none', cursor: 'pointer' }}
          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
        >
          {album.title || '—'}
        </span>
      ),
      year: (album: Album) => album.year || '—',
      barcode: (album: Album) => album.barcode || '—',
      cat_no: (album: Album) => album.cat_no || '—',
      sort_title: (album: Album) => album.sort_title || '—',
      subtitle: (album: Album) => album.subtitle || '—',
      index_number: (album: Album) => album.index_number || '—',
      format: (album: Album) => album.format || '—',
      discs: (album: Album) => album.discs || '—',
      tracks: (album: Album) => album.spotify_total_tracks || album.apple_music_track_count || '—',
      length: (album: Album) => formatLength(album.length_seconds),
      box_set: (album: Album) => album.is_box_set ? 'Yes' : 'No',
      country: (album: Album) => album.country || '—',
      extra: (album: Album) => album.extra || '—',
      is_live: (album: Album) => album.is_live ? 'Yes' : 'No',
      media_condition: (album: Album) => album.media_condition || '—',
      package_sleeve_condition: (album: Album) => album.package_sleeve_condition || '—',
      packaging: (album: Album) => album.packaging || '—',
      rpm: (album: Album) => album.rpm || '—',
      sound: (album: Album) => album.sound || '—',
      spars_code: (album: Album) => album.spars_code || '—',
      storage_device_slot: (album: Album) => album.storage_device_slot || '—',
      studio: (album: Album) => album.studio || '—',
      vinyl_color: (album: Album) => album.vinyl_color || '—',
      vinyl_weight: (album: Album) => album.vinyl_weight || '—',
      genres: (album: Album) => formatArray(album.discogs_genres || album.spotify_genres),
      styles: (album: Album) => formatArray(album.discogs_styles),
      label: (album: Album) => album.spotify_label || album.apple_music_label || '—',
      original_release_date: (album: Album) => formatDate(album.original_release_date),
      original_release_year: (album: Album) => album.original_release_year || '—',
      recording_date: (album: Album) => formatDate(album.recording_date),
      recording_year: (album: Album) => album.recording_year || '—',
      master_release_date: (album: Album) => album.master_release_date || '—',
      chorus: (album: Album) => album.chorus || '—',
      composer: (album: Album) => album.composer || '—',
      composition: (album: Album) => album.composition || '—',
      conductor: (album: Album) => album.conductor || '—',
      orchestra: (album: Album) => album.orchestra || '—',
      engineers: (album: Album) => formatArray(album.engineers),
      musicians: (album: Album) => formatArray(album.musicians),
      producers: (album: Album) => formatArray(album.producers),
      songwriters: (album: Album) => formatArray(album.songwriters),
      added_date: (album: Album) => formatDate(album.date_added),
      collection_status: (album: Album) => album.collection_status || '—',
      folder: (album: Album) => album.folder || '—',
      location: (album: Album) => album.location || '—',
      my_rating: (album: Album) => album.my_rating ? '⭐'.repeat(album.my_rating) : '—',
      notes: (album: Album) => album.notes || '—',
      owner: (album: Album) => album.owner || '—',
      play_count: (album: Album) => album.play_count || 0,
      last_played_date: (album: Album) => formatDate(album.last_played_date),
      last_cleaned_date: (album: Album) => formatDate(album.last_cleaned_date),
      signed_by: (album: Album) => formatArray(album.signed_by),
      custom_tags: (album: Album) => formatArray(album.custom_tags),
      modified_date: (album: Album) => formatDate(album.modified_date),
      due_date: (album: Album) => formatDate(album.due_date),
      loan_date: (album: Album) => formatDate(album.loan_date),
      loaned_to: (album: Album) => album.loaned_to || '—',
      for_sale: (album: Album) => album.for_sale ? 'Yes' : 'No',
      purchase_date: (album: Album) => formatDate(album.purchase_date),
      purchase_store: (album: Album) => album.purchase_store || '—',
      purchase_price: (album: Album) => formatCurrency(album.purchase_price),
      current_value: (album: Album) => formatCurrency(album.current_value),
      sale_price: (album: Album) => formatCurrency(album.sale_price),
      sale_platform: (album: Album) => album.sale_platform || '—',
      sale_quantity: (album: Album) => album.sale_quantity || '—',
      wholesale_cost: (album: Album) => formatCurrency(album.wholesale_cost),
      discogs_price_min: (album: Album) => formatCurrency(album.discogs_price_min),
      discogs_price_median: (album: Album) => formatCurrency(album.discogs_price_median),
      discogs_price_max: (album: Album) => formatCurrency(album.discogs_price_max),
      pricing_notes: (album: Album) => album.pricing_notes || '—',
      spotify_popularity: (album: Album) => album.spotify_popularity || '—'
    } as Record<string, (album: Album) => React.ReactNode>;
  }, []);

  const handleSelectAll = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.target.checked) {
      onSelectionChange(new Set(albums.map(album => String(album.id))));
    } else {
      onSelectionChange(new Set());
    }
  }, [albums, onSelectionChange]);

  const allSelected = albums.length > 0 && selectedAlbums.size === albums.length;
  const someSelected = selectedAlbums.size > 0 && selectedAlbums.size < albums.length;

  const handleHeaderClick = useCallback((columnId: ColumnId, sortable?: boolean) => {
    if (sortable) {
      onSortChange(columnId);
    }
  }, [onSortChange]);

  const getSortIndicator = useCallback((columnId: ColumnId) => {
    if (sortState.column !== columnId) return null;
    return sortState.direction === 'asc' ? ' ▲' : ' ▼';
  }, [sortState]);

  const handleRowClick = useCallback((album: Album) => {
    onAlbumClick(album);
  }, [onAlbumClick]);

  const handleCheckboxClick = useCallback((e: React.ChangeEvent<HTMLInputElement>, albumId: string) => {
    e.stopPropagation();
    const newSelected = new Set(selectedAlbums);
    if (e.target.checked) {
      newSelected.add(albumId);
    } else {
      newSelected.delete(albumId);
    }
    onSelectionChange(newSelected);
  }, [selectedAlbums, onSelectionChange]);

  const renderHeaderCell = useCallback((col: ReturnType<typeof getVisibleColumns>[0]) => {
    const isColumnLocked = lockedColumns.includes(col.id);
    
    return (
      <div
        key={col.id}
        onClick={() => handleHeaderClick(col.id, col.sortable)}
        style={{
          width: col.width,
          minWidth: col.width,
          maxWidth: col.width,
          padding: '8px',
          fontWeight: 600,
          color: '#212529',
          borderRight: '1px solid #d0d0d0',
          whiteSpace: 'nowrap',
          fontSize: '13px',
          cursor: col.sortable ? 'pointer' : 'default',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '4px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, overflow: 'hidden' }}>
          {col.id === 'checkbox' ? (
            <input
              type="checkbox"
              checked={allSelected}
              ref={input => {
                if (input) {
                  input.indeterminate = someSelected;
                }
              }}
              onChange={handleSelectAll}
              onClick={(e) => e.stopPropagation()}
              style={{ cursor: 'pointer' }}
            />
          ) : (
            <>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.label}</span>
              {col.sortable && (
                <span style={{ 
                  color: sortState.column === col.id ? '#2196F3' : '#999',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}>
                  {getSortIndicator(col.id) || '⇅'}
                </span>
              )}
            </>
          )}
        </div>
        {col.lockable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onColumnLockToggle(col.id);
            }}
            title={isColumnLocked ? 'Unlock column' : 'Lock column'}
            style={{
              background: 'none',
              border: 'none',
              color: isColumnLocked ? '#2196F3' : '#999',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              lineHeight: '1'
            }}
          >
            {isColumnLocked ? '🔒' : '🔓'}
          </button>
        )}
      </div>
    );
  }, [allSelected, someSelected, sortState, lockedColumns, handleSelectAll, handleHeaderClick, getSortIndicator, onColumnLockToggle]);

  const renderCellContent = useCallback((col: ReturnType<typeof getVisibleColumns>[0], album: Album, albumId: string, isSelected: boolean) => {
    if (col.id === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => handleCheckboxClick(e, albumId)}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'pointer' }}
        />
      );
    }
    return formatters[col.id]?.(album) || '—';
  }, [formatters, handleCheckboxClick]);

  const virtualItems = virtualizer.getVirtualItems();

  const lockedWidth = locked.reduce((sum, col) => sum + parseInt(col.width), 0);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Headers */}
      <div style={{ display: 'flex', flexShrink: 0 }}>
        {/* Locked Headers */}
        {locked.length > 0 && (
          <div 
            ref={lockedHeaderRef}
            style={{
              width: `${lockedWidth}px`,
              flexShrink: 0,
              overflowX: 'hidden',
              overflowY: 'hidden'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#e8e8e8',
              borderBottom: '2px solid #d0d0d0',
              borderRight: '2px solid #999'
            }}>
              {locked.map(col => renderHeaderCell(col))}
            </div>
          </div>
        )}
        
        {/* Scrollable Headers */}
        {unlocked.length > 0 && (
          <div 
            ref={scrollableHeaderRef}
            style={{
              flex: 1,
              overflowX: 'hidden',
              overflowY: 'hidden'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#e8e8e8',
              borderBottom: '2px solid #d0d0d0'
            }}>
              {unlocked.map(col => renderHeaderCell(col))}
            </div>
          </div>
        )}
      </div>
      
      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Locked Columns Body */}
        {locked.length > 0 && (
          <div style={{
            width: `${lockedWidth}px`,
            flexShrink: 0,
            overflow: 'hidden',
            position: 'relative',
            borderRight: '2px solid #999'
          }}>
            <div style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}>
              {virtualItems.map(virtualRow => {
                const album = albums[virtualRow.index];
                const albumId = String(album.id);
                const isSelected = selectedAlbums.has(albumId);

                return (
                  <div
                    key={`locked-${virtualRow.key}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#e3f2fd' : virtualRow.index % 2 === 0 ? 'white' : '#fafafa',
                      borderBottom: '1px solid #e0e0e0'
                    }}
                    onClick={() => handleRowClick(album)}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = virtualRow.index % 2 === 0 ? 'white' : '#fafafa';
                      }
                    }}
                  >
                    {locked.map(col => (
                      <div
                        key={col.id}
                        style={{
                          width: col.width,
                          minWidth: col.width,
                          maxWidth: col.width,
                          padding: '6px 8px',
                          borderRight: '1px solid #e0e0e0',
                          color: '#212529',
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {renderCellContent(col, album, albumId, isSelected)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Scrollable Columns Body */}
        {unlocked.length > 0 && (
          <div ref={scrollableRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            <div style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}>
              {virtualItems.map(virtualRow => {
                const album = albums[virtualRow.index];
                const albumId = String(album.id);
                const isSelected = selectedAlbums.has(albumId);

                return (
                  <div
                    key={`unlocked-${virtualRow.key}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#e3f2fd' : virtualRow.index % 2 === 0 ? 'white' : '#fafafa',
                      borderBottom: '1px solid #e0e0e0'
                    }}
                    onClick={() => handleRowClick(album)}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = virtualRow.index % 2 === 0 ? 'white' : '#fafafa';
                      }
                    }}
                  >
                    {unlocked.map(col => (
                      <div
                        key={col.id}
                        style={{
                          width: col.width,
                          minWidth: col.width,
                          maxWidth: col.width,
                          padding: '6px 8px',
                          borderRight: '1px solid #e0e0e0',
                          color: '#212529',
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {renderCellContent(col, album, albumId, isSelected)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.albums === nextProps.albums &&
    prevProps.visibleColumns === nextProps.visibleColumns &&
    prevProps.lockedColumns === nextProps.lockedColumns &&
    prevProps.selectedAlbums === nextProps.selectedAlbums &&
    prevProps.sortState.column === nextProps.sortState.column &&
    prevProps.sortState.direction === nextProps.sortState.direction
  );
});

export default CollectionTable;