// src/app/edit-collection/tabs/PeopleTab.tsx
'use client';

import React, { useState } from 'react';
import type { Album } from 'types/album';
import { UniversalPicker } from '../pickers/UniversalPicker';
import {
  fetchSongwriters,
  fetchProducers,
  fetchEngineers,
  fetchMusicians,
} from '../pickers/pickerDataUtils';

interface PeopleTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

type PeopleField = 'songwriters' | 'producers' | 'engineers' | 'musicians';

export function PeopleTab({ album, onChange }: PeopleTabProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [currentField, setCurrentField] = useState<PeopleField | null>(null);

  const handleOpenPicker = (field: PeopleField) => {
    setCurrentField(field);
    setShowPicker(true);
  };

  const handlePickerSelect = (selectedItems: string[]) => {
    if (currentField) {
      onChange(currentField, selectedItems.length > 0 ? selectedItems : null as Album[PeopleField]);
    }
    setShowPicker(false);
    setCurrentField(null);
  };

  const getFieldConfig = () => {
    switch (currentField) {
      case 'songwriters':
        return {
          title: 'Select Songwriters',
          fetchItems: fetchSongwriters,
          label: 'Songwriter',
          showSortName: true, // Proper names
          showDefaultInstrument: false,
        };
      case 'producers':
        return {
          title: 'Select Producers',
          fetchItems: fetchProducers,
          label: 'Producer',
          showSortName: true, // Proper names
          showDefaultInstrument: false,
        };
      case 'engineers':
        return {
          title: 'Select Engineers',
          fetchItems: fetchEngineers,
          label: 'Engineer',
          showSortName: true, // Proper names
          showDefaultInstrument: false,
        };
      case 'musicians':
        return {
          title: 'Select Musicians',
          fetchItems: fetchMusicians,
          label: 'Musician',
          showSortName: true, // Proper names
          showDefaultInstrument: true, // Musicians need default instrument
        };
      default:
        return null;
    }
  };

  const renderField = (label: string, field: PeopleField) => {
    const values = (album[field] as string[]) || [];
    const displayText = values.length > 0 ? values.join(', ') : '';
    
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
          cursor: values.length === 0 ? 'pointer' : 'default',
        }}
        onClick={() => values.length === 0 && handleOpenPicker(field)}
        >
          {displayText}
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
        {/* LEFT COLUMN - Credits */}
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '16px',
          backgroundColor: '#fafafa',
        }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#6b7280',
            marginBottom: '16px',
            marginTop: '0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            Credits
          </h3>
          {renderField('Songwriter', 'songwriters')}
          {renderField('Producer', 'producers')}
          {renderField('Engineer', 'engineers')}
        </div>

        {/* RIGHT COLUMN - Musicians */}
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '16px',
          backgroundColor: '#fafafa',
        }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#6b7280',
            marginBottom: '16px',
            marginTop: '0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            Musicians
          </h3>
          {renderField('Musician', 'musicians')}
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
          selectedItems={(album[currentField] as string[]) || []}
          onSelect={handlePickerSelect}
          multiSelect={true}
          canManage={true}
          newItemLabel={fieldConfig.label}
          manageItemsLabel={`Manage ${fieldConfig.label}s`}
          showSortName={fieldConfig.showSortName}
          showDefaultInstrument={fieldConfig.showDefaultInstrument}
        />
      )}
    </div>
  );
}