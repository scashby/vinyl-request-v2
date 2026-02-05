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
  onChange: (field: keyof Album, value: unknown) => void;
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
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-[13px] font-semibold text-gray-500">
            {label}
          </label>
          <span 
            onClick={() => handleOpenPicker(field)}
            className="text-gray-400 text-xl font-light cursor-pointer select-none hover:text-blue-500"
          >
            +
          </span>
        </div>
        <div 
          className={`px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 min-h-[38px] ${
            !value ? 'cursor-pointer hover:border-blue-400' : 'cursor-default'
          }`}
          onClick={() => !value && handleOpenPicker(field)}
        >
          {value}
        </div>
      </div>
    );
  };

  const fieldConfig = getFieldConfig();

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[980px]">
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
// AUDIT: updated for UI parity with CLZ reference.
