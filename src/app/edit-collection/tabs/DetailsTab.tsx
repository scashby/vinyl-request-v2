// src/app/edit-collection/tabs/DetailsTab.tsx
'use client';

import { useState, useEffect } from 'react';
import type { Album } from 'types/album';
import { PickerModal } from '../pickers/PickerModal';
import { ManageModal } from '../pickers/ManageModal';
import { EditModal } from '../pickers/EditModal';
import { MergeModal } from '../pickers/MergeModal';
import {
  fetchPackaging,
  fetchMediaConditions,
  fetchPackageConditions,
  fetchStudios,
  fetchCountries,
  fetchSounds,
  fetchVinylColors,
  fetchSPARS,
  fetchBoxSets,
  updatePackaging,
  updateStudio,
  updateSound,
  updateVinylColor,
  updateSPARS,
  deletePackaging,
  mergePackaging,
  mergeStudios,
  mergeSounds,
  mergeVinylColors,
  mergeSPARS,
  type PickerDataItem,
} from '../pickers/pickerDataUtils';

interface DetailsTabProps {
  album: Album;
  onChange: (field: keyof Album, value: string | number | string[] | null | boolean) => void;
}

type ModalType = 'picker' | 'manage' | 'edit' | 'merge' | 'boxset' | null;
type FieldType = 
  | 'packaging' 
  | 'package_sleeve_condition' 
  | 'media_condition' 
  | 'studio' 
  | 'country' 
  | 'sound'
  | 'vinyl_color'
  | 'spars_code'
  | 'box_set';

export function DetailsTab({ album, onChange }: DetailsTabProps) {
  // Modal state
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [activeField, setActiveField] = useState<FieldType | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [mergingItemIds, setMergingItemIds] = useState<string[]>([]);

  // Data state
  const [packaging, setPackaging] = useState<PickerDataItem[]>([]);
  const [mediaConditions, setMediaConditions] = useState<PickerDataItem[]>([]);
  const [packageConditions, setPackageConditions] = useState<PickerDataItem[]>([]);
  const [studios, setStudios] = useState<PickerDataItem[]>([]);
  const [countries, setCountries] = useState<PickerDataItem[]>([]);
  const [sounds, setSounds] = useState<PickerDataItem[]>([]);
  const [vinylColors, setVinylColors] = useState<PickerDataItem[]>([]);
  const [spars, setSPARS] = useState<PickerDataItem[]>([]);
  const [boxSets, setBoxSets] = useState<PickerDataItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Box Set modal state
  const [boxSetName, setBoxSetName] = useState('');
  const [boxSetBarcode, setBoxSetBarcode] = useState('');
  const [boxSetReleaseDate, setBoxSetReleaseDate] = useState({ year: '', month: '', day: '' });

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setDataLoading(true);
    const [
      packagingData,
      mediaCondData,
      packageCondData,
      studiosData,
      countriesData,
      soundsData,
      vinylColorsData,
      sparsData,
      boxSetsData,
    ] = await Promise.all([
      fetchPackaging(),
      fetchMediaConditions(),
      fetchPackageConditions(),
      fetchStudios(),
      fetchCountries(),
      fetchSounds(),
      fetchVinylColors(),
      fetchSPARS(),
      fetchBoxSets(),
    ]);
    setPackaging(packagingData);
    setMediaConditions(mediaCondData);
    setPackageConditions(packageCondData);
    setStudios(studiosData);
    setCountries(countriesData);
    setSounds(soundsData);
    setVinylColors(vinylColorsData);
    setSPARS(sparsData);
    setBoxSets(boxSetsData);
    setDataLoading(false);
  };

  // Reload specific dataset
  const reloadData = async (field: FieldType) => {
    switch (field) {
      case 'packaging':
        setPackaging(await fetchPackaging());
        break;
      case 'media_condition':
        setMediaConditions(await fetchMediaConditions());
        break;
      case 'package_sleeve_condition':
        setPackageConditions(await fetchPackageConditions());
        break;
      case 'studio':
        setStudios(await fetchStudios());
        break;
      case 'country':
        setCountries(await fetchCountries());
        break;
      case 'sound':
        setSounds(await fetchSounds());
        break;
      case 'vinyl_color':
        setVinylColors(await fetchVinylColors());
        break;
      case 'spars_code':
        setSPARS(await fetchSPARS());
        break;
      case 'box_set':
        setBoxSets(await fetchBoxSets());
        break;
    }
  };

  // Get current items based on active field
  const getCurrentItems = () => {
    switch (activeField) {
      case 'packaging': return packaging;
      case 'media_condition': return mediaConditions;
      case 'package_sleeve_condition': return packageConditions;
      case 'studio': return studios;
      case 'country': return countries;
      case 'sound': return sounds;
      case 'vinyl_color': return vinylColors;
      case 'spars_code': return spars;
      case 'box_set': return boxSets;
      default: return [];
    }
  };

  // Get current selection based on active field
  const getCurrentSelection = () => {
    switch (activeField) {
      case 'packaging': return album.packaging || '';
      case 'media_condition': return album.media_condition || '';
      case 'package_sleeve_condition': return album.package_sleeve_condition || '';
      case 'studio': return album.studio || '';
      case 'country': return album.country || '';
      case 'sound': return album.sound || '';
      case 'vinyl_color': return album.vinyl_color || '';
      case 'spars_code': return album.spars_code || '';
      case 'box_set': return album.box_set || '';
      default: return '';
    }
  };

  // Get field configuration
  const getFieldConfig = () => {
    switch (activeField) {
      case 'packaging': return { title: 'Select Packaging', itemLabel: 'Packaging', mode: 'single' as const };
      case 'media_condition': return { title: 'Select Media Condition', itemLabel: 'Media Condition', mode: 'single' as const };
      case 'package_sleeve_condition': return { title: 'Select Package/Sleeve Condition', itemLabel: 'Package/Sleeve Condition', mode: 'single' as const };
      case 'studio': return { title: 'Select Studio', itemLabel: 'Studio', mode: 'single' as const };
      case 'country': return { title: 'Select Country', itemLabel: 'Country', mode: 'single' as const };
      case 'sound': return { title: 'Select Sound', itemLabel: 'Sound', mode: 'single' as const };
      case 'vinyl_color': return { title: 'Select Vinyl Color', itemLabel: 'Vinyl Color', mode: 'single' as const };
      case 'spars_code': return { title: 'Select SPARS', itemLabel: 'SPARS', mode: 'single' as const };
      case 'box_set': return { title: 'Select Box Set', itemLabel: 'Box Set', mode: 'single' as const };
      default: return { title: '', itemLabel: '', mode: 'single' as const };
    }
  };

  // Open picker modal
  const handleOpenPicker = (field: FieldType) => {
    if (field === 'box_set') {
      setActiveModal('boxset');
    } else {
      setActiveField(field);
      setActiveModal('picker');
    }
  };

  // PickerModal handlers
  const handlePickerSave = (selectedIds: string | string[]) => {
    if (!activeField) return;

    const items = getCurrentItems();
    const selectedName = Array.isArray(selectedIds) 
      ? items.find(item => item.id === selectedIds[0])?.name || ''
      : items.find(item => item.id === selectedIds)?.name || '';
    
    switch (activeField) {
      case 'packaging':
        onChange('packaging', selectedName);
        break;
      case 'media_condition':
        onChange('media_condition', selectedName);
        break;
      case 'package_sleeve_condition':
        onChange('package_sleeve_condition', selectedName);
        break;
      case 'studio':
        onChange('studio', selectedName);
        break;
      case 'country':
        onChange('country', selectedName);
        break;
      case 'sound':
        onChange('sound', selectedName);
        break;
      case 'vinyl_color':
        onChange('vinyl_color', selectedName);
        break;
      case 'spars_code':
        onChange('spars_code', selectedName);
        break;
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

  const handleDelete = async (itemId: string) => {
    if (!activeField) return;

    let success = false;
    if (activeField === 'packaging') {
      success = await deletePackaging(itemId);
    }
    
    if (success && activeField) {
      await reloadData(activeField);
    }
  };

  const handleOpenMerge = (itemIds: string[]) => {
    setMergingItemIds(itemIds);
    setActiveModal('merge');
  };

  // EditModal handlers
  const handleEditSave = async (newName: string) => {
    if (!activeField) return;
    
    if (editingItemId) {
      // Edit existing
      let success = false;
      
      switch (activeField) {
        case 'packaging':
          success = await updatePackaging(editingItemId, newName);
          break;
        case 'studio':
          success = await updateStudio(editingItemId, newName);
          break;
        case 'sound':
          success = await updateSound(editingItemId, newName);
          break;
        case 'vinyl_color':
          success = await updateVinylColor(editingItemId, newName);
          break;
        case 'spars_code':
          success = await updateSPARS(editingItemId, newName);
          break;
      }
      
      if (success) {
        await reloadData(activeField);
      }
    } else {
      // Create new
      const newItem: PickerDataItem = {
        id: newName,
        name: newName,
        count: 0,
      };
      
      switch (activeField) {
        case 'packaging':
          setPackaging([...packaging, newItem].sort((a, b) => a.name.localeCompare(b.name)));
          break;
        case 'studio':
          setStudios([...studios, newItem].sort((a, b) => a.name.localeCompare(b.name)));
          break;
        case 'sound':
          setSounds([...sounds, newItem].sort((a, b) => a.name.localeCompare(b.name)));
          break;
        case 'vinyl_color':
          setVinylColors([...vinylColors, newItem].sort((a, b) => a.name.localeCompare(b.name)));
          break;
        case 'spars_code':
          setSPARS([...spars, newItem].sort((a, b) => a.name.localeCompare(b.name)));
          break;
      }
    }
  };

  // MergeModal handlers
  const handleMerge = async (primaryId: string, mergeIntoIds: string[]) => {
    if (!activeField) return;

    let success = false;
    
    switch (activeField) {
      case 'packaging':
        success = await mergePackaging(primaryId, mergeIntoIds);
        break;
      case 'studio':
        success = await mergeStudios(primaryId, mergeIntoIds);
        break;
      case 'sound':
        success = await mergeSounds(primaryId, mergeIntoIds);
        break;
      case 'vinyl_color':
        success = await mergeVinylColors(primaryId, mergeIntoIds);
        break;
      case 'spars_code':
        success = await mergeSPARS(primaryId, mergeIntoIds);
        break;
    }
    
    if (success) {
      await reloadData(activeField);
    }
  };

  // Box Set modal handlers
  const handleBoxSetSave = () => {
    // TODO: Implement box set creation/linking
    onChange('box_set', boxSetName);
    setActiveModal(null);
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
        {/* LEFT COLUMN - PACKAGING */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ 
            fontSize: '15px', 
            fontWeight: '700', 
            color: '#374151', 
            marginBottom: '4px',
            paddingBottom: '8px',
            borderBottom: '2px solid #e5e7eb'
          }}>
            Packaging
          </div>

          {/* Packaging */}
          <div>
            <label style={labelStyle}>Packaging</label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
              <select 
                value={album.packaging || ''}
                onChange={(e) => onChange('packaging', e.target.value)}
                style={{ 
                  ...selectStyle, 
                  flex: 1, 
                  height: '36px',
                  borderRadius: '4px 0 0 4px',
                  borderRight: 'none'
                }}
              >
                <option value="">Select...</option>
                <option>{album.packaging || 'Select...'}</option>
              </select>
              <button 
                onClick={() => handleOpenPicker('packaging')}
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

          {/* Package/Sleeve Condition */}
          <div>
            <label style={labelStyle}>Package/Sleeve Condition</label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
              <select 
                value={album.package_sleeve_condition || ''}
                onChange={(e) => onChange('package_sleeve_condition', e.target.value)}
                style={{ 
                  ...selectStyle, 
                  flex: 1, 
                  height: '36px',
                  borderRadius: '4px 0 0 4px',
                  borderRight: 'none'
                }}
              >
                <option value="">Select...</option>
                <option>{album.package_sleeve_condition || 'Select...'}</option>
              </select>
              <button 
                onClick={() => handleOpenPicker('package_sleeve_condition')}
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

          {/* Media Condition */}
          <div>
            <label style={labelStyle}>Media Condition</label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
              <select 
                value={album.media_condition || ''}
                onChange={(e) => onChange('media_condition', e.target.value)}
                style={{ 
                  ...selectStyle, 
                  flex: 1, 
                  height: '36px',
                  borderRadius: '4px 0 0 4px',
                  borderRight: 'none'
                }}
              >
                <option value="">Select...</option>
                <option>{album.media_condition || 'Select...'}</option>
              </select>
              <button 
                onClick={() => handleOpenPicker('media_condition')}
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

          {/* Studio */}
          <div>
            <label style={labelStyle}>Studio</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                value={album.studio || ''}
                onChange={(e) => onChange('studio', e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Add studio..."
              />
              <button
                onClick={() => handleOpenPicker('studio')}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#6b7280',
                  fontWeight: '300',
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Country */}
          <div>
            <label style={labelStyle}>Country</label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
              <select 
                value={album.country || ''}
                onChange={(e) => onChange('country', e.target.value)}
                style={{ 
                  ...selectStyle, 
                  flex: 1, 
                  height: '36px',
                  borderRadius: '4px 0 0 4px',
                  borderRight: 'none'
                }}
              >
                <option value="">Select...</option>
                <option>{album.country || 'Select...'}</option>
              </select>
              <button 
                onClick={() => handleOpenPicker('country')}
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

          {/* Sound */}
          <div>
            <label style={labelStyle}>Sound</label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
              <select 
                value={album.sound || ''}
                onChange={(e) => onChange('sound', e.target.value)}
                style={{ 
                  ...selectStyle, 
                  flex: 1, 
                  height: '36px',
                  borderRadius: '4px 0 0 4px',
                  borderRight: 'none'
                }}
              >
                <option value="">Select...</option>
                <option>{album.sound || 'Select...'}</option>
              </select>
              <button 
                onClick={() => handleOpenPicker('sound')}
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
        </div>

        {/* RIGHT COLUMN - VINYL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ 
            fontSize: '15px', 
            fontWeight: '700', 
            color: '#374151', 
            marginBottom: '4px',
            paddingBottom: '8px',
            borderBottom: '2px solid #e5e7eb'
          }}>
            Vinyl
          </div>

          {/* Vinyl Color */}
          <div>
            <label style={labelStyle}>Vinyl Color</label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
              <select 
                value={album.vinyl_color || ''}
                onChange={(e) => onChange('vinyl_color', e.target.value)}
                style={{ 
                  ...selectStyle, 
                  flex: 1, 
                  height: '36px',
                  borderRadius: '4px 0 0 4px',
                  borderRight: 'none'
                }}
              >
                <option value="">Select...</option>
                <option>{album.vinyl_color || 'Select...'}</option>
              </select>
              <button 
                onClick={() => handleOpenPicker('vinyl_color')}
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

          {/* Vinyl Weight */}
          <div>
            <label style={labelStyle}>Vinyl Weight</label>
            <input
              type="number"
              value={album.vinyl_weight || ''}
              onChange={(e) => onChange('vinyl_weight', e.target.value)}
              style={inputStyle}
              placeholder="0"
            />
          </div>

          {/* RPM */}
          <div>
            <label style={labelStyle}>RPM</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['N/A', '33', '45', '78'].map((rpm) => (
                <button
                  key={rpm}
                  onClick={() => onChange('rpm', rpm === 'N/A' ? null : rpm)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: `2px solid ${album.rpm === rpm || (rpm === 'N/A' && !album.rpm) ? '#3b82f6' : '#d1d5db'}`,
                    borderRadius: '4px',
                    backgroundColor: album.rpm === rpm || (rpm === 'N/A' && !album.rpm) ? '#eff6ff' : 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: album.rpm === rpm || (rpm === 'N/A' && !album.rpm) ? '#3b82f6' : '#374151',
                  }}
                >
                  {rpm}
                </button>
              ))}
            </div>
          </div>

          {/* Extra */}
          <div>
            <label style={labelStyle}>Extra</label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'flex-start' }}>
              <textarea
                value={album.extra || ''}
                onChange={(e) => onChange('extra', e.target.value)}
                style={{
                  ...inputStyle,
                  flex: 1,
                  minHeight: '80px',
                  resize: 'vertical',
                  borderRadius: '4px 0 0 4px',
                  borderRight: 'none',
                }}
                placeholder="Additional details..."
              />
              <button 
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

          {/* SPARS */}
          <div>
            <label style={labelStyle}>SPARS</label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
              <select 
                value={album.spars_code || ''}
                onChange={(e) => onChange('spars_code', e.target.value)}
                style={{ 
                  ...selectStyle, 
                  flex: 1, 
                  height: '36px',
                  borderRadius: '4px 0 0 4px',
                  borderRight: 'none'
                }}
              >
                <option value="">Select...</option>
                <option>{album.spars_code || 'Select...'}</option>
              </select>
              <button 
                onClick={() => handleOpenPicker('spars_code')}
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

          {/* Box Set */}
          <div>
            <label style={labelStyle}>Box Set</label>
            <div style={{ display: 'flex', gap: '0', alignItems: 'stretch' }}>
              <select 
                value={album.box_set || ''}
                onChange={(e) => onChange('box_set', e.target.value)}
                style={{ 
                  ...selectStyle, 
                  flex: 1, 
                  height: '36px',
                  borderRadius: '4px 0 0 4px',
                  borderRight: 'none'
                }}
              >
                <option value="">Select...</option>
                <option>{album.box_set || 'Select...'}</option>
              </select>
              <button 
                onClick={() => handleOpenPicker('box_set')}
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

          {/* Is Live */}
          <div>
            <label style={labelStyle}>Is Live</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['No', 'Yes'].map((option) => (
                <button
                  key={option}
                  onClick={() => onChange('is_live', option === 'Yes')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: `2px solid ${
                      (option === 'Yes' && album.is_live) || (option === 'No' && !album.is_live)
                        ? '#3b82f6'
                        : '#d1d5db'
                    }`,
                    borderRadius: '4px',
                    backgroundColor:
                      (option === 'Yes' && album.is_live) || (option === 'No' && !album.is_live)
                        ? '#eff6ff'
                        : 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color:
                      (option === 'Yes' && album.is_live) || (option === 'No' && !album.is_live)
                        ? '#3b82f6'
                        : '#374151',
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL COMPONENTS */}
      {activeModal === 'picker' && activeField !== 'box_set' && (
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

      {/* Box Set Modal */}
      {activeModal === 'boxset' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30001,
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '6px',
              width: '500px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#F7941D',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                New Box Set
              </h3>
              <button
                onClick={handleCloseModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '0 4px',
                  lineHeight: '1',
                }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Name</label>
                <input
                  type="text"
                  value={boxSetName}
                  onChange={(e) => setBoxSetName(e.target.value)}
                  style={inputStyle}
                  placeholder="Box Set Name"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Barcode</label>
                <input
                  type="text"
                  value={boxSetBarcode}
                  onChange={(e) => setBoxSetBarcode(e.target.value)}
                  style={inputStyle}
                  placeholder="Barcode"
                />
              </div>

              <div>
                <label style={labelStyle}>Release Date</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={boxSetReleaseDate.year}
                    onChange={(e) =>
                      setBoxSetReleaseDate({ ...boxSetReleaseDate, year: e.target.value })
                    }
                    placeholder="YYYY"
                    style={{ ...inputStyle, textAlign: 'center' }}
                  />
                  <input
                    type="text"
                    value={boxSetReleaseDate.month}
                    onChange={(e) =>
                      setBoxSetReleaseDate({ ...boxSetReleaseDate, month: e.target.value })
                    }
                    placeholder="MM"
                    style={{ ...inputStyle, width: '60px', textAlign: 'center' }}
                  />
                  <input
                    type="text"
                    value={boxSetReleaseDate.day}
                    onChange={(e) =>
                      setBoxSetReleaseDate({ ...boxSetReleaseDate, day: e.target.value })
                    }
                    placeholder="DD"
                    style={{ ...inputStyle, width: '60px', textAlign: 'center' }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button
                onClick={handleCloseModal}
                style={{
                  padding: '6px 16px',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBoxSetSave}
                style={{
                  padding: '6px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}