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
      onChange(currentField, (selectedItems.length > 0 ? selectedItems : null) as Album[PeopleField]);
    }
    setShowPicker(false);
    setCurrentField(null);
  };

  const getFieldConfig = () => {
    switch (currentField) {
      case 'songwriters':
        return { title: 'Select Songwriters', fetchItems: fetchSongwriters, label: 'Songwriter', showSortName: true };
      case 'producers':
        return { title: 'Select Producers', fetchItems: fetchProducers, label: 'Producer', showSortName: true };
      case 'engineers':
        return { title: 'Select Engineers', fetchItems: fetchEngineers, label: 'Engineer', showSortName: true };
      case 'musicians':
        return { title: 'Select Musicians', fetchItems: fetchMusicians, label: 'Musician', showSortName: true };
      default:
        return null;
    }
  };

  const renderField = (label: string, field: PeopleField) => {
    const values = (album[field] as string[]) || [];
    const displayText = values.length > 0 ? values.join(', ') : '';

    return (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-[13px] font-semibold text-gray-500">{label}</label>
          <span
            onClick={() => handleOpenPicker(field)}
            className="text-gray-400 text-xl font-light cursor-pointer select-none hover:text-blue-500"
          >
            +
          </span>
        </div>
        <div
          className={`px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 min-h-[38px] ${
            values.length === 0 ? 'cursor-pointer hover:border-blue-400' : 'cursor-default'
          }`}
          onClick={() => values.length === 0 && handleOpenPicker(field)}
        >
          {displayText}
        </div>
      </div>
    );
  };

  const fieldConfig = getFieldConfig();

  return (
    <div className="p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-[900px]">
        <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-500 mb-4 mt-0">Credits</h3>
          {renderField('Songwriter', 'songwriters')}
          {renderField('Producer', 'producers')}
          {renderField('Engineer', 'engineers')}
        </div>

        <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-500 mb-4 mt-0">Musicians</h3>
          {renderField('Musician', 'musicians')}
        </div>
      </div>

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
          canManage={false}
          newItemLabel={fieldConfig.label}
          manageItemsLabel={`Manage ${fieldConfig.label}s`}
          showSortName={fieldConfig.showSortName}
        />
      )}
    </div>
  );
}
