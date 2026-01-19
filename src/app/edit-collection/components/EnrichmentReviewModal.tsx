// src/app/edit-collection/components/EnrichmentReviewModal.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { type ExtendedFieldConflict } from './ImportEnrichModal';
import { SERVICE_ICONS } from 'lib/enrichment-data-mapping';

interface EnrichmentReviewModalProps {
  conflicts: ExtendedFieldConflict[];
  onComplete: (
    resolutions: Record<string, { value: unknown, source: string }>,
    finalizedFields: Record<string, boolean>
  ) => void;
  onCancel: () => void;
}

// --- HELPER: Image Detection ---
function isImageUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  return !!url.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i) || 
         url.includes('images.discogs.com') ||
         url.includes('i.scdn.co') || 
         url.includes('mzstatic.com');
}

function isSimpleArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(v => typeof v === 'string' || typeof v === 'number');
}

function isImageArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(v => isImageUrl(v));
}

// --- COMPONENT: Image Grid Selector (For Galleries) ---
function ImageGridSelector({
  images,
  selectedImages,
  onToggle,
  label,
  color
}: {
  images: string[];
  selectedImages: Set<string>;
  onToggle: (url: string) => void;
  label: string;
  color: 'green' | 'blue';
}) {
  const isGreen = color === 'green';
  const borderColor = isGreen ? 'border-[#10b981]' : 'border-[#3b82f6]';
  const bgColor = isGreen ? 'bg-[#f0fdf4]' : 'bg-[#eff6ff]';
  const labelColor = isGreen ? 'text-[#047857]' : 'text-[#1d4ed8]';
  const labelBg = isGreen ? 'bg-[#047857]' : 'bg-[#1d4ed8]';
  const borderSelected = isGreen ? 'border-[#047857]' : 'border-[#1d4ed8]';

  return (
    <div className={`border-2 rounded-lg p-3 ${borderColor} ${bgColor}`}>
      <div className={`text-[11px] font-bold uppercase mb-2 flex justify-between ${labelColor}`}>
        <span>{label} ({images.length})</span>
        <span>{Array.from(selectedImages).filter(img => images.includes(img)).length} Selected</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
        {images.map((url, idx) => {
          const isSelected = selectedImages.has(url);
          return (
            <div 
              key={`${idx}-${url}`} 
              onClick={() => onToggle(url)}
              className={`relative aspect-square rounded overflow-hidden cursor-pointer border ${
                isSelected ? `border-[3px] ${borderSelected} opacity-100` : 'border-gray-300 opacity-60'
              }`}
            >
              <Image src={url} alt="" fill style={{ objectFit: 'cover' }} unoptimized />
              {isSelected && (
                <div className={`absolute top-0.5 right-0.5 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center ${labelBg}`}>
                  ✓
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- COMPONENT: Granular Array Selection (Phase 4) ---
function ArrayChipSelector({
  items,
  selectedItems,
  onToggle,
  label,
  color
}: {
  items: string[];
  selectedItems: Set<string>;
  onToggle: (item: string) => void;
  label: string;
  color: 'green' | 'blue';
}) {
  const isGreen = color === 'green';
  const borderColor = isGreen ? 'border-[#10b981]' : 'border-[#3b82f6]';
  const bgColor = isGreen ? 'bg-[#f0fdf4]' : 'bg-[#eff6ff]';
  const labelColor = isGreen ? 'text-[#047857]' : 'text-[#1d4ed8]';
  
  // Dynamic styles for chips
  const activeBg = isGreen ? 'bg-[#047857]' : 'bg-[#1d4ed8]';
  const activeBorder = isGreen ? 'border-[#047857]' : 'border-[#1d4ed8]';

  return (
    <div className={`p-3 rounded-lg border-2 flex flex-col gap-2 flex-1 ${borderColor} ${bgColor}`}>
      <div className={`text-[11px] font-bold uppercase ${labelColor}`}>
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, idx) => {
          const isSelected = selectedItems.has(item);
          return (
            <button
              key={`${idx}-${item}`}
              onClick={() => onToggle(item)}
              className={`px-2.5 py-1 rounded-2xl text-xs cursor-pointer border transition-all ${
                isSelected 
                  ? `${activeBg} ${activeBorder} text-white` 
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {isSelected ? '✓ ' : ''}{item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- HELPER: Standard Value Component ---
function ConflictValue({ 
  value, 
  onClick, 
  isSelected, 
  label, 
  color,
  isMultiSelect = false 
}: { 
  value: unknown; 
  onClick: () => void; 
  isSelected: boolean; 
  label: string;
  color: 'green' | 'blue';
  isMultiSelect?: boolean; 
}) {
  const [dimensions, setDimensions] = useState<{ w: number, h: number } | null>(null);
  const [isImage, setIsImage] = useState(false);

  useEffect(() => {
    if (isImageUrl(value)) setIsImage(true);
  }, [value]);

  const isGreen = color === 'green';
  const borderColor = isSelected 
    ? (isGreen ? 'border-[#10b981]' : 'border-[#3b82f6]') 
    : 'border-gray-200';
  const bgColor = isSelected 
    ? (isGreen ? 'bg-[#f0fdf4]' : 'bg-[#eff6ff]') 
    : 'bg-white';
  const labelColor = isGreen ? 'text-[#047857]' : 'text-[#1d4ed8]';

  // Helper to get icon
  const getIcon = (lbl: string) => {
    const key = Object.keys(SERVICE_ICONS).find(k => lbl.toLowerCase().includes(k.toLowerCase()));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return key ? (SERVICE_ICONS as any)[key] : null;
  };

  const ContentWrapper = ({ children }: { children: React.ReactNode }) => (
    <div 
      onClick={onClick} 
      className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 flex flex-col gap-2 relative h-full min-w-0 flex-1 ${borderColor} ${bgColor}`}
    >
      <div className={`text-[11px] font-bold uppercase flex justify-between items-center gap-1.5 ${labelColor}`}>
        <div className="flex items-center gap-1">
           <span>{getIcon(label)}</span>
           <span>{label} {isImage && dimensions && `(${dimensions.w} x ${dimensions.h} px)`}</span>
        </div>
        {isMultiSelect ? (
          <input 
            type="checkbox" 
            checked={isSelected} 
            readOnly 
            className="cursor-pointer w-4 h-4 z-50 relative accent-blue-500"
          />
        ) : (
          isSelected && <span className="z-50 relative">✓ SELECTED</span>
        )}
      </div>
      {children}
    </div>
  );

  if (isImage && typeof value === 'string') {
    return (
      <ContentWrapper>
        <div className="relative w-full aspect-square bg-gray-100 rounded overflow-hidden flex items-center justify-center">
          {/* Switched to standard img tag to avoid Next.js mixed-content loops and performance overhead on large lists */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={value} 
            alt={label}
            className="max-w-full max-h-full object-contain"
            loading="lazy"
            onLoad={(e) => {
              const img = e.currentTarget;
              setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
            }}
            onError={() => setIsImage(false)}
          />
        </div>
      </ContentWrapper>
    );
  }

  const displayValue = typeof value === 'object' && value !== null 
    ? JSON.stringify(value, null, 2) 
    : String(value ?? '');

  // Detect and render links if the value contains http/https
  const renderContent = () => {
    if (!value) return 'Empty / None';
    
    // Simple URL detection
    if (typeof value === 'string' && (value.includes('http://') || value.includes('https://'))) {
      const parts = value.split(/(https?:\/\/[^\s]+)/g);
      return (
        <>
          {parts.map((part, i) => 
            part.match(/^https?:\/\//) ? (
              <a 
                key={i} 
                href={part} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()} // Prevent selecting the card when clicking link
                className="text-blue-600 hover:underline break-all relative z-50"
              >
                {part}
              </a>
            ) : part
          )}
        </>
      );
    }
    return displayValue;
  };

  return (
    <ContentWrapper>
      <div className={`text-[13px] whitespace-pre-wrap break-words leading-relaxed mt-1 ${value ? 'not-italic' : 'italic'}`}>
        {renderContent()}
      </div>
    </ContentWrapper>
  );
}

export default function EnrichmentReviewModal({ conflicts, onComplete, onCancel }: EnrichmentReviewModalProps) {
  // State tracks the RESOLVED VALUE, not just the source
  const [resolutions, setResolutions] = useState<Record<string, { value: unknown, source: string, selectedSources?: string[] }>>({});
  const [finalizedFields, setFinalizedFields] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 5;

  // Scroll to top on page change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [page]);

  const groupedConflicts = useMemo(() => {
    const groups: Record<number, ExtendedFieldConflict[]> = {};
    conflicts.forEach(c => {
      // 1. Skip Tracks if DB already has data (User request: don't review if populated)
      if (c.field_name === 'tracks' && Array.isArray(c.current_value) && c.current_value.length > 0) return;

      if (!groups[c.album_id]) groups[c.album_id] = [];
      groups[c.album_id].push(c);
    });
    return groups;
  }, [conflicts]);

  useEffect(() => {
    const defaults: Record<string, { value: unknown, source: string }> = {};
    const autoFinalized: Record<string, boolean> = {};

    conflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      defaults[key] = { value: c.current_value, source: 'current' };

      // Auto-finalize TRACKS if DB already has data (User Preference)
      if (c.field_name === 'tracks' && Array.isArray(c.current_value) && c.current_value.length > 0) {
        autoFinalized[key] = true;
      }
    });
    setResolutions(defaults);
    setFinalizedFields(prev => ({ ...prev, ...autoFinalized }));
  }, [conflicts]);

  const handleResolve = (conflict: ExtendedFieldConflict, value: unknown, source: string) => {
    const key = `${conflict.album_id}-${conflict.field_name}`;
    
    // Explicit list of fields that support "Chip Selection" (Merging)
    // Note: 'labels' covers both 'label' and 'labels' keys due to normalization
    const MERGEABLE_FIELDS = [
      'genres', 'styles', 'musicians', 'credits', 'producers', 'tags', 
      'inner_sleeve_images', 'vinyl_label_images', 'spine_image_url', 
      'label', 'labels', 'engineers', 'writers', 'mixers', 'composer', 'lyricist', 'arranger', 'songwriters'
    ];
    
    const isMergeable = MERGEABLE_FIELDS.includes(conflict.field_name);

    if (isMergeable) {
      setResolutions(prev => {
        // Get currently selected items (or default to current value if first interaction)
        const currentRes = prev[key];
        let currentItems: Set<string>;

        if (currentRes) {
           currentItems = new Set(Array.isArray(currentRes.value) ? (currentRes.value as string[]).map(String) : []);
        } else {
           // Default state: 'current' value is selected
           currentItems = new Set(Array.isArray(conflict.current_value) ? (conflict.current_value as string[]).map(String) : []);
        }

        // Handle Image Gallery vs Text Chips
        if (isImageArray(conflict.current_value) || isImageArray(conflict.new_value)) {
           // Image Mode: Toggle the specific URL passed in 'value'
           const urlToToggle = String(value);
           if (currentItems.has(urlToToggle)) currentItems.delete(urlToToggle);
           else currentItems.add(urlToToggle);
        } else {
           // Text Mode: Handle Chip Clicks
           // If 'value' is an array (e.g. user clicked "Select All New" or a source box), add all
           if (Array.isArray(value)) {
              (value as string[]).forEach(v => currentItems.add(String(v)));
           } 
           // If 'value' is a single string (clicked a specific chip), toggle it
           else {
              const strVal = String(value);
              if (currentItems.has(strVal)) currentItems.delete(strVal);
              else currentItems.add(strVal);
           }
        }

        return { 
          ...prev, 
          [key]: { 
            value: Array.from(currentItems), 
            source: 'custom_merge', // Mark as custom so UI knows it's a mix
            selectedSources: ['custom'] 
          } 
        };
      });
    } else {
      // Standard Radio-style behavior for static fields (Date, Country, Barcode)
      setResolutions(prev => ({ ...prev, [key]: { value, source } }));
    }
  };

  const handleSelectAllNew = () => {
    const newResolutions: Record<string, { value: unknown, source: string, selectedSources?: string[] }> = {};
    conflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      newResolutions[key] = { value: c.new_value, source: c.source || 'enrichment', selectedSources: [c.source || 'enrichment'] };
    });
    setResolutions(newResolutions);
  };

  const handleSelectAllCurrent = () => {
    const newResolutions: Record<string, { value: unknown, source: string, selectedSources?: string[] }> = {};
    conflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      newResolutions[key] = { value: c.current_value, source: 'current', selectedSources: ['current'] };
    });
    setResolutions(newResolutions);
  };

  const totalChanges = Object.keys(groupedConflicts).length;
  const groups = Object.values(groupedConflicts);
  const totalPages = Math.ceil(groups.length / ITEMS_PER_PAGE);
  const visibleGroups = groups.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30000]">
      <div className="flex-1 overflow-auto p-5 h-full flex justify-center items-center">
      <div className="bg-white rounded-xl w-[1000px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* HEADER */}
        <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-white">
          <div>
            <h3 className="m-0 text-xl font-bold">
              Review Enrichment Data
            </h3>
            <div className="text-sm text-gray-500 mt-1">
              {totalChanges} album{totalChanges !== 1 ? 's' : ''} with conflicting data found
            </div>
          </div>
          
          <div className="flex gap-3">
            {/* RESTORED: Finalize All Button */}
            <button 
              onClick={() => {
                const nonMergableFields = ['image_url', 'back_image_url', 'original_release_date', 'country', 'barcode', 'year', 'format', 'catalog_no', 'tracks'];
                const newFinalized = { ...finalizedFields };
                conflicts.forEach(c => {
                  if (nonMergableFields.includes(c.field_name)) {
                    newFinalized[`${c.album_id}-${c.field_name}`] = true;
                  }
                });
                setFinalizedFields(newFinalized);
              }}
              className="px-4 py-2 text-[13px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-md cursor-pointer hover:bg-violet-200 transition-all shadow-sm active:bg-violet-300"
            >
              Finalize All (Static Fields)
            </button>
            <button onClick={handleSelectAllCurrent} className="px-4 py-2 text-[13px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md cursor-pointer hover:bg-emerald-100">
              Keep Current
            </button>
            <button onClick={handleSelectAllNew} className="px-4 py-2 text-[13px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md cursor-pointer hover:bg-blue-100">
              Use All New Data
            </button>
          </div>
        </div>

        {/* LIST CONTENT */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6" ref={listRef}>
          <div className="flex flex-col gap-6">
            {visibleGroups.map((group, idx) => {
              const albumInfo = group[0];
              
              return (
                <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  
                  {/* ALBUM CONTEXT HEADER */}
                  <div className="p-4 border-b border-gray-200 flex gap-4 items-center flex-wrap bg-gray-50/50">
                    <div className="font-bold text-[15px] mr-auto">
                      {albumInfo.artist} - {albumInfo.title}
                    </div>
                    <div className="flex gap-2 text-xs">
                      {albumInfo.format && <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 border border-gray-300">{albumInfo.format}</span>}
                      {albumInfo.year && <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 border border-gray-300">{albumInfo.year}</span>}
                    </div>
                  </div>

                  {/* CONFLICT ROWS */}
                  <div className="p-4 flex flex-col gap-6">
                    {group.map((conflict) => {
                      const key = `${conflict.album_id}-${conflict.field_name}`;
                      const selected = resolutions[key] || { value: conflict.current_value, source: 'current' };
                      const isImageArrayField = isImageArray(conflict.current_value) || isImageArray(conflict.new_value);
                      
                      // Define fields that should behave as mergeable lists (Chips)
                      // Added 'labels' to ensure Multi-Select works for Record Labels
                      const TEXT_LIST_FIELDS = ['genres', 'styles', 'musicians', 'credits', 'producers', 'tags', 'label', 'labels', 'engineers', 'writers', 'mixers', 'composer', 'lyricist', 'arranger'];
                      const isTextListField = TEXT_LIST_FIELDS.includes(conflict.field_name);

                      // Helper to normalize values to array for Chip Selector
                      const toArray = (v: unknown): string[] => {
                        if (Array.isArray(v)) return v.map(String);
                        if (!v) return [];
                        return String(v).split(/,\s*/).map(s => s.trim()).filter(Boolean);
                      };

                      return (
                        <div key={key}>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-3">
                              <div className="text-xs font-bold text-gray-600 uppercase">
                                {['label', 'labels'].includes(conflict.field_name) ? 'RECORD LABELS' : conflict.field_name.replace(/_/g, ' ')}
                              </div>
                              {/* Action Bar for merging text fields OR Gallery Mode for images */}
                              {isImageArrayField ? (
                                <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                  GALLERY MODE: Click images to Keep/Reject
                                </span>
                              ) : (
                                isTextListField && (
                                  <div className="flex gap-2 items-center">
                                    <button 
                                      onClick={() => handleResolve(conflict, conflict.current_value, 'current')}
                                      className="px-2 py-0.5 text-[10px] rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold cursor-pointer hover:bg-emerald-100"
                                    >
                                      KEEP CURRENT ONLY
                                    </button>
                                    <div className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                                      {selected.selectedSources?.length || 0} SOURCES SELECTED TO MERGE
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500 select-none">
                              <input 
                                type="checkbox" 
                                checked={finalizedFields[key] || false}
                                onChange={(e) => setFinalizedFields(prev => ({ ...prev, [key]: e.target.checked }))}
                                className="accent-blue-600"
                              />
                              Mark as Finalized
                            </label>
                          </div>

                          <div className="grid grid-cols-[1fr_2fr] gap-4 items-stretch">
                            
                            {/* CURRENT VALUE */}
                            <div className="flex flex-col">
                                {isImageArrayField && Array.isArray(conflict.current_value) ? (
                                  <ImageGridSelector 
                                    label="Current Gallery"
                                    color="green"
                                    images={conflict.current_value as string[]}
                                    selectedImages={new Set(Array.isArray(selected.value) ? selected.value as string[] : [])}
                                    onToggle={(url) => handleResolve(conflict, url, 'current')}
                                  />
                                ) : (isTextListField || isSimpleArray(conflict.current_value)) ? (
                                  <ArrayChipSelector
                                    label="Current (DB)"
                                    color="green"
                                    items={toArray(conflict.current_value)}
                                    selectedItems={new Set(Array.isArray(selected.value) ? selected.value as string[] : [])}
                                    onToggle={(val) => handleResolve(conflict, val, 'current')}
                                  />
                                ) : (
                                  <ConflictValue 
                                    label="Current (DB)"
                                    color="green"
                                    value={conflict.current_value}
                                    isSelected={selected.source === 'current' || (selected.selectedSources?.includes('current') ?? false)}
                                    isMultiSelect={false}
                                    onClick={() => handleResolve(conflict, conflict.current_value, 'current')}
                                  />
                                )}
                            </div>

                            {/* NEW CANDIDATES */}
                            <div className={`grid gap-3 ${isImageArrayField ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))]'}`}>
                                {conflict.candidates ? (
                                    Object.entries(conflict.candidates).map(([source, val]) => (
                                        isImageArrayField && Array.isArray(val) ? (
                                          <ImageGridSelector 
                                            key={source}
                                            label={`${source} Candidates`}
                                            color="blue"
                                            images={val as string[]}
                                            selectedImages={new Set(Array.isArray(selected.value) ? selected.value as string[] : [])}
                                            onToggle={(url) => handleResolve(conflict, url, source)}
                                          />
                                        ) : (isTextListField || isSimpleArray(val)) ? (
                                          <ArrayChipSelector
                                            key={source}
                                            label={source}
                                            color="blue"
                                            items={toArray(val)}
                                            selectedItems={new Set(Array.isArray(selected.value) ? selected.value as string[] : [])}
                                            onToggle={(item) => handleResolve(conflict, item, source)}
                                          />
                                        ) : (
                                          <ConflictValue 
                                              key={source}
                                              label={source}
                                              color="blue"
                                              value={val}
                                              isSelected={selected.source === source || (selected.selectedSources?.includes(source) ?? false)}
                                              isMultiSelect={false}
                                              onClick={() => handleResolve(conflict, val, source)}
                                          />
                                        )
                                    ))
                                ) : (
                                    // Fallback if no detailed candidates map
                                    isImageArrayField && Array.isArray(conflict.new_value) ? (
                                      <ImageGridSelector 
                                        label="New Candidates"
                                        color="blue"
                                        images={conflict.new_value as string[]}
                                        selectedImages={new Set(Array.isArray(selected.value) ? selected.value as string[] : [])}
                                        onToggle={(url) => handleResolve(conflict, url, 'enrichment')}
                                      />
                                    ) : (
                                      <ConflictValue 
                                          label={`New (${conflict.source || 'Unknown'})`}
                                          color="blue"
                                          value={conflict.new_value}
                                          isSelected={selected.source === (conflict.source || 'enrichment')}
                                          onClick={() => handleResolve(conflict, conflict.new_value, conflict.source || 'enrichment')}
                                      />
                                    )
                                )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-gray-200 flex justify-between items-center gap-3 bg-white">
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 bg-white border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="flex items-center text-sm font-medium text-gray-600">
                Page {page + 1} of {totalPages || 1}
              </span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 bg-white border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
            <div className="text-[10px] text-gray-500 font-medium italic pl-1">
              Selections are retained across pages. Save applies to all albums.
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onCancel} className="px-6 py-2 bg-white border-2 border-gray-300 rounded text-sm font-medium cursor-pointer text-gray-700 hover:bg-gray-50">Cancel</button>
            <button 
              onClick={() => onComplete(resolutions as Record<string, { value: unknown, source: string }>, finalizedFields)}
              disabled={page < (totalPages || 1) - 1}
              className={`px-6 py-2 border-none rounded text-sm font-bold shadow-sm transition-colors ${
                page < (totalPages || 1) - 1
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-amber-500 text-white cursor-pointer hover:bg-amber-600'
              }`}
            >
              Save Changes
            </button>
          </div>
        </div>

      </div> {/* Closes Modal Card */}
      </div> {/* Closes Scroll Wrapper */}
    </div>
  );
}