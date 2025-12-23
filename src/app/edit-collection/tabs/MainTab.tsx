// src/app/edit-collection/tabs/MainTab.tsx
'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { Album } from 'types/album';
import { PickerModal } from '../pickers/PickerModal';
import ManagePickListsModal from '../ManagePickListsModal';
import { EditModal } from '../pickers/EditModal';
import { DatePicker } from 'components/DatePicker';
import { AutoCapSettings, type AutoCapMode } from '../settings/AutoCapSettings';
import { AutoCapExceptions, applyAutoCap, DEFAULT_EXCEPTIONS } from '../settings/AutoCapExceptions';
import {
  fetchLabels,
  fetchFormats,
  fetchGenres,
  fetchLocations,
  fetchArtists,
  type PickerDataItem,
} from '../pickers/pickerDataUtils';

interface MainTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null | boolean) => void;
}

type ModalType = 'picker' | 'manage' | 'edit' | null;
type FieldType = 
  | 'spotify_label' 
  | 'format' 
  | 'genre' 
  | 'location' 
  | 'artist';

export interface MainTabRef {
  openLocationPicker: () => void;
}

export const MainTab = forwardRef<MainTabRef, MainTabProps>(function MainTab({ album, onChange }, ref) {
  // Modal state
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [activeField, setActiveField] = useState<FieldType | null>(null);

  // Data state - real data from Supabase
  const [labels, setLabels] = useState<PickerDataItem[]>([]);
  const [formats, setFormats] = useState<PickerDataItem[]>([]);
  const [genres, setGenres] = useState<PickerDataItem[]>([]);
  const [locations, setLocations] = useState<PickerDataItem[]>([]);
  const [artists, setArtists] = useState<PickerDataItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerField, setDatePickerField] = useState<'release' | 'original' | 'recording' | null>(null);
  const [datePickerPosition, setDatePickerPosition] = useState({ top: 0, left: 0 });

  // Auto Cap state
  const [showAutoCapSettings, setShowAutoCapSettings] = useState(false);
  const [showAutoCapExceptions, setShowAutoCapExceptions] = useState(false);
  const [autoCapMode, setAutoCapMode] = useState<AutoCapMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('autoCapMode') as AutoCapMode) || 'FirstExceptions';
    }
    return 'FirstExceptions';
  });
  const [autoCapExceptions, setAutoCapExceptions] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('autoCapExceptions');
      return stored ? JSON.parse(stored) : DEFAULT_EXCEPTIONS;
    }
    return DEFAULT_EXCEPTIONS;
  });

  // Fetch real data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  // Expose method to parent via ref
  useImperativeHandle(ref, () => ({
    openLocationPicker: () => handleOpenPicker('location'),
  }));

  const loadAllData = async () => {
    setDataLoading(true);
    const [labelsData, formatsData, genresData, locationsData, artistsData] = await Promise.all([
      fetchLabels(),
      fetchFormats(),
      fetchGenres(),
      fetchLocations(),
      fetchArtists(),
    ]);
    setLabels(labelsData);
    setFormats(formatsData);
    setGenres(genresData);
    setLocations(locationsData);
    setArtists(artistsData);
    setDataLoading(false);
  };

  // Reload specific dataset
  const reloadData = async (field: FieldType) => {
    switch (field) {
      case 'spotify_label':
        setLabels(await fetchLabels());
        break;
      case 'format':
        setFormats(await fetchFormats());
        break;
      case 'genre':
        setGenres(await fetchGenres());
        break;
      case 'location':
        setLocations(await fetchLocations());
        break;
      case 'artist':
        setArtists(await fetchArtists());
        break;
    }
  };

  // Get current items based on active field
  const getCurrentItems = () => {
    switch (activeField) {
      case 'spotify_label': return labels;
      case 'format': return formats;
      case 'genre': return genres;
      case 'location': return locations;
      case 'artist': return artists;
      default: return [];
    }
  };

  // Get current selection based on active field
  const getCurrentSelection = () => {
    switch (activeField) {
      case 'spotify_label': 
        return album.labels && album.labels.length > 0 
          ? album.labels[0]
          : (album.spotify_label || album.apple_music_label || '');
      case 'format': return album.format || '';
      case 'genre': return album.discogs_genres || [];
      case 'location': return album.location || '';
      case 'artist': return album.artist || '';
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
      case 'artist': return { title: 'Select Artists', itemLabel: 'Artist', mode: 'single' as const };
      default: return { title: '', itemLabel: '', mode: 'single' as const };
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
        // Update all label fields
        onChange('spotify_label', selectedName);
        onChange('apple_music_label', selectedName);
        onChange('labels', selectedName ? [selectedName] : null);
      } else if (activeField === 'format') {
        onChange('format', selectedName);
      } else if (activeField === 'location') {
        onChange('location', selectedName);
      } else if (activeField === 'artist') {
        onChange('artist', selectedName);
      }
    }
  };

  const handleOpenManage = () => {
    setActiveModal('manage');
  };

  const handleOpenNew = () => {
    setActiveModal('edit');
  };

  // ManageModal handlers
  const handleManageClose = async () => {
    handleCloseModal();
    // Refresh data after manage modal closes in case changes were made
    if (activeField) {
      await reloadData(activeField);
    }
  };

  // EditModal handlers
  const handleEditSave = async (newName: string) => {
    if (!activeField) return;
    
    // Create new (Local only - db sync handled by reload or future implementation)
    const newItem: PickerDataItem = {
      id: newName,
      name: newName,
      count: 0,
    };
    
    switch (activeField) {
      case 'spotify_label':
        setLabels([...labels, newItem].sort((a, b) => a.name.localeCompare(b.name)));
        break;
      case 'format':
        setFormats([...formats, newItem].sort((a, b) => a.name.localeCompare(b.name)));
        break;
      case 'genre':
        setGenres([...genres, newItem].sort((a, b) => a.name.localeCompare(b.name)));
        break;
      case 'location':
        setLocations([...locations, newItem].sort((a, b) => a.name.localeCompare(b.name)));
        break;
      case 'artist':
        setArtists([...artists, newItem].sort((a, b) => a.name.localeCompare(b.name)));
        break;
    }
  };

  // Close all modals
  const handleCloseModal = () => {
    setActiveModal(null);
  };

  // Date picker handlers
  const handleOpenDatePicker = (field: 'release' | 'original' | 'recording', event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setDatePickerPosition({
      top: rect.bottom + 4,
      left: rect.left,
    });
    setDatePickerField(field);
    setShowDatePicker(true);
  };

  const handleDateChange = (date: { year: number | null; month: number | null; day: number | null }) => {
    if (datePickerField === 'release') {
      if (date.year) onChange('year', date.year.toString());
    }
    setShowDatePicker(false);
  };

  // Auto Cap handler
  const handleApplyAutoCap = () => {
    const mode = (localStorage.getItem('autoCapMode') as AutoCapMode) || autoCapMode;
    const exceptionsStr = localStorage.getItem('autoCapExceptions');
    const exceptions = exceptionsStr ? JSON.parse(exceptionsStr) : autoCapExceptions;
    
    const capitalized = applyAutoCap(album.title || '', mode, exceptions);
    onChange('title', capitalized);
  };

  const handleAutoCapModeChange = (mode: AutoCapMode) => {
    setAutoCapMode(mode);
    localStorage.setItem('autoCapMode', mode);
  };

  const handleAutoCapExceptionsChange = (exceptions: string[]) => {
    setAutoCapExceptions(exceptions);
    localStorage.setItem('autoCapExceptions', JSON.stringify(exceptions));
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

  // Map activeField to ManagePickListsModal config keys
  const getManageListKey = (field: FieldType | null): string => {
    switch (field) {
      case 'artist': return 'artist';
      case 'spotify_label': return 'label';
      case 'format': return 'format';
      case 'genre': return 'genre';
      case 'location': return 'location';
      default: return '';
    }
  };

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
              <span 
                onClick={handleApplyAutoCap}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setShowAutoCapSettings(true);
                }}
                style={{ 
                  color: '#9ca3af',
                  fontSize: '13px', 
                  fontWeight: '600',
                  cursor: 'pointer',
                  userSelect: 'none',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                }}
                title="Click to capitalize title - Right-click for settings"
              >
                Aa
              </span>
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
              <span 
                onClick={() => handleOpenPicker('artist')}
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#111827',
            }}>
              <span>{album.artist}</span>
              <button
                onClick={() => onChange('artist', '')}
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
                <div 
                  onClick={(e) => handleOpenDatePicker('release', e)}
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
                <div 
                  onClick={(e) => handleOpenDatePicker('original', e)}
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
                  value={
                    album.labels && album.labels.length > 0 
                      ? album.labels[0] 
                      : (album.spotify_label || album.apple_music_label || '')
                  }
                  onChange={(e) => {
                    onChange('spotify_label', e.target.value);
                    onChange('apple_music_label', e.target.value);
                    onChange('labels', e.target.value ? [e.target.value] : null);
                  }}
                  style={{ 
                    ...selectStyle, 
                    flex: 1, 
                    height: '36px',
                    borderRadius: '4px 0 0 4px',
                    borderRight: 'none'
                  }}
                >
                  <option>
                    {album.labels && album.labels.length > 0 
                      ? album.labels.join(', ') 
                      : (album.spotify_label || album.apple_music_label || 'Select label')}
                  </option>
                </select>
                <button 
                  onClick={() => handleOpenPicker('spotify_label')}
                  disabled={dataLoading}
                  style={{
                    width: '36px',
                    height: '36px',
                    padding: 0,
                    border: '1px solid #d1d5db',
                    borderRadius: '0 4px 4px 0',
                    backgroundColor: 'white',
                    cursor: dataLoading ? 'wait' : 'pointer',
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
                <div 
                  onClick={(e) => handleOpenDatePicker('recording', e)}
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
                  disabled={dataLoading}
                  style={{
                    width: '36px',
                    height: '36px',
                    padding: 0,
                    border: '1px solid #d1d5db',
                    borderRadius: '0 4px 4px 0',
                    backgroundColor: 'white',
                    cursor: dataLoading ? 'wait' : 'pointer',
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

          {/* Row 4: Cat No */}
          <div>
            <label style={labelStyle}>Cat No</label>
            <input
              type="text"
              value={album.cat_no || ''}
              onChange={(e) => onChange('cat_no', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Row 5: Genre */}
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
                disabled={dataLoading}
                style={{
                  width: '36px',
                  minHeight: '40px',
                  padding: 0,
                  border: '1px solid #d1d5db',
                  borderRadius: '0 4px 4px 0',
                  backgroundColor: 'white',
                  cursor: dataLoading ? 'wait' : 'pointer',
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
        <ManagePickListsModal
          isOpen={true}
          onClose={handleManageClose}
          initialList={getManageListKey(activeField)}
        />
      )}

      {activeModal === 'edit' && (
        <EditModal
          isOpen={true}
          onClose={handleCloseModal}
          title={`New ${fieldConfig.itemLabel}`}
          itemName={''}
          onSave={handleEditSave}
          itemLabel={fieldConfig.itemLabel}
        />
      )}

      {/* Date Picker */}
      {showDatePicker && (
        <DatePicker
          value={{ year: album.year ? parseInt(album.year.toString()) : null, month: null, day: null }}
          onChange={handleDateChange}
          onClose={() => setShowDatePicker(false)}
          position={datePickerPosition}
        />
      )}

      {/* Auto Cap Settings */}
      <AutoCapSettings
        isOpen={showAutoCapSettings}
        onClose={() => setShowAutoCapSettings(false)}
        currentMode={autoCapMode}
        onSave={handleAutoCapModeChange}
        onManageExceptions={() => {
          setShowAutoCapSettings(false);
          setShowAutoCapExceptions(true);
        }}
      />

      {/* Auto Cap Exceptions */}
      <AutoCapExceptions
        isOpen={showAutoCapExceptions}
        onClose={() => setShowAutoCapExceptions(false)}
        exceptions={autoCapExceptions}
        onSave={handleAutoCapExceptionsChange}
      />
    </>
  );
});