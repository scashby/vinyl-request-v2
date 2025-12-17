// src/app/edit-collection/tabs/ClassicalTab.tsx
'use client';

import React, { useState } from 'react';
import type { Album } from 'types/album';
import { UniversalPicker } from '../pickers/UniversalPicker';
import {
  fetchComposers,
  fetchConductors,
  fetchChoruses,
  fetchCompositions,
  fetchOrchestras,
  updateComposer,
  updateConductor,
  updateChorus,
  updateComposition,
  updateOrchestra,
  mergeComposers,
  mergeConductors,
  mergeChorus,
  mergeCompositions,
  mergeOrchestras,
} from '../pickers/pickerDataUtils';

interface ClassicalTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

type ClassicalField = 'composer' | 'conductor' | 'chorus' | 'composition' | 'orchestra';

export function ClassicalTab({ album, onChange }: ClassicalTabProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [currentField, setCurrentField] = useState<ClassicalField | null>(null);

  const handleOpenPicker = (field: ClassicalField) => {
    setCurrentField(field);
    setShowPicker(true);
  };

  const handlePickerSelect = (selectedItems: string[]) => {
    if (currentField && selectedItems.length > 0) {
      onChange(currentField, selectedItems[0] as Album[ClassicalField]);
    }
    setShowPicker(false);
    setCurrentField(null);
  };

  const getFieldConfig = () => {
    switch (currentField) {
      case 'composer':
        return {
          title: 'Select Composer',
          fetchItems: fetchComposers,
          onUpdate: updateComposer,
          onMerge: mergeComposers,
          label: 'Composer',
        };
      case 'conductor':
        return {
          title: 'Select Conductor',
          fetchItems: fetchConductors,
          onUpdate: updateConductor,
          onMerge: mergeConductors,
          label: 'Conductor',
        };
      case 'chorus':
        return {
          title: 'Select Chorus',
          fetchItems: fetchChoruses,
          onUpdate: updateChorus,
          onMerge: mergeChorus,
          label: 'Chorus',
        };
      case 'composition':
        return {
          title: 'Select Composition',
          fetchItems: fetchCompositions,
          onUpdate: updateComposition,
          onMerge: mergeCompositions,
          label: 'Composition',
        };
      case 'orchestra':
        return {
          title: 'Select Orchestra',
          fetchItems: fetchOrchestras,
          onUpdate: updateOrchestra,
          onMerge: mergeOrchestras,
          label: 'Orchestra',
        };
      default:
        return null;
    }
  };

  const renderField = (label: string, field: ClassicalField) => {
    const value = album[field];
    
    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#6b7280',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            {label}
          </label>
          <span 
            onClick={() => handleOpenPicker(field)}
            style={{ 
              color: '#9ca3af',
              fontSize: '20px', 
              fontWeight: '300',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            +
          </span>
        </div>
        <div style={{ 
          flex: 1,
          padding: '8px 10px',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          fontSize: '14px',
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#111827',
        }}>
          <span>{value || 'Select...'}</span>
          {value && (
            <button
              onClick={() => onChange(field, '' as Album[ClassicalField])}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: 0,
                fontSize: '18px',
                lineHeight: '1',
                fontWeight: '300',
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>
    );
  };

  const fieldConfig = getFieldConfig();

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr',
        gap: '40px',
        maxWidth: '900px'
      }}>
        {/* LEFT COLUMN */}
        <div>
          {renderField('Composer', 'composer')}
          {renderField('Conductor', 'conductor')}
          {renderField('Chorus', 'chorus')}
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {renderField('Composition', 'composition')}
          {renderField('Orchestra', 'orchestra')}
        </div>
      </div>

      {/* Universal Picker */}
      {showPicker && currentField && fieldConfig && (
        <UniversalPicker
          title={fieldConfig.title}
          isOpen={showPicker}
          onClose={() => {
            setShowPicker(false);
            setCurrentField(null);
          }}
          fetchItems={fieldConfig.fetchItems}
          selectedItems={album[currentField] ? [album[currentField] as string] : []}
          onSelect={handlePickerSelect}
          multiSelect={false}
          canManage={true}
          onUpdate={fieldConfig.onUpdate}
          onMerge={fieldConfig.onMerge}
          newItemLabel={fieldConfig.label}
          manageItemsLabel={`Manage ${fieldConfig.label}s`}
        />
      )}
    </div>
  );
}