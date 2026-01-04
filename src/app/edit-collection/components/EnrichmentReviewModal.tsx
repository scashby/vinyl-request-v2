// src/app/edit-collection/components/EnrichmentReviewModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { type FieldConflict } from 'lib/conflictDetection';

interface EnrichmentReviewModalProps {
  conflicts: FieldConflict[];
  onComplete: () => void;
  onCancel: () => void;
}

// --- HELPER: Smart Value Component ---
function ConflictValue({ value, onClick, isSelected, label }: { value: unknown, onClick: () => void, isSelected: boolean, label: string }) {
  const [dimensions, setDimensions] = useState<{ w: number, h: number } | null>(null);
  const [isImage, setIsImage] = useState(false);

  // Detect image URLs
  useEffect(() => {
    if (typeof value === 'string' && (value.match(/\.(jpeg|jpg|gif|png|webp)$/i) || value.includes('images.discogs.com'))) {
      setIsImage(true);
    }
  }, [value]);

  const baseStyle = {
    padding: '16px',
    borderRadius: '8px',
    border: `2px solid ${isSelected ? '#f59e0b' : '#e5e7eb'}`,
    backgroundColor: isSelected ? '#fff7ed' : 'white',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    height: '100%',
    position: 'relative' as const
  };

  const labelStyle = {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    marginBottom: '4px'
  };

  if (isImage) {
    return (
      <div onClick={onClick} style={baseStyle}>
        <div style={labelStyle}>{label}</div>
        <div style={{ position: 'relative', width: '100%', minHeight: '200px', backgroundColor: '#f3f4f6', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Image 
            src={value as string} 
            alt="Candidate" 
            fill
            style={{ objectFit: 'contain' }}
            unoptimized // Allowed for external metadata sources
            onLoadingComplete={(img) => {
              setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
            }}
          />
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>
          {dimensions ? (
            <strong>{dimensions.w} x {dimensions.h} px</strong>
          ) : (
            <span>Loading size...</span>
          )}
        </div>
      </div>
    );
  }

  // Fallback for text/objects
  const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  
  return (
    <div onClick={onClick} style={baseStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: '14px', color: '#111827', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {displayValue || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Empty</span>}
      </div>
    </div>
  );
}

export default function EnrichmentReviewModal({ conflicts, onComplete, onCancel }: EnrichmentReviewModalProps) {
  // Map of Field Name -> Selected Value
  const [resolutions, setResolutions] = useState<Record<string, unknown>>({});
  const [currentStep, setCurrentStep] = useState(0);

  const currentConflict = conflicts[currentStep];
  const isLast = currentStep === conflicts.length - 1;

  const handleResolve = (value: unknown) => {
    setResolutions(prev => ({
      ...prev,
      [currentConflict.field_name]: value
    }));
  };

  const handleNext = () => {
    if (isLast) {
      // Apply resolutions to the conflicts array in place
      conflicts.forEach(c => {
        if (resolutions[c.field_name] !== undefined) {
          c.new_value = resolutions[c.field_name];
        }
      });
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  if (!currentConflict) return null;

  // Determine current selection for visual state
  const selectedValue = resolutions[currentConflict.field_name];
  const isCurrentSelected = selectedValue === currentConflict.current_value;
  const isNewSelected = selectedValue === currentConflict.new_value;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '800px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        
        {/* HEADER */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>
              Review Enrichment ({currentStep + 1}/{conflicts.length})
            </h3>
            <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
              {currentConflict.artist} - {currentConflict.title}
            </div>
          </div>
          <div style={{ padding: '4px 12px', backgroundColor: '#f3f4f6', borderRadius: '99px', fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>
            {currentConflict.field_name.replace(/_/g, ' ')}
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ padding: '32px', flex: 1, overflowY: 'auto', backgroundColor: '#fafafa' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', height: '100%' }}>
            
            {/* CURRENT */}
            <ConflictValue 
              label="Keep Current"
              value={currentConflict.current_value} 
              onClick={() => handleResolve(currentConflict.current_value)}
              isSelected={isCurrentSelected}
            />

            {/* NEW */}
            <ConflictValue 
              label="Accept New Data"
              value={currentConflict.new_value} 
              onClick={() => handleResolve(currentConflict.new_value)}
              isSelected={isNewSelected}
            />

          </div>
        </div>

        {/* FOOTER */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white' }}>
          <button onClick={onCancel} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', color: '#374151', fontWeight: '500' }}>
            Cancel
          </button>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
             <span style={{ fontSize: '13px', color: '#9ca3af', marginRight: '8px' }}>
               {selectedValue === undefined ? 'Please select an option' : 'Selection saved'}
             </span>
             <button 
               onClick={handleNext}
               disabled={selectedValue === undefined}
               style={{ 
                 padding: '10px 24px', 
                 backgroundColor: selectedValue === undefined ? '#d1d5db' : '#f59e0b', 
                 color: 'white', 
                 border: 'none', 
                 borderRadius: '6px', 
                 cursor: selectedValue === undefined ? 'not-allowed' : 'pointer',
                 fontWeight: '600',
                 fontSize: '14px',
                 boxShadow: selectedValue !== undefined ? '0 4px 6px -1px rgba(245, 158, 11, 0.2)' : 'none'
               }}
             >
               {isLast ? 'Finish & Save' : 'Next Conflict →'}
             </button>
          </div>
        </div>

      </div>
    </div>
  );
}