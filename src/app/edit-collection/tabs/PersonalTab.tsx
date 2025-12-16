// src/app/edit-collection/tabs/PersonalTab.tsx
'use client';

import { useState, useEffect } from 'react';
import type { Album } from 'types/album';
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
  // Purchase Date
  const [purchaseYear, setPurchaseYear] = useState('');
  const [purchaseMonth, setPurchaseMonth] = useState('');
  const [purchaseDay, setPurchaseDay] = useState('');

  // Last Cleaned Date
  const [cleanedYear, setCleanedYear] = useState('');
  const [cleanedMonth, setCleanedMonth] = useState('');
  const [cleanedDay, setCleanedDay] = useState('');

  // Pickers
  const [showPurchaseStorePicker, setShowPurchaseStorePicker] = useState(false);
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [showTagsPicker, setShowTagsPicker] = useState(false);
  const [showSigneesPicker, setShowSigneesPicker] = useState(false);

  // Played History
  const [playedHistory, setPlayedHistory] = useState<PlayedHistoryEntry[]>([]);
  const [showPlayedForm, setShowPlayedForm] = useState(false);
  const [newPlayYear, setNewPlayYear] = useState('');
  const [newPlayMonth, setNewPlayMonth] = useState('');
  const [newPlayDay, setNewPlayDay] = useState('');
  const [newPlayCount, setNewPlayCount] = useState('1');

  // Parse purchase date on mount
  useEffect(() => {
    if (album.purchase_date) {
      const parts = album.purchase_date.split('-');
      if (parts.length === 3) {
        setPurchaseYear(parts[0]);
        setPurchaseMonth(parts[1]);
        setPurchaseDay(parts[2]);
      }
    }
  }, [album.purchase_date]);

  // Parse last cleaned date on mount
  useEffect(() => {
    if (album.last_cleaned_date) {
      const parts = album.last_cleaned_date.split('-');
      if (parts.length === 3) {
        setCleanedYear(parts[0]);
        setCleanedMonth(parts[1]);
        setCleanedDay(parts[2]);
      }
    }
  }, [album.last_cleaned_date]);

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

  const handlePurchaseDateChange = (year: string, month: string, day: string) => {
    if (year && month && day) {
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      onChange('purchase_date', date);
    } else {
      onChange('purchase_date', null);
    }
  };

  const handleCleanedDateChange = (year: string, month: string, day: string) => {
    if (year && month && day) {
      const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      onChange('last_cleaned_date', date);
    } else {
      onChange('last_cleaned_date', null);
    }
  };

  const handleAddPlayedHistory = () => {
    if (newPlayYear && newPlayMonth && newPlayDay && newPlayCount) {
      const newEntry: PlayedHistoryEntry = {
        year: parseInt(newPlayYear),
        month: parseInt(newPlayMonth),
        day: parseInt(newPlayDay),
        count: parseInt(newPlayCount)
      };
      const updated = [...playedHistory, newEntry];
      setPlayedHistory(updated);
      onChange('played_history', JSON.stringify(updated));
      
      // Reset form
      setNewPlayYear('');
      setNewPlayMonth('');
      setNewPlayDay('');
      setNewPlayCount('1');
      setShowPlayedForm(false);
    }
  };

  const handleDeletePlayedHistory = (index: number) => {
    const updated = playedHistory.filter((_, i) => i !== index);
    setPlayedHistory(updated);
    onChange('played_history', updated.length > 0 ? JSON.stringify(updated) : null);
  };

  const totalPlays = playedHistory.reduce((sum, entry) => sum + entry.count, 0);

  // Calculate rating from my_rating field
  const currentRating = album.my_rating || 0;

  const handleRatingChange = (rating: number) => {
    onChange('my_rating', rating);
  };

  const handleRemoveSignee = (signee: string) => {
    const current = Array.isArray(album.signed_by) ? album.signed_by : [];
    onChange('signed_by', current.filter(s => s !== signee));
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Purchase Date */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
          Purchase Date
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="YYYY"
            value={purchaseYear}
            onChange={(e) => {
              setPurchaseYear(e.target.value);
              handlePurchaseDateChange(e.target.value, purchaseMonth, purchaseDay);
            }}
            style={{
              width: '80px',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px'
            }}
          />
          <input
            type="text"
            placeholder="MM"
            value={purchaseMonth}
            onChange={(e) => {
              setPurchaseMonth(e.target.value);
              handlePurchaseDateChange(purchaseYear, e.target.value, purchaseDay);
            }}
            style={{
              width: '60px',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px'
            }}
          />
          <input
            type="text"
            placeholder="DD"
            value={purchaseDay}
            onChange={(e) => {
              setPurchaseDay(e.target.value);
              handlePurchaseDateChange(purchaseYear, purchaseMonth, e.target.value);
            }}
            style={{
              width: '60px',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px'
            }}
          />
          <button
            style={{
              padding: '8px 12px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            📅
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Purchase Store */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Purchase Store
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={album.purchase_store || ''}
              onChange={(e) => onChange('purchase_store', e.target.value)}
              style={{
                flex: 1,
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            />
            <button
              onClick={() => setShowPurchaseStorePicker(true)}
              style={{
                padding: '8px 12px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              📋
            </button>
          </div>
        </div>

        {/* Owner */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Owner
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={album.owner || ''}
              onChange={(e) => onChange('owner', e.target.value)}
              style={{
                flex: 1,
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '13px',
                background: 'white'
              }}
            >
              <option value=""></option>
              <option value="Me">Me</option>
            </select>
            <button
              onClick={() => setShowOwnerPicker(true)}
              style={{
                padding: '8px 12px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              📋
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Purchase Price */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Purchase Price
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>$</span>
            <input
              type="number"
              step="0.01"
              value={album.purchase_price || ''}
              onChange={(e) => onChange('purchase_price', e.target.value ? parseFloat(e.target.value) : null)}
              style={{
                flex: 1,
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            />
          </div>
        </div>

        {/* Current Value */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Current Value
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>$</span>
            <input
              type="number"
              step="0.01"
              value={album.current_value || ''}
              onChange={(e) => onChange('current_value', e.target.value ? parseFloat(e.target.value) : null)}
              style={{
                flex: 1,
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            />
          </div>
        </div>
      </div>

      {/* My Rating */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
          My Rating (6 / 10)
        </label>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
            <button
              key={star}
              onClick={() => handleRatingChange(star)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '28px',
                padding: 0,
                color: star <= currentRating ? '#fbbf24' : '#d1d5db'
              }}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
          Tags
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {Array.isArray(album.custom_tags) && album.custom_tags.map((tag) => (
            <div
              key={tag}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                background: '#f3f4f6',
                borderRadius: '16px',
                fontSize: '13px'
              }}
            >
              <span>{tag}</span>
              <button
                onClick={() => {
                  const updated = album.custom_tags?.filter(t => t !== tag) || [];
                  onChange('custom_tags', updated.length > 0 ? updated : null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: 0,
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => setShowTagsPicker(true)}
            style={{
              padding: '4px 12px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '16px',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>📋</span>
          </button>
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
          Notes
        </label>
        <textarea
          value={album.notes || ''}
          onChange={(e) => onChange('notes', e.target.value)}
          rows={4}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '13px',
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
        />
      </div>

      {/* Last Cleaned Date */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
          Last Cleaned Date
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="YYYY"
            value={cleanedYear}
            onChange={(e) => {
              setCleanedYear(e.target.value);
              handleCleanedDateChange(e.target.value, cleanedMonth, cleanedDay);
            }}
            style={{
              width: '80px',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px'
            }}
          />
          <input
            type="text"
            placeholder="MM"
            value={cleanedMonth}
            onChange={(e) => {
              setCleanedMonth(e.target.value);
              handleCleanedDateChange(cleanedYear, e.target.value, cleanedDay);
            }}
            style={{
              width: '60px',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px'
            }}
          />
          <input
            type="text"
            placeholder="DD"
            value={cleanedDay}
            onChange={(e) => {
              setCleanedDay(e.target.value);
              handleCleanedDateChange(cleanedYear, cleanedMonth, e.target.value);
            }}
            style={{
              width: '60px',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px'
            }}
          />
          <button
            style={{
              padding: '8px 12px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            📅
          </button>
        </div>
      </div>

      {/* Signed by */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
          Signed by
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Array.isArray(album.signed_by) && album.signed_by.length > 0 ? (
            album.signed_by.map((signee, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px'
                }}
              >
                <span style={{ fontSize: '13px' }}>{signee}</span>
                <button
                  onClick={() => handleRemoveSignee(signee)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: '#ef4444',
                    padding: 0
                  }}
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <div style={{ padding: '8px', color: '#9ca3af', fontSize: '13px' }}>
              No signatures recorded
            </div>
          )}
          <button
            onClick={() => setShowSigneesPicker(true)}
            style={{
              padding: '8px 12px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '20px',
              color: '#6b7280',
              alignSelf: 'flex-start'
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Played History */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
          Played History (total plays: {totalPlays})
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {playedHistory.map((entry, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '4px'
              }}
            >
              <input
                type="text"
                value={entry.year}
                readOnly
                style={{
                  width: '70px',
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '13px',
                  background: 'white'
                }}
              />
              <input
                type="text"
                value={entry.month}
                readOnly
                style={{
                  width: '50px',
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '13px',
                  background: 'white'
                }}
              />
              <input
                type="text"
                value={entry.day}
                readOnly
                style={{
                  width: '50px',
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '13px',
                  background: 'white'
                }}
              />
              <span style={{ fontSize: '13px', color: '#6b7280', marginLeft: 'auto' }}>
                Count: {entry.count}
              </span>
              <button
                onClick={() => handleDeletePlayedHistory(idx)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#ef4444',
                  padding: 0
                }}
              >
                ×
              </button>
            </div>
          ))}

          {showPlayedForm && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '4px'
            }}>
              <input
                type="text"
                placeholder="YYYY"
                value={newPlayYear}
                onChange={(e) => setNewPlayYear(e.target.value)}
                style={{
                  width: '70px',
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}
              />
              <input
                type="text"
                placeholder="MM"
                value={newPlayMonth}
                onChange={(e) => setNewPlayMonth(e.target.value)}
                style={{
                  width: '50px',
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}
              />
              <input
                type="text"
                placeholder="DD"
                value={newPlayDay}
                onChange={(e) => setNewPlayDay(e.target.value)}
                style={{
                  width: '50px',
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}
              />
              <input
                type="number"
                placeholder="Count"
                value={newPlayCount}
                onChange={(e) => setNewPlayCount(e.target.value)}
                style={{
                  width: '70px',
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '13px',
                  marginLeft: 'auto'
                }}
              />
              <button
                onClick={handleAddPlayedHistory}
                style={{
                  padding: '4px 12px',
                  background: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Save
              </button>
              <button
                onClick={() => setShowPlayedForm(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#ef4444',
                  padding: 0
                }}
              >
                ×
              </button>
            </div>
          )}

          <button
            onClick={() => setShowPlayedForm(true)}
            style={{
              padding: '8px 12px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '20px',
              color: '#6b7280',
              alignSelf: 'flex-start'
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Pickers */}
      {showPurchaseStorePicker && (
        <UniversalPicker
          title="Select Purchase Store"
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
          newItemLabel="New Purchase Store"
          manageItemsLabel="Manage Purchase Stores"
        />
      )}

      {showOwnerPicker && (
        <UniversalPicker
          title="Select Owner"
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
          newItemLabel="New Owner"
          manageItemsLabel="Manage Owners"
        />
      )}

      {showTagsPicker && (
        <UniversalPicker
          title="Select Tags"
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
          newItemLabel="New Tag"
          manageItemsLabel="Manage Tags"
        />
      )}

      {showSigneesPicker && (
        <UniversalPicker
          title="Select Signees"
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
          newItemLabel="New Signee"
          manageItemsLabel="Manage Signees"
        />
      )}
    </div>
  );
}