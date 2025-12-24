// src/app/edit-collection/ManagePickListsModal.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MergeModal } from './pickers/MergeModal';
import { EditModal } from './pickers/EditModal';
import {
  fetchArtists, updateArtist, mergeArtists, deleteArtist,
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
  initialList?: string;
  hideListSelector?: boolean;
}

interface PickListConfig {
  label: string;
  fetchFn: () => Promise<{ id: string; name: string; count?: number; sortName?: string }[]>;
  updateFn: (id: string, name: string, sortName?: string) => Promise<boolean>;
  deleteFn?: (id: string) => Promise<boolean>;
  mergeFn: (targetId: string, sourceIds: string[]) => Promise<boolean>;
  allowDelete: boolean;
  allowMerge: boolean;
  hasSortName?: boolean;
}

const PICK_LIST_CONFIGS: Record<string, PickListConfig> = {
  // Sort Name Required
  artist: { label: 'Artist', fetchFn: fetchArtists, updateFn: updateArtist, deleteFn: deleteArtist, mergeFn: mergeArtists, allowDelete: true, allowMerge: true, hasSortName: true },
  composer: { label: 'Composer', fetchFn: fetchComposers, updateFn: updateComposer, mergeFn: mergeComposers, allowDelete: false, allowMerge: true, hasSortName: true },
  conductor: { label: 'Conductor', fetchFn: fetchConductors, updateFn: updateConductor, mergeFn: mergeConductors, allowDelete: false, allowMerge: true, hasSortName: true },
  musician: { label: 'Musician', fetchFn: fetchMusicians, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: true, hasSortName: true },
  songwriter: { label: 'Songwriter', fetchFn: fetchSongwriters, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: true, hasSortName: true },
  producer: { label: 'Producer', fetchFn: fetchProducers, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: true, hasSortName: true },
  engineer: { label: 'Engineer', fetchFn: fetchEngineers, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: true, hasSortName: true },

  // No Sort Name
  chorus: { label: 'Chorus', fetchFn: fetchChoruses, updateFn: updateChorus, mergeFn: mergeChorus, allowDelete: false, allowMerge: true, hasSortName: false },
  label: { label: 'Label', fetchFn: fetchLabels, updateFn: updateLabel, deleteFn: deleteLabel, mergeFn: mergeLabels, allowDelete: true, allowMerge: true, hasSortName: false },
  genre: { label: 'Genre', fetchFn: fetchGenres, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: true, hasSortName: false },
  'media-condition': { label: 'Media Condition', fetchFn: fetchMediaConditions, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: true, hasSortName: false },
  'package-sleeve-condition': { label: 'Package/Sleeve Condition', fetchFn: fetchPackageConditions, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: true, hasSortName: false },
  tag: { label: 'Tag', fetchFn: fetchTags, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: true, hasSortName: false },
  'vinyl-color': { label: 'Vinyl Color', fetchFn: fetchVinylColors, updateFn: updateVinylColor, deleteFn: async () => false, mergeFn: mergeVinylColors, allowDelete: true, allowMerge: true, hasSortName: false },
  'vinyl-weight': { label: 'Vinyl Weight', fetchFn: fetchVinylWeights, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: true, hasSortName: false },
  
  // Others (Merge enabled for consistency)
  'box-set': { label: 'Box Set', fetchFn: fetchBoxSets, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: true, hasSortName: false },
  composition: { label: 'Composition', fetchFn: fetchCompositions, updateFn: updateComposition, mergeFn: mergeCompositions, allowDelete: false, allowMerge: true, hasSortName: false },
  country: { label: 'Country', fetchFn: fetchCountries, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: true, hasSortName: false },
  format: { label: 'Format', fetchFn: fetchFormats, updateFn: updateFormat, deleteFn: async () => false, mergeFn: mergeFormats, allowDelete: true, allowMerge: true, hasSortName: false },
  location: { label: 'Location', fetchFn: fetchLocations, updateFn: updateLocation, deleteFn: async () => false, mergeFn: mergeLocations, allowDelete: true, allowMerge: true, hasSortName: false },
  orchestra: { label: 'Orchestra', fetchFn: fetchOrchestras, updateFn: updateOrchestra, mergeFn: mergeOrchestras, allowDelete: false, allowMerge: true, hasSortName: false },
  owner: { label: 'Owner', fetchFn: fetchOwners, updateFn: updateOwner, deleteFn: deleteOwner, mergeFn: mergeOwners, allowDelete: true, allowMerge: true, hasSortName: false },
  packaging: { label: 'Packaging', fetchFn: fetchPackaging, updateFn: updatePackaging, deleteFn: deletePackaging, mergeFn: mergePackaging, allowDelete: true, allowMerge: true, hasSortName: false },
  'purchase-store': { label: 'Purchase Store', fetchFn: fetchPurchaseStores, updateFn: updatePurchaseStore, deleteFn: deletePurchaseStore, mergeFn: mergePurchaseStores, allowDelete: true, allowMerge: true, hasSortName: false },
  signee: { label: 'Signee', fetchFn: fetchSignees, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: true, hasSortName: false },
  sound: { label: 'Sound', fetchFn: fetchSounds, updateFn: updateSound, mergeFn: mergeSounds, allowDelete: false, allowMerge: true, hasSortName: false },
  spars: { label: 'SPARS', fetchFn: fetchSPARS, updateFn: updateSPARS, deleteFn: async () => false, mergeFn: mergeSPARS, allowDelete: true, allowMerge: true, hasSortName: false },
  'storage-device': { label: 'Storage Device', fetchFn: fetchStorageDevices, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: true, hasSortName: false },
  studio: { label: 'Studio', fetchFn: fetchStudios, updateFn: updateStudio, mergeFn: mergeStudios, allowDelete: false, allowMerge: true, hasSortName: false },
};

export default function ManagePickListsModal({ isOpen, onClose, initialList, hideListSelector = false }: ManagePickListsModalProps) {
  const [selectedList, setSelectedList] = useState<string>('');
  const [items, setItems] = useState<{ id: string; name: string; count?: number; sortName?: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Edit State
  const [editingItem, setEditingItem] = useState<{ id: string; name: string; sortName?: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editSortName, setEditSortName] = useState('');

  const [mergeMode, setMergeMode] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  
  // Sort toggle state
  const [sortBy, setSortBy] = useState<'name' | 'sortName'>('sortName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  // Handle initialization and list changes
  useEffect(() => {
    if (isOpen) {
      if (initialList && PICK_LIST_CONFIGS[initialList]) {
        setSelectedList(initialList);
      }
      setSearchQuery('');
      setMergeMode(false);
      setSelectedItems(new Set());
      setShowMergeModal(false);
    }
  }, [isOpen, initialList]);

  useEffect(() => {
    if (selectedList) {
      loadItems();
      setSelectedItems(new Set());
      setMergeMode(false);
      
      // Default sort logic
      const config = PICK_LIST_CONFIGS[selectedList];
      if (config && config.hasSortName) {
        setSortBy('sortName');
      } else {
        setSortBy('name');
      }
      setSortDirection('asc');
    } else {
      setItems([]);
    }
  }, [selectedList, loadItems]);

  const handleEdit = (item: { id: string; name: string; sortName?: string }) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditSortName(item.sortName || getSortName(item.name));
  };

  const handleSaveEdit = async (newName: string, newSortName?: string) => {
    if (!selectedList || !editingItem) return;
    const config = PICK_LIST_CONFIGS[selectedList];
    
    const success = await config.updateFn(editingItem.id, newName, newSortName);
    
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
      const confirmMessage = selectedList === 'artist' 
        ? 'This will remove the artist permanently from all albums in your collection. Are you sure?'
        : 'Are you sure you want to delete this item?';

      setTimeout(async () => {
        if (window.confirm(confirmMessage)) {
          const success = await config.deleteFn!(itemId);
          if (success) await loadItems();
        }
      }, 0);
    }
  };

  const handleOpenMergeModal = () => {
    if (selectedItems.size >= 2) {
      setShowMergeModal(true);
    }
  };

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
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('sortName');
      setSortDirection('asc');
    }
  };

  const config = selectedList ? PICK_LIST_CONFIGS[selectedList] : null;
  const showSortNameUI = config?.hasSortName || false;

  const filteredItems = useMemo(() => {
    const result = items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return result.sort((a, b) => {
      // If Sort Name is not applicable, always sort by Name
      if (!showSortNameUI) {
         return sortDirection === 'asc' 
            ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
            : b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      }

      // Otherwise follow standard logic
      const nameA = sortBy === 'sortName' ? (a.sortName || getSortName(a.name)) : a.name;
      const nameB = sortBy === 'sortName' ? (b.sortName || getSortName(b.name)) : b.name;
      
      const comparison = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [items, searchQuery, sortBy, sortDirection, getSortName, showSortNameUI]);

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
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'white' }}>
              {/* Show the selected list name if configured, otherwise generic title */}
              {config ? `Manage ${config.label}s` : 'Manage Pick Lists'}
            </h3>
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

            {/* Conditionally render dropdown */}
            {!hideListSelector && (
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
            )}
            {hideListSelector && <div style={{ flex: '0 0 35%' }} />}
          </div>

          {/* Table Content */}
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'white' }}>
            {!selectedList ? (
              <div style={{ padding: '50px 30px', textAlign: 'center', color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>
                Select a pick list to manage...
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: '50px 30px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                {searchQuery ? 'No items match your search' : 'No items available'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>
                    <th style={{ width: '40px', padding: '8px' }}></th>
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
                        {/* Only show Sort Name header if applicable */}
                        {showSortNameUI && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>Sort Name</span>
                            {sortBy === 'sortName' && (
                              <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                                {sortDirection === 'asc' ? '▼' : '▲'}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Show simple arrow for Name sort if Sort Name hidden */}
                        {!showSortNameUI && sortBy === 'name' && (
                           <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '4px' }}>
                              {sortDirection === 'asc' ? '▼' : '▲'}
                           </span>
                        )}
                      </div>
                    </th>
                    <th style={{ width: '60px', padding: '8px 12px', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                      Count
                    </th>
                    <th style={{ width: '40px', padding: '8px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => {
                    const isSelected = selectedItems.has(item.id);
                    const sortName = item.sortName || getSortName(item.name);

                    return (
                      <tr 
                        key={item.id} 
                        style={{ 
                          backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                          borderBottom: '1px solid #f3f4f6' 
                        }}
                      >
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
                        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '13px', color: '#111827', fontWeight: '500' }}>
                              {item.name}
                            </span>
                            {showSortNameUI && (
                              <span style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                                {sortName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', verticalAlign: 'middle', fontSize: '13px', color: '#4b5563' }}>
                          {item.count}
                        </td>
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
        <EditModal 
          isOpen={true}
          onClose={() => setEditingItem(null)}
          title={`Edit ${config.label}`}
          itemName={editName}
          itemSortName={editSortName}
          itemLabel={config.label}
          onSave={handleSaveEdit}
          showSortName={showSortNameUI}
        />
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