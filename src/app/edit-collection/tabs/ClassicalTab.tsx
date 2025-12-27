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
          label: 'Composer',
          showSortName: true, // Proper name
        };
      case 'conductor':
        return {
          title: 'Select Conductor',
          fetchItems: fetchConductors,
          label: 'Conductor',
          showSortName: true, // Proper name
        };
      case 'chorus':
        return {
          title: 'Select Chorus',
          fetchItems: fetchChoruses,
          label: 'Chorus',
          showSortName: true, // Band/ensemble name
        };
      case 'composition':
        return {
          title: 'Select Composition',
          fetchItems: fetchCompositions,
          label: 'Composition',
          showSortName: false, // Work title, not a name
        };
      case 'orchestra':
        return {
          title: 'Select Orchestra',
          fetchItems: fetchOrchestras,
          label: 'Orchestra',
          showSortName: true, // Band/ensemble name
        };
      default:
        return null;
    }
  };

  const renderField = (label: string, field: ClassicalField) => {
    const value = album[field] || '';
    
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
          padding: '8px 10px',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          fontSize: '14px',
          backgroundColor: 'white',
          color: '#111827',
          minHeight: '36px',
          cursor: !value ? 'pointer' : 'default',
        }}
        onClick={() => !value && handleOpenPicker(field)}
        >
          {value}
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
          newItemLabel={fieldConfig.label}
          manageItemsLabel={`Manage ${fieldConfig.label}s`}
          showSortName={fieldConfig.showSortName}
        />
      )}
    </div>
  );
}