// src/app/edit-collection/tabs/ClassicalTab.tsx
'use client';

import React, { useState } from 'react';
import type { Album } from 'types/album';
import { PickerModal } from '../pickers/PickerModal';

interface ClassicalTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

type ClassicalField = 'composer' | 'conductor' | 'chorus' | 'composition' | 'orchestra';

export default function ClassicalTab({ album, onChange }: ClassicalTabProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [currentField, setCurrentField] = useState<ClassicalField | null>(null);

  const handleOpenPicker = (field: ClassicalField) => {
    setCurrentField(field);
    setShowPicker(true);
  };

  const handlePickerSelect = (selectedItem: { name: string }) => {
    if (currentField) {
      onChange(currentField, selectedItem.name as Album[ClassicalField]);
    }
    setShowPicker(false);
    setCurrentField(null);
  };

  const renderField = (label: string, field: ClassicalField) => {
    const value = album[field];
    
    return (
      <div className="flex items-center gap-3">
        <label className="text-[13px] text-[#e8e6e3] w-[120px] text-right flex-shrink-0">
          {label}:
        </label>
        <div className="flex-1 flex items-center gap-2">
          <button
            type="button"
            className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[13px] border border-[#555555] rounded flex items-center justify-between min-w-[200px] transition-colors"
            onClick={() => handleOpenPicker(field)}
          >
            <span className={value ? 'text-[#e8e6e3]' : 'text-[#999999]'}>
              {value || 'Select...'}
            </span>
            <svg className="w-3 h-3 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          {value && (
            <button
              type="button"
              className="h-[26px] w-[26px] bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] border border-[#555555] rounded flex items-center justify-center transition-colors"
              onClick={() => onChange(field, '' as Album[ClassicalField])}
              title={`Clear ${label.toLowerCase()}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">
        {renderField('Composer', 'composer')}
        {renderField('Conductor', 'conductor')}
        {renderField('Chorus', 'chorus')}
        {renderField('Composition', 'composition')}
        {renderField('Orchestra', 'orchestra')}
      </div>

      {/* Picker Modal */}
      {showPicker && currentField && (
        <PickerModal
          isOpen={showPicker}
          onClose={() => {
            setShowPicker(false);
            setCurrentField(null);
          }}
          title={`Select ${currentField.charAt(0).toUpperCase() + currentField.slice(1)}`}
          type={currentField}
          onSelect={handlePickerSelect}
          allowMultiple={false}
          selectedItems={album[currentField] ? [{ name: album[currentField] as string }] : []}
        />
      )}
    </div>
  );
}