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

  const handleRemoveItem = (field: PeopleField, index: number) => {
    const currentArray = (album[field] as string[]) || [];
    const newArray = currentArray.filter((_, i) => i !== index);
    onChange(field, newArray.length > 0 ? newArray : null as Album[PeopleField]);
  };

  const getFieldConfig = () => {
    switch (currentField) {
      case 'songwriters':
        return {
          title: 'Select Songwriters',
          fetchItems: fetchSongwriters,
          label: 'Songwriter',
        };
      case 'producers':
        return {
          title: 'Select Producers',
          fetchItems: fetchProducers,
          label: 'Producer',
        };
      case 'engineers':
        return {
          title: 'Select Engineers',
          fetchItems: fetchEngineers,
          label: 'Engineer',
        };
      case 'musicians':
        return {
          title: 'Select Musicians',
          fetchItems: fetchMusicians,
          label: 'Musician',
        };
      default:
        return null;
    }
  };

  const renderMultiValueField = (
    label: string,
    field: PeopleField,
    values: string[] | undefined
  ) => {
    return (
      <div className="flex items-start gap-3">
        <label className="text-[13px] text-[#e8e6e3] w-[120px] text-right flex-shrink-0 pt-[5px]">
          {label}:
        </label>
        <div className="flex-1 flex flex-col gap-2">
          {values && values.length > 0 ? (
            <div className="flex flex-col gap-1">
              {values.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="h-[26px] px-3 bg-[#2a2a2a] text-[#e8e6e3] text-[13px] border border-[#555555] rounded flex items-center flex-1">
                    {value}
                  </div>
                  <button
                    type="button"
                    className="h-[26px] w-[26px] bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] border border-[#555555] rounded flex items-center justify-center transition-colors"
                    onClick={() => handleRemoveItem(field, index)}
                    title={`Remove ${value}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="h-[26px] px-3 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[13px] border border-[#555555] rounded flex items-center justify-between min-w-[200px] transition-colors self-start"
            onClick={() => handleOpenPicker(field)}
          >
            <span className="text-[#999999]">Select...</span>
            <svg className="w-3 h-3 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  const fieldConfig = getFieldConfig();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-8">
        {/* Credits Section */}
        <div className="space-y-4">
          <h3 className="text-[14px] font-semibold text-[#e8e6e3] pb-2 border-b border-[#555555]">
            Credits
          </h3>
          <div className="space-y-6">
            {renderMultiValueField('Songwriter', 'songwriters', album.songwriters as string[])}
            {renderMultiValueField('Producer', 'producers', album.producers as string[])}
            {renderMultiValueField('Engineer', 'engineers', album.engineers as string[])}
          </div>
        </div>

        {/* Musicians Section */}
        <div className="space-y-4">
          <h3 className="text-[14px] font-semibold text-[#e8e6e3] pb-2 border-b border-[#555555]">
            Musicians
          </h3>
          <div className="space-y-6">
            {renderMultiValueField('Musician', 'musicians', album.musicians as string[])}
          </div>
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
        />
      )}
    </div>
  );
}