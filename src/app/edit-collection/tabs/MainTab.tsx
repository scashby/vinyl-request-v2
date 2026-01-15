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
      case 'genre': return album.genres || []; // FIXED: Use 'genres'
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
      onChange('genres', selectedNames); // FIXED: Update 'genres' instead of 'discogs_genres'
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
  const handleEditSave = async (newName: string, newSortName?: string) => {
    if (!activeField) return;
    
    // Create new (Local only - db sync handled by reload or future implementation)
    const newItem: PickerDataItem = {
      id: newName,
      name: newName,
      count: 0,
      sortName: newSortName, // Pass through the sort name
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

  // Styles removed in favor of Tailwind classes

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-4">
          {/* Title with Aa */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[13px] font-semibold text-gray-500">Title</label>
              <span 
                onClick={handleApplyAutoCap}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setShowAutoCapSettings(true);
                }}
                className="text-gray-400 text-[13px] font-semibold cursor-pointer select-none px-1.5 py-0.5 rounded bg-gray-100 border border-gray-300 hover:text-gray-600 hover:border-gray-400"
                title="Click to capitalize title - Right-click for settings"
              >
                Aa
              </span>
            </div>
            <input
              type="text"
              value={album.title}
              onChange={(e) => onChange('title', e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Sort Title */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Sort Title</label>
            <input
              type="text"
              value={album.sort_title || ''}
              onChange={(e) => onChange('sort_title', e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Subtitle</label>
            <input
              type="text"
              value={album.subtitle || ''}
              onChange={(e) => onChange('subtitle', e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Artist */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[13px] font-semibold text-gray-500">Artist</label>
              <span 
                onClick={() => handleOpenPicker('artist')}
                className="text-gray-400 text-xl font-light cursor-pointer hover:text-blue-500"
              >
                +
              </span>
            </div>
            <div className="flex flex-1 items-center justify-between px-2.5 py-2 border border-gray-300 rounded bg-white text-sm text-gray-900">
              <span>{album.artist}</span>
              <button
                onClick={() => onChange('artist', '')}
                className="bg-transparent border-none text-gray-400 cursor-pointer p-0 text-lg leading-none font-light hover:text-red-500"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4">
          {/* Row 1: Release Date | Original Release Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[13px] font-semibold text-gray-500">Release Date</label>
                <div 
                  onClick={(e) => handleOpenDatePicker('release', e)}
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
                  value={album.year || ''}
                  onChange={(e) => onChange('year', e.target.value)}
                  placeholder="YYYY"
                  className="w-[92px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500"
                />
                <div className="w-[10px] h-px bg-gray-300" />
                <input
                  type="text"
                  placeholder="MM"
                  className="w-[56px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500"
                />
                <div className="w-[10px] h-px bg-gray-300" />
                <input
                  type="text"
                  placeholder="DD"
                  className="w-[56px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[13px] font-semibold text-gray-500">Original Release Date</label>
                <div 
                  onClick={(e) => handleOpenDatePicker('original', e)}
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
                  value={album.master_release_date || ''}
                  onChange={(e) => onChange('master_release_date', e.target.value)}
                  placeholder="YYYY"
                  className="w-[92px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500"
                />
                <div className="w-[10px] h-px bg-gray-300" />
                <input
                  type="text"
                  placeholder="MM"
                  className="w-[56px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500"
                />
                <div className="w-[10px] h-px bg-gray-300" />
                <input
                  type="text"
                  placeholder="DD"
                  className="w-[56px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Label | Recording Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Label</label>
              <div className="flex items-stretch">
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
                  className="flex-1 px-2.5 py-2 border border-gray-300 rounded-l text-sm bg-white text-gray-900 outline-none focus:border-blue-500 border-r-0"
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
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[13px] font-semibold text-gray-500">Recording Date</label>
                <div 
                  onClick={(e) => handleOpenDatePicker('recording', e)}
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
                  placeholder="YYYY"
                  className="w-[92px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500"
                />
                <div className="w-[10px] h-px bg-gray-300" />
                <input
                  type="text"
                  placeholder="MM"
                  className="w-[56px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500"
                />
                <div className="w-[10px] h-px bg-gray-300" />
                <input
                  type="text"
                  placeholder="DD"
                  className="w-[56px] px-2 py-2 border border-gray-300 rounded text-sm text-center bg-white text-gray-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Format | Barcode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Format</label>
              <div className="flex items-stretch">
                <select 
                  value={album.format}
                  onChange={(e) => onChange('format', e.target.value)}
                  className="flex-1 px-2.5 py-2 border border-gray-300 rounded-l text-sm bg-white text-gray-900 outline-none focus:border-blue-500 border-r-0"
                >
                  <option>{album.format}</option>
                </select>
                <button 
                  onClick={() => handleOpenPicker('format')}
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
              <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Barcode</label>
              <input
                type="text"
                value={album.barcode || ''}
                onChange={(e) => onChange('barcode', e.target.value)}
                className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Row 4: Cat No */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Cat No</label>
            <input
              type="text"
              value={album.cat_no || ''}
              onChange={(e) => onChange('cat_no', e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Row 5: Genre */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Genre</label>
            <div className="flex items-start">
              <div className="flex-1 min-h-[38px] p-1.5 border border-gray-300 rounded-l border-r-0 bg-white flex flex-wrap gap-1.5 items-center">
                {/* FIXED: Iterate over canonical 'genres' */}
                {album.genres && album.genres.length > 0 ? (
                  <>
                    {album.genres.map((genre, idx) => (
                      <span
                        key={idx}
                        className="bg-gray-200 px-2 py-1 rounded text-xs flex items-center gap-1.5 text-gray-700"
                      >
                        {genre}
                        <button
                          className="bg-transparent border-none text-gray-500 cursor-pointer p-0 text-base leading-none font-light hover:text-red-500"
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
                className="w-9 min-h-[38px] flex items-center justify-center border border-gray-300 rounded-r bg-white text-gray-500 hover:bg-gray-50 disabled:cursor-wait"
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
          showSortName={activeField === 'artist'}
        />
      )}

      {activeModal === 'manage' && (
        <ManagePickListsModal
          isOpen={true}
          onClose={handleManageClose}
          initialList={getManageListKey(activeField)}
          hideListSelector={true} // Hide selector when opened from here
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
          showSortName={activeField === 'artist'} // Show Sort Name for Artists
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