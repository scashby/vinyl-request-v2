// src/components/CollectionTable.tsx
'use client';

import React, { memo, useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Album } from '../types/album';
import { 
  ColumnId, 
  getVisibleColumns,
  splitColumnsByLock,
  SortState 
} from '../app/edit-collection/columnDefinitions';
import { getDisplayFormat } from '../utils/formatDisplay';

interface CollectionTableProps {
  albums: Album[];
  onAlbumClick: (album: Album) => void;
  selectedAlbums: Set<string>;
  onSelectionChange: (albumIds: Set<string>) => void;
  visibleColumns: ColumnId[];
  lockedColumns: ColumnId[];
  sortState: SortState;
  onSortChange: (column: ColumnId) => void;
  onEditAlbum: (albumId: number) => void;
}

const ROW_HEIGHT = 32;

const CollectionTable = memo(function CollectionTable({
  albums,
  onAlbumClick,
  selectedAlbums,
  onSelectionChange,
  visibleColumns,
  lockedColumns,
  sortState,
  onSortChange,
  onEditAlbum
}: CollectionTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const allColumns = useMemo(() => getVisibleColumns(visibleColumns), [visibleColumns]);
  const { locked, unlocked } = useMemo(
    () => splitColumnsByLock(allColumns, lockedColumns),
    [allColumns, lockedColumns]
  );

  const virtualizer = useVirtualizer({
    count: albums.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const formatters = useMemo(() => {
    const getAlbumArtist = (album: Album) =>
      album.release?.master?.artist?.name || '—';

    const getAlbumTitle = (album: Album) =>
      album.release?.master?.title || '—';

    const getAlbumYear = (album: Album) =>
      album.release?.release_year ||
      album.release?.master?.original_release_year ||
      '—';

    const getAlbumFormat = (album: Album) => {
      const release = album.release;
      if (!release) return '';
      const parts = [release.media_type, ...(release.format_details ?? [])].filter(Boolean);
      const base = parts.join(', ');
      const qty = release.qty ?? 1;
      if (!base) return '';
      return qty > 1 ? `${qty}x${base}` : base;
    };

    const getAlbumGenres = (album: Album) =>
      album.release?.master?.genres || null;

    const getAlbumStyles = (album: Album) =>
      album.release?.master?.styles || null;

    const getAlbumLabels = (album: Album) => {
      const releaseLabel = album.release?.label;
      return releaseLabel ? [releaseLabel] : null;
    };

    const getAlbumBarcode = (album: Album) =>
      album.release?.barcode || '—';

    const getAlbumCatalogNumber = (album: Album) =>
      album.release?.catalog_number || '—';

    const getAlbumLocation = (album: Album) =>
      album.location || '—';

    const getAlbumStatus = (album: Album) =>
      album.status || '—';

    const getAlbumTags = (album: Album) =>
      (album.release?.master?.master_tag_links ?? [])
        .map((link) => link.master_tags?.name)
        .filter((name): name is string => Boolean(name));

    const getTrackCount = (album: Album): number => {
      const tracks = album.release?.release_tracks ?? [];
      return tracks.length;
    };

    const getTotalDuration = (album: Album): number | null => {
      const tracks = album.release?.release_tracks ?? [];
      if (tracks.length === 0) return null;
      const total = tracks.reduce((sum, track) => sum + (track.recording?.duration_seconds ?? 0), 0);
      return total > 0 ? total : null;
    };

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
      owned: () => <span className="text-green-500 text-sm">✓</span>,
      for_sale_indicator: (album: Album) => album.status === 'for_sale' ? <span className="text-amber-500 text-sm">$</span> : null,
      menu: (album: Album) => (
        <span 
          className="text-blue-500 text-sm cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onEditAlbum(album.id);
          }}
        >
          ✏
        </span>
      ),
      artist: (album: Album) => getAlbumArtist(album),
      title: (album: Album) => (
        <span 
          className="text-blue-700 no-underline cursor-pointer hover:underline"
        >
          {getAlbumTitle(album)}
        </span>
      ),
      year: (album: Album) => getAlbumYear(album),
      barcode: (album: Album) => getAlbumBarcode(album),
      cat_no: (album: Album) => getAlbumCatalogNumber(album),
      sort_title: () => '—',
      subtitle: () => '—',
      index_number: () => '—',
      format: (album: Album) => getDisplayFormat(getAlbumFormat(album)),
      discs: (album: Album) => album.release?.qty ?? '—',
      tracks: (album: Album) => (getTrackCount(album) > 0 ? getTrackCount(album) : '—'),
      length: (album: Album) => formatLength(getTotalDuration(album)),
      box_set: () => '—',
      country: (album: Album) => album.release?.country || '—',
      extra: () => '—',
      is_live: () => '—',
      media_condition: (album: Album) => album.media_condition || '—',
      package_sleeve_condition: (album: Album) => album.sleeve_condition || '—',
      packaging: () => '—',
      rpm: () => '—',
      sound: () => '—',
      spars_code: () => '—',
      storage_device_slot: () => '—',
      studio: () => '—',
      vinyl_color: () => '—',
      vinyl_weight: () => '—',
      
      genres: (album: Album) => formatArray(getAlbumGenres(album)),
      styles: (album: Album) => formatArray(getAlbumStyles(album)),
      label: (album: Album) => formatArray(getAlbumLabels(album)),
      original_release_date: () => '—',
      original_release_year: (album: Album) => album.release?.master?.original_release_year || '—',
      recording_date: () => '—',
      recording_year: () => '—',
      master_release_date: (album: Album) => album.release?.release_date || '—',
      chorus: () => '—',
      composer: () => '—',
      composition: () => '—',
      conductor: () => '—',
      orchestra: () => '—',
      engineers: () => '—',
      musicians: () => '—',
      producers: () => '—',
      songwriters: () => '—',
      added_date: (album: Album) => formatDate(album.date_added),
      collection_status: (album: Album) => getAlbumStatus(album),
      location: (album: Album) => getAlbumLocation(album),
      my_rating: () => '—',
      notes: (album: Album) => album.personal_notes || '—',
      owner: (album: Album) => album.owner || '—',
      play_count: (album: Album) => album.play_count || 0,
      last_played_date: (album: Album) => formatDate(album.last_played_at),
      last_cleaned_date: () => '—',
      signed_by: () => '—',
      custom_tags: (album: Album) => formatArray(getAlbumTags(album)),
      modified_date: () => '—',
      due_date: () => '—',
      loan_date: () => '—',
      loaned_to: () => '—',
      for_sale: (album: Album) => album.status === 'for_sale' ? 'Yes' : 'No',
      purchase_date: (album: Album) => formatDate(album.purchase_date),
      purchase_store: () => '—',
      purchase_price: (album: Album) => formatCurrency(album.purchase_price),
      current_value: (album: Album) => formatCurrency(album.current_value),
      sale_price: () => '—',
      sale_platform: () => '—',
      sale_quantity: () => '—',
      wholesale_cost: () => '—',
      pricing_notes: () => '—',
    } as Record<string, (album: Album) => React.ReactNode>;
  }, [onEditAlbum]);

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

  const renderHeaderCell = useCallback((col: ReturnType<typeof getVisibleColumns>[0], leftPosition?: number) => {
    const isLocked = typeof leftPosition === 'number';
    const isLastLocked = isLocked && leftPosition + parseInt(col.width) === locked.reduce((sum, c) => sum + parseInt(c.width), 0);
    
    return (
      <div
        key={col.id}
        onClick={() => handleHeaderClick(col.id, col.sortable)}
        className={`px-2 py-2 font-semibold text-gray-800 border-b-2 border-gray-300 text-[13px] whitespace-nowrap select-none flex items-center gap-1 ${
          col.sortable ? 'cursor-pointer hover:bg-gray-200' : 'cursor-default'
        } ${isLastLocked ? 'border-r-2 border-r-gray-400' : 'border-r border-gray-300'}`}
        style={{
          width: col.width,
          minWidth: col.width,
          maxWidth: col.width,
          ...(isLocked && {
            position: 'sticky',
            left: `${leftPosition}px`,
            zIndex: 3,
            background: '#e8e8e8',
          })
        }}
      >
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
            className="cursor-pointer m-0"
          />
        ) : (
          <>
            <span className="truncate">{col.label}</span>
            {col.sortable && (
              <span className={`text-[11px] font-bold ${sortState.column === col.id ? 'text-blue-500' : 'text-gray-400'}`}>
                {getSortIndicator(col.id) || '⇅'}
              </span>
            )}
          </>
        )}
      </div>
    );
  }, [allSelected, someSelected, sortState, handleSelectAll, handleHeaderClick, getSortIndicator, locked]);

  const renderCellContent = useCallback((col: ReturnType<typeof getVisibleColumns>[0], album: Album, albumId: string, isSelected: boolean) => {
    if (col.id === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => handleCheckboxClick(e, albumId)}
          onClick={(e) => e.stopPropagation()}
          className="cursor-pointer m-0"
        />
      );
    }
    return formatters[col.id]?.(album) || '—';
  }, [formatters, handleCheckboxClick]);

  const virtualItems = virtualizer.getVirtualItems();

  const unlockedWidth = unlocked.reduce((sum, col) => sum + parseInt(col.width), 0);
  const lockedWidth = locked.reduce((sum, col) => sum + parseInt(col.width), 0);

  return (
    <div ref={scrollRef} className="w-full h-full overflow-auto relative">
      <div className="sticky top-0 z-[2] flex items-stretch bg-[#e8e8e8] min-w-fit">
        {locked.map((col, index) => {
          const leftPosition = locked.slice(0, index).reduce((sum, c) => sum + parseInt(c.width), 0);
          return renderHeaderCell(col, leftPosition);
        })}
        {unlocked.map(col => renderHeaderCell(col))}
      </div>
      
      <div 
        className="relative min-w-fit"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: `${unlockedWidth + lockedWidth}px`,
        }}
      >
        {virtualItems.map(virtualRow => {
          const album = albums[virtualRow.index];
          const albumId = String(album.id);
          const isSelected = selectedAlbums.has(albumId);
          const rowBg = isSelected ? '#e3f2fd' : virtualRow.index % 2 === 0 ? 'white' : '#fafafa';

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'flex',
                alignItems: 'stretch',
                cursor: 'pointer',
              }}
              onClick={() => handleRowClick(album)}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  const cells = e.currentTarget.querySelectorAll('[data-cell]');
                  cells.forEach((cell) => {
                    (cell as HTMLElement).style.backgroundColor = '#f5f5f5';
                  });
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  const cells = e.currentTarget.querySelectorAll('[data-cell]');
                  cells.forEach((cell) => {
                    (cell as HTMLElement).style.backgroundColor = rowBg;
                  });
                }
              }}
            >
              {locked.map((col, index) => {
                const leftPosition = locked.slice(0, index).reduce((sum, c) => sum + parseInt(c.width), 0);
                const isLastLocked = index === locked.length - 1;
                
                return (
                  <div
                    key={col.id}
                    data-cell
                    className={`h-full px-2 py-1.5 border-b border-gray-200 text-gray-900 text-[13px] whitespace-nowrap overflow-hidden text-ellipsis flex items-center box-border ${
                      isLastLocked ? 'border-r-2 border-r-gray-400' : 'border-r border-gray-200'
                    }`}
                    style={{
                      width: col.width,
                      minWidth: col.width,
                      maxWidth: col.width,
                      position: 'sticky',
                      left: `${leftPosition}px`,
                      zIndex: 1,
                      backgroundColor: rowBg,
                    }}
                  >
                    {renderCellContent(col, album, albumId, isSelected)}
                  </div>
                );
              })}
              
              {unlocked.map(col => (
                <div
                  key={col.id}
                  data-cell
                  className="h-full px-2 py-1.5 border-b border-r border-gray-200 text-gray-900 text-[13px] whitespace-nowrap overflow-hidden text-ellipsis flex items-center box-border"
                  style={{
                    width: col.width,
                    minWidth: col.width,
                    maxWidth: col.width,
                    backgroundColor: rowBg,
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
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.albums === nextProps.albums &&
    prevProps.visibleColumns === nextProps.visibleColumns &&
    prevProps.lockedColumns === nextProps.lockedColumns &&
    prevProps.selectedAlbums === nextProps.selectedAlbums &&
    prevProps.sortState.column === nextProps.sortState.column &&
    prevProps.sortState.direction === nextProps.sortState.direction &&
    prevProps.onEditAlbum === nextProps.onEditAlbum
  );
});

export default CollectionTable;
