// src/app/edit-collection/tabs/PersonalTab.tsx
'use client';

import { useState, useEffect } from 'react';
import type { Album } from 'types/album';
import { DatePicker } from 'components/DatePicker';
import { UniversalPicker } from '../pickers/UniversalPicker';
import { 
  fetchPurchaseStores, 
  fetchOwners, 
  fetchSignees, 
  fetchTags,
  updatePurchaseStore,
  deletePurchaseStore,
  mergePurchaseStores,
  updateOwner,
  deleteOwner,
  mergeOwners
} from '../pickers/pickerDataUtils';

interface PersonalTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null | boolean) => void;
}

interface PlayedHistoryEntry {
  year: number;
  month: number;
  day: number;
  count: number;
}

export function PersonalTab({ album, onChange }: PersonalTabProps) {
  // Date picker state
  const [showPurchaseDatePicker, setShowPurchaseDatePicker] = useState(false);
  const [showCleanedDatePicker, setShowCleanedDatePicker] = useState(false);
  const [datePickerPosition, setDatePickerPosition] = useState({ top: 0, left: 0 });

  // Picker state
  const [showPurchaseStorePicker, setShowPurchaseStorePicker] = useState(false);
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [showTagsPicker, setShowTagsPicker] = useState(false);
  const [showSigneesPicker, setShowSigneesPicker] = useState(false);

  // Played History
  const [playedHistory, setPlayedHistory] = useState<PlayedHistoryEntry[]>([]);
  const [showPlayedForm, setShowPlayedForm] = useState(false);

  // Parse played history
  useEffect(() => {
    if (album.played_history) {
      try {
        const parsed = typeof album.played_history === 'string' 
          ? JSON.parse(album.played_history)
          : album.played_history;
        setPlayedHistory(Array.isArray(parsed) ? parsed : []);
      } catch {
        setPlayedHistory([]);
      }
    }
  }, [album.played_history]);

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

  // Parse dates for display
  const parsePurchaseDate = () => {
    if (!album.purchase_date) return { year: null, month: null, day: null };
    const parts = album.purchase_date.split('-');
    return {
      year: parts[0] ? parseInt(parts[0]) : null,
      month: parts[1] ? parseInt(parts[1]) : null,
      day: parts[2] ? parseInt(parts[2]) : null
    };
  };

  const parseCleanedDate = () => {
    if (!album.last_cleaned_date) return { year: null, month: null, day: null };
    const parts = album.last_cleaned_date.split('-');
    return {
      year: parts[0] ? parseInt(parts[0]) : null,
      month: parts[1] ? parseInt(parts[1]) : null,
      day: parts[2] ? parseInt(parts[2]) : null
    };
  };

  const purchaseDate = parsePurchaseDate();
  const cleanedDate = parseCleanedDate();

  // Rating handlers
  const currentRating = album.my_rating || 0;
  const handleRatingChange = (rating: number) => {
    onChange('my_rating', rating === currentRating ? 0 : rating);
  };

  // Played history handlers
  const totalPlays = playedHistory.reduce((sum, entry) => sum + entry.count, 0);

  const handleAddPlayedHistory = (year: string, month: string, day: string, count: string) => {
    if (year && month && day && count) {
      const newEntry: PlayedHistoryEntry = {
        year: parseInt(year),
        month: parseInt(month),
        day: parseInt(day),
        count: parseInt(count)
      };
      const updated = [...playedHistory, newEntry];
      setPlayedHistory(updated);
      onChange('played_history', JSON.stringify(updated));
      setShowPlayedForm(false);
    }
  };

  const handleDeletePlayedHistory = (index: number) => {
    const updated = playedHistory.filter((_, i) => i !== index);
    setPlayedHistory(updated);
    onChange('played_history', updated.length > 0 ? JSON.stringify(updated) : null);
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

  // Styles - COPIED FROM MAINTAB
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: '6px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: 'white',
    color: '#111827',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: 'white',
    color: '#111827',
  };

  const dateInputStyle: React.CSSProperties = {
    padding: '8px 8px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    textAlign: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: 'white',
    color: '#111827',
  };

  return (
    <>
      <div style={{ maxWidth: '100%' }}>
        {/* ROW 1: [25%] [25%] [50%] - Purchase Date | Purchase Store | Owner */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px', marginBottom: '10px' }}>
          {/* Purchase Date - COPIED FROM MAINTAB ORIGINAL RELEASE DATE */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: '0' }}>Purchase Date</label>
              <div 
                onClick={handleOpenPurchaseDatePicker}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6b7280' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
              <input
                type="text"
                value={purchaseDate.year || ''}
                placeholder="YYYY"
                readOnly
                onClick={handleOpenPurchaseDatePicker}
                style={{ ...dateInputStyle, width: '92px', borderRadius: '4px', cursor: 'pointer' }}
              />
              <div style={{ width: '10px', height: '1px', backgroundColor: '#d1d5db' }} />
              <input
                type="text"
                value={purchaseDate.month || ''}
                placeholder="MM"
                readOnly
                onClick={handleOpenPurchaseDatePicker}
                style={{ ...dateInputStyle, width: '56px', borderRadius: '4px', cursor: 'pointer' }}
              />
              <div style={{ width: '10px', height: '1px', backgroundColor: '#d1d5db' }} />
              <input
                type="text"
                value={purchaseDate.day || ''}
                placeholder="DD"
                readOnly
                onClick={handleOpenPurchaseDatePicker}
                style={{ ...dateInputStyle, width: '56px', borderRadius: '4px', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Purchase Store */}
          <div>
            <label style={labelStyle}>Purchase Store</label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
              <select 
                value={album.purchase_store || ''}
                onChange={(e) => onChange('purchase_store', e.target.value)}
                style={{ 
                  ...selectStyle, 
                  flex: 1, 
                  height: '36px',
                  borderRadius: '4px 0 0 4px',
                  borderRight: 'none',
                  appearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'%3E%3Cpath fill=\'%23666\' d=\'M0 0l5 6 5-6z\'/%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: '32px',
                }}
              >
                <option value="">Select</option>
              </select>
              <button 
                onClick={() => setShowPurchaseStorePicker(true)}
                style={{
                  width: '36px',
                  height: '36px',
                  padding: 0,
                  border: '1px solid #d1d5db',
                  borderRadius: '0 4px 4px 0',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  flexShrink: 0,
                }}
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
            <label style={labelStyle}>Owner</label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
              <select 
                value={album.owner || ''}
                onChange={(e) => onChange('owner', e.target.value)}
                style={{ 
                  ...selectStyle, 
                  flex: 1, 
                  height: '36px',
                  borderRadius: '4px 0 0 4px',
                  borderRight: 'none',
                  appearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'%3E%3Cpath fill=\'%23666\' d=\'M0 0l5 6 5-6z\'/%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: '32px',
                }}
              >
                <option value="">Select</option>
              </select>
              <button 
                onClick={() => setShowOwnerPicker(true)}
                style={{
                  width: '36px',
                  height: '36px',
                  padding: 0,
                  border: '1px solid #d1d5db',
                  borderRadius: '0 4px 4px 0',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  flexShrink: 0,
                }}
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

        {/* ROW 2: [25%] [25%] [50%] - Purchase Price | Current Value | My Rating */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px', marginBottom: '10px' }}>
          {/* Purchase Price */}
          <div>
            <label style={labelStyle}>Purchase Price</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>$</span>
              <input
                type="number"
                step="0.01"
                value={album.purchase_price || ''}
                onChange={(e) => onChange('purchase_price', e.target.value ? parseFloat(e.target.value) : null)}
                style={{ ...inputStyle, flex: 1, height: '36px' }}
              />
            </div>
          </div>

          {/* Current Value */}
          <div>
            <label style={labelStyle}>Current Value</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>$</span>
              <input
                type="number"
                step="0.01"
                value={album.current_value || ''}
                onChange={(e) => onChange('current_value', e.target.value ? parseFloat(e.target.value) : null)}
                style={{ ...inputStyle, flex: 1, height: '36px' }}
              />
            </div>
          </div>

          {/* My Rating */}
          <div>
            <label style={labelStyle}>My Rating {currentRating > 0 ? `(${currentRating} / 10)` : ''}</label>
            <div style={{ display: 'flex', gap: '2px' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRatingChange(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '22px',
                    padding: 0,
                    color: star <= currentRating ? '#fbbf24' : '#d1d5db',
                    lineHeight: '1'
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ROW 3: [50%] [50%] - Tags | Notes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
          {/* Tags */}
          <div>
            <label style={labelStyle}>Tags</label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'flex-start' }}>
              <div style={{
                flex: 1,
                padding: '6px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px 0 0 4px',
                borderRight: 'none',
                minHeight: '36px',
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
                alignItems: 'center',
                backgroundColor: 'white',
                boxSizing: 'border-box',
              }}>
                {Array.isArray(album.custom_tags) && album.custom_tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      backgroundColor: '#e5e7eb',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '13px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#374151',
                    }}
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '16px',
                        lineHeight: '1',
                        fontWeight: '300',
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <button 
                onClick={() => setShowTagsPicker(true)}
                style={{
                  width: '36px',
                  minHeight: '40px',
                  padding: 0,
                  border: '1px solid #d1d5db',
                  borderRadius: '0 4px 4px 0',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                }}
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

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={album.notes || ''}
              onChange={(e) => onChange('notes', e.target.value)}
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: '40px',
              }}
            />
          </div>
        </div>

        {/* ROW 4: [50%] [50%] - Last Cleaned Date | Signed by */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
          {/* Last Cleaned Date - COPIED FROM MAINTAB ORIGINAL RELEASE DATE */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: '0' }}>Last Cleaned Date</label>
              <div 
                onClick={handleOpenCleanedDatePicker}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6b7280' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
              <input
                type="text"
                value={cleanedDate.year || ''}
                placeholder="YYYY"
                readOnly
                onClick={handleOpenCleanedDatePicker}
                style={{ ...dateInputStyle, width: '92px', borderRadius: '4px', cursor: 'pointer' }}
              />
              <div style={{ width: '10px', height: '1px', backgroundColor: '#d1d5db' }} />
              <input
                type="text"
                value={cleanedDate.month || ''}
                placeholder="MM"
                readOnly
                onClick={handleOpenCleanedDatePicker}
                style={{ ...dateInputStyle, width: '56px', borderRadius: '4px', cursor: 'pointer' }}
              />
              <div style={{ width: '10px', height: '1px', backgroundColor: '#d1d5db' }} />
              <input
                type="text"
                value={cleanedDate.day || ''}
                placeholder="DD"
                readOnly
                onClick={handleOpenCleanedDatePicker}
                style={{ ...dateInputStyle, width: '56px', borderRadius: '4px', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Signed by - COPIED FROM MAINTAB ARTIST PATTERN */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: '0' }}>Signed by</label>
              <span 
                onClick={() => setShowSigneesPicker(true)}
                style={{ color: '#9ca3af', fontSize: '20px', fontWeight: '300', cursor: 'pointer' }}
              >
                +
              </span>
            </div>
            <div style={{ 
              flex: 1,
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              backgroundColor: 'white',
              minHeight: '36px',
              color: '#111827',
            }}>
              {Array.isArray(album.signed_by) && album.signed_by.length > 0 ? (
                album.signed_by.map((signee, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: idx < album.signed_by!.length - 1 ? '4px' : '0'
                  }}>
                    <span>{signee}</span>
                    <button
                      onClick={() => handleRemoveSignee(signee)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '18px',
                        lineHeight: '1',
                        fontWeight: '300',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <span style={{ color: '#9ca3af' }}></span>
              )}
            </div>
          </div>
        </div>

        {/* ROW 5: [50%] [50%] - Played History | empty */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* Played History - COPIED FROM MAINTAB ARTIST PATTERN */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: '0' }}>Played History (total plays: {totalPlays})</label>
              <span 
                onClick={() => setShowPlayedForm(true)}
                style={{ color: '#9ca3af', fontSize: '20px', fontWeight: '300', cursor: 'pointer' }}
              >
                +
              </span>
            </div>
            <div style={{ 
              flex: 1,
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              backgroundColor: 'white',
              minHeight: '36px',
              color: '#111827',
            }}>
              {playedHistory.length > 0 ? (
                playedHistory.map((entry, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: idx < playedHistory.length - 1 ? '4px' : '0'
                  }}>
                    <span>{entry.month}/{entry.day}/{entry.year} - Count: {entry.count}</span>
                    <button
                      onClick={() => handleDeletePlayedHistory(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '18px',
                        lineHeight: '1',
                        fontWeight: '300',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <span style={{ color: '#9ca3af' }}></span>
              )}
            </div>
          </div>

          {/* Empty column */}
          <div></div>
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
          onUpdate={updatePurchaseStore}
          onDelete={deletePurchaseStore}
          onMerge={mergePurchaseStores}
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
          onUpdate={updateOwner}
          onDelete={deleteOwner}
          onMerge={mergeOwners}
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

      {/* Played History Form Modal */}
      {showPlayedForm && (
        <PlayedHistoryFormModal
          onClose={() => setShowPlayedForm(false)}
          onSave={handleAddPlayedHistory}
        />
      )}
    </>
  );
}

// Played History Form Modal Component
interface PlayedHistoryFormModalProps {
  onClose: () => void;
  onSave: (year: string, month: string, day: string, count: string) => void;
}

function PlayedHistoryFormModal({ onClose, onSave }: PlayedHistoryFormModalProps) {
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [count, setCount] = useState('1');

  const handleSave = () => {
    if (year && month && day && count) {
      onSave(year, month, day, count);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 30000,
        }}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'white',
        borderRadius: '8px',
        width: '400px',
        zIndex: 30001,
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        padding: '20px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Add Played History</h3>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Date</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="YYYY"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              style={{ width: '80px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
            />
            <input
              type="text"
              placeholder="MM"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ width: '60px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
            />
            <input
              type="text"
              placeholder="DD"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              style={{ width: '60px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Count</label>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}