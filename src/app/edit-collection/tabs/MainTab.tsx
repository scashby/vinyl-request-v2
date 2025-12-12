// src/app/edit-collection/tabs/MainTab.tsx
'use client';

import { useState } from 'react';
import type { Album } from 'types/album';
import { PickerModal } from '../pickers/PickerModal';
import { ManageModal } from '../pickers/ManageModal';
import { EditModal } from '../pickers/EditModal';
import { MergeModal } from '../pickers/MergeModal';

interface MainTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null | boolean) => void;
}

// Mock data - in production, these would come from database
const MOCK_LABELS = [
  { id: '1', name: 'Blue Note', count: 42 },
  { id: '2', name: 'Columbia', count: 38 },
  { id: '3', name: 'Def Jam', count: 25 },
  { id: '4', name: 'Elektra', count: 18 },
  { id: '5', name: 'Interscope', count: 31 },
];

const MOCK_FORMATS = [
  { id: '1', name: 'LP', count: 156 },
  { id: '2', name: '12"', count: 89 },
  { id: '3', name: '7"', count: 45 },
  { id: '4', name: '10"', count: 12 },
  { id: '5', name: 'Box Set', count: 8 },
];

const MOCK_GENRES = [
  { id: '1', name: 'Jazz', count: 78 },
  { id: '2', name: 'Rock', count: 65 },
  { id: '3', name: 'Hip Hop', count: 52 },
  { id: '4', name: 'Electronic', count: 41 },
  { id: '5', name: 'Soul', count: 34 },
  { id: '6', name: 'Funk', count: 29 },
];

const MOCK_LOCATIONS = [
  { id: '1', name: 'Living Room - Main Shelf', count: 145 },
  { id: '2', name: 'Bedroom - Upper Cabinet', count: 89 },
  { id: '3', name: 'Storage - Box A', count: 67 },
  { id: '4', name: 'Office - Display Case', count: 23 },
];

type ModalType = 'picker' | 'manage' | 'edit' | 'merge' | null;
type FieldType = 'spotify_label' | 'format' | 'genre' | 'location';

export function MainTab({ album, onChange }: MainTabProps) {
  // Modal state
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [activeField, setActiveField] = useState<FieldType | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [mergingItemIds, setMergingItemIds] = useState<string[]>([]);

  // Data state (mock - would be from props or context in production)
  const [labels, setLabels] = useState(MOCK_LABELS);
  const [formats, setFormats] = useState(MOCK_FORMATS);
  const [genres, setGenres] = useState(MOCK_GENRES);
  const [locations, setLocations] = useState(MOCK_LOCATIONS);

  // Get current items based on active field
  const getCurrentItems = () => {
    switch (activeField) {
      case 'spotify_label': return labels;
      case 'format': return formats;
      case 'genre': return genres;
      case 'location': return locations;
      default: return [];
    }
  };

  // Get current selection based on active field
  const getCurrentSelection = () => {
    switch (activeField) {
      case 'spotify_label': return album.spotify_label || album.apple_music_label || '';
      case 'format': return album.format || '';
      case 'genre': return album.discogs_genres || [];
      case 'location': return album.location || '';
      default: return '';
    }
  };

  // Get field configuration
  const getFieldConfig = () => {
    switch (activeField) {
      case 'spotify_label': return { title: 'Select Label', itemLabel: 'Label', mode: 'single' as const };
      case 'format': return { title: 'Select Format', itemLabel: 'Format', mode: 'single' as const };
      case 'genre': return { title: 'Select Genres', itemLabel: 'Genre', mode: 'multi' as const };
      case 'location': return { title: 'Select Location', itemLabel: 'Location', mode: 'single' as const };
      default: return { title: '', itemLabel: '', mode: 'single' as const };
    }
  };

  // Update items based on field
  const updateItems = (items: typeof labels) => {
    switch (activeField) {
      case 'spotify_label': setLabels(items); break;
      case 'format': setFormats(items); break;
      case 'genre': setGenres(items); break;
      case 'location': setLocations(items); break;
    }
  };

  // Open picker modal
  const handleOpenPicker = (field: FieldType) => {
    setActiveField(field);
    setActiveModal('picker');
  };

  // PickerModal handlers
  const handlePickerSave = (selectedIds: string | string[]) => {
    if (!activeField) return;

    const items = getCurrentItems();
    
    if (Array.isArray(selectedIds)) {
      // Multi-select (genres only)
      const selectedNames = selectedIds.map(id => items.find(item => item.id === id)?.name || '');
      onChange('discogs_genres', selectedNames);
    } else {
      // Single-select
      const selectedName = items.find(item => item.id === selectedIds)?.name || '';
      
      if (activeField === 'spotify_label') {
        onChange('spotify_label', selectedName);
        onChange('apple_music_label', selectedName);
      } else if (activeField === 'format') {
        onChange('format', selectedName);
      } else if (activeField === 'location') {
        onChange('location', selectedName);
      }
    }
  };

  const handleOpenManage = () => {
    setActiveModal('manage');
  };

  const handleOpenNew = () => {
    setEditingItemId(null);
    setActiveModal('edit');
  };

  // ManageModal handlers
  const handleEdit = (itemId: string) => {
    setEditingItemId(itemId);
    setActiveModal('edit');
  };

  const handleDelete = (itemId: string) => {
    const items = getCurrentItems();
    updateItems(items.filter(item => item.id !== itemId));
  };

  const handleOpenMerge = (itemIds: string[]) => {
    setMergingItemIds(itemIds);
    setActiveModal('merge');
  };

  // EditModal handlers
  const handleEditSave = (newName: string) => {
    const items = getCurrentItems();
    
    if (editingItemId) {
      // Edit existing
      updateItems(items.map(item => 
        item.id === editingItemId ? { ...item, name: newName } : item
      ));
    } else {
      // Create new
      const newId = String(Math.max(...items.map(i => parseInt(i.id))) + 1);
      updateItems([...items, { id: newId, name: newName, count: 0 }]);
    }
  };

  // MergeModal handlers
  const handleMerge = (primaryId: string, mergeIntoIds: string[]) => {
    const items = getCurrentItems();
    const primaryItem = items.find(item => item.id === primaryId);
    if (!primaryItem) return;

    // Sum up all counts
    const mergedCount = items
      .filter(item => item.id === primaryId || mergeIntoIds.includes(item.id))
      .reduce((sum, item) => sum + (item.count || 0), 0);

    // Remove merged items and update primary
    updateItems(items
      .filter(item => !mergeIntoIds.includes(item.id))
      .map(item => item.id === primaryId ? { ...item, count: mergedCount } : item)
    );
  };

  // Close all modals
  const handleCloseModal = () => {
    setActiveModal(null);
    setEditingItemId(null);
    setMergingItemIds([]);
  };

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
    appearance: 'none',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'%3E%3Cpath fill=\'%23666\' d=\'M0 0l5 6 5-6z\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: '32px',
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

  const fieldConfig = getFieldConfig();
  const currentItems = getCurrentItems();
  const editingItem = editingItemId ? currentItems.find(item => item.id === editingItemId) : null;
  const mergingItems = currentItems.filter(item => mergingItemIds.includes(item.id));

  return (
    <>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '20px',
        maxWidth: '100%',
      }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Title with Aa */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: '0' }}>Title</label>
              <span style={{ color: '#9ca3af', fontSize: '13px', fontWeight: '400' }}>Aa</span>
            </div>
            <input
              type="text"
              value={album.title}
              onChange={(e) => onChange('title', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Sort Title */}
          <div>
            <label style={labelStyle}>Sort Title</label>
            <input
              type="text"
              value={album.sort_title || ''}
              onChange={(e) => onChange('sort_title', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Subtitle */}
          <div>
            <label style={labelStyle}>Subtitle</label>
            <input
              type="text"
              value={album.subtitle || ''}
              onChange={(e) => onChange('subtitle', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Artist */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: '0' }}>Artist</label>
              <span style={{ color: '#9ca3af', fontSize: '20px', fontWeight: '300', cursor: 'pointer' }}>+</span>
            </div>
            <div style={{ 
              flex: 1,
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>{album.artist}</span>
              <button
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
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Row 1: Release Date | Original Release Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: '0' }}>Release Date</label>
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6b7280' }}>
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
                  value={album.year || ''}
                  onChange={(e) => onChange('year', e.target.value)}
                  placeholder="YYYY"
                  style={{ ...dateInputStyle, width: '92px', borderRadius: '4px' }}
                />
                <div style={{ width: '10px', height: '1px', backgroundColor: '#d1d5db' }} />
                <input
                  type="text"
                  placeholder="MM"
                  style={{ ...dateInputStyle, width: '56px', borderRadius: '4px' }}
                />
                <div style={{ width: '10px', height: '1px', backgroundColor: '#d1d5db' }} />
                <input
                  type="text"
                  placeholder="DD"
                  style={{ ...dateInputStyle, width: '56px', borderRadius: '4px' }}
                />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: '0' }}>Original Release Date</label>
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6b7280' }}>
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
                  value={album.master_release_date || ''}
                  onChange={(e) => onChange('master_release_date', e.target.value)}
                  placeholder="YYYY"
                  style={{ ...dateInputStyle, width: '92px', borderRadius: '4px' }}
                />
                <div style={{ width: '10px', height: '1px', backgroundColor: '#d1d5db' }} />
                <input
                  type="text"
                  placeholder="MM"
                  style={{ ...dateInputStyle, width: '56px', borderRadius: '4px' }}
                />
                <div style={{ width: '10px', height: '1px', backgroundColor: '#d1d5db' }} />
                <input
                  type="text"
                  placeholder="DD"
                  style={{ ...dateInputStyle, width: '56px', borderRadius: '4px' }}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Label | Recording Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Label</label>
              <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
                <select 
                  value={album.spotify_label || album.apple_music_label || ''}
                  onChange={(e) => {
                    onChange('spotify_label', e.target.value);
                    onChange('apple_music_label', e.target.value);
                  }}
                  style={{ 
                    ...selectStyle, 
                    flex: 1, 
                    height: '36px',
                    borderRadius: '4px 0 0 4px',
                    borderRight: 'none'
                  }}
                >
                  <option>{album.spotify_label || album.apple_music_label || 'Select label'}</option>
                </select>
                <button 
                  onClick={() => handleOpenPicker('spotify_label')}
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
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: '0' }}>Recording Date</label>
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6b7280' }}>
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
                  placeholder="YYYY"
                  style={{ ...dateInputStyle, width: '92px', borderRadius: '4px' }}
                />
                <div style={{ width: '10px', height: '1px', backgroundColor: '#d1d5db' }} />
                <input
                  type="text"
                  placeholder="MM"
                  style={{ ...dateInputStyle, width: '56px', borderRadius: '4px' }}
                />
                <div style={{ width: '10px', height: '1px', backgroundColor: '#d1d5db' }} />
                <input
                  type="text"
                  placeholder="DD"
                  style={{ ...dateInputStyle, width: '56px', borderRadius: '4px' }}
                />
              </div>
            </div>
          </div>

          {/* Row 3: Format | Barcode */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Format</label>
              <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
                <select 
                  value={album.format}
                  onChange={(e) => onChange('format', e.target.value)}
                  style={{ 
                    ...selectStyle, 
                    flex: 1, 
                    height: '36px',
                    borderRadius: '4px 0 0 4px',
                    borderRight: 'none'
                  }}
                >
                  <option>{album.format}</option>
                </select>
                <button 
                  onClick={() => handleOpenPicker('format')}
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
            <div>
              <label style={labelStyle}>Barcode</label>
              <input
                type="text"
                value={album.barcode || ''}
                onChange={(e) => onChange('barcode', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 4: Cat No - FULL WIDTH */}
          <div>
            <label style={labelStyle}>Cat No</label>
            <input
              type="text"
              value={album.cat_no || ''}
              onChange={(e) => onChange('cat_no', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Row 5: Genre - FULL WIDTH */}
          <div>
            <label style={labelStyle}>Genre</label>
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
                {album.discogs_genres && album.discogs_genres.length > 0 ? (
                  <>
                    {album.discogs_genres.map((genre, idx) => (
                      <span
                        key={idx}
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
                        {genre}
                        <button
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
                  </>
                ) : null}
              </div>
              <button 
                onClick={() => handleOpenPicker('genre')}
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
        </div>
      </div>

      {/* MODAL COMPONENTS */}
      {activeModal === 'picker' && (
        <PickerModal
          isOpen={true}
          onClose={handleCloseModal}
          title={fieldConfig.title}
          mode={fieldConfig.mode}
          items={currentItems}
          selectedIds={getCurrentSelection()}
          onSave={handlePickerSave}
          onManage={handleOpenManage}
          onNew={handleOpenNew}
          searchPlaceholder={`Search ${fieldConfig.itemLabel}s...`}
          itemLabel={fieldConfig.itemLabel}
        />
      )}

      {activeModal === 'manage' && (
        <ManageModal
          isOpen={true}
          onClose={handleCloseModal}
          title={`Manage ${fieldConfig.itemLabel}s`}
          items={currentItems}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onMerge={handleOpenMerge}
          itemLabel={fieldConfig.itemLabel}
          allowMerge={true}
        />
      )}

      {activeModal === 'edit' && (
        <EditModal
          isOpen={true}
          onClose={handleCloseModal}
          title={editingItemId ? `Edit ${fieldConfig.itemLabel}` : `New ${fieldConfig.itemLabel}`}
          itemName={editingItem?.name || ''}
          onSave={handleEditSave}
          itemLabel={fieldConfig.itemLabel}
        />
      )}

      {activeModal === 'merge' && (
        <MergeModal
          isOpen={true}
          onClose={handleCloseModal}
          title={`Merge ${fieldConfig.itemLabel}s`}
          items={mergingItems}
          onMerge={handleMerge}
          itemLabel={fieldConfig.itemLabel}
        />
      )}
    </>
  );
}