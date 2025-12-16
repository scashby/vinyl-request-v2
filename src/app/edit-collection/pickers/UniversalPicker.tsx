// src/app/edit-collection/pickers/UniversalPicker.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { PickerModal } from './PickerModal';
import { ManageModal } from './ManageModal';
import { EditModal } from './EditModal';
import { MergeModal } from './MergeModal';
import type { PickerDataItem } from './pickerDataUtils';

interface UniversalPickerProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  fetchItems: () => Promise<PickerDataItem[]>;
  selectedItems: string[];
  onSelect: (items: string[]) => void;
  multiSelect: boolean;
  canManage: boolean;
  onUpdate?: (id: string, newName: string) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
  onMerge?: (targetId: string, sourceIds: string[]) => Promise<boolean>;
  newItemLabel: string;
  manageItemsLabel: string;
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
  onUpdate,
  onDelete,
  onMerge,
  newItemLabel,
  manageItemsLabel,
}: UniversalPickerProps) {
  const [items, setItems] = useState<PickerDataItem[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; name: string } | null>(null);
  const [mergingItems, setMergingItems] = useState<PickerDataItem[]>([]);

  const loadItems = useCallback(async () => {
    const fetchedItems = await fetchItems();
    setItems(fetchedItems);
  }, [fetchItems]);

  // Load items when picker opens
  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, loadItems]);

  const handleManageClick = () => {
    setShowManage(true);
  };

  const handleNewClick = () => {
    setShowNew(true);
  };

  const handleEditClick = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setEditingItem({ id: item.id, name: item.name });
      setShowEdit(true);
    }
  };

  const handleDeleteClick = async (itemId: string) => {
    if (onDelete) {
      const success = await onDelete(itemId);
      if (success) {
        await loadItems();
      }
    }
  };

  const handleMergeClick = (itemIds: string[]) => {
    const itemsToMerge = items.filter(item => itemIds.includes(item.id));
    setMergingItems(itemsToMerge);
    setShowMerge(true);
    setShowManage(false);
  };

  const handleSaveEdit = async (newName: string) => {
    if (editingItem && onUpdate) {
      const success = await onUpdate(editingItem.id, newName);
      if (success) {
        await loadItems();
      }
    }
    setShowEdit(false);
    setEditingItem(null);
  };

  const handleSaveNew = async (newName: string) => {
    // For creating new items, we use the update function with the new name as both id and name
    // This works because the backend will see it doesn't exist and create it
    if (onUpdate) {
      const success = await onUpdate(newName, newName);
      if (success) {
        await loadItems();
        // Auto-select the new item
        if (multiSelect) {
          onSelect([...selectedItems, newName]);
        } else {
          onSelect([newName]);
        }
      }
    }
    setShowNew(false);
  };

  const handleMergeConfirm = async (primaryId: string, mergeIntoIds: string[]) => {
    if (onMerge) {
      const success = await onMerge(primaryId, mergeIntoIds);
      if (success) {
        await loadItems();
        // Update selection if any merged items were selected
        const newSelection = selectedItems.filter(id => !mergeIntoIds.includes(id));
        if (selectedItems.some(id => mergeIntoIds.includes(id)) && !newSelection.includes(primaryId)) {
          newSelection.push(primaryId);
        }
        if (newSelection.length !== selectedItems.length) {
          onSelect(newSelection);
        }
      }
    }
    setShowMerge(false);
    setMergingItems([]);
  };

  const handleSelect = (selectedIds: string | string[]) => {
    const idsArray = Array.isArray(selectedIds) ? selectedIds : [selectedIds];
    onSelect(idsArray);
  };

  // Convert selectedItems to the format PickerModal expects
  const selectedIdsForPicker = multiSelect ? selectedItems : (selectedItems[0] || '');

  return (
    <>
      <PickerModal
        isOpen={isOpen && !showManage}
        onClose={onClose}
        title={title}
        mode={multiSelect ? 'multi' : 'single'}
        items={items}
        selectedIds={selectedIdsForPicker}
        onSave={handleSelect}
        onManage={handleManageClick}
        onNew={handleNewClick}
        searchPlaceholder={`Search ${newItemLabel}s...`}
        itemLabel={newItemLabel}
      />

      {showManage && canManage && (
        <ManageModal
          isOpen={showManage}
          onClose={() => setShowManage(false)}
          title={manageItemsLabel}
          items={items}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onMerge={handleMergeClick}
          itemLabel={newItemLabel}
          allowMerge={!!onMerge}
        />
      )}

      {showEdit && editingItem && (
        <EditModal
          isOpen={showEdit}
          onClose={() => {
            setShowEdit(false);
            setEditingItem(null);
          }}
          title={`Edit ${newItemLabel}`}
          itemName={editingItem.name}
          onSave={handleSaveEdit}
          itemLabel={newItemLabel}
        />
      )}

      {showNew && (
        <EditModal
          isOpen={showNew}
          onClose={() => setShowNew(false)}
          title={`New ${newItemLabel}`}
          itemName=""
          onSave={handleSaveNew}
          itemLabel={newItemLabel}
        />
      )}

      {showMerge && mergingItems.length > 0 && (
        <MergeModal
          isOpen={showMerge}
          onClose={() => {
            setShowMerge(false);
            setMergingItems([]);
          }}
          title={`Merge ${newItemLabel}s`}
          items={mergingItems}
          onMerge={handleMergeConfirm}
          itemLabel={newItemLabel}
        />
      )}
    </>
  );
}