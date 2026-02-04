// src/app/edit-collection/tabs/PersonalTab.tsx
'use client';

import { useState } from 'react';
import type { Album } from 'types/album';
import { DatePicker } from 'components/DatePicker';
import { UniversalPicker } from '../pickers/UniversalPicker';
import {
  fetchOwners,
  fetchTags,
} from '../pickers/pickerDataUtils';

interface PersonalTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

export function PersonalTab({ album, onChange }: PersonalTabProps) {
  const [showPurchaseDatePicker, setShowPurchaseDatePicker] = useState(false);
  const [datePickerPosition, setDatePickerPosition] = useState({ top: 0, left: 0 });

  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [showTagsPicker, setShowTagsPicker] = useState(false);

  const handlePurchaseDateChange = (date: { year: number | null; month: number | null; day: number | null }) => {
    if (date.year && date.month && date.day) {
      const dateStr = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
      onChange('purchase_date', dateStr);
    }
    setShowPurchaseDatePicker(false);
  };

  const handleOpenPurchaseDatePicker = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setDatePickerPosition({ top: rect.bottom + 4, left: rect.left });
    setShowPurchaseDatePicker(true);
  };

  const parsePurchaseDate = () => {
    if (!album.purchase_date) return { year: null, month: null, day: null };
    const parts = album.purchase_date.split('-');
    return {
      year: parts[0] ? parseInt(parts[0]) : null,
      month: parts[1] ? parseInt(parts[1]) : null,
      day: parts[2] ? parseInt(parts[2]) : null
    };
  };

  const purchaseDate = parsePurchaseDate();

  const handleRemoveTag = (tag: string) => {
    const updated = (album.tags || []).filter(t => t !== tag);
    onChange('tags', updated.length > 0 ? updated : null);
  };

  return (
    <>
      <div className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-3 mb-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[13px] font-semibold text-gray-500">Purchase Date</label>
              <div
                onClick={handleOpenPurchaseDatePicker}
                className="cursor-pointer flex items-center text-gray-500 hover:text-blue-500"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-between w-full">
              <input
                type="text"
                value={purchaseDate.year || ''}
                placeholder="YYYY"
                readOnly
                onClick={handleOpenPurchaseDatePicker}
                className="w-[92px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500 cursor-pointer"
              />
              <div className="w-[10px] h-px bg-gray-300" />
              <input
                type="text"
                value={purchaseDate.month || ''}
                placeholder="MM"
                readOnly
                onClick={handleOpenPurchaseDatePicker}
                className="w-[56px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500 cursor-pointer"
              />
              <div className="w-[10px] h-px bg-gray-300" />
              <input
                type="text"
                value={purchaseDate.day || ''}
                placeholder="DD"
                readOnly
                onClick={handleOpenPurchaseDatePicker}
                className="w-[56px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Owner</label>
            <div className="flex items-stretch">
              <input
                type="text"
                value={album.owner || ''}
                onChange={(e) => onChange('owner', e.target.value)}
                className="flex-1 px-2.5 py-2 border border-gray-300 rounded-l text-sm bg-white text-gray-900 outline-none focus:border-blue-500 border-r-0"
                placeholder="Owner"
              />
              <button
                onClick={() => setShowOwnerPicker(true)}
                className="px-3 py-2 border border-gray-300 rounded-r bg-white text-gray-500 hover:bg-gray-50 text-base font-light"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Current Value</label>
            <input
              type="number"
              value={album.current_value ?? ''}
              onChange={(e) => onChange('current_value', e.target.value === '' ? null : Number(e.target.value))}
              className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 outline-none focus:border-blue-500"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3 mb-4">
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Purchase Price</label>
            <input
              type="number"
              value={album.purchase_price ?? ''}
              onChange={(e) => onChange('purchase_price', e.target.value === '' ? null : Number(e.target.value))}
              className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 outline-none focus:border-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
              <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Tags</label>
            <div className="flex flex-wrap items-center gap-2 min-h-[38px] px-2.5 py-2 border border-gray-300 rounded bg-white">
              {(album.tags || []).length > 0 ? (
                album.tags!.map((tag) => (
                  <span key={tag} className="bg-gray-200 px-2 py-1 rounded text-xs text-gray-700 inline-flex items-center gap-1">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="bg-transparent border-none text-gray-500 hover:text-red-500 cursor-pointer p-0 text-sm leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-xs">No tags</span>
              )}
              <button
                onClick={() => setShowTagsPicker(true)}
                className="ml-auto px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
              >
                Manage
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Personal Notes</label>
          <textarea
            value={album.personal_notes || ''}
            onChange={(e) => onChange('personal_notes', e.target.value)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 outline-none focus:border-blue-500 min-h-[80px] resize-y"
            placeholder="Notes..."
          />
        </div>
      </div>

      {showPurchaseDatePicker && (
        <DatePicker
          position={datePickerPosition}
          onClose={() => setShowPurchaseDatePicker(false)}
          onChange={handlePurchaseDateChange}
          value={purchaseDate}
        />
      )}

      {showOwnerPicker && (
        <UniversalPicker
          title="Select Owner"
          isOpen={showOwnerPicker}
          onClose={() => setShowOwnerPicker(false)}
          fetchItems={fetchOwners}
          selectedItems={album.owner ? [album.owner] : []}
          onSelect={(selectedItems) => onChange('owner', selectedItems[0] ?? null)}
          multiSelect={false}
          canManage={true}
          newItemLabel="Owner"
          manageItemsLabel="Manage Owners"
          showSortName={false}
        />
      )}

      {showTagsPicker && (
        <UniversalPicker
          title="Select Tags"
          isOpen={showTagsPicker}
          onClose={() => setShowTagsPicker(false)}
          fetchItems={fetchTags}
          selectedItems={album.tags || []}
          onSelect={(selectedItems) => onChange('tags', selectedItems.length > 0 ? selectedItems : null)}
          multiSelect={true}
          canManage={true}
          newItemLabel="Tag"
          manageItemsLabel="Manage Tags"
          showSortName={false}
        />
      )}
    </>
  );
}
