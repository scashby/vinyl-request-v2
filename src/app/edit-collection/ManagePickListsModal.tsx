// src/app/edit-collection/ManagePickListsModal.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MergeModal } from './pickers/MergeModal';
import {
  fetchArtists, updateArtist, mergeArtists,
  fetchLabels, updateLabel, deleteLabel, mergeLabels,
  fetchFormats, updateFormat, mergeFormats,
  fetchGenres,
  fetchLocations, updateLocation, mergeLocations,
  fetchCountries,
  fetchPackaging, updatePackaging, deletePackaging, mergePackaging,
  fetchMediaConditions,
  fetchPackageConditions,
  fetchVinylColors, updateVinylColor, mergeVinylColors,
  fetchVinylWeights,
  fetchSPARS, updateSPARS, mergeSPARS,
  fetchBoxSets,
  fetchTags,
  fetchSignees,
  fetchStorageDevices,
  fetchPurchaseStores, updatePurchaseStore, deletePurchaseStore, mergePurchaseStores,
  fetchOwners, updateOwner, deleteOwner, mergeOwners,
  fetchStudios, updateStudio, mergeStudios,
  fetchSounds, updateSound, mergeSounds,
  fetchComposers, updateComposer, mergeComposers,
  fetchConductors, updateConductor, mergeConductors,
  fetchChoruses, updateChorus, mergeChorus,
  fetchCompositions, updateComposition, mergeCompositions,
  fetchOrchestras, updateOrchestra, mergeOrchestras,
  fetchSongwriters,
  fetchProducers,
  fetchEngineers,
  fetchMusicians,
} from './pickers/pickerDataUtils';

interface ManagePickListsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PickListConfig {
  label: string;
  fetchFn: () => Promise<{ id: string; name: string; count?: number }[]>;
  updateFn: (id: string, name: string) => Promise<boolean>;
  deleteFn?: (id: string) => Promise<boolean>;
  mergeFn: (targetId: string, sourceIds: string[]) => Promise<boolean>;
  allowDelete: boolean;
  allowMerge: boolean;
}

// Updated allowDelete for Artist based on requirements
const PICK_LIST_CONFIGS: Record<string, PickListConfig> = {
  artist: { label: 'Artist', fetchFn: fetchArtists, updateFn: updateArtist, mergeFn: mergeArtists, allowDelete: true, allowMerge: true },
  'box-set': { label: 'Box Set', fetchFn: fetchBoxSets, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: false },
  chorus: { label: 'Chorus', fetchFn: fetchChoruses, updateFn: updateChorus, mergeFn: mergeChorus, allowDelete: false, allowMerge: true },
  composer: { label: 'Composer', fetchFn: fetchComposers, updateFn: updateComposer, mergeFn: mergeComposers, allowDelete: false, allowMerge: true },
  composition: { label: 'Composition', fetchFn: fetchCompositions, updateFn: updateComposition, mergeFn: mergeCompositions, allowDelete: false, allowMerge: true },
  conductor: { label: 'Conductor', fetchFn: fetchConductors, updateFn: updateConductor, mergeFn: mergeConductors, allowDelete: false, allowMerge: true },
  country: { label: 'Country', fetchFn: fetchCountries, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: false },
  engineer: { label: 'Engineer', fetchFn: fetchEngineers, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: false },
  format: { label: 'Format', fetchFn: fetchFormats, updateFn: updateFormat, deleteFn: async () => false, mergeFn: mergeFormats, allowDelete: true, allowMerge: true },
  genre: { label: 'Genre', fetchFn: fetchGenres, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: false },
  label: { label: 'Label', fetchFn: fetchLabels, updateFn: updateLabel, deleteFn: deleteLabel, mergeFn: mergeLabels, allowDelete: true, allowMerge: true },
  location: { label: 'Location', fetchFn: fetchLocations, updateFn: updateLocation, deleteFn: async () => false, mergeFn: mergeLocations, allowDelete: true, allowMerge: true },
  'media-condition': { label: 'Media Condition', fetchFn: fetchMediaConditions, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: false },
  musician: { label: 'Musician', fetchFn: fetchMusicians, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: false },
  orchestra: { label: 'Orchestra', fetchFn: fetchOrchestras, updateFn: updateOrchestra, mergeFn: mergeOrchestras, allowDelete: false, allowMerge: true },
  owner: { label: 'Owner', fetchFn: fetchOwners, updateFn: updateOwner, deleteFn: deleteOwner, mergeFn: mergeOwners, allowDelete: true, allowMerge: true },
  'package-sleeve-condition': { label: 'Package/Sleeve Condition', fetchFn: fetchPackageConditions, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: false },
  packaging: { label: 'Packaging', fetchFn: fetchPackaging, updateFn: updatePackaging, deleteFn: deletePackaging, mergeFn: mergePackaging, allowDelete: true, allowMerge: true },
  producer: { label: 'Producer', fetchFn: fetchProducers, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: false },
  'purchase-store': { label: 'Purchase Store', fetchFn: fetchPurchaseStores, updateFn: updatePurchaseStore, deleteFn: deletePurchaseStore, mergeFn: mergePurchaseStores, allowDelete: true, allowMerge: true },
  signee: { label: 'Signee', fetchFn: fetchSignees, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: false },
  songwriter: { label: 'Songwriter', fetchFn: fetchSongwriters, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: false },
  sound: { label: 'Sound', fetchFn: fetchSounds, updateFn: updateSound, mergeFn: mergeSounds, allowDelete: false, allowMerge: true },
  spars: { label: 'SPARS', fetchFn: fetchSPARS, updateFn: updateSPARS, deleteFn: async () => false, mergeFn: mergeSPARS, allowDelete: true, allowMerge: true },
  'storage-device': { label: 'Storage Device', fetchFn: fetchStorageDevices, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: false },
  studio: { label: 'Studio', fetchFn: fetchStudios, updateFn: updateStudio, mergeFn: mergeStudios, allowDelete: false, allowMerge: true },
  tag: { label: 'Tag', fetchFn: fetchTags, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: false },
  'vinyl-color': { label: 'Vinyl Color', fetchFn: fetchVinylColors, updateFn: updateVinylColor, deleteFn: async () => false, mergeFn: mergeVinylColors, allowDelete: true, allowMerge: true },
  'vinyl-weight': { label: 'Vinyl Weight', fetchFn: fetchVinylWeights, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: false },
};

export default function ManagePickListsModal({ isOpen, onClose }: ManagePickListsModalProps) {
  const [selectedList, setSelectedList] = useState<string>('');
  const [items, setItems] = useState<{ id: string; name: string; count?: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Edit State
  const [editingItem, setEditingItem] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editSortName, setEditSortName] = useState('');

  const [mergeMode, setMergeMode] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  
  // Sort toggle state - Default to sorting by Sort Name
  const [sortBy, setSortBy] = useState<'name' | 'sortName'>('sortName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Helper to generate a display sortname
  const getSortName = useCallback((name: string) => {
    if (name.startsWith('The ')) return name.substring(4) + ', The';
    if (name.startsWith('A ')) return name.substring(2) + ', A';
    return name;
  }, []);

  const loadItems = useCallback(async () => {
    if (!selectedList) {
      setItems([]);
      return;
    }
    const config = PICK_LIST_CONFIGS[selectedList];
    if (config) {
      const data = await config.fetchFn();
      setItems(data);
    }
  }, [selectedList]);

  useEffect(() => {
    if (selectedList) {
      loadItems();
      setSelectedItems(new Set());
      setMergeMode(false);
      setSortBy('sortName');
      setSortDirection('asc');
    } else {
      setItems([]);
    }
  }, [selectedList, loadItems]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setMergeMode(false);
      setSelectedItems(new Set());
      setShowMergeModal(false);
    }
  }, [isOpen]);

  const handleEdit = (item: { id: string; name: string }) => {
    setEditingItem(item);
    setEditName(item.name);
    // Initialize sort name with the auto-generated one for now
    setEditSortName(getSortName(item.name));
  };

  const handleSaveEdit = async () => {
    if (!selectedList || !editingItem) return;
    const config = PICK_LIST_CONFIGS[selectedList];
    
    // Note: Currently updateFn only takes ID and Name. 
    // If Sort Name support is added to backend, it would be passed here.
    const success = await config.updateFn(editingItem.id, editName);
    
    if (success) {
      await loadItems();
      setEditingItem(null);
      setEditName('');
      setEditSortName('');
    }
  };

  const handleDelete = async (itemId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (!selectedList) return;
    const config = PICK_LIST_CONFIGS[selectedList];
    
    if (config.deleteFn) {
      // Use specific confirmation for Artist or generic for others
      const confirmMessage = selectedList === 'artist' 
        ? 'Are you sure you want to remove this artist permanently?'
        : 'Are you sure you want to delete this item?';

      // We use a small timeout to ensure the UI updates/doesn't block immediately if there's a race condition
      setTimeout(async () => {
        if (window.confirm(confirmMessage)) {
          const success = await config.deleteFn!(itemId);
          if (success) await loadItems();
        }
      }, 0);
    }
  };

  // Open the MergeModal
  const handleOpenMergeModal = () => {
    if (selectedItems.size >= 2) {
      setShowMergeModal(true);
    }
  };

  // Execute the actual merge
  const handleExecuteMerge = async (primaryId: string, mergeIntoIds: string[]) => {
    if (!selectedList) return;
    const config = PICK_LIST_CONFIGS[selectedList];
    
    const success = await config.mergeFn(primaryId, mergeIntoIds);
    if (success) {
      await loadItems();
      setSelectedItems(new Set());
      setMergeMode(false);
      setShowMergeModal(false);
    }
  };

  const toggleSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const handleSortToggle = () => {
    if (sortBy === 'sortName') {
      // Toggle direction if already sorting by sortName
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Switch to sortName if not already
      setSortBy('sortName');
      setSortDirection('asc');
    }
  };

  const config = selectedList ? PICK_LIST_CONFIGS[selectedList] : null;

  const filteredItems = useMemo(() => {
    const result = items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return result.sort((a, b) => {
      const nameA = sortBy === 'sortName' ? getSortName(a.name) : a.name;
      const nameB = sortBy === 'sortName' ? getSortName(b.name) : b.name;
      
      const comparison = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [items, searchQuery, sortBy, sortDirection, getSortName]);

  if (!isOpen) return null;

  return (
    <>
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
          zIndex: 30000 
        }} 
        onClick={onClose}
      >
        <div 
          style={{ 
            backgroundColor: 'white', 
            borderRadius: '8px', 
            width: '800px', 
            height: '600px', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden', 
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)' 
          }} 
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* Header */}
          <div 
            style={{ 
              padding: '12px 16px', 
              backgroundColor: '#f97316', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'white' }}>Manage Pick Lists</h3>
            <button 
              onClick={onClose} 
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'white', 
                fontSize: '22px', 
                cursor: 'pointer', 
                padding: 0, 
                lineHeight: '1',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              ×
            </button>
          </div>

          {/* Toolbar */}
          <div 
            style={{ 
              padding: '12px 16px', 
              borderBottom: '1px solid #e5e7eb', 
              display: 'flex', 
              alignItems: 'center', 
              backgroundColor: 'white',
              gap: '12px'
            }}
          >
            {/* Search Field (Left) */}
            <div style={{ flex: '0 0 35%', position: 'relative' }}>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '6px 10px', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '4px', 
                  fontSize: '13px', 
                  outline: 'none', 
                  backgroundColor: 'white', 
                  color: '#111827',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Spacer & Count (Middle) */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
               {selectedList && (
                <div style={{ 
                  backgroundColor: '#f3f4f6', 
                  padding: '4px 12px', 
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#4b5563',
                  border: '1px solid #e5e7eb'
                }}>
                  <span style={{ 
                    backgroundColor: 'black', 
                    color: 'white', 
                    padding: '1px 6px', 
                    borderRadius: '10px', 
                    fontWeight: '600',
                    fontSize: '11px'
                  }}>
                    {filteredItems.length}
                  </span>
                  <span>{config?.label}s</span>
                </div>
               )}
            </div>

            {/* Dropdown (Right) */}
            <div style={{ flex: '0 0 35%' }}>
              <select
                value={selectedList}
                onChange={(e) => setSelectedList(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '6px 10px', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '4px', 
                  fontSize: '13px', 
                  outline: 'none', 
                  backgroundColor: 'white', 
                  cursor: 'pointer', 
                  color: '#111827',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select a list...</option>
                {Object.entries(PICK_LIST_CONFIGS).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label} list</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table Content */}
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'white' }}>
            {!selectedList ? (
              <div style={{ padding: '50px 30px', textAlign: 'center', color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>
                Select a pick list to manage in the top right dropdown menu...
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: '50px 30px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                {searchQuery ? 'No items match your search' : 'No items available'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>
                    {/* Edit/Checkbox Column */}
                    <th style={{ width: '40px', padding: '8px' }}></th>
                    
                    {/* Name / Sort Name Header */}
                    <th 
                      style={{ 
                        padding: '8px 12px', 
                        textAlign: 'left', 
                        cursor: 'pointer',
                        verticalAlign: 'top'
                      }}
                      onClick={handleSortToggle}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Name</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                          <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>Sort Name</span>
                          {sortBy === 'sortName' && (
                            <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                              {sortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>

                    {/* Count Header */}
                    <th style={{ width: '60px', padding: '8px 12px', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                      Count
                    </th>

                    {/* Delete Column Header */}
                    <th style={{ width: '40px', padding: '8px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => {
                    const isSelected = selectedItems.has(item.id);
                    const sortName = getSortName(item.name);

                    return (
                      <tr 
                        key={item.id} 
                        style={{ 
                          backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                          borderBottom: '1px solid #f3f4f6' 
                        }}
                      >
                        {/* Column 1: Edit or Checkbox */}
                        <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'middle' }}>
                          {mergeMode ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection(item.id)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                          ) : (
                            <button 
                              onClick={() => handleEdit(item)}
                              style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                cursor: 'pointer', 
                                color: '#3b82f6',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Edit"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          )}
                        </td>

                        {/* Column 2: Name & Sort Name Rows */}
                        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '13px', color: '#111827', fontWeight: '500' }}>
                              {item.name}
                            </span>
                            <span style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                              {sortName}
                            </span>
                          </div>
                        </td>

                        {/* Column 3: Count */}
                        <td style={{ padding: '8px 12px', textAlign: 'center', verticalAlign: 'middle', fontSize: '13px', color: '#4b5563' }}>
                          {item.count}
                        </td>

                        {/* Column 4: Delete */}
                        <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'middle' }}>
                          {!mergeMode && config?.allowDelete && (
                            <button 
                              onClick={(e) => handleDelete(item.id, e)}
                              style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                cursor: 'pointer', 
                                color: '#ef4444',
                                fontSize: '18px',
                                padding: '0 4px',
                                lineHeight: '1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Delete"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div style={{ 
            padding: '12px 16px', 
            borderTop: '1px solid #e5e7eb', 
            backgroundColor: 'white', 
            borderBottomLeftRadius: '8px', 
            borderBottomRightRadius: '8px',
            height: '50px',
            display: 'flex',
            alignItems: 'center'
          }}>
            {!mergeMode ? (
              <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                {config?.allowMerge && (
                  <button
                    onClick={() => { setMergeMode(true); setSelectedItems(new Set()); }}
                    disabled={!selectedList}
                    style={{ 
                      padding: '6px 16px', 
                      background: !selectedList ? '#f3f4f6' : '#e5e7eb', 
                      color: !selectedList ? '#9ca3af' : '#374151', 
                      border: 'none', 
                      borderRadius: '4px', 
                      fontSize: '13px', 
                      fontWeight: '500', 
                      cursor: !selectedList ? 'not-allowed' : 'pointer' 
                    }}
                  >
                    Merge Mode
                  </button>
                )}
              </div>
            ) : (
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                  {selectedItems.size > 0 ? `${selectedItems.size} selected...` : 'Select items to merge...'}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => { setMergeMode(false); setSelectedItems(new Set()); }}
                    style={{ padding: '6px 16px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleOpenMergeModal}
                    disabled={selectedItems.size < 2}
                    style={{ 
                      padding: '6px 16px', 
                      background: selectedItems.size >= 2 ? '#3b82f6' : '#d1d5db', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px', 
                      fontSize: '13px', 
                      fontWeight: '600', 
                      cursor: selectedItems.size >= 2 ? 'pointer' : 'not-allowed' 
                    }}
                  >
                    Merge to
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Internal Edit Modal */}
      {editingItem && config && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30005 }} onClick={() => setEditingItem(null)}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '400px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '12px 18px', backgroundColor: '#f97316', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'white' }}>Edit {config.label}</h3>
            </div>
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Name Input */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: '#374151' }}>Name</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} 
                  autoFocus 
                />
              </div>

              {/* Sort Name Input */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: '#374151' }}>Sort Name</label>
                <input 
                  type="text" 
                  value={editSortName} 
                  onChange={(e) => setEditSortName(e.target.value)} 
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} 
                />
              </div>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '8px', backgroundColor: 'white', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
              <button onClick={() => setEditingItem(null)} style={{ padding: '6px 18px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveEdit} style={{ padding: '6px 18px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* External Merge Modal */}
      {showMergeModal && config && (
        <MergeModal
          isOpen={showMergeModal}
          onClose={() => setShowMergeModal(false)}
          title={`Merge ${config.label}s`}
          items={items.filter(i => selectedItems.has(i.id))}
          onMerge={handleExecuteMerge}
          itemLabel={config.label}
        />
      )}
    </>
  );
}