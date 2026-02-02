// src/app/edit-collection/pickers/UniversalPicker.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ManageModal } from './ManageModal';
import { EditModal } from './EditModal';
import { MergeModal } from './MergeModal';

interface UniversalPickerItem {
  id: string;
  name: string;
  count?: number;
  sortName?: string;
  defaultInstrument?: string;
}

interface UniversalPickerProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  fetchItems: () => Promise<UniversalPickerItem[]>;
  selectedItems: string[];
  onSelect: (selectedItems: string[]) => void;
  multiSelect: boolean;
  canManage: boolean;
  onUpdate?: (id: string, name: string, sortName?: string, defaultInstrument?: string) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
  onMerge?: (sourceIds: string[], targetId: string) => Promise<boolean>;
  newItemLabel?: string;
  manageItemsLabel?: string;
  showSortName?: boolean; // NEW: Show sort name fields
  showDefaultInstrument?: boolean; // NEW: Show default instrument field (for musicians)
}

export function UniversalPicker({
  title,
  isOpen,
  onClose,
  fetchItems,
  selectedItems,
  onSelect,
  multiSelect,
  canManage,
  newItemLabel = 'Item',
  manageItemsLabel = 'Manage Items',
  showSortName = false,
  showDefaultInstrument = false,
}: UniversalPickerProps) {
  const [items, setItems] = useState<UniversalPickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedItems, setLocalSelectedItems] = useState<string[]>(selectedItems);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<UniversalPickerItem | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeCandidates, setMergeCandidates] = useState<UniversalPickerItem[]>([]);
  
  // New item form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemSortName, setNewItemSortName] = useState('');
  const [newItemDefaultInstrument, setNewItemDefaultInstrument] = useState('');

  // Load items on mount
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchItems();
      setItems(data);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchItems]);

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, loadItems]);

  // Update local selection when props change
  useEffect(() => {
    setLocalSelectedItems(selectedItems);
  }, [selectedItems]);

  const getSortName = (name: string) => {
    if (name.startsWith('The ')) return name.substring(4) + ', The';
    if (name.startsWith('A ')) return name.substring(2) + ', A';
    return name;
  };

  const filteredItems = useMemo(() => {
    return items
      .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        const nameA = showSortName ? (a.sortName || getSortName(a.name)) : a.name;
        const nameB = showSortName ? (b.sortName || getSortName(b.name)) : b.name;
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      });
  }, [items, searchQuery, showSortName]);

  if (!isOpen) return null;

  const handleToggleItem = (itemName: string) => {
    if (multiSelect) {
      if (localSelectedItems.includes(itemName)) {
        setLocalSelectedItems(localSelectedItems.filter(name => name !== itemName));
      } else {
        setLocalSelectedItems([...localSelectedItems, itemName]);
      }
    } else {
      setLocalSelectedItems([itemName]);
    }
  };

  const handleSave = () => {
    onSelect(localSelectedItems);
    onClose();
  };

  const handleCancel = () => {
    setLocalSelectedItems(selectedItems);
    onClose();
  };

  const handleOpenNewModal = () => {
    setNewItemName('');
    setNewItemSortName('');
    setNewItemDefaultInstrument('');
    setShowNewModal(true);
  };

  const handleOpenManageModal = () => {
    setShowManageModal(true);
  };

  const handleEditItem = (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    setEditingItem(item);
    setShowManageModal(false);
    setShowEditModal(true);
  };

  const handleSaveEditItem = async (newName: string, newSortName?: string) => {
    if (!editingItem) return;
    const updateFn = onUpdate;
    let success = true;
    if (updateFn) {
      success = await updateFn(editingItem.id, newName, newSortName, editingItem.defaultInstrument);
    }
    if (!success) return;

    setItems((prev) =>
      prev.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              id: newName,
              name: newName,
              sortName: showSortName ? (newSortName || getSortName(newName)) : item.sortName,
            }
          : item
      )
    );

    setLocalSelectedItems((prev) =>
      prev.map((name) => (name === editingItem.name ? newName : name))
    );

    setShowEditModal(false);
    setEditingItem(null);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!onDelete) return;
    const success = await onDelete(itemId);
    if (!success) return;
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    setLocalSelectedItems((prev) => prev.filter((name) => name !== itemId));
  };

  const handleStartMerge = (itemIds: string[]) => {
    const candidates = items.filter((item) => itemIds.includes(item.id));
    if (candidates.length < 2) return;
    setMergeCandidates(candidates);
    setShowManageModal(false);
    setShowMergeModal(true);
  };

  const handleMergeItems = async (primaryId: string, mergeIntoIds: string[]) => {
    if (!onMerge) return;
    const success = await onMerge(mergeIntoIds, primaryId);
    if (!success) return;
    const totalCount = mergeCandidates.reduce((sum, item) => sum + (item.count ?? 0), 0);
    setItems((prev) =>
      prev
        .filter((item) => !mergeIntoIds.includes(item.id))
        .map((item) =>
          item.id === primaryId ? { ...item, count: totalCount } : item
        )
    );
    setLocalSelectedItems((prev) => {
      const next = prev.map((name) => (mergeIntoIds.includes(name) ? primaryId : name));
      return Array.from(new Set(next));
    });
    setShowMergeModal(false);
    setMergeCandidates([]);
  };

  const handleSaveNewItem = () => {
    if (!newItemName.trim()) return;

    // Create new item locally
    const newItem: UniversalPickerItem = {
      id: newItemName,
      name: newItemName,
      count: 0,
      sortName: showSortName ? (newItemSortName || getSortName(newItemName)) : undefined,
      defaultInstrument: showDefaultInstrument ? newItemDefaultInstrument : undefined,
    };

    setItems([...items, newItem].sort((a, b) => a.name.localeCompare(b.name)));
    
    // Add to selection
    if (multiSelect) {
      setLocalSelectedItems([...localSelectedItems, newItemName]);
    } else {
      setLocalSelectedItems([newItemName]);
    }

    setShowNewModal(false);
    setNewItemName('');
    setNewItemSortName('');
    setNewItemDefaultInstrument('');
  };

  return (
    <>
      {/* Main Picker Modal */}
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
        onClick={handleCancel}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '6px',
            width: '500px',
            height: '600px',
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
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f97316',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'white' }}>
              {title}
            </h3>
            <button
              onClick={handleCancel}
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

          {/* Search and Actions */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              backgroundColor: 'white',
            }}
          >
            <input
              type="text"
              placeholder={`Search ${newItemLabel}s...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '13px',
                outline: 'none',
                color: '#111827',
              }}
            />
            <button
              onClick={handleOpenNewModal}
              style={{
                padding: '6px 12px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              New {newItemLabel}
            </button>
            {canManage && (
              <button
                onClick={handleOpenManageModal}
                style={{
                  padding: '6px 12px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {manageItemsLabel}
              </button>
            )}
          </div>

          {/* Items List */}
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'white' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                Loading...
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                No items available
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
                    <th style={{ width: '40px', padding: '8px' }}></th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                      Name
                    </th>
                    <th style={{ width: '60px', padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => {
                    const isSelected = localSelectedItems.includes(item.name);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleToggleItem(item.name)}
                        style={{
                          backgroundColor: isSelected ? '#eff6ff' : (index % 2 === 0 ? 'white' : '#f9fafb'),
                          borderBottom: '1px solid #f3f4f6',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <input
                            type={multiSelect ? 'checkbox' : 'radio'}
                            checked={isSelected}
                            onChange={() => handleToggleItem(item.name)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '13px', color: '#111827', fontWeight: '500' }}>
                          {item.name}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '13px', color: '#4b5563' }}>
                          {item.count || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              backgroundColor: 'white',
            }}
          >
            <button
              onClick={handleCancel}
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
              onClick={handleSave}
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

      {/* New Item Modal */}
      {showNewModal && (
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
          onClick={() => setShowNewModal(false)}
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
            {/* Header */}
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#f97316',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                New {newItemLabel}
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
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
              {/* Name */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#6b7280',
                    marginBottom: '6px',
                  }}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={`Enter ${newItemLabel.toLowerCase()} name`}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#111827',
                  }}
                />
              </div>

              {/* Sort Name */}
              {showSortName && (
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#6b7280',
                      marginBottom: '6px',
                    }}
                  >
                    Sort Name
                  </label>
                  <input
                    type="text"
                    value={newItemSortName}
                    onChange={(e) => setNewItemSortName(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px',
                      color: '#111827',
                    }}
                  />
                </div>
              )}

              {/* Default Instrument */}
              {showDefaultInstrument && (
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#6b7280',
                      marginBottom: '6px',
                    }}
                  >
                    Default Instrument
                  </label>
                  <input
                    type="text"
                    value={newItemDefaultInstrument}
                    onChange={(e) => setNewItemDefaultInstrument(e.target.value)}
                    placeholder="Enter instrument"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px',
                      color: '#111827',
                    }}
                  />
                </div>
              )}
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
                onClick={() => setShowNewModal(false)}
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
                onClick={handleSaveNewItem}
                disabled={!newItemName.trim()}
                style={{
                  padding: '6px 16px',
                  background: newItemName.trim() ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: newItemName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showManageModal && (
        <ManageModal
          isOpen={true}
          onClose={() => setShowManageModal(false)}
          title={manageItemsLabel}
          items={items}
          onEdit={handleEditItem}
          onDelete={handleDeleteItem}
          onMerge={handleStartMerge}
          itemLabel={newItemLabel}
          allowMerge={Boolean(onMerge)}
        />
      )}

      {showEditModal && editingItem && (
        <EditModal
          isOpen={true}
          onClose={() => {
            setShowEditModal(false);
            setEditingItem(null);
          }}
          title={`Edit ${newItemLabel}`}
          itemName={editingItem.name}
          itemSortName={editingItem.sortName}
          onSave={handleSaveEditItem}
          itemLabel={newItemLabel}
          showSortName={showSortName}
        />
      )}

      {showMergeModal && (
        <MergeModal
          isOpen={true}
          onClose={() => {
            setShowMergeModal(false);
            setMergeCandidates([]);
          }}
          title={`Merge ${newItemLabel}s`}
          items={mergeCandidates}
          onMerge={handleMergeItems}
          itemLabel={newItemLabel}
        />
      )}
    </>
  );
}
