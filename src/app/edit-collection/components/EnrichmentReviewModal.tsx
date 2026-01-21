// src/app/edit-collection/components/EnrichmentReviewModal.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { type ExtendedFieldConflict } from './ImportEnrichModal';
import { SERVICE_ICONS } from 'lib/enrichment-data-mapping';

interface EnrichmentReviewModalProps {
  conflicts: ExtendedFieldConflict[];
  onSave: (
    resolutions: Record<string, { value: unknown, source: string }>,
    finalizedFields: Record<string, boolean>,
    albumId: number
  ) => void;
  onSkip: (albumId: number) => void;
  onCancel: () => void;
}

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
  
  const activeBg = isGreen ? 'bg-[#047857]' : 'bg-[#1d4ed8]';
  const activeBorder = isGreen ? 'border-[#047857]' : 'border-[#1d4ed8]';

  // Deduplicate items for display to prevent duplicates
  const uniqueItems = Array.from(new Set(items));

  return (
    <div className={`p-3 rounded-lg border-2 flex flex-col gap-2 flex-1 ${borderColor} ${bgColor}`}>
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

  const renderContent = () => {
    if (!value) return 'Empty / None';
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

    const defaults: Record<string, { value: unknown, source: string }> = {};
    const autoFinalized: Record<string, boolean> = {};

    currentConflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      defaults[key] = { value: c.current_value, source: 'current' };

      if (c.field_name === 'tracks' && Array.isArray(c.current_value) && c.current_value.length > 0) {
        autoFinalized[key] = true;
      }
    });

    setResolutions(defaults);
    setFinalizedFields(autoFinalized);
  }, [currentAlbumId, currentConflicts]);

  const handleResolve = (conflict: ExtendedFieldConflict, value: unknown, source: string) => {
    const key = `${conflict.album_id}-${conflict.field_name}`;
    
    const MERGEABLE_FIELDS = [
      'genres', 'styles', 'musicians', 'credits', 'producers', 'tags', 
      'inner_sleeve_images', 'vinyl_label_images', 'spine_image_url', 
      'label', 'labels', 'engineers', 'writers', 'mixers', 'composer', 'lyricist', 'arranger', 'songwriters'
    ];
    
    if (MERGEABLE_FIELDS.includes(conflict.field_name)) {
      setResolutions(prev => {
        const currentRes = prev[key];
        const currentVal = currentRes ? currentRes.value : conflict.current_value;
        const currentArray = Array.isArray(currentVal) ? currentVal : (currentVal ? [currentVal] : []);
        const currentItems = new Set(currentArray.map(String));

        if (Array.isArray(value)) {
            value.forEach(v => currentItems.add(String(v)));
        } else {
            const strVal = String(value);
            if (currentItems.has(strVal)) currentItems.delete(strVal);
            else currentItems.add(strVal);
        }

        return { 
          ...prev, 
          [key]: { 
            value: Array.from(currentItems), 
            source: 'custom_merge',
            selectedSources: ['custom'] 
          } 
        };
      });
    } else {
      setResolutions(prev => ({ ...prev, [key]: { value, source } }));
    }
  };

  const handleSelectAllNew = () => {
    const newResolutions: Record<string, { value: unknown, source: string, selectedSources?: string[] }> = {};
    currentConflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      newResolutions[key] = { value: c.new_value, source: c.source || 'enrichment', selectedSources: [c.source || 'enrichment'] };
    });
    setResolutions(newResolutions);
  };

  const handleSelectAllCurrent = () => {
    const newResolutions: Record<string, { value: unknown, source: string, selectedSources?: string[] }> = {};
    currentConflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      newResolutions[key] = { value: c.current_value, source: 'current', selectedSources: ['current'] };
    });
    setResolutions(newResolutions);
  };

  const handleFinalizeAll = () => {
    const newFinalized = { ...finalizedFields };
    currentConflicts.forEach(c => {
      newFinalized[`${c.album_id}-${c.field_name}`] = true;
    });
    setFinalizedFields(newFinalized);
  };

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
             <button onClick={handleFinalizeAll} className="px-3 py-2 text-[12px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-md hover:bg-violet-100">
               Finalize All Fields
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
                {currentConflicts.map((conflict) => {
                  const key = `${conflict.album_id}-${conflict.field_name}`;
                  const selected = resolutions[key] || { value: conflict.current_value, source: 'current' };
                  const isImageArrayField = isImageArray(conflict.current_value) || isImageArray(conflict.new_value);
                  const TEXT_LIST_FIELDS = ['genres', 'styles', 'musicians', 'credits', 'producers', 'tags', 'label', 'labels', 'engineers', 'writers', 'mixers', 'composer', 'lyricist', 'arranger'];
                  const isTextListField = TEXT_LIST_FIELDS.includes(conflict.field_name);
                  const toArray = (v: unknown) => {
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
                          {isImageArrayField ? (
                            <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                              GALLERY MODE
                            </span>
                          ) : isTextListField && (
                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              MERGEABLE LIST
                            </span>
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
                              <ConflictValue 
                                  label={`New (${conflict.source || 'Unknown'})`}
                                  color="blue"
                                  value={conflict.new_value}
                                  isSelected={selected.source === (conflict.source || 'enrichment')}
                                  onClick={() => handleResolve(conflict, conflict.new_value, conflict.source || 'enrichment')}
                              />
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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