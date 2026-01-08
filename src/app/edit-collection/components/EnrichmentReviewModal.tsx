// src/app/edit-collection/components/EnrichmentReviewModal.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { type ExtendedFieldConflict } from './ImportEnrichModal';
import styles from '../EditCollection.module.css';

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
  const labelColor = color === 'green' ? '#047857' : '#1d4ed8';
  const borderColor = color === 'green' ? '#10b981' : '#3b82f6';

  return (
    <div style={{ 
      border: `2px solid ${borderColor}`, 
      borderRadius: '8px', 
      padding: '12px',
      backgroundColor: color === 'green' ? '#f0fdf4' : '#eff6ff'
    }}>
      <div style={{ 
        fontSize: '11px', fontWeight: '700', color: labelColor, 
        marginBottom: '8px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' 
      }}>
        <span>{label} ({images.length})</span>
        <span>{Array.from(selectedImages).filter(img => images.includes(img)).length} Selected</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
        {images.map((url, idx) => {
          const isSelected = selectedImages.has(url);
          return (
            <div 
              key={`${idx}-${url}`} 
              onClick={() => onToggle(url)}
              style={{ 
                position: 'relative', 
                aspectRatio: '1', 
                borderRadius: '4px', 
                overflow: 'hidden', 
                cursor: 'pointer',
                border: isSelected ? `3px solid ${labelColor}` : '1px solid #d1d5db',
                opacity: isSelected ? 1 : 0.6
              }}
            >
              <Image src={url} alt="" fill style={{ objectFit: 'cover' }} unoptimized />
              {isSelected && (
                <div style={{ 
                  position: 'absolute', top: '2px', right: '2px', 
                  background: labelColor, color: 'white', borderRadius: '50%', 
                  width: '16px', height: '16px', fontSize: '10px', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}>✓</div>
              )}
            </div>
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

  const borderColor = isSelected ? (color === 'green' ? '#10b981' : '#3b82f6') : '#e5e7eb';
  const bgColor = isSelected ? (color === 'green' ? '#f0fdf4' : '#eff6ff') : 'white';
  const labelColor = color === 'green' ? '#047857' : '#1d4ed8';

  const baseStyle = {
    padding: '12px',
    borderRadius: '8px',
    border: `2px solid ${borderColor}`,
    backgroundColor: bgColor,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    position: 'relative' as const,
    height: '100%',
    minWidth: '0',
    flex: 1
  };

  const headerStyle = {
    fontSize: '11px',
    fontWeight: '700',
    color: labelColor,
    textTransform: 'uppercase' as const,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  if (isImage && typeof value === 'string') {
    return (
    <div onClick={onClick} style={baseStyle}>
       <div style={headerStyle}>
          <span>{label} {dimensions && `(${dimensions.w} x ${dimensions.h} px)`}</span>
          {isMultiSelect ? (
            <input 
              type="checkbox" 
              checked={isSelected} 
              readOnly 
              style={{ 
                cursor: 'pointer', width: '18px', height: '18px', zIndex: 50, position: 'relative', accentColor: '#3b82f6'
              }} 
            />
          ) : (
            isSelected && <span style={{ zIndex: 50, position: 'relative' }}>✓ SELECTED</span>
          )}
        </div>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
          <Image 
            src={value} 
            alt={label} 
            fill
            style={{ objectFit: 'contain' }}
            unoptimized
            onLoadingComplete={(img) => setDimensions({ w: img.naturalWidth, h: img.naturalHeight })}
            onError={() => setIsImage(false)}
          />
        </div>
      </div>
    );
  }

  const displayValue = typeof value === 'object' && value !== null 
    ? JSON.stringify(value, null, 2) 
    : String(value ?? '');

  return (
    <div onClick={onClick} style={baseStyle}>
      <div style={headerStyle}>
        <span>{label}</span>
        {isMultiSelect ? (
          <input 
            type="checkbox" 
            checked={isSelected} 
            readOnly 
            style={{ 
              cursor: 'pointer', width: '18px', height: '18px', zIndex: 50, position: 'relative'
            }} 
          />
        ) : (
          isSelected && <span style={{ zIndex: 50, position: 'relative' }}>✓ SELECTED</span>
        )}
      </div>
      <div style={{ 
        fontSize: '13px', 
        color: value ? '#111827' : '#9ca3af', 
        whiteSpace: 'pre-wrap', 
        wordBreak: 'break-word',
        fontStyle: value ? 'normal' : 'italic',
        lineHeight: '1.5',
        marginTop: '4px'
      }}>
        {value ? displayValue : 'Empty / None'}
      </div>
    </div>
  );
}

export default function EnrichmentReviewModal({ conflicts, onComplete, onCancel }: EnrichmentReviewModalProps) {
  // State tracks the RESOLVED VALUE, not just the source
  const [resolutions, setResolutions] = useState<Record<string, { value: unknown, source: string, selectedSources?: string[] }>>({});
  const [finalizedFields, setFinalizedFields] = useState<Record<string, boolean>>({});

  const groupedConflicts = useMemo(() => {
    const groups: Record<number, ExtendedFieldConflict[]> = {};
    conflicts.forEach(c => {
      if (!groups[c.album_id]) groups[c.album_id] = [];
      groups[c.album_id].push(c);
    });
    return groups;
  }, [conflicts]);

  useEffect(() => {
    const defaults: Record<string, { value: unknown, source: string }> = {};
    conflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      defaults[key] = { value: c.current_value, source: 'current' };
    });
    setResolutions(defaults);
  }, [conflicts]);

  const handleResolve = (conflict: ExtendedFieldConflict, value: unknown, source: string) => {
    const key = `${conflict.album_id}-${conflict.field_name}`;
    const MERGEABLE_FIELDS = ['genres', 'styles', 'musicians', 'credits', 'producers', 'tags', 'inner_sleeve_images', 'vinyl_label_images', 'spine_image_url'];
    const isMergeable = MERGEABLE_FIELDS.includes(conflict.field_name);

    if (isMergeable) {
      setResolutions(prev => {
        const current = prev[key] || { value: [], source: 'merge', selectedSources: [] };
        
        // Special Handling for Image Arrays (Gallery)
        if (isImageArray(conflict.current_value) || isImageArray(conflict.new_value)) {
           // For images, 'value' holds the actual selected URLs array
           const currentSelection = new Set(Array.isArray(current.value) ? current.value as string[] : []);
           const toggledUrl = String(value); // In image grid mode, value passed is the single URL toggled
           
           // If the value passed is NOT a single URL string (e.g. "Select All"), handle differently
           if (typeof value !== 'string') {
              // Fallback to standard merge if not clicking specific image
              const sources = current.selectedSources || [];
              const newSources = sources.includes(source) ? sources.filter(s => s !== source) : [...sources, source];
              // Re-calculate full set based on sources
              const mergedSet = new Set<string>();
              newSources.forEach(src => {
                const val = src === 'current' ? conflict.current_value : conflict.candidates?.[src];
                if (Array.isArray(val)) val.forEach(v => mergedSet.add(String(v)));
              });
              return { ...prev, [key]: { value: Array.from(mergedSet), source: 'merge', selectedSources: newSources } };
           }

           // Toggle individual image
           if (currentSelection.has(toggledUrl)) currentSelection.delete(toggledUrl);
           else currentSelection.add(toggledUrl);
           
           return { ...prev, [key]: { value: Array.from(currentSelection), source: 'custom', selectedSources: ['custom'] } };
        }

        // Standard Text Array Merge (Genres, etc.)
        const sources = current.selectedSources || [];
        const newSources = sources.includes(source) ? sources.filter(s => s !== source) : [...sources, source];
        const mergedSet = new Set<string>();
        newSources.forEach(src => {
          const val = src === 'current' ? conflict.current_value : conflict.candidates?.[src];
          if (Array.isArray(val)) val.forEach(v => mergedSet.add(String(v)));
          else if (val) mergedSet.add(String(val));
        });

        return { 
          ...prev, 
          [key]: { value: Array.from(mergedSet), source: 'merge', selectedSources: newSources } 
        };
      });
    } else {
      // Standard Radio-style behavior for static fields
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

  return (
    <div className={styles.importModalContainer} style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className={styles.importModalContent} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        width: '1000px', 
        maxWidth: '95vw', 
        maxHeight: '90vh', 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden', 
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
      }}>
        
        {/* HEADER */}
        <div className={styles.importModalHeader} style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>
              Review Enrichment Data
            </h3>
            <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
              {totalChanges} album{totalChanges !== 1 ? 's' : ''} with conflicting data found
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* RESTORED: Finalize All Button */}
            <button 
              onClick={() => {
                const nonMergableFields = ['image_url', 'back_image_url', 'original_release_date', 'country', 'barcode', 'year', 'format', 'label', 'catalog_no'];
                const newFinalized = { ...finalizedFields };
                conflicts.forEach(c => {
                  if (nonMergableFields.includes(c.field_name)) {
                    newFinalized[`${c.album_id}-${c.field_name}`] = true;
                  }
                });
                setFinalizedFields(newFinalized);
              }}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600', color: '#7c3aed', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '6px', cursor: 'pointer' }}
            >
              Finalize All (Static Fields)
            </button>
            <button onClick={handleSelectAllCurrent} style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600', color: '#047857', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', cursor: 'pointer' }}>
              Keep Current
            </button>
            <button onClick={handleSelectAllNew} style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600', color: '#1d4ed8', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer' }}>
              Use All New Data
            </button>
          </div>
        </div>

        {/* LIST CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f9fafb', padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {Object.values(groupedConflicts).map((group, idx) => {
              const albumInfo = group[0];
              
              return (
                <div key={idx} className={styles.importEnrichCard} style={{ padding: 0, overflow: 'hidden' }}>
                  
                  {/* ALBUM CONTEXT HEADER */}
                  <div style={{ padding: '12px 16px', backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#111827', marginRight: 'auto' }}>
                      {albumInfo.artist} - {albumInfo.title}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                      {albumInfo.format && <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db' }}>{albumInfo.format}</span>}
                      {albumInfo.year && <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db' }}>{albumInfo.year}</span>}
                    </div>
                  </div>

                  {/* CONFLICT ROWS */}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {group.map((conflict) => {
                      const key = `${conflict.album_id}-${conflict.field_name}`;
                      const selected = resolutions[key] || { value: conflict.current_value, source: 'current' };
                      const isImageArrayField = isImageArray(conflict.current_value) || isImageArray(conflict.new_value);
                      
                      return (
                        <div key={key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ fontSize: '12px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>
                                {conflict.field_name.replace(/_/g, ' ')}
                              </div>
                              {/* RESTORED: Action Bar for merging text fields OR Gallery Mode for images */}
                              {isImageArrayField ? (
                                <span style={{ fontSize: '10px', color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
                                  GALLERY MODE: Click images to Keep/Reject
                                </span>
                              ) : (
                                ['genres', 'styles', 'musicians', 'credits', 'producers', 'tags'].includes(conflict.field_name) && (
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button 
                                      onClick={() => handleResolve(conflict, conflict.current_value, 'current')}
                                      style={{ padding: '2px 8px', fontSize: '10px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                      KEEP CURRENT ONLY
                                    </button>
                                    <div style={{ padding: '2px 8px', fontSize: '10px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 'bold' }}>
                                      {selected.selectedSources?.length || 0} SOURCES SELECTED TO MERGE
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#6b7280' }}>
                              <input 
                                type="checkbox" 
                                checked={finalizedFields[key] || false}
                                onChange={(e) => setFinalizedFields(prev => ({ ...prev, [key]: e.target.checked }))}
                              />
                              Mark as Finalized
                            </label>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', alignItems: 'stretch' }}>
                            
                            {/* CURRENT VALUE */}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {isImageArrayField && Array.isArray(conflict.current_value) ? (
                                  <ImageGridSelector 
                                    label="Current Gallery"
                                    color="green"
                                    images={conflict.current_value as string[]}
                                    selectedImages={new Set(Array.isArray(selected.value) ? selected.value as string[] : [])}
                                    onToggle={(url) => handleResolve(conflict, url, 'current')}
                                  />
                                ) : (
                                  <ConflictValue 
                                    label="Current (DB)"
                                    color="green"
                                    value={conflict.current_value}
                                    isSelected={selected.source === 'current' || (selected.selectedSources?.includes('current') ?? false)}
                                    isMultiSelect={!isImageArrayField && ['genres', 'styles', 'musicians'].includes(conflict.field_name)}
                                    onClick={() => handleResolve(conflict, conflict.current_value, 'current')}
                                  />
                                )}
                            </div>

                            {/* NEW CANDIDATES */}
                            <div style={{ display: 'grid', gridTemplateColumns: isImageArrayField ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
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
                                        ) : (
                                          <ConflictValue 
                                              key={source}
                                              label={source}
                                              color="blue"
                                              value={val}
                                              isSelected={selected.source === source || (selected.selectedSources?.includes(source) ?? false)}
                                              isMultiSelect={!isImageArrayField && ['genres', 'styles', 'musicians'].includes(conflict.field_name)}
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
        <div className={styles.importButtonContainer} style={{ padding: '20px 24px', borderTop: '1px solid #e5e7eb', backgroundColor: 'white', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className={styles.importCancelButton}>Cancel</button>
          <button 
            onClick={() => onComplete(resolutions as Record<string, { value: unknown, source: string }>, finalizedFields)}
            className={styles.importConfirmButton}
            style={{ backgroundColor: '#f59e0b', cursor: 'pointer', fontWeight: '700' }}
          >
            Save Changes
          </button>
        </div>

      </div>
      </div>
    </div>
  );
}