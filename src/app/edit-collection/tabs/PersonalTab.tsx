'use client';

import { useState } from 'react';
import type { Album } from 'types/album';
import { DatePicker } from 'components/DatePicker';

interface PersonalTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | null | boolean) => void;
}

export function PersonalTab({ album, onChange }: PersonalTabProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeDateField, setActiveDateField] = useState<'purchase' | 'cleaned' | 'played' | 'due' | 'loan' | null>(null);
  const [datePickerPosition, setDatePickerPosition] = useState({ top: 0, left: 0 });

  const handleOpenDatePicker = (field: 'purchase' | 'cleaned' | 'played' | 'due' | 'loan', event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // Adjust position to keep it visible
    const top = rect.bottom + window.scrollY + 5;
    const left = Math.min(rect.left + window.scrollX, window.innerWidth - 320); // Prevent overflow right
    
    setDatePickerPosition({ top, left });
    setActiveDateField(field);
    setShowDatePicker(true);
  };

  const handleDateChange = (date: { year: number | null; month: number | null; day: number | null }) => {
    if (!activeDateField) return;
    
    let dateStr = null;
    if (date.year && date.month && date.day) {
      dateStr = `${date.year}-${date.month.toString().padStart(2, '0')}-${date.day.toString().padStart(2, '0')}`;
    }

    switch (activeDateField) {
      case 'purchase':
        onChange('purchase_date', dateStr);
        break;
      case 'cleaned':
        onChange('last_cleaned_date', dateStr);
        break;
      case 'played':
        onChange('last_played_date', dateStr);
        break;
      case 'due':
        onChange('due_date', dateStr);
        break;
      case 'loan':
        onChange('loan_date', dateStr);
        break;
    }
    setShowDatePicker(false);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return dateStr;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full relative">
      {/* Left Column */}
      <div className="flex flex-col gap-4">
        {/* Purchase Date */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-[13px] font-semibold text-gray-500">Purchase Date</label>
            <div 
              onClick={(e) => handleOpenDatePicker('purchase', e)}
              className="cursor-pointer text-gray-400 hover:text-blue-500"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <input
            type="text"
            value={formatDate(album.purchase_date)}
            readOnly
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-gray-50 text-gray-900 focus:outline-none"
            placeholder="YYYY-MM-DD"
          />
        </div>

        {/* Purchase Store */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Purchase Store</label>
          <input
            type="text"
            value={album.purchase_store || ''}
            onChange={(e) => onChange('purchase_store', e.target.value)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Purchase Price */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Purchase Price</label>
          <input
            type="number"
            step="0.01"
            value={album.purchase_price || ''}
            onChange={(e) => onChange('purchase_price', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Current Value */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Current Value</label>
          <input
            type="number"
            step="0.01"
            value={album.current_value || ''}
            onChange={(e) => onChange('current_value', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Owner */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Owner</label>
          <input
            type="text"
            value={album.owner || ''}
            onChange={(e) => onChange('owner', e.target.value)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Personal Notes */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Notes</label>
          <textarea
            value={album.personal_notes || ''}
            onChange={(e) => onChange('personal_notes', e.target.value)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500 min-h-[80px]"
          />
        </div>
      </div>

      {/* Right Column */}
      <div className="flex flex-col gap-4">
        {/* Last Cleaned Date */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-[13px] font-semibold text-gray-500">Last Cleaned Date</label>
            <div 
              onClick={(e) => handleOpenDatePicker('cleaned', e)}
              className="cursor-pointer text-gray-400 hover:text-blue-500"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <input
            type="text"
            value={formatDate(album.last_cleaned_date)}
            readOnly
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-gray-50 text-gray-900 focus:outline-none"
            placeholder="YYYY-MM-DD"
          />
        </div>

        {/* Signed By */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Signed By</label>
          <input
            type="text"
            value={album.signed_by ? album.signed_by.join(', ') : ''}
            onChange={(e) => onChange('signed_by', e.target.value ? e.target.value.split(',').map(s => s.trim()) : null)}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
            placeholder="Comma separated names"
          />
        </div>

        {/* My Rating */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">My Rating (0-5)</label>
          <div className="flex gap-1 items-center h-[38px]">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onChange('my_rating', star)}
                className={`text-2xl leading-none border-none bg-transparent cursor-pointer transition-colors ${
                  (album.my_rating || 0) >= star ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-200'
                }`}
              >
                ★
              </button>
            ))}
            {album.my_rating && (
              <button
                onClick={() => onChange('my_rating', null)}
                className="ml-2 text-xs text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Last Played Date */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-[13px] font-semibold text-gray-500">Last Played Date</label>
            <div 
              onClick={(e) => handleOpenDatePicker('played', e)}
              className="cursor-pointer text-gray-400 hover:text-blue-500"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <input
            type="text"
            value={formatDate(album.last_played_date)}
            readOnly
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-gray-50 text-gray-900 focus:outline-none"
            placeholder="YYYY-MM-DD"
          />
        </div>

        {/* Play Count */}
        <div>
          <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Play Count</label>
          <input
            type="number"
            value={album.play_count || 0}
            onChange={(e) => onChange('play_count', parseInt(e.target.value))}
            className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Loan Info Header */}
        <div className="pt-2 border-t border-gray-100 mt-2">
          <label className="block text-sm font-bold text-gray-700 mb-3">Loan Information</label>
          
          {/* Due Date */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[13px] font-semibold text-gray-500">Due Date</label>
              <div 
                onClick={(e) => handleOpenDatePicker('due', e)}
                className="cursor-pointer text-gray-400 hover:text-blue-500"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <input
              type="text"
              value={formatDate(album.due_date)}
              readOnly
              className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-gray-50 text-gray-900 focus:outline-none"
              placeholder="YYYY-MM-DD"
            />
          </div>

          {/* Loan Date */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[13px] font-semibold text-gray-500">Loan Date</label>
              <div 
                onClick={(e) => handleOpenDatePicker('loan', e)}
                className="cursor-pointer text-gray-400 hover:text-blue-500"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <input
              type="text"
              value={formatDate(album.loan_date)}
              readOnly
              className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-gray-50 text-gray-900 focus:outline-none"
              placeholder="YYYY-MM-DD"
            />
          </div>

          {/* Loaned To */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Loaned To</label>
            <input
              type="text"
              value={album.loaned_to || ''}
              onChange={(e) => onChange('loaned_to', e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {showDatePicker && (
        <DatePicker
          value={{ year: null, month: null, day: null }} // You'd typically parse the active date here
          onChange={handleDateChange}
          onClose={() => setShowDatePicker(false)}
          position={datePickerPosition}
        />
      )}
    </div>
  );
}