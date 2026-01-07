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

// --- HELPER: Smart Value Component ---
function ConflictValue({ 
  value, 
  onClick, 
  isSelected, 
  label, 
  color,
  isMultiSelect = false // NEW
}: { 
  value: unknown; 
  onClick: () => void; 
  isSelected: boolean; 
  label: string;
  color: 'green' | 'blue';
  isMultiSelect?: boolean; // NEW
}) {
  const [dimensions, setDimensions] = useState<{ w: number, h: number } | null>(null);
  const [isImage, setIsImage] = useState(false);

  useEffect(() => {
    if (typeof value === 'string') {
      const url = value.toLowerCase();
      if (
        url.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i) || 
        url.includes('images.discogs.com') ||
        url.includes('i.scdn.co') || 
        url.includes('mzstatic.com')
      ) {
        setIsImage(true);
      }
    }
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
              style={{ cursor: 'pointer', width: '16px', height: '16px' }} 
            />
          ) : (
            isSelected && <span>✓ SELECTED</span>
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
        {isSelected && <span>✓ SELECTED</span>}
      </div>
      <div style={{ 
        fontSize: '13px', 
        color: value ? '#111827' : '#9ca3af', 
        whiteSpace: 'pre-wrap', 
        wordBreak: 'break-word',
        fontStyle: value ? 'normal' : 'italic',
        lineHeight: '1.5'
      }}>
        {value ? displayValue : 'Empty / None'}
      </div>
    </div>
  );
}

export default function EnrichmentReviewModal({ conflicts, onComplete, onCancel }: EnrichmentReviewModalProps) {
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
    const MERGEABLE_FIELDS = ['genres', 'styles', 'musicians', 'credits', 'producers', 'tags'];
    const isMergeable = MERGEABLE_FIELDS.includes(conflict.field_name);

    if (isMergeable) {
      setResolutions(prev => {
        const current = prev[key] || { value: [], source: 'merge', selectedSources: [] };
        const sources = current.selectedSources || [];
        // Toggle the source: add if missing, remove if present
        const newSources = sources.includes(source) ? sources.filter(s => s !== source) : [...sources, source];
        
        // Construct the merged value (Unique Array)
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
      // Standard Radio-style behavior for static fields (Image, Date, etc)
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
            <button 
              onClick={() => {
                const nonMergableFields = ['image_url', 'original_release_date', 'country', 'barcode', 'year'];
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
            <button 
              onClick={handleSelectAllCurrent}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600', color: '#047857', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', cursor: 'pointer' }}
            >
              Keep Current
            </button>
            <button 
              onClick={handleSelectAllNew}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600', color: '#1d4ed8', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer' }}
            >
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
                    
                    {/* Identification Badges */}
                    <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                      {albumInfo.format && (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db' }}>
                          {albumInfo.format}
                        </span>
                      )}
                      {albumInfo.year && (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db' }}>
                          {albumInfo.year}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CONFLICT ROWS */}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {group.map((conflict) => {
                      const key = `${conflict.album_id}-${conflict.field_name}`;
                      const selected = resolutions[key] || { value: conflict.current_value, source: 'current' };
                      
                      return (
                        <div key={key}>
                          {/* UPDATED: Row Header with Finalize Checkbox */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>
                              {conflict.field_name.replace(/_/g, ' ')}
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#6b7280' }}>
                              <input 
                                type="checkbox" 
                                checked={finalizedFields[key] || false}
                                onChange={(e) => setFinalizedFields(prev => ({
                                  ...prev, 
                                  [key]: e.target.checked
                                }))}
                              />
                              Mark as Finalized
                            </label>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', alignItems: 'stretch' }}>
                            {/* Option A: Current Database Value */}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <ConflictValue 
                                  label="Current (DB)"
                                  color="green"
                                  value={conflict.current_value}
                                  isSelected={selected.source === 'current' || (selected.selectedSources?.includes('current') ?? false)}
                                  isMultiSelect={['genres', 'styles', 'musicians', 'credits', 'producers', 'tags'].includes(conflict.field_name)}
                                  onClick={() => handleResolve(conflict, conflict.current_value, 'current')}
                                />
                            </div>

                            {/* Option B: Grouped Candidates Grid (Multi-Source Selection) */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                {conflict.candidates ? (
                                    Object.entries(conflict.candidates).map(([source, val]) => (
                                        <ConflictValue 
                                            key={source}
                                            label={source}
                                            color="blue"
                                            value={val}
                                            isSelected={selected.source === source || (selected.selectedSources?.includes(source) ?? false)}
                                            isMultiSelect={['genres', 'styles', 'musicians', 'credits', 'producers', 'tags'].includes(conflict.field_name)}
                                            onClick={() => handleResolve(conflict, val, source)}
                                        />
                                    ))
                                ) : (
                                    /* Fallback for legacy single-source data if map is missing */
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
              );
            })}
          </div>
        </div>

        {/* FOOTER */}
        <div className={styles.importButtonContainer} style={{ padding: '20px 24px', borderTop: '1px solid #e5e7eb', backgroundColor: 'white', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className={styles.importCancelButton}>
            Cancel
          </button>
          <button 
            onClick={() => onComplete(resolutions, finalizedFields)}
            className={styles.importConfirmButton}
            style={{ backgroundColor: '#f59e0b', cursor: 'pointer' }}
          >
            Save Changes
          </button>
        </div>

      </div>
      </div>
    </div>
  );
}