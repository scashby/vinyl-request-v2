// src/app/edit-collection/components/EnrichmentReviewModal.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { type ExtendedFieldConflict } from './ImportEnrichModal';
import { SERVICE_ICONS } from 'lib/enrichment-data-mapping';

interface EnrichmentReviewModalProps {
  conflicts: ExtendedFieldConflict[];
  onSave: (
    resolutions: Record<string, { value: unknown, source: string, selectedSources?: string[] }>,
    finalizedFields: Record<string, boolean>,
    albumId: number
  ) => void;
  onSkip: (albumId: number) => void;
  onCancel: () => void;
}

// --- HELPERS ---

function isImageUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  return !!url.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i) || 
         url.includes('images.discogs.com') ||
         url.includes('i.scdn.co') || 
         url.includes('mzstatic.com') ||
         url.includes('coverartarchive.org');
}

function isImageArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(v => isImageUrl(v));
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

// --- MEMOIZED COMPONENTS (PERFORMANCE FIX) ---

const ImageGridSelector = React.memo(({
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
}) => {
  const isGreen = color === 'green';
  const borderColor = isGreen ? 'border-[#10b981]' : 'border-[#3b82f6]';
  const bgColor = isGreen ? 'bg-[#f0fdf4]' : 'bg-[#eff6ff]';
  const labelColor = isGreen ? 'text-[#047857]' : 'text-[#1d4ed8]';
  const borderSelected = isGreen ? 'border-[#047857]' : 'border-[#1d4ed8]';

  return (
    <div className={`border-2 rounded-lg p-3 ${borderColor} ${bgColor}`}>
      <div className={`text-[11px] font-bold uppercase mb-2 flex justify-between ${labelColor}`}>
        <span>{label} ({images.length})</span>
        <span>{Array.from(selectedImages).filter(img => images.includes(img)).length} Selected</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
        {images.map((url, idx) => {
          const isSelected = selectedImages.has(url);
          return (
            <div 
              key={`${idx}-${url}`} 
              onClick={() => onToggle(url)}
              className={`relative aspect-square rounded overflow-hidden cursor-pointer border-2 transition-all ${
                isSelected ? `border-[3px] ${borderSelected} opacity-100 shadow-md` : 'border-gray-300 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="absolute top-1 left-1 z-20 pointer-events-none">
                <input 
                  type="checkbox" 
                  checked={isSelected} 
                  readOnly 
                  className={`w-5 h-5 accent-${isGreen ? 'emerald' : 'blue'}-600 shadow-sm border-white border rounded`}
                />
              </div>
              <Image 
                src={url} 
                alt="" 
                fill
                sizes="100px"
                className="object-cover" 
                unoptimized
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
ImageGridSelector.displayName = 'ImageGridSelector';

const ArrayChipSelector = React.memo(({
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
}) => {
  const isGreen = color === 'green';
  const borderColor = isGreen ? 'border-[#10b981]' : 'border-[#3b82f6]';
  const bgColor = isGreen ? 'bg-[#f0fdf4]' : 'bg-[#eff6ff]';
  const labelColor = isGreen ? 'text-[#047857]' : 'text-[#1d4ed8]';
  
  const activeBg = isGreen ? 'bg-[#047857]' : 'bg-[#1d4ed8]';
  const activeBorder = isGreen ? 'border-[#047857]' : 'border-[#1d4ed8]';

  const uniqueItems = Array.from(new Set(items));

  return (
    <div className={`p-3 rounded-lg border-2 flex flex-col gap-2 ${borderColor} ${bgColor}`}>
      <div className={`text-[11px] font-bold uppercase ${labelColor}`}>
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {uniqueItems.map((item, idx) => {
          const isSelected = selectedItems.has(item);
          return (
            <button
              key={`${idx}-${item}`}
              onClick={() => onToggle(item)}
              className={`px-2.5 py-1 rounded-2xl text-xs cursor-pointer border transition-all flex items-center gap-1 ${
                isSelected 
                  ? `${activeBg} ${activeBorder} text-white shadow-sm` 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {isSelected && <span className="font-bold">✓</span>}
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
});
ArrayChipSelector.displayName = 'ArrayChipSelector';

const ConflictValue = React.memo(({ 
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
}) => {
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

  const getIcon = (lbl: string) => {
    const key = Object.keys(SERVICE_ICONS).find(k => lbl.toLowerCase().includes(k.toLowerCase()));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return key ? (SERVICE_ICONS as any)[key] : null;
  };

  const ContentWrapper = ({ children }: { children: React.ReactNode }) => (
    <div 
      onClick={onClick} 
      className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 flex flex-col gap-2 relative w-full ${borderColor} ${bgColor} hover:shadow-sm`}
    >
      <div className={`text-[11px] font-bold uppercase flex justify-between items-center gap-1.5 ${labelColor}`}>
        <div className="flex items-center gap-2 w-full">
           <input 
             type={isMultiSelect ? "checkbox" : "radio"} 
             checked={isSelected} 
             readOnly 
             className={`cursor-pointer w-4 h-4 accent-${isGreen ? 'emerald' : 'blue'}-600 shrink-0`}
           />
           <div className="flex items-center gap-1 flex-1 min-w-0">
             <span className="shrink-0">{getIcon(label)}</span>
             <span className="truncate" title={label}>{label} {isImage && dimensions && `(${dimensions.w}x${dimensions.h})`}</span>
           </div>
        </div>
      </div>
      {children}
    </div>
  );

  if (isImage && typeof value === 'string') {
    return (
      <ContentWrapper>
        <div className="relative w-full aspect-square bg-gray-100 rounded overflow-hidden flex items-center justify-center mt-1">
          <Image 
            src={value} 
            alt={label}
            fill
            sizes="200px"
            className="object-contain"
            onLoad={(e) => {
                if (!dimensions) {
                    setDimensions({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
                }
            }}
            onError={() => setIsImage(false)}
            loading="lazy" 
            unoptimized
          />
        </div>
      </ContentWrapper>
    );
  }

  const displayValue = typeof value === 'object' && value !== null 
    ? JSON.stringify(value, null, 2) 
    : String(value ?? '');

  const renderContent = () => {
    if (!value) return <span className="text-gray-400 italic">Empty / None</span>;
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
                onClick={(e) => e.stopPropagation()} 
                className="text-blue-600 hover:underline break-all relative z-10"
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
      <div className={`text-[13px] whitespace-pre-wrap break-words leading-relaxed pl-6 ${value ? 'not-italic' : 'italic'}`}>
        {renderContent()}
      </div>
    </ContentWrapper>
  );
});
ConflictValue.displayName = 'ConflictValue';


// --- ISOLATED CONFLICT ROW (PERFORMANCE FIX) ---
const ConflictRow = React.memo(({
    conflict,
    resolutions,
    finalizedFields,
    onResolve,
    onFinalize
}: {
    conflict: ExtendedFieldConflict;
    resolutions: Record<string, { value: unknown, source: string, selectedSources?: string[] }>;
    finalizedFields: Record<string, boolean>;
    onResolve: (conflict: ExtendedFieldConflict, value: unknown, source: string) => void;
    onFinalize: (key: string, val: boolean) => void;
}) => {
    const key = `${conflict.album_id}-${conflict.field_name}`;
    const selected = resolutions[key] || { value: conflict.current_value, source: 'current' };
    const isImageArrayField = isImageArray(conflict.current_value) || isImageArray(conflict.new_value);
    
    // Explicitly add Engineers/Producers here
    const TEXT_LIST_FIELDS = [
        'genres', 'styles', 'musicians', 'credits', 'producers', 'engineers', 
        'tags', 'label', 'labels', 'writers', 'mixers', 'composer', 'lyricist', 
        'arranger', 'samples', 'sampled_by', 'awards', 'certifications', 'songwriters'
    ];
    
    const isTextListField = TEXT_LIST_FIELDS.includes(conflict.field_name);
    // Enriched Metadata should always be treated as multi-select for merging
    const isEnrichedMetadata = conflict.field_name === 'enriched_metadata';
    
    const isMultiSelect = isTextListField || isEnrichedMetadata;

    const toArray = (v: unknown) => {
        if (Array.isArray(v)) return v.map(String);
        if (!v) return [];
        return String(v).split(/,\s*/).map(s => s.trim()).filter(Boolean);
    };

    if (isTextListField) {
        // Force Title Case for consistency
        const allCurrent = toArray(conflict.current_value).map(toTitleCase);
        const allNewItems = new Set<string>();
        
        if (conflict.candidates) {
            Object.values(conflict.candidates).forEach(val => {
                toArray(val).forEach(item => allNewItems.add(toTitleCase(item)));
            });
        } else if (conflict.new_value) {
            toArray(conflict.new_value).forEach(item => allNewItems.add(toTitleCase(item)));
        }

        const currentSet = new Set(allCurrent);
        const actualNewItems = Array.from(allNewItems).filter(item => !currentSet.has(item));

        // Calculate selected items for chips
        const selectedChipSet = new Set(toArray(selected.value));

        return (
            <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                <div className="text-xs font-bold text-gray-600 uppercase">
                    {['label', 'labels'].includes(conflict.field_name) ? 'RECORD LABELS' : conflict.field_name.replace(/_/g, ' ')}
                </div>
                <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    UNIFIED TAG REVIEW
                </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500 select-none">
                <input 
                    type="checkbox" 
                    checked={finalizedFields[key] || false}
                    onChange={(e) => onFinalize(key, e.target.checked)}
                    className="accent-blue-600"
                />
                Mark as Finalized
                </label>
            </div>
            <div className="flex flex-col gap-3">
                <ArrayChipSelector
                    label="Currently in Database"
                    color="green"
                    items={allCurrent}
                    selectedItems={selectedChipSet}
                    onToggle={(val) => onResolve(conflict, val, 'custom_merge')}
                />
                {actualNewItems.length > 0 && (
                <ArrayChipSelector
                    label="New Suggestions Found (Not in DB)"
                    color="blue"
                    items={actualNewItems}
                    selectedItems={selectedChipSet}
                    onToggle={(val) => onResolve(conflict, val, 'custom_merge')}
                />
                )}
            </div>
            </div>
        );
    }

    return (
        <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-3">
                <div className="text-xs font-bold text-gray-600 uppercase">
                {conflict.field_name.replace(/_/g, ' ')}
                </div>
                {isImageArrayField && (
                <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                    GALLERY MODE
                </span>
                )}
                {isEnrichedMetadata && (
                <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                    SMART MERGE ENABLED
                </span>
                )}
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500 select-none">
                <input 
                type="checkbox" 
                checked={finalizedFields[key] || false}
                onChange={(e) => onFinalize(key, e.target.checked)}
                className="accent-blue-600"
                />
                Mark as Finalized
            </label>
            </div>

            {/* Layout fix: items-start prevents stretching */}
            <div className="grid grid-cols-[1fr_2fr] gap-4 items-start">
            <div className="flex flex-col">
                {isImageArrayField && Array.isArray(conflict.current_value) ? (
                    <ImageGridSelector 
                        label="Current Gallery"
                        color="green"
                        images={conflict.current_value as string[]}
                        selectedImages={new Set(selected.value as string[])}
                        onToggle={(url) => onResolve(conflict, url, 'current')}
                    />
                ) : (
                    <ConflictValue 
                        label="Current (DB)"
                        color="green"
                        value={conflict.current_value}
                        isSelected={selected.selectedSources?.includes('current') ?? false}
                        isMultiSelect={isMultiSelect}
                        onClick={() => onResolve(conflict, conflict.current_value, 'current')}
                    />
                )}
            </div>

            <div className={`grid gap-3 ${isImageArrayField ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))]'}`}>
                {conflict.candidates ? (
                    Object.entries(conflict.candidates).map(([source, val]) => (
                        isImageArrayField && Array.isArray(val) ? (
                            <ImageGridSelector 
                                key={source}
                                label={`${source} Candidates`}
                                color="blue"
                                images={val as string[]}
                                selectedImages={new Set(selected.value as string[])}
                                onToggle={(url) => onResolve(conflict, url, source)}
                            />
                        ) : (
                            <ConflictValue 
                                key={source}
                                label={source}
                                color="blue"
                                value={val}
                                isSelected={selected.selectedSources?.includes(source) ?? false}
                                isMultiSelect={isMultiSelect}
                                onClick={() => onResolve(conflict, val, source)}
                            />
                        )
                    ))
                ) : (
                    <ConflictValue 
                        label={`New (${conflict.source || 'Unknown'})`}
                        color="blue"
                        value={conflict.new_value}
                        isSelected={selected.selectedSources?.includes(conflict.source || 'enrichment') ?? false}
                        isMultiSelect={isMultiSelect}
                        onClick={() => onResolve(conflict, conflict.new_value, conflict.source || 'enrichment')}
                    />
                )}
            </div>
            </div>
        </div>
    );
});
ConflictRow.displayName = 'ConflictRow';


// --- MAIN COMPONENT ---

export default function EnrichmentReviewModal({ conflicts, onSave, onSkip, onCancel }: EnrichmentReviewModalProps) {
  const currentAlbumId = conflicts.length > 0 ? conflicts[0].album_id : null;
  
  const currentConflicts = useMemo(() => 
    conflicts.filter(c => c.album_id === currentAlbumId), 
    [conflicts, currentAlbumId]
  );

  const [resolutions, setResolutions] = useState<Record<string, { value: unknown, source: string, selectedSources?: string[] }>>({});
  const [finalizedFields, setFinalizedFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!currentAlbumId) return;

    const defaults: Record<string, { value: unknown, source: string, selectedSources?: string[] }> = {};
    const autoFinalized: Record<string, boolean> = {};

    currentConflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      
      // Default to "Current"
      defaults[key] = { value: c.current_value, source: 'current', selectedSources: ['current'] };
      
      // Auto-finalize simple single-value fields (optional convenience)
      if (['artist', 'title', 'year'].includes(c.field_name)) {
         autoFinalized[key] = true;
      }
    });

    setResolutions(defaults);
    setFinalizedFields(autoFinalized);
  }, [currentAlbumId, currentConflicts]);

  const handleResolve = useCallback((conflict: ExtendedFieldConflict, value: unknown, source: string) => {
    const key = `${conflict.album_id}-${conflict.field_name}`;
    
    // Explicitly listing fields that support multi-source merging
    const MERGEABLE_FIELDS = [
      'genres', 'styles', 'musicians', 'credits', 'producers', 'engineers', 'tags', 
      'inner_sleeve_images', 'vinyl_label_images', 'spine_image_url', 
      'label', 'labels', 'writers', 'mixers', 'composer', 
      'lyricist', 'arranger', 'songwriters', 'samples', 
      'sampled_by', 'awards', 'certifications', 'enriched_metadata'
    ];
    
    if (MERGEABLE_FIELDS.includes(conflict.field_name)) {
      setResolutions(prev => {
        const currentRes = prev[key];
        const selectedSources = new Set(currentRes?.selectedSources || ['current']);

        if (source === 'custom_merge') {
            return {
                ...prev,
                [key]: { value, source: 'custom_merge', selectedSources: Array.from(selectedSources) }
            };
        }

        // Toggle logic for Radio/Checkbox approach
        if (selectedSources.has(source)) {
            selectedSources.delete(source);
        } else {
            selectedSources.add(source);
        }
        
        const newSelectedSources = Array.from(selectedSources);

        // --- ENRICHED METADATA MERGE LOGIC ---
        // For 'enriched_metadata', we are selecting which keys (sources) to include in the JSON
        if (conflict.field_name === 'enriched_metadata') {
             // For metadata, the 'value' passed in (if singular) is just one piece
             // But we need to construct the full JSON object based on selected sources.
             const newMeta: Record<string, unknown> = {};
             
             // If Current is selected, we keep current keys
             if (selectedSources.has('current') && conflict.current_value) {
                Object.assign(newMeta, conflict.current_value);
             }
             
             // If candidate sources are selected, map them
             if (conflict.candidates) {
                 Object.entries(conflict.candidates).forEach(([candSource, candVal]) => {
                     if (selectedSources.has(candSource)) {
                         // Map source back to specific keys if needed, 
                         // or just rely on the Import logic that passed them in as sourceValues.
                         // Wait, in ImportEnrichModal we passed: 
                         // fieldCandidates['enriched_metadata'][source] = value;
                         // So candVal IS the note text.
                         // We need to decide a key for it.
                         if (candSource === 'wikipedia') newMeta['wiki_bio'] = candVal;
                         else if (candSource === 'discogs') newMeta['media_notes'] = candVal;
                         else if (candSource === 'allmusic') newMeta['review'] = candVal;
                         else newMeta[`${candSource}_notes`] = candVal;
                     }
                 });
             }

             return {
                ...prev,
                [key]: {
                   value: newMeta,
                   source: 'custom_merge',
                   selectedSources: newSelectedSources
                }
             };
        }

        // --- ARRAY MERGING LOGIC ---
        const combinedItems = new Set<string>();
        const addItems = (val: unknown) => {
            const arr = Array.isArray(val) ? val : (val ? [val] : []);
            arr.forEach(v => combinedItems.add(toTitleCase(String(v))));
        };

        if (selectedSources.has('current')) addItems(conflict.current_value);
        if (conflict.candidates) {
            Object.entries(conflict.candidates).forEach(([candSource, candVal]) => {
                if (selectedSources.has(candSource)) addItems(candVal);
            });
        } else if (selectedSources.has(conflict.source)) {
            addItems(conflict.new_value);
        }

        return { 
          ...prev, 
          [key]: { 
            value: Array.from(combinedItems), 
            source: 'custom_merge',
            selectedSources: newSelectedSources 
          } 
        };
      });
    } else {
      // Standard Radio Selection (Single Value - Artist, Title, Year)
      setResolutions(prev => ({ 
          ...prev, 
          [key]: { value, source, selectedSources: [source] } 
      }));
    }
  }, []);

  const handleFinalizeKey = useCallback((key: string, val: boolean) => {
      setFinalizedFields(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleSelectAllNew = useCallback(() => {
    const newResolutions: Record<string, { value: unknown, source: string, selectedSources?: string[] }> = {};
    currentConflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      newResolutions[key] = { value: c.new_value, source: c.source || 'enrichment', selectedSources: [c.source || 'enrichment'] };
    });
    setResolutions(newResolutions);
  }, [currentConflicts]);

  const handleSelectAllCurrent = useCallback(() => {
    const newResolutions: Record<string, { value: unknown, source: string, selectedSources?: string[] }> = {};
    currentConflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      newResolutions[key] = { value: c.current_value, source: 'current', selectedSources: ['current'] };
    });
    setResolutions(newResolutions);
  }, [currentConflicts]);

  const handleFinalizeStatic = useCallback(() => {
    const NON_STATIC_FIELDS = [
      'genres', 'styles', 'musicians', 'credits', 'producers', 'tags', 
      'inner_sleeve_images', 'vinyl_label_images', 'spine_image_url', 
      'label', 'labels', 'engineers', 'writers', 'mixers', 'composer', 
      'lyricist', 'arranger', 'songwriters', 'tracks', 
      'samples', 'sampled_by', 'awards', 'certifications', 'enriched_metadata'
    ];

    const newFinalized = { ...finalizedFields };
    currentConflicts.forEach(c => {
      if (!NON_STATIC_FIELDS.includes(c.field_name)) {
         newFinalized[`${c.album_id}-${c.field_name}`] = true;
      }
    });
    setFinalizedFields(newFinalized);
  }, [currentConflicts, finalizedFields]);

  if (!currentAlbumId || currentConflicts.length === 0) return null;

  const albumInfo = currentConflicts[0];
  const uniqueAlbumsLeft = new Set(conflicts.map(c => c.album_id)).size;

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
              <span className="font-bold text-blue-600">{uniqueAlbumsLeft}</span> albums remaining in queue
            </div>
          </div>
          
          <div className="flex gap-3">
             <button onClick={handleFinalizeStatic} className="px-3 py-2 text-[12px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-md hover:bg-violet-100">
               Finalize Static Fields
             </button>
             <button onClick={handleSelectAllCurrent} className="px-3 py-2 text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100">
               Reset to Current
             </button>
             <button onClick={handleSelectAllNew} className="px-3 py-2 text-[12px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100">
               Use All New
             </button>
          </div>
        </div>

        {/* LIST CONTENT */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm mb-6">
              
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
              <div className="p-4 flex flex-col gap-8">
                {currentConflicts.map((conflict) => (
                    <ConflictRow 
                        key={`${conflict.album_id}-${conflict.field_name}`}
                        conflict={conflict}
                        resolutions={resolutions}
                        finalizedFields={finalizedFields}
                        onResolve={handleResolve}
                        onFinalize={handleFinalizeKey}
                    />
                ))}
              </div>
            </div>
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-gray-200 flex justify-between items-center gap-3 bg-white">
          <div className="text-xs text-gray-500 font-medium italic">
             Changes are saved to the database immediately upon clicking Save & Next.
          </div>

          <div className="flex gap-3">
            <button onClick={onCancel} className="px-4 py-2 bg-white border border-gray-300 rounded text-sm font-medium cursor-pointer text-gray-700 hover:bg-gray-50">
               Stop Review
            </button>
            <button 
              onClick={() => onSkip(currentAlbumId)}
              className="px-4 py-2 bg-gray-100 border border-gray-300 rounded text-sm font-medium cursor-pointer text-gray-700 hover:bg-gray-200"
            >
              Skip (Snooze)
            </button>
            <button 
              onClick={() => onSave(resolutions, finalizedFields, currentAlbumId)}
              className="px-6 py-2 border-none rounded text-sm font-bold shadow-sm transition-colors bg-amber-500 text-white cursor-pointer hover:bg-amber-600"
            >
              Save & Next Album →
            </button>
          </div>
        </div>

      </div> 
      </div>
    </div>
  );
}