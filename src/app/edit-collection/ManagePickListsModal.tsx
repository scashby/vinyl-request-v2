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
  artist: {
    label: 'Artist',
    fetchFn: fetchArtists,
    updateFn: updateArtist,
    mergeFn: mergeArtists,
    allowDelete: false,
  },
  'box-set': {
    label: 'Box Set',
    fetchFn: fetchBoxSets,
    updateFn: async () => false,
    mergeFn: async () => false,
    allowDelete: false,
  },
  chorus: {
    label: 'Chorus',
    fetchFn: fetchChoruses,
    updateFn: updateChorus,
    mergeFn: mergeChorus,
    allowDelete: false,
  },
  composer: {
    label: 'Composer',
    fetchFn: fetchComposers,
    updateFn: updateComposer,
    mergeFn: mergeComposers,
    allowDelete: false,
  },
  conductor: {
    label: 'Conductor',
    fetchFn: fetchConductors,
    updateFn: updateConductor,
    mergeFn: mergeConductors,
    allowDelete: false,
  },
  country: {
    label: 'Country',
    fetchFn: fetchCountries,
    updateFn: async () => false,
    deleteFn: async () => false,
    mergeFn: async () => false,
    allowDelete: true,
  },
  engineer: {
    label: 'Engineer',
    fetchFn: fetchEngineers,
    updateFn: async () => false,
    mergeFn: async () => false,
    allowDelete: false,
  },
  format: {
    label: 'Format',
    fetchFn: fetchFormats,
    updateFn: updateFormat,
    deleteFn: async () => false,
    mergeFn: mergeFormats,
    allowDelete: true,
  },
  genre: {
    label: 'Genre',
    fetchFn: fetchGenres,
    updateFn: async () => false,
    deleteFn: async () => false,
    mergeFn: async () => false,
    allowDelete: true,
  },
  label: {
    label: 'Label',
    fetchFn: fetchLabels,
    updateFn: updateLabel,
    deleteFn: deleteLabel,
    mergeFn: mergeLabels,
    allowDelete: true,
  },
  location: {
    label: 'Location',
    fetchFn: fetchLocations,
    updateFn: updateLocation,
    deleteFn: async () => false,
    mergeFn: mergeLocations,
    allowDelete: true,
  },
  'media-condition': {
    label: 'Media Condition',
    fetchFn: fetchMediaConditions,
    updateFn: async () => false,
    deleteFn: async () => false,
    mergeFn: async () => false,
    allowDelete: true,
  },
  musician: {
    label: 'Musician',
    fetchFn: fetchMusicians,
    updateFn: async () => false,
    mergeFn: async () => false,
    allowDelete: false,
  },
  orchestra: {
    label: 'Orchestra',
    fetchFn: fetchOrchestras,
    updateFn: updateOrchestra,
    mergeFn: mergeOrchestras,
    allowDelete: false,
  },
  owner: {
    label: 'Owner',
    fetchFn: fetchOwners,
    updateFn: updateOwner,
    deleteFn: deleteOwner,
    mergeFn: mergeOwners,
    allowDelete: true,
  },
  'package-sleeve-condition': {
    label: 'Package/Sleeve Condition',
    fetchFn: fetchPackageConditions,
    updateFn: async () => false,
    deleteFn: async () => false,
    mergeFn: async () => false,
    allowDelete: true,
  },
  packaging: {
    label: 'Packaging',
    fetchFn: fetchPackaging,
    updateFn: updatePackaging,
    deleteFn: deletePackaging,
    mergeFn: mergePackaging,
    allowDelete: true,
  },
  producer: {
    label: 'Producer',
    fetchFn: fetchProducers,
    updateFn: async () => false,
    mergeFn: async () => false,
    allowDelete: false,
  },
  'purchase-store': {
    label: 'Purchase Store',
    fetchFn: fetchPurchaseStores,
    updateFn: updatePurchaseStore,
    deleteFn: deletePurchaseStore,
    mergeFn: mergePurchaseStores,
    allowDelete: true,
  },
  spars: {
    label: 'SPARS',
    fetchFn: fetchSPARS,
    updateFn: updateSPARS,
    deleteFn: async () => false,
    mergeFn: mergeSPARS,
    allowDelete: true,
  },
  signee: {
    label: 'Signee',
    fetchFn: fetchSignees,
    updateFn: async () => false,
    mergeFn: async () => false,
    allowDelete: false,
  },
  songwriter: {
    label: 'Songwriter',
    fetchFn: fetchSongwriters,
    updateFn: async () => false,
    mergeFn: async () => false,
    allowDelete: false,
  },
  sound: {
    label: 'Sound',
    fetchFn: fetchSounds,
    updateFn: updateSound,
    mergeFn: mergeSounds,
    allowDelete: false,
  },
  'storage-device': {
    label: 'Storage Device',
    fetchFn: fetchStorageDevices,
    updateFn: async () => false,
    mergeFn: async () => false,
    allowDelete: false,
  },
  studio: {
    label: 'Studio',
    fetchFn: fetchStudios,
    updateFn: updateStudio,
    mergeFn: mergeStudios,
    allowDelete: false,
  },
  tag: {
    label: 'Tag',
    fetchFn: fetchTags,
    updateFn: async () => false,
    deleteFn: async () => false,
    mergeFn: async () => false,
    allowDelete: true,
  },
  composition: {
    label: 'Composition',
    fetchFn: fetchCompositions,
    updateFn: updateComposition,
    mergeFn: mergeCompositions,
    allowDelete: false,
  },
  'vinyl-color': {
    label: 'Vinyl Color',
    fetchFn: fetchVinylColors,
    updateFn: updateVinylColor,
    deleteFn: async () => false,
    mergeFn: mergeVinylColors,
    allowDelete: true,
  },
  'vinyl-weight': {
    label: 'Vinyl Weight',
    fetchFn: fetchVinylWeights,
    updateFn: async () => false,
    mergeFn: async () => false,
    allowDelete: false,
  },
};

export default function ManagePickListsModal({ isOpen, onClose }: ManagePickListsModalProps) {
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [items, setItems] = useState<{ id: string; name: string; count?: number }[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState('');

  const loadItems = useCallback(async () => {
    if (!selectedList) return;
    
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
        if (success) {
          await loadItems();
        }
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

  // Stage 1: List selection
  if (!selectedList) {
    return (
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
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '6px',
            width: '500px',
            maxHeight: '600px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
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
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'white' }}>
              Manage Pick Lists
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
                lineHeight: '1',
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}
          >
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
              Select a list below to view and manage its items. You can edit names, merge duplicates,
              and delete unused entries.
            </p>
          </div>

          <div style={{ padding: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#374151',
              }}
            >
              Select a list
            </label>
            <select
              value=""
              onChange={(e) => setSelectedList(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '13px',
                outline: 'none',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            >
              <option value="">Choose a list...</option>
              {Object.entries(PICK_LIST_CONFIGS)
                .sort((a, b) => a[1].label.localeCompare(b[1].label))
                .map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
            </select>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: '6px 20px',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stage 2: Manage items
  const config = PICK_LIST_CONFIGS[selectedList];
  
  return (
    <>
      {/* Main manage modal */}
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
        onClick={() => setSelectedList(null)}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '6px',
            width: '600px',
            maxHeight: '700px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
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
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'white' }}>
              Manage {config.label}s
            </h3>
            <button
              onClick={() => setSelectedList(null)}
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

          {/* Action buttons */}
          {selectedItems.size > 1 && (
            <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <button
                onClick={handleMerge}
                style={{
                  padding: '6px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Merge {selectedItems.size} Items
              </button>
            </div>
          )}

          {/* Items list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '8px 12px',
                  marginBottom: '4px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: selectedItems.has(item.id) ? '#eff6ff' : 'white',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={() => toggleSelection(item.id)}
                  style={{ cursor: 'pointer' }}
                />
                <div style={{ flex: 1, fontSize: '13px' }}>
                  {item.name}
                  {item.count !== undefined && (
                    <span style={{ marginLeft: '8px', color: '#6b7280' }}>({item.count})</span>
                  )}
                </div>
                <button
                  onClick={() => handleEdit(item)}
                  style={{
                    padding: '4px 12px',
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                {config.deleteFn && config.allowDelete && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      padding: '4px 12px',
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <button
              onClick={() => setSelectedList(null)}
              style={{
                padding: '6px 20px',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Back to List Selection
            </button>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editingItem && (
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
            zIndex: 30002,
          }}
          onClick={() => setEditingItem(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '6px',
              width: '400px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: '#3b82f6',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'white' }}>
                Edit {config.label}
              </h3>
            </div>

            <div style={{ padding: '16px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#374151',
                }}
              >
                Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '13px',
                  outline: 'none',
                }}
                autoFocus
              />
            </div>

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
                onClick={() => setEditingItem(null)}
                style={{
                  padding: '6px 20px',
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
                onClick={handleSaveEdit}
                style={{
                  padding: '6px 20px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '500',
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