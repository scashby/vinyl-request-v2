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
  fetchLocations, updateLocation, deleteLocation, mergeLocations,
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
  fetchSongwriters, updateSongwriter, deleteSongwriter, mergeSongwriters,
  fetchProducers, updateProducer, deleteProducer, mergeProducers,
  fetchEngineers, updateEngineer, deleteEngineer, mergeEngineers,
  fetchMusicians, updateMusician, deleteMusician, mergeMusicians
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
  hasSortName: boolean;
  keepOriginalOrder?: boolean;
}

const PICK_LIST_CONFIGS: Record<string, PickListConfig> = {
  // --------------------------------------------------------------------------
  // COMPLEX LISTS (Name + Sort Name)
  // --------------------------------------------------------------------------
  artist: { 
    label: 'Artist', 
    fetchFn: fetchArtists, 
    updateFn: updateArtist, 
    deleteFn: deleteArtist, 
    mergeFn: mergeArtists, 
    allowDelete: true, 
    allowMerge: true, 
    hasSortName: true 
  },
  composer: { 
    label: 'Composer', 
    fetchFn: fetchComposers, 
    updateFn: updateComposer, 
    mergeFn: mergeComposers, 
    allowDelete: false, 
    allowMerge: true, 
    hasSortName: true 
  },
  conductor: { 
    label: 'Conductor', 
    fetchFn: fetchConductors, 
    updateFn: updateConductor, 
    mergeFn: mergeConductors, 
    allowDelete: false, 
    allowMerge: true, 
    hasSortName: true 
  },
  chorus: { 
    label: 'Chorus', 
    fetchFn: fetchChoruses, 
    updateFn: updateChorus, 
    mergeFn: mergeChorus, 
    allowDelete: false, 
    allowMerge: true, 
    hasSortName: true 
  },
  composition: { 
    label: 'Composition', 
    fetchFn: fetchCompositions, 
    updateFn: updateComposition, 
    mergeFn: mergeCompositions, 
    allowDelete: false, 
    allowMerge: true, 
    hasSortName: true 
  },
  orchestra: { 
    label: 'Orchestra', 
    fetchFn: fetchOrchestras, 
    updateFn: updateOrchestra, 
    mergeFn: mergeOrchestras, 
    allowDelete: false, 
    allowMerge: true, 
    hasSortName: true 
  },
  
  // PEOPLE (Smart Lists)
  musician: { 
    label: 'Musician', 
    fetchFn: fetchMusicians, 
    updateFn: updateMusician, 
    deleteFn: deleteMusician,
    mergeFn: mergeMusicians, 
    allowDelete: true, 
    allowMerge: true, 
    hasSortName: true 
  },
  songwriter: { 
    label: 'Songwriter', 
    fetchFn: fetchSongwriters, 
    updateFn: updateSongwriter, 
    deleteFn: deleteSongwriter,
    mergeFn: mergeSongwriters, 
    allowDelete: true, 
    allowMerge: true, 
    hasSortName: true 
  },
  producer: { 
    label: 'Producer', 
    fetchFn: fetchProducers, 
    updateFn: updateProducer, 
    deleteFn: deleteProducer,
    mergeFn: mergeProducers, 
    allowDelete: true, 
    allowMerge: true, 
    hasSortName: true 
  },
  engineer: { 
    label: 'Engineer', 
    fetchFn: fetchEngineers, 
    updateFn: updateEngineer, 
    deleteFn: deleteEngineer,
    mergeFn: mergeEngineers, 
    allowDelete: true, 
    allowMerge: true, 
    hasSortName: true 
  },

  // --------------------------------------------------------------------------
  // SIMPLE LISTS (Name Only - Sort Name Field Hidden)
  // --------------------------------------------------------------------------
  label: { label: 'Label', fetchFn: fetchLabels, updateFn: updateLabel, deleteFn: deleteLabel, mergeFn: mergeLabels, allowDelete: true, allowMerge: true, hasSortName: false },
  genre: { label: 'Genre', fetchFn: fetchGenres, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: true, hasSortName: false },
  
  // GRADE ORDER PRESERVED (keepOriginalOrder: true)
  'media-condition': { label: 'Media Condition', fetchFn: fetchMediaConditions, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: true, hasSortName: false, keepOriginalOrder: true },
  'package-sleeve-condition': { label: 'Package/Sleeve Condition', fetchFn: fetchPackageConditions, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: true, hasSortName: false, keepOriginalOrder: true },
  'vinyl-weight': { label: 'Vinyl Weight', fetchFn: fetchVinylWeights, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: true, hasSortName: false, keepOriginalOrder: true },
  
  tag: { label: 'Tag', fetchFn: fetchTags, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: true, hasSortName: false },
  'vinyl-color': { label: 'Vinyl Color', fetchFn: fetchVinylColors, updateFn: updateVinylColor, deleteFn: async () => false, mergeFn: mergeVinylColors, allowDelete: true, allowMerge: true, hasSortName: false },
  
  // Others
  'box-set': { label: 'Box Set', fetchFn: fetchBoxSets, updateFn: async () => false, mergeFn: async () => false, allowDelete: false, allowMerge: true, hasSortName: false },
  country: { label: 'Country', fetchFn: fetchCountries, updateFn: async () => false, deleteFn: async () => false, mergeFn: async () => false, allowDelete: true, allowMerge: true, hasSortName: false },
  format: { label: 'Format', fetchFn: fetchFormats, updateFn: updateFormat, deleteFn: async () => false, mergeFn: mergeFormats, allowDelete: true, allowMerge: true, hasSortName: false },
  location: { label: 'Location', fetchFn: fetchLocations, updateFn: updateLocation, deleteFn: deleteLocation, mergeFn: mergeLocations, allowDelete: true, allowMerge: true, hasSortName: false },
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
  const [sortBy, setSortBy] = useState<'name' | 'sortName' | 'none'>('sortName');
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
      
      const config = PICK_LIST_CONFIGS[selectedList];
      
      if (config?.keepOriginalOrder) {
        setSortBy('none'); 
      } else if (config?.hasSortName) {
        setSortBy('sortName');
        setSortDirection('asc');
      } else {
        setSortBy('name');
        setSortDirection('asc');
      }
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
    
    // Only pass sortName if the list supports it
    const sortNameToSave = config.hasSortName ? newSortName : undefined;
    
    const success = await config.updateFn(editingItem.id, newName, sortNameToSave);
    
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
    const config = selectedList ? PICK_LIST_CONFIGS[selectedList] : null;

    if (sortBy === 'none') {
        setSortBy('name');
        setSortDirection('asc');
        return;
    }

    if (!config?.hasSortName) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      if (sortBy === 'sortName') {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy('sortName');
        setSortDirection('asc');
      }
    }
  };

  const config = selectedList ? PICK_LIST_CONFIGS[selectedList] : null;
  const showSortNameUI = config?.hasSortName || false;

  const filteredItems = useMemo(() => {
    const result = items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (sortBy === 'none') return result;

    return result.sort((a, b) => {
      if (!showSortNameUI) {
         return sortDirection === 'asc' 
            ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
            : b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      }

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
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30000] p-4"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-lg w-full max-w-[800px] h-[600px] flex flex-col overflow-hidden shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-orange-500 flex justify-between items-center rounded-t-lg">
            <h3 className="m-0 text-[15px] font-semibold text-white">
              {config ? `Manage ${config.label}s` : 'Manage Pick Lists'}
            </h3>
            <button 
              onClick={onClose} 
              className="bg-transparent border-none text-white text-2xl cursor-pointer p-0 leading-none flex items-center hover:text-white/80"
            >
              ×
            </button>
          </div>

          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-gray-200 flex flex-col md:flex-row md:items-center bg-white gap-3">
            <div className="w-full md:w-[35%] relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-[13px] outline-none bg-white text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex-1 flex justify-center items-center">
               {selectedList && (
                <div className="bg-gray-100 px-3 py-1 rounded flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200">
                  <span className="bg-black text-white px-1.5 py-px rounded-full font-bold text-[10px]">
                    {filteredItems.length}
                  </span>
                  <span>{config?.label}s</span>
                </div>
               )}
            </div>

            {!hideListSelector && (
              <div className="w-full md:w-[35%]">
                <select
                  value={selectedList}
                  onChange={(e) => setSelectedList(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-[13px] outline-none bg-white cursor-pointer text-gray-900 focus:border-blue-500"
                >
                  <option value="">Select a list...</option>
                  {Object.entries(PICK_LIST_CONFIGS).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label} list</option>
                  ))}
                </select>
              </div>
            )}
            {hideListSelector && <div className="hidden md:block md:w-[35%]" />}
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-y-auto bg-white">
            {!selectedList ? (
              <div className="py-12 text-center text-gray-400 text-[13px] italic">
                Select a pick list to manage...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-[13px]">
                {searchQuery ? 'No items match your search' : 'No items available'}
              </div>
            ) : (
              <table className="w-full border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-gray-200 bg-white sticky top-0 z-10">
                    <th className="w-10 p-2"></th>
                    <th 
                      className="px-3 py-2 text-left cursor-pointer align-top hover:bg-gray-50"
                      onClick={handleSortToggle}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-500">Name</span>
                        
                        {showSortNameUI && (
                          <div className="flex items-center gap-1 mt-px">
                            <span className="text-[11px] font-normal text-gray-400">Sort Name</span>
                            {sortBy === 'sortName' && (
                              <span className="text-[10px] text-gray-400">
                                {sortDirection === 'asc' ? '▼' : '▲'}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {(!showSortNameUI || sortBy === 'name') && (
                           <span className="text-[10px] text-gray-400 ml-1">
                              {sortBy === 'none' ? '' : (sortDirection === 'asc' ? '▼' : '▲')}
                           </span>
                        )}
                      </div>
                    </th>
                    <th className="w-[60px] px-3 py-2 text-center align-middle text-xs font-semibold text-gray-500">
                      Count
                    </th>
                    <th className="w-10 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => {
                    const isSelected = selectedItems.has(item.id);
                    const sortName = item.sortName || getSortName(item.name);

                    return (
                      <tr 
                        key={item.id} 
                        className={`border-b border-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="p-2 text-center align-middle">
                          {mergeMode ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection(item.id)}
                              className="w-4 h-4 cursor-pointer m-0 align-middle"
                            />
                          ) : (
                            <button 
                              onClick={() => handleEdit(item)}
                              className="bg-transparent border-none cursor-pointer text-blue-500 p-1 flex items-center justify-center hover:text-blue-600"
                              title="Edit"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <div className="flex flex-col">
                            <span className="text-[13px] font-medium text-gray-900">
                              {item.name}
                            </span>
                            {showSortNameUI && (
                              <span className="text-[11px] text-gray-400 mt-px">
                                {sortName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center align-middle text-[13px] text-gray-600">
                          {item.count}
                        </td>
                        <td className="p-2 text-center align-middle">
                          {!mergeMode && config?.allowDelete && (
                            <button 
                              onClick={(e) => handleDelete(item.id, e)}
                              className="bg-transparent border-none cursor-pointer text-red-500 text-lg p-0 leading-none flex items-center justify-center hover:text-red-600"
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
          <div className="px-4 py-3 border-t border-gray-200 bg-white rounded-b-lg h-[50px] flex items-center">
            {!mergeMode ? (
              <div className="w-full flex justify-end">
                {config?.allowMerge && (
                  <button
                    onClick={() => { setMergeMode(true); setSelectedItems(new Set()); }}
                    disabled={!selectedList}
                    className={`px-4 py-1.5 border-none rounded text-[13px] font-medium transition-colors ${
                      !selectedList 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-gray-200 text-gray-700 cursor-pointer hover:bg-gray-300'
                    }`}
                  >
                    Merge Mode
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full flex justify-between items-center">
                <span className="text-[13px] font-medium text-gray-500">
                  {selectedItems.size > 0 ? `${selectedItems.size} selected...` : 'Select items to merge...'}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setMergeMode(false); setSelectedItems(new Set()); }}
                    className="px-4 py-1.5 bg-gray-200 text-gray-700 border-none rounded text-[13px] font-medium cursor-pointer hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleOpenMergeModal}
                    disabled={selectedItems.size < 2}
                    className={`px-4 py-1.5 border-none rounded text-[13px] font-semibold text-white transition-colors ${
                      selectedItems.size >= 2 
                        ? 'bg-blue-500 cursor-pointer hover:bg-blue-600' 
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
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
          // The Sort Name Input is only shown if this list is configured for it
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
