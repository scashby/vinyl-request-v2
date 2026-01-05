// src/app/edit-collection/components/EnrichmentReviewModal.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { type FieldConflict } from 'lib/conflictDetection';

// --- HELPER: Smart Value Component ---
function ConflictValue({ 
  value, 
  onClick, 
  isSelected, 
  label, 
  color 
}: { 
  value: unknown; 
  onClick: () => void; 
  isSelected: boolean; 
  label: string;
  color: 'green' | 'blue';
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
    minWidth: '0'
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
          <span>{label}</span>
          {isSelected && <span>✓ SELECTED</span>}
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
        <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', marginTop: 'auto', paddingTop: '4px' }}>
          {dimensions ? `${dimensions.w} x ${dimensions.h} px` : 'Loading...'}
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

// --- HELPERS ---
const areValuesEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    // Simple sort comparison for arrays
    return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  }
  return JSON.stringify(a) === JSON.stringify(b);
};

const mergeArrays = (a: unknown, b: unknown): unknown[] | null => {
  if (!Array.isArray(a) || !Array.isArray(b)) return null;
  // Combine and deduplicate
  const set = new Set([...a, ...b]);
  return Array.from(set).sort();
};

interface EnrichmentReviewModalProps {
  conflicts: FieldConflict[];
  onComplete: (resolutions: Record<string, unknown>) => void;
  onCancel: () => void;
}

export default function EnrichmentReviewModal({ conflicts, onComplete, onCancel }: EnrichmentReviewModalProps) {
  // Map of "AlbumID-FieldName" -> Selected Value
  const [resolutions, setResolutions] = useState<Record<string, unknown>>({});

  const groupedConflicts = useMemo(() => {
    const groups: Record<number, FieldConflict[]> = {};
    conflicts.forEach(c => {
      if (!groups[c.album_id]) groups[c.album_id] = [];
      groups[c.album_id].push(c);
    });
    return groups;
  }, [conflicts]);

  // Initial Auto-Select: Default to KEEP CURRENT
  useEffect(() => {
    const defaults: Record<string, unknown> = {};
    conflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      defaults[key] = c.current_value; 
    });
    setResolutions(defaults);
  }, [conflicts]);

  const handleResolve = (conflict: FieldConflict, value: unknown) => {
    const key = `${conflict.album_id}-${conflict.field_name}`;
    setResolutions(prev => ({ ...prev, [key]: value }));
  };

  const handleSelectAllNew = () => {
    const newResolutions: Record<string, unknown> = {};
    conflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      newResolutions[key] = c.new_value;
    });
    setResolutions(newResolutions);
  };

  const handleSelectAllCurrent = () => {
    const newResolutions: Record<string, unknown> = {};
    conflicts.forEach(c => {
      const key = `${c.album_id}-${c.field_name}`;
      newResolutions[key] = c.current_value;
    });
    setResolutions(newResolutions);
  };

  const handleSave = () => {
    // Pass the resolutions map back to parent instead of mutating props
    onComplete(resolutions);
  };

  const totalChanges = Object.keys(groupedConflicts).length;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
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
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              onClick={handleSelectAllCurrent}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '600', color: '#047857', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', cursor: 'pointer' }}
            >
              Keep All Current
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
                <div key={idx} style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  
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
                      {albumInfo.cat_no && (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db' }}>
                          Cat: {albumInfo.cat_no}
                        </span>
                      )}
                      {albumInfo.country && (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db' }}>
                          {albumInfo.country}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CONFLICT ROWS */}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {group.map((conflict) => {
                      const key = `${conflict.album_id}-${conflict.field_name}`;
                      const selected = resolutions[key];
                      
                      // Check for merge capability
                      const mergedValue = mergeArrays(conflict.current_value, conflict.new_value);
                      const isMergeable = mergedValue !== null;

                      return (
                        <div key={key}>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#4b5563', marginBottom: '8px', textTransform: 'uppercase' }}>
                            {conflict.field_name.replace(/_/g, ' ')}
                          </div>
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: isMergeable ? '1fr 1fr 1fr' : '1fr 1fr', 
                            gap: '16px' 
                          }}>
                            {/* Option A: Current */}
                            <ConflictValue 
                              label="Current"
                              color="green"
                              value={conflict.current_value}
                              isSelected={areValuesEqual(selected, conflict.current_value)}
                              onClick={() => handleResolve(conflict, conflict.current_value)}
                            />
                            
                            {/* Option B: Merge (If Array) */}
                            {isMergeable && (
                              <ConflictValue 
                                label="Combined"
                                color="blue"
                                value={mergedValue}
                                isSelected={areValuesEqual(selected, mergedValue)}
                                onClick={() => handleResolve(conflict, mergedValue)}
                              />
                            )}

                            {/* Option C: New */}
                            <ConflictValue 
                              // @ts-expect-error - source added in previous step
                              label={`New Data (${conflict.source || 'Unknown'})`}
                              color="blue"
                              value={conflict.new_value}
                              isSelected={areValuesEqual(selected, conflict.new_value)}
                              onClick={() => handleResolve(conflict, conflict.new_value)}
                            />
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
        <div style={{ padding: '20px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: 'white' }}>
          <button onClick={onCancel} style={{ padding: '10px 24px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', color: '#374151', fontWeight: '600' }}>
            Cancel
          </button>
          <button 
            onClick={handleSave}
            style={{ 
              padding: '10px 32px', 
              backgroundColor: '#f59e0b', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.3)'
            }}
          >
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
}