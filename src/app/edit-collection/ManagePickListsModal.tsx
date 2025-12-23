// src/app/edit-collection/ManagePickListsModal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
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

const PICK_LIST_CONFIGS: Record<string, PickListConfig> = {
  artist: { label: 'Artist', fetchFn: fetchArtists, updateFn: updateArtist, mergeFn: mergeArtists, allowDelete: false, allowMerge: true },
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
  const [editingItem, setEditingItem] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
      setDeleteConfirmId(null);
    } else {
      setItems([]);
    }
  }, [selectedList, loadItems]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setMergeMode(false);
      setDeleteConfirmId(null);
    }
  }, [isOpen]);

  const handleEdit = (item: { id: string; name: string }) => {
    setEditingItem(item);
    setEditName(item.name);
  };

  const handleSaveEdit = async () => {
    if (!selectedList || !editingItem) return;
    const config = PICK_LIST_CONFIGS[selectedList];
    const success = await config.updateFn(editingItem.id, editName);
    if (success) {
      await loadItems();
      setEditingItem(null);
      setEditName('');
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!selectedList) return;
    const config = PICK_LIST_CONFIGS[selectedList];
    if (config.deleteFn) {
      const success = await config.deleteFn(itemId);
      if (success) {
        await loadItems();
        setDeleteConfirmId(null);
      }
    }
  };

  const handleMerge = async () => {
    if (!selectedList || selectedItems.size < 2) return;
    const config = PICK_LIST_CONFIGS[selectedList];
    const itemIds = Array.from(selectedItems);
    const targetId = itemIds[0];
    const sourceIds = itemIds.slice(1);
    
    const targetName = items.find(i => i.id === targetId)?.name;
    
    if (confirm(`Merge ${selectedItems.size} items into "${targetName}"?`)) {
      const success = await config.mergeFn(targetId, sourceIds);
      if (success) {
        await loadItems();
        setSelectedItems(new Set());
        setMergeMode(false);
      }
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

  if (!isOpen) return null;

  const config = selectedList ? PICK_LIST_CONFIGS[selectedList] : null;
  const filteredItems = items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const sortedItems = [...filteredItems].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

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
          zIndex: 30001 
        }} 
        onClick={onClose}
      >
        <div 
          style={{ 
            backgroundColor: 'white', 
            borderRadius: '6px', 
            width: mergeMode ? '900px' : '650px', 
            maxHeight: '600px', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden', 
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)' 
          }} 
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* Header - ORANGE by default (CLZ Style) */}
          <div 
            style={{ 
              padding: '12px 16px', 
              borderBottom: '1px solid #e5e7eb', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              backgroundColor: '#f97316',
            }}
          >
            <h3 style={{ 
              margin: 0, 
              fontSize: '16px', 
              fontWeight: '600', 
              color: 'white'
            }}>
              {config ? `Manage ${config.label}s` : 'Manage Pick Lists'}
            </h3>
            <button 
              onClick={onClose} 
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'white', 
                fontSize: '20px', 
                cursor: 'pointer', 
                padding: '0 4px', 
                lineHeight: '1' 
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
              gap: '8px', 
              alignItems: 'center', 
              backgroundColor: 'white' 
            }}
          >
            {/* List Selector on LEFT */}
            <select
              value={selectedList}
              onChange={(e) => setSelectedList(e.target.value)}
              style={{ 
                flex: '0 0 200px', 
                padding: '6px 10px', 
                border: '1px solid #d1d5db', 
                borderRadius: '4px', 
                fontSize: '13px', 
                outline: 'none', 
                backgroundColor: 'white', 
                cursor: 'pointer', 
                color: '#111827' 
              }}
            >
              <option value="">Select a list...</option>
              {Object.entries(PICK_LIST_CONFIGS).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                flex: 1, 
                padding: '6px 10px', 
                border: '1px solid #d1d5db', 
                borderRadius: '4px', 
                fontSize: '13px', 
                outline: 'none', 
                backgroundColor: 'white', 
                color: '#111827' 
              }}
            />

            {/* Merge Mode Toggle */}
            {config?.allowMerge && (
              <button
                onClick={() => {
                  setMergeMode(!mergeMode);
                  setSelectedItems(new Set());
                }}
                style={{
                  padding: '6px 12px',
                  background: mergeMode ? '#ef4444' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {mergeMode ? 'Cancel Merge' : 'Merge Mode'}
              </button>
            )}
          </div>

          {/* Yellow Banner in Merge Mode */}
          {mergeMode && (
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: '#fef3c7',
                borderBottom: '1px solid #fbbf24',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '13px', color: '#92400e', fontWeight: '500' }}>
                {selectedItems.size === 0
                  ? `Select 2 or more items to merge`
                  : `${selectedItems.size} items selected`}
              </span>
              {selectedItems.size >= 2 && (
                <button
                  onClick={handleMerge}
                  style={{
                    padding: '5px 14px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Merge Selected
                </button>
              )}
            </div>
          )}

          {/* Content Area */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* List */}
            <div 
              style={{ 
                flex: mergeMode ? '0 0 60%' : '1', 
                overflowY: 'auto', 
                padding: '8px 16px', 
                borderRight: mergeMode ? '1px solid #e5e7eb' : 'none' 
              }}
            >
              {!selectedList ? (
                <div style={{ padding: '50px 30px', textAlign: 'center', color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>
                  Select a pick list to manage using the dropdown menu...
                </div>
              ) : sortedItems.length === 0 ? (
                <div style={{ padding: '50px 30px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                  {searchQuery ? 'No items match your search' : 'No items available'}
                </div>
              ) : (
                sortedItems.map((item) => {
                  const isDeleteConfirming = deleteConfirmId === item.id;
                  const isSelectedForMerge = selectedItems.has(item.id);

                  return (
                    <div 
                      key={item.id} 
                      style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '3px',
                        backgroundColor: isSelectedForMerge ? '#eff6ff' : 'transparent',
                        marginBottom: '1px',
                        borderBottom: '1px solid #f3f4f6'
                      }}
                    >
                      {/* Name & Checkbox */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        {mergeMode && (
                          <input
                            type="checkbox"
                            checked={isSelectedForMerge}
                            onChange={() => toggleSelection(item.id)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
                          />
                        )}
                        <span style={{ fontSize: '13px', color: '#111827', flex: 1 }}>{item.name}</span>
                        {item.count !== undefined && (
                          <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '400', marginRight: '8px' }}>
                            {item.count}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      {!mergeMode && (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {isDeleteConfirming ? (
                            <>
                              <button
                                onClick={() => handleDelete(item.id)}
                                style={{
                                  padding: '4px 10px',
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                }}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                style={{
                                  padding: '4px 10px',
                                  background: '#e5e7eb',
                                  color: '#374151',
                                  border: 'none',
                                  borderRadius: '3px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Edit Button */}
                              <button 
                                onClick={() => handleEdit(item)} 
                                style={{ 
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  color: '#6b7280',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                                title="Edit"
                              >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                  <path d="M11.5 1.5l1 1-8 8-1.5.5.5-1.5 8-8zm1.5-.5c-.3-.3-.7-.3-1 0l-1 1 1 1 1-1c.3-.3.3-.7 0-1l-.5-.5-.5.5zm-10 11l1-3 2 2-3 1z"/>
                                </svg>
                              </button>
                              
                              {/* Delete Button */}
                              {config?.allowDelete && config.deleteFn && (
                                <button 
                                  onClick={() => setDeleteConfirmId(item.id)} 
                                  style={{ 
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    color: '#6b7280',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '16px',
                                    lineHeight: '1',
                                  }}
                                  title="Delete"
                                >
                                  ×
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Panel in Merge Mode */}
            {mergeMode && selectedItems.size > 0 && (
              <div style={{ flex: '0 0 40%', padding: '16px', backgroundColor: '#f9fafb', overflowY: 'auto' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                  Merge {selectedItems.size} items into:
                </div>
                {Array.from(selectedItems).map(id => {
                  const item = items.find(i => i.id === id);
                  if (!item) return null;
                  return (
                    <div key={id} style={{
                      padding: '6px 8px',
                      backgroundColor: 'white',
                      borderRadius: '3px',
                      marginBottom: '4px',
                      fontSize: '13px',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}>
                      <span>{item.name}</span>
                      <span style={{ color: '#6b7280' }}>{item.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div 
            style={{ 
              padding: '12px 16px', 
              borderTop: '1px solid #e5e7eb', 
              display: 'flex', 
              justifyContent: mergeMode ? 'space-between' : 'flex-end', // Right align close button
              gap: '8px',
              backgroundColor: 'white'
            }}
          >
            {mergeMode ? (
              <>
                <button
                  onClick={() => { setMergeMode(false); setSelectedItems(new Set()); }}
                  style={{ padding: '6px 16px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleMerge}
                  disabled={selectedItems.size < 2}
                  style={{ padding: '6px 16px', background: selectedItems.size >= 2 ? '#3b82f6' : '#d1d5db', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: selectedItems.size >= 2 ? 'pointer' : 'not-allowed' }}
                >
                  Merge to
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                style={{ padding: '6px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editingItem && config && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30002 }} onClick={() => setEditingItem(null)}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '400px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '12px 18px', backgroundColor: '#f97316', borderBottom: '1px solid #e5e7eb', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'white' }}>Edit {config.label}</h3>
            </div>
            <div style={{ padding: '18px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: '#374151' }}>Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} autoFocus />
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '8px', backgroundColor: 'white', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
              <button onClick={() => setEditingItem(null)} style={{ padding: '6px 18px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveEdit} style={{ padding: '6px 18px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}