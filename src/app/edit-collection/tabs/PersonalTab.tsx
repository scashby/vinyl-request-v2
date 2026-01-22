// src/app/edit-collection/tabs/PersonalTab.tsx
'use client';

import { useState } from 'react';
import type { Album } from 'types/album';
import { DatePicker } from 'components/DatePicker';
import { UniversalPicker } from '../pickers/UniversalPicker';
import { 
  fetchPurchaseStores, 
  fetchOwners, 
  fetchSignees, 
  fetchTags,
} from '../pickers/pickerDataUtils';

interface PersonalTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null | boolean) => void;
}

export function PersonalTab({ album, onChange }: PersonalTabProps) {
  // Date picker state
  const [showPurchaseDatePicker, setShowPurchaseDatePicker] = useState(false);
  const [showCleanedDatePicker, setShowCleanedDatePicker] = useState(false);
  const [showLastPlayedDatePicker, setShowLastPlayedDatePicker] = useState(false);
  const [datePickerPosition, setDatePickerPosition] = useState({ top: 0, left: 0 });

  // Picker state
  const [showPurchaseStorePicker, setShowPurchaseStorePicker] = useState(false);
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [showTagsPicker, setShowTagsPicker] = useState(false);
  const [showSigneesPicker, setShowSigneesPicker] = useState(false);

  // Date handlers
  const handlePurchaseDateChange = (date: { year: number | null; month: number | null; day: number | null }) => {
    if (date.year && date.month && date.day) {
      const dateStr = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
      onChange('purchase_date', dateStr);
    }
    setShowPurchaseDatePicker(false);
  };

  const handleCleanedDateChange = (date: { year: number | null; month: number | null; day: number | null }) => {
    if (date.year && date.month && date.day) {
      const dateStr = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
      onChange('last_cleaned_date', dateStr);
    }
    setShowCleanedDatePicker(false);
  };

  const handleLastPlayedDateChange = (date: { year: number | null; month: number | null; day: number | null }) => {
    if (date.year && date.month && date.day) {
      const dateStr = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
      onChange('last_played_date', dateStr);
    }
    setShowLastPlayedDatePicker(false);
  };

  const handleOpenPurchaseDatePicker = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setDatePickerPosition({ top: rect.bottom + 4, left: rect.left });
    setShowPurchaseDatePicker(true);
  };

  const handleOpenCleanedDatePicker = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setDatePickerPosition({ top: rect.bottom + 4, left: rect.left });
    setShowCleanedDatePicker(true);
  };
  
  const handleOpenLastPlayedDatePicker = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setDatePickerPosition({ top: rect.bottom + 4, left: rect.left });
    setShowLastPlayedDatePicker(true);
  };

  // Parse dates for display
  const parseDate = (dateStr: string | null) => {
    if (!dateStr) return { year: null, month: null, day: null };
    const parts = dateStr.split('-');
    return {
      year: parts[0] ? parseInt(parts[0]) : null,
      month: parts[1] ? parseInt(parts[1]) : null,
      day: parts[2] ? parseInt(parts[2]) : null
    };
  };

  const purchaseDate = parseDate(album.purchase_date);
  const cleanedDate = parseDate(album.last_cleaned_date);
  const lastPlayedDate = parseDate(album.last_played_date);

  // Rating handlers
  const currentRating = album.my_rating || 0;
  const handleRatingChange = (rating: number) => {
    onChange('my_rating', rating === currentRating ? 0 : rating);
  };

  // Remove tag
  const handleRemoveTag = (tag: string) => {
    const updated = (album.custom_tags || []).filter(t => t !== tag);
    onChange('custom_tags', updated.length > 0 ? updated : null);
  };

  // Remove signee
  const handleRemoveSignee = (signee: string) => {
    const updated = (album.signed_by || []).filter(s => s !== signee);
    onChange('signed_by', updated.length > 0 ? updated : null);
  };

  return (
    <>
      <div className="w-full">
        {/* ROW 1: Purchase Date | Purchase Store | Owner */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-3 mb-3">
          {/* Purchase Date */}
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

          {/* Purchase Store */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Purchase Store</label>
            <div className="flex items-stretch">
              <select 
                value={album.purchase_store || ''}
                onChange={(e) => onChange('purchase_store', e.target.value)}
                className="flex-1 px-2.5 py-2 border border-gray-300 rounded-l text-sm bg-white text-gray-900 outline-none focus:border-blue-500 border-r-0"
              >
                <option value="">{album.purchase_store || 'Select'}</option>
              </select>
              <button 
                onClick={() => setShowPurchaseStorePicker(true)}
                className="w-9 h-[38px] flex items-center justify-center border border-gray-300 rounded-r bg-white text-gray-500 hover:bg-gray-50"
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

          {/* Owner */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Owner</label>
            <div className="flex items-stretch">
              <select 
                value={album.owner || ''}
                onChange={(e) => onChange('owner', e.target.value)}
                className="flex-1 px-2.5 py-2 border border-gray-300 rounded-l text-sm bg-white text-gray-900 outline-none focus:border-blue-500 border-r-0"
              >
                <option value="">{album.owner || 'Select'}</option>
              </select>
              <button 
                onClick={() => setShowOwnerPicker(true)}
                className="w-9 h-[38px] flex items-center justify-center border border-gray-300 rounded-r bg-white text-gray-500 hover:bg-gray-50"
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

        {/* ROW 2: Purchase Price | Current Value | My Rating */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-3 mb-3">
          {/* Purchase Price */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Purchase Price</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={album.purchase_price || ''}
                onChange={(e) => onChange('purchase_price', e.target.value ? parseFloat(e.target.value) : null)}
                className="flex-1 px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Current Value */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Current Value</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={album.current_value || ''}
                onChange={(e) => onChange('current_value', e.target.value ? parseFloat(e.target.value) : null)}
                className="flex-1 px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* My Rating */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">
              My Rating {currentRating > 0 ? `(${currentRating} / 10)` : ''}
            </label>
            <div className="flex gap-0.5 items-center h-[38px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRatingChange(star)}
                  className={`bg-transparent border-none cursor-pointer text-2xl p-0 leading-none ${
                    star <= currentRating ? 'text-yellow-400' : 'text-gray-300 hover:text-gray-400'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ROW 3: Tags | Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {/* Tags */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Tags</label>
            <div className="flex items-start">
              <div className="flex-1 min-h-[38px] p-1.5 border border-gray-300 rounded-l border-r-0 bg-white flex flex-wrap gap-1.5 items-center">
                {Array.isArray(album.custom_tags) && album.custom_tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-gray-200 px-2 py-1 rounded text-xs flex items-center gap-1.5 text-gray-700"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="bg-transparent border-none text-gray-500 cursor-pointer p-0 text-base leading-none font-light hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <button 
                onClick={() => setShowTagsPicker(true)}
                className="w-9 min-h-[38px] flex items-center justify-center border border-gray-300 rounded-r bg-white text-gray-500 hover:bg-gray-50"
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

          {/* Notes - UPDATED FIELD NAME */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Personal Notes</label>
            <textarea
              value={album.personal_notes || ''} 
              onChange={(e) => onChange('personal_notes', e.target.value)}
              rows={3}
              className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 outline-none focus:border-blue-500 min-h-[40px] resize-y"
            />
          </div>
        </div>

        {/* ROW 4: Last Cleaned | Play Stats | Signed */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-3">
          {/* Last Cleaned Date */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[13px] font-semibold text-gray-500">Last Cleaned</label>
              <div 
                onClick={handleOpenCleanedDatePicker}
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
                value={cleanedDate.year || ''}
                placeholder="YYYY"
                readOnly
                onClick={handleOpenCleanedDatePicker}
                className="w-[92px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500 cursor-pointer"
              />
              <div className="w-[10px] h-px bg-gray-300" />
              <input
                type="text"
                value={cleanedDate.month || ''}
                placeholder="MM"
                readOnly
                onClick={handleOpenCleanedDatePicker}
                className="w-[56px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500 cursor-pointer"
              />
              <div className="w-[10px] h-px bg-gray-300" />
              <input
                type="text"
                value={cleanedDate.day || ''}
                placeholder="DD"
                readOnly
                onClick={handleOpenCleanedDatePicker}
                className="w-[56px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Play Stats (New simplified UI) */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
               <label className="block text-[13px] font-semibold text-gray-500">Play Count</label>
                <div 
                  onClick={handleOpenLastPlayedDatePicker}
                  className="cursor-pointer flex items-center text-gray-500 hover:text-blue-500"
                  title="Set Last Played Date"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
            </div>
            <div className="flex items-center gap-2">
               <input 
                 type="number" 
                 value={album.play_count || 0} 
                 onChange={(e) => onChange('play_count', parseInt(e.target.value))}
                 className="flex-1 px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900"
                 min="0"
               />
            </div>
             <div className="mt-1 text-[11px] text-gray-500 text-right">
               Last: {album.last_played_date || 'Never'}
             </div>
          </div>

          {/* Signed by */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[13px] font-semibold text-gray-500">Signed by</label>
              <span 
                onClick={() => setShowSigneesPicker(true)}
                className="text-gray-400 text-xl font-light cursor-pointer hover:text-blue-500"
              >
                +
              </span>
            </div>
            <div className="flex-1 px-2.5 py-2 border border-gray-300 rounded text-sm bg-white min-h-[38px] text-gray-900">
              {Array.isArray(album.signed_by) && album.signed_by.length > 0 ? (
                album.signed_by.map((signee, idx) => (
                  <div key={idx} className="flex items-center justify-between mb-1 last:mb-0">
                    <span>{signee}</span>
                    <button
                      onClick={() => handleRemoveSignee(signee)}
                      className="bg-transparent border-none text-gray-400 cursor-pointer p-0 text-base leading-none font-light hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <span className="text-gray-400 italic">Unsigned</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Date Pickers */}
      {showPurchaseDatePicker && (
        <DatePicker
          value={purchaseDate}
          onChange={handlePurchaseDateChange}
          onClose={() => setShowPurchaseDatePicker(false)}
          position={datePickerPosition}
        />
      )}

      {showCleanedDatePicker && (
        <DatePicker
          value={cleanedDate}
          onChange={handleCleanedDateChange}
          onClose={() => setShowCleanedDatePicker(false)}
          position={datePickerPosition}
        />
      )}

      {showLastPlayedDatePicker && (
        <DatePicker
          value={lastPlayedDate}
          onChange={handleLastPlayedDateChange}
          onClose={() => setShowLastPlayedDatePicker(false)}
          position={datePickerPosition}
        />
      )}

      {/* Universal Pickers */}
      {showPurchaseStorePicker && (
        <UniversalPicker
          title="Purchase Stores"
          isOpen={showPurchaseStorePicker}
          onClose={() => setShowPurchaseStorePicker(false)}
          fetchItems={fetchPurchaseStores}
          selectedItems={album.purchase_store ? [album.purchase_store] : []}
          onSelect={(items) => {
            onChange('purchase_store', items.length > 0 ? items[0] : null);
            setShowPurchaseStorePicker(false);
          }}
          multiSelect={false}
          canManage={true}
          newItemLabel="Purchase Store"
          manageItemsLabel="Manage Purchase Stores"
        />
      )}

      {showOwnerPicker && (
        <UniversalPicker
          title="Owners"
          isOpen={showOwnerPicker}
          onClose={() => setShowOwnerPicker(false)}
          fetchItems={fetchOwners}
          selectedItems={album.owner ? [album.owner] : []}
          onSelect={(items) => {
            onChange('owner', items.length > 0 ? items[0] : null);
            setShowOwnerPicker(false);
          }}
          multiSelect={false}
          canManage={true}
          newItemLabel="Owner"
          manageItemsLabel="Manage Owners"
        />
      )}

      {showTagsPicker && (
        <UniversalPicker
          title="Tags"
          isOpen={showTagsPicker}
          onClose={() => setShowTagsPicker(false)}
          fetchItems={fetchTags}
          selectedItems={Array.isArray(album.custom_tags) ? album.custom_tags : []}
          onSelect={(items) => {
            onChange('custom_tags', items.length > 0 ? items : null);
            setShowTagsPicker(false);
          }}
          multiSelect={true}
          canManage={true}
          newItemLabel="Tag"
          manageItemsLabel="Manage Tags"
        />
      )}

      {showSigneesPicker && (
        <UniversalPicker
          title="Signees"
          isOpen={showSigneesPicker}
          onClose={() => setShowSigneesPicker(false)}
          fetchItems={fetchSignees}
          selectedItems={Array.isArray(album.signed_by) ? album.signed_by : []}
          onSelect={(items) => {
            onChange('signed_by', items.length > 0 ? items : null);
            setShowSigneesPicker(false);
          }}
          multiSelect={true}
          canManage={true}
          newItemLabel="Signee"
          manageItemsLabel="Manage Signees"
        />
      )}
    </>
  );
}