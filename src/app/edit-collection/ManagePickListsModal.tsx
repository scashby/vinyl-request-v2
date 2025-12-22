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
}

const PICK_LIST_CONFIGS: Record<string, PickListConfig> = {
  artist: { label: 'Artist', fetchFn: fetchArtists, updateFn: updateArtist, mergeFn: mergeArtists, allowDelete: false },
  'box-set': { label: 'Box Set', fetchFn: fetchBoxSets, updateFn: async () => false, mergeFn: async () => false, allowDelete: false },
  chorus: { label: 'Chorus', fetchFn: fetchChoruses, updateFn: updateChorus, mergeFn: mergeChorus, allowDelete: false },
  composer: { label: 'Composer', fetchFn: fetchComposers, updateFn: updateComposer, mergeFn: mergeComposers, allowDelete: false },
  composition: { label: 'Composition', fetchFn: fetchCompositions, updateFn: updateComposition, mergeFn: mergeCompositions, allowDelete: false },
  conductor: { label: 'Conductor', fetchFn: fetchConductors, updateFn: updateConductor, mergeFn: mergeConductors, allowDelete: false },
  country: { label: 'Country', fetchFn: fetchCountries, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true },
  engineer: { label: 'Engineer', fetchFn: fetchEngineers, updateFn: async () => false, mergeFn: async () => false, allowDelete: false },
  format: { label: 'Format', fetchFn: fetchFormats, updateFn: updateFormat, deleteFn: async () => false, mergeFn: mergeFormats, allowDelete: true },
  genre: { label: 'Genre', fetchFn: fetchGenres, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true },
  label: { label: 'Label', fetchFn: fetchLabels, updateFn: updateLabel, deleteFn: deleteLabel, mergeFn: mergeLabels, allowDelete: true },
  location: { label: 'Location', fetchFn: fetchLocations, updateFn: updateLocation, deleteFn: async () => false, mergeFn: mergeLocations, allowDelete: true },
  'media-condition': { label: 'Media Condition', fetchFn: fetchMediaConditions, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true },
  musician: { label: 'Musician', fetchFn: fetchMusicians, updateFn: async () => false, mergeFn: async () => false, allowDelete: false },
  orchestra: { label: 'Orchestra', fetchFn: fetchOrchestras, updateFn: updateOrchestra, mergeFn: mergeOrchestras, allowDelete: false },
  owner: { label: 'Owner', fetchFn: fetchOwners, updateFn: updateOwner, deleteFn: deleteOwner, mergeFn: mergeOwners, allowDelete: true },
  'package-sleeve-condition': { label: 'Package/Sleeve Condition', fetchFn: fetchPackageConditions, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true },
  packaging: { label: 'Packaging', fetchFn: fetchPackaging, updateFn: updatePackaging, deleteFn: deletePackaging, mergeFn: mergePackaging, allowDelete: true },
  producer: { label: 'Producer', fetchFn: fetchProducers, updateFn: async () => false, mergeFn: async () => false, allowDelete: false },
  'purchase-store': { label: 'Purchase Store', fetchFn: fetchPurchaseStores, updateFn: updatePurchaseStore, deleteFn: deletePurchaseStore, mergeFn: mergePurchaseStores, allowDelete: true },
  signee: { label: 'Signee', fetchFn: fetchSignees, updateFn: async () => false, mergeFn: async () => false, allowDelete: false },
  songwriter: { label: 'Songwriter', fetchFn: fetchSongwriters, updateFn: async () => false, mergeFn: async () => false, allowDelete: false },
  sound: { label: 'Sound', fetchFn: fetchSounds, updateFn: updateSound, mergeFn: mergeSounds, allowDelete: false },
  spars: { label: 'SPARS', fetchFn: fetchSPARS, updateFn: updateSPARS, deleteFn: async () => false, mergeFn: mergeSPARS, allowDelete: true },
  'storage-device': { label: 'Storage Device', fetchFn: fetchStorageDevices, updateFn: async () => false, mergeFn: async () => false, allowDelete: false },
  studio: { label: 'Studio', fetchFn: fetchStudios, updateFn: updateStudio, mergeFn: mergeStudios, allowDelete: false },
  tag: { label: 'Tag', fetchFn: fetchTags, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true },
  'vinyl-color': { label: 'Vinyl Color', fetchFn: fetchVinylColors, updateFn: updateVinylColor, deleteFn: async () => false, mergeFn: mergeVinylColors, allowDelete: true },
  'vinyl-weight': { label: 'Vinyl Weight', fetchFn: fetchVinylWeights, updateFn: async () => false, mergeFn: async () => false, allowDelete: false },
};

export default function ManagePickListsModal({ isOpen, onClose }: ManagePickListsModalProps) {
  const [selectedList, setSelectedList] = useState<string>('');
  const [items, setItems] = useState<{ id: string; name: string; count?: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [mergeMode, setMergeMode] = useState(false);

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
    } else {
      setItems([]);
    }
  }, [selectedList, loadItems]);

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
      if (confirm('Are you sure you want to delete this item?')) {
        const success = await config.deleteFn(itemId);
        if (success) await loadItems();
      }
    }
  };

  const handleMerge = async () => {
    if (!selectedList || selectedItems.size < 2) return;
    const config = PICK_LIST_CONFIGS[selectedList];
    const itemIds = Array.from(selectedItems);
    const targetId = itemIds[0];
    const sourceIds = itemIds.slice(1);
    if (confirm(`Merge ${selectedItems.size} items into "${items.find(i => i.id === targetId)?.name}"?`)) {
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
  const selectedArray = Array.from(selectedItems);
  const previewItems = mergeMode && selectedArray.length > 0 ? items.filter(i => selectedItems.has(i.id)) : [];

  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30001 }} onClick={onClose}>
        <div style={{ backgroundColor: 'white', borderRadius: '6px', width: mergeMode ? '900px' : '700px', maxHeight: '700px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
          
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f97316' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'white' }}>Manage Pick Lists</h3>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer', padding: '0 4px', lineHeight: '1' }}>×</button>
          </div>

          {/* Toolbar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: '0 0 200px', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', outline: 'none', backgroundColor: 'white', color: '#111827' }}
            />
            <select
              value={selectedList}
              onChange={(e) => setSelectedList(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', outline: 'none', backgroundColor: 'white', cursor: 'pointer', color: '#111827' }}
            >
              <option value="">Choose a list...</option>
              {Object.entries(PICK_LIST_CONFIGS).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label} list</option>
              ))}
            </select>
            {selectedList && (
              <button
                onClick={() => { setMergeMode(!mergeMode); setSelectedItems(new Set()); }}
                style={{ padding: '6px 16px', background: mergeMode ? '#ef4444' : '#93c5fd', color: mergeMode ? 'white' : '#1e40af', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {mergeMode ? 'Cancel Merge' : 'Merge Mode'}
              </button>
            )}
          </div>

          {/* Yellow banner in merge mode */}
          {mergeMode && selectedList && (
            <div style={{ padding: '10px 16px', backgroundColor: '#fef3c7', borderBottom: '1px solid #fbbf24', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#92400e', fontWeight: '500' }}>
                {selectedItems.size === 0 ? `Select 2 or more ${config?.label.toLowerCase()}s to merge` : `${selectedItems.size} ${config?.label.toLowerCase()}${selectedItems.size === 1 ? '' : 's'} selected`}
              </span>
              {selectedItems.size >= 2 && (
                <button onClick={handleMerge} style={{ padding: '5px 14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Merge to</button>
              )}
            </div>
          )}

          {/* Content */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: mergeMode ? '0 0 60%' : '1', overflowY: 'auto', padding: '16px' }}>
              {!selectedList ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                  Select a pick list to manage in the top right dropdown menu...
                </div>
              ) : filteredItems.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                  {searchQuery ? 'No items match your search' : 'No items available'}
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '3px', backgroundColor: selectedItems.has(item.id) ? '#eff6ff' : 'transparent', marginBottom: '2px', border: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      {mergeMode && <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelection(item.id)} style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0 }} />}
                      <span style={{ fontSize: '13px', color: '#111827' }}>{item.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {item.count !== undefined && <span style={{ fontSize: '13px', color: '#6b7280' }}>{item.count}</span>}
                      {!mergeMode && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => handleEdit(item)} style={{ padding: '4px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '3px', fontSize: '12px', cursor: 'pointer' }}>Edit</button>
                          {config?.deleteFn && config.allowDelete && (
                            <button onClick={() => handleDelete(item.id)} style={{ padding: '4px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '3px', fontSize: '12px', cursor: 'pointer' }}>Delete</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Merge preview panel */}
            {mergeMode && previewItems.length > 0 && (
              <div style={{ flex: '0 0 40%', padding: '16px', backgroundColor: '#f9fafb', overflowY: 'auto', borderLeft: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                  Merge {selectedItems.size} {config?.label}s to:
                </div>
                {previewItems.map((item) => (
                  <div key={item.id} style={{ padding: '8px 10px', backgroundColor: 'white', borderRadius: '3px', marginBottom: '4px', fontSize: '13px', color: '#111827', border: '1px solid #e5e7eb' }}>
                    {item.name} ({item.count || 0})
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'center' }}>
            <button onClick={onClose} style={{ padding: '6px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editingItem && config && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30002 }} onClick={() => setEditingItem(null)}>
          <div style={{ backgroundColor: 'white', borderRadius: '6px', width: '400px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#3b82f6' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'white' }}>Edit {config.label}</h3>
            </div>
            <div style={{ padding: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: '#374151' }}>Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#111827' }} autoFocus />
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setEditingItem(null)} style={{ padding: '6px 20px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveEdit} style={{ padding: '6px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}