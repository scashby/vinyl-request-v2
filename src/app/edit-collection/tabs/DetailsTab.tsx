// src/app/edit-collection/tabs/DetailsTab.tsx
'use client';

import { useState, useEffect } from 'react';
import type { Album } from 'types/album';
import { PickerModal } from '../pickers/PickerModal';
import ManagePickListsModal from '../ManagePickListsModal';
import {
  fetchMediaConditions,
  fetchPackageConditions,
  fetchCountries,
  type PickerDataItem,
} from '../pickers/pickerDataUtils';

interface DetailsTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null | boolean) => void;
}

type ModalType = 'picker' | 'manage' | null;

type FieldType =
  | 'media_condition'
  | 'sleeve_condition'
  | 'country';

export function DetailsTab({ album, onChange }: DetailsTabProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [activeField, setActiveField] = useState<FieldType | null>(null);

  const [mediaConditions, setMediaConditions] = useState<PickerDataItem[]>([]);
  const [packageConditions, setPackageConditions] = useState<PickerDataItem[]>([]);
  const [countries, setCountries] = useState<PickerDataItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setDataLoading(true);
    const [mediaCondData, packageCondData, countriesData] = await Promise.all([
      fetchMediaConditions(),
      fetchPackageConditions(),
      fetchCountries(),
    ]);
    setMediaConditions(mediaCondData);
    setPackageConditions(packageCondData);
    setCountries(countriesData);
    setDataLoading(false);
  };

  const reloadData = async (field: FieldType) => {
    switch (field) {
      case 'media_condition':
        setMediaConditions(await fetchMediaConditions());
        break;
      case 'sleeve_condition':
        setPackageConditions(await fetchPackageConditions());
        break;
      case 'country':
        setCountries(await fetchCountries());
        break;
    }
  };

  const getCurrentItems = () => {
    switch (activeField) {
      case 'media_condition': return mediaConditions;
      case 'sleeve_condition': return packageConditions;
      case 'country': return countries;
      default: return [];
    }
  };

  const getCurrentSelection = () => {
    switch (activeField) {
      case 'media_condition': return album.media_condition || '';
      case 'sleeve_condition': return album.sleeve_condition || '';
      case 'country': return album.country || '';
      default: return '';
    }
  };

  const getFieldConfig = () => {
    switch (activeField) {
      case 'media_condition': return { title: 'Select Media Condition', itemLabel: 'Media Condition' };
      case 'sleeve_condition': return { title: 'Select Sleeve Condition', itemLabel: 'Sleeve Condition' };
      case 'country': return { title: 'Select Country', itemLabel: 'Country' };
      default: return { title: '', itemLabel: '' };
    }
  };

  const getManageListKey = (field: FieldType | null): string => {
    switch (field) {
      case 'media_condition': return 'media-condition';
      case 'sleeve_condition': return 'sleeve-condition';
      case 'country': return 'country';
      default: return '';
    }
  };

  const handleOpenPicker = (field: FieldType) => {
    setActiveField(field);
    setActiveModal('picker');
  };

  const handlePickerSave = (selectedId: string | string[]) => {
    if (!activeField || Array.isArray(selectedId)) return;
    const items = getCurrentItems();
    const selectedName = items.find(item => item.id === selectedId)?.name || '';

    switch (activeField) {
      case 'media_condition':
        onChange('media_condition', selectedName);
        break;
      case 'sleeve_condition':
        onChange('sleeve_condition', selectedName);
        break;
      case 'country':
        onChange('country', selectedName);
        break;
    }
  };

  const handleCloseModal = () => {
    setActiveModal(null);
  };

  const handleManageClose = async () => {
    handleCloseModal();
    if (activeField) {
      await reloadData(activeField);
    }
  };

  const fieldConfig = getFieldConfig();
  const currentItems = getCurrentItems();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
        <div className="flex flex-col gap-4">
          <div className="text-[15px] font-bold text-gray-700 mb-1 pb-2 border-b-2 border-gray-200">
            Conditions
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Media Condition</label>
            <div className="flex items-stretch">
              <select
                value={album.media_condition || ''}
                onChange={(e) => onChange('media_condition', e.target.value)}
                className="flex-1 px-2.5 py-2 border border-gray-300 rounded-l text-sm bg-white text-gray-900 outline-none focus:border-blue-500 border-r-0"
              >
                <option value="">Select...</option>
                {mediaConditions.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <button
                onClick={() => handleOpenPicker('media_condition')}
                disabled={dataLoading}
                className="w-9 h-[38px] flex items-center justify-center border border-gray-300 rounded-r bg-white text-gray-500 hover:bg-gray-50 disabled:cursor-wait"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <circle cx="1.5" cy="2.5" r="1"/>
                  <rect x="4" y="2" width="10" height="1"/>
                  <circle cx="1.5" cy="7" r="1"/>
                  <rect x="4" y="6.5" width="10" height="1"/>
                  <circle cx="1.5" cy="11.5" r="1"/>
                  <rect x="4" y="11" width="10" height="1"/>
                </svg>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Sleeve Condition</label>
            <div className="flex items-stretch">
              <select
                value={album.sleeve_condition || ''}
                onChange={(e) => onChange('sleeve_condition', e.target.value)}
                className="flex-1 px-2.5 py-2 border border-gray-300 rounded-l text-sm bg-white text-gray-900 outline-none focus:border-blue-500 border-r-0"
              >
                <option value="">Select...</option>
                {packageConditions.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <button
                onClick={() => handleOpenPicker('sleeve_condition')}
                disabled={dataLoading}
                className="w-9 h-[38px] flex items-center justify-center border border-gray-300 rounded-r bg-white text-gray-500 hover:bg-gray-50 disabled:cursor-wait"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <circle cx="1.5" cy="2.5" r="1"/>
                  <rect x="4" y="2" width="10" height="1"/>
                  <circle cx="1.5" cy="7" r="1"/>
                  <rect x="4" y="6.5" width="10" height="1"/>
                  <circle cx="1.5" cy="11.5" r="1"/>
                  <rect x="4" y="11" width="10" height="1"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="text-[15px] font-bold text-gray-700 mb-1 pb-2 border-b-2 border-gray-200">
            Release
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Country</label>
            <div className="flex items-stretch">
              <select
                value={album.country || ''}
                onChange={(e) => onChange('country', e.target.value)}
                className="flex-1 px-2.5 py-2 border border-gray-300 rounded-l text-sm bg-white text-gray-900 outline-none focus:border-blue-500 border-r-0"
              >
                <option value="">Select...</option>
                {countries.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <button
                onClick={() => handleOpenPicker('country')}
                disabled={dataLoading}
                className="w-9 h-[38px] flex items-center justify-center border border-gray-300 rounded-r bg-white text-gray-500 hover:bg-gray-50 disabled:cursor-wait"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <circle cx="1.5" cy="2.5" r="1"/>
                  <rect x="4" y="2" width="10" height="1"/>
                  <circle cx="1.5" cy="7" r="1"/>
                  <rect x="4" y="6.5" width="10" height="1"/>
                  <circle cx="1.5" cy="11.5" r="1"/>
                  <rect x="4" y="11" width="10" height="1"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeModal === 'picker' && activeField && (
        <PickerModal
          isOpen={true}
          onClose={handleCloseModal}
          title={fieldConfig.title}
          mode="single"
          items={currentItems}
          selectedIds={getCurrentSelection()}
          onSave={handlePickerSave}
          onManage={() => setActiveModal('manage')}
          onNew={() => {}} // new item creation disabled in V3
          searchPlaceholder={`Search ${fieldConfig.itemLabel}s...`}
          itemLabel={fieldConfig.itemLabel}
          showSortName={false}
        />
      )}

      {activeModal === 'manage' && (
        <ManagePickListsModal
          isOpen={true}
          onClose={handleManageClose}
          initialList={getManageListKey(activeField)}
          hideListSelector={true}
        />
      )}
    </>
  );
}
