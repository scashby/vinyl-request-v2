// src/app/edit-collection/pickers/PickerModal.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

interface PickerItem {
  id: string;
  name: string;
  count?: number;
  sortName?: string;
}

interface PickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  mode: 'single' | 'multi';
  items: PickerItem[];
  selectedIds: string | string[];
  onSave: (selectedIds: string | string[]) => void;
  onManage: () => void;
  onNew: () => void;
  searchPlaceholder?: string;
  itemLabel?: string;
  showSortName?: boolean; // NEW: Control whether to show sort names
}

export function PickerModal({
  isOpen,
  onClose,
  title,
  mode,
  items,
  selectedIds,
  onSave,
  onManage,
  onNew,
  searchPlaceholder = 'Search...',
  itemLabel = 'Item',
  showSortName = false, // NEW: Default to false (simple picklists)
}: PickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedIds, setLocalSelectedIds] = useState<string | string[]>(selectedIds);
  const [sortBy, setSortBy] = useState<'name' | 'sortName'>('sortName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    setLocalSelectedIds(selectedIds);
  }, [selectedIds, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSortBy('sortName');
      setSortDirection('asc');
    }
  }, [isOpen]);

  const getSortName = useCallback((name: string) => {
    if (name.startsWith('The ')) return name.substring(4) + ', The';
    if (name.startsWith('A ')) return name.substring(2) + ', A';
    return name;
  }, []);

  const handleSortToggle = () => {
    if (sortBy === 'sortName') {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('sortName');
      setSortDirection('asc');
    }
  };

  const filteredItems = useMemo(() => {
    const result = items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return result.sort((a, b) => {
      const nameA = sortBy === 'sortName' ? (a.sortName || getSortName(a.name)) : a.name;
      const nameB = sortBy === 'sortName' ? (b.sortName || getSortName(b.name)) : b.name;
      
      const comparison = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [items, searchQuery, sortBy, sortDirection, getSortName]);

  if (!isOpen) return null;

  const handleSelectionChange = (itemId: string) => {
    if (mode === 'single') {
      setLocalSelectedIds(itemId);
    } else {
      const currentIds = Array.isArray(localSelectedIds) ? localSelectedIds : [];
      if (currentIds.includes(itemId)) {
        setLocalSelectedIds(currentIds.filter(id => id !== itemId));
      } else {
        setLocalSelectedIds([...currentIds, itemId]);
      }
    }
  };

  const handleSave = () => {
    onSave(localSelectedIds);
    onClose();
  };

  const handleCancel = () => {
    setLocalSelectedIds(selectedIds);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30001] p-4"
      onClick={handleCancel}
    >
      <div
        className="bg-white rounded-lg w-full max-w-[500px] h-[600px] max-h-[90vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-orange-500">
          <h3 className="m-0 text-base font-semibold text-white">
            {title}
          </h3>
          <button
            onClick={handleCancel}
            className="bg-transparent border-none text-white text-xl cursor-pointer p-1 leading-none hover:text-white/80"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-3 border-b border-gray-200 flex gap-2 items-center bg-white">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-[13px] outline-none text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={onNew}
            className="px-3 py-1.5 bg-blue-500 text-white border-none rounded text-[13px] font-medium cursor-pointer whitespace-nowrap hover:bg-blue-600"
          >
            New {itemLabel}
          </button>
          <button
            onClick={onManage}
            className="px-3 py-1.5 bg-gray-500 text-white border-none rounded text-[13px] font-medium cursor-pointer whitespace-nowrap hover:bg-gray-600"
          >
            Manage {itemLabel}s
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="border-b border-gray-200 bg-white sticky top-0 z-10">
                <th className="w-10 p-2"></th>
                <th 
                  className={`px-3 py-2 text-left align-top ${showSortName ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}
                  onClick={showSortName ? handleSortToggle : undefined}
                >
                  {showSortName ? (
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-gray-500">Name</span>
                      <div className="flex items-center gap-1 mt-px">
                        <span className="text-[11px] font-normal text-gray-400">Sort Name</span>
                        {sortBy === 'sortName' && (
                          <span className="text-[10px] text-gray-400">
                            {sortDirection === 'asc' ? '▼' : '▲'}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-gray-500">Name</span>
                  )}
                </th>
                <th className="w-[60px] px-3 py-2 text-center align-middle text-xs font-semibold text-gray-500">
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-gray-400 text-[13px]">
                    {searchQuery ? 'No items match your search' : 'No items available'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const isSelected =
                    mode === 'single'
                      ? localSelectedIds === item.id
                      : Array.isArray(localSelectedIds) && localSelectedIds.includes(item.id);
                  
                  const sortName = item.sortName || getSortName(item.name);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleSelectionChange(item.id)}
                      className={`border-b border-gray-50 cursor-pointer ${
                        isSelected ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <td className="p-2 text-center align-middle">
                        <input
                          type={mode === 'single' ? 'radio' : 'checkbox'}
                          checked={isSelected}
                          onChange={() => handleSelectionChange(item.id)}
                          className="w-4 h-4 cursor-pointer m-0 align-middle"
                          onClick={(e) => e.stopPropagation()} 
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {showSortName ? (
                          <div className="flex flex-col">
                            <span className="text-[13px] font-medium text-gray-900">
                              {item.name}
                            </span>
                            <span className="text-[11px] text-gray-400 mt-px">
                              {sortName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[13px] font-medium text-gray-900">
                            {item.name}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center align-middle text-[13px] text-gray-600">
                        {item.count}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 bg-white">
          <button
            onClick={handleCancel}
            className="px-4 py-1.5 bg-gray-200 text-gray-700 border-none rounded text-[13px] font-medium cursor-pointer hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-blue-500 text-white border-none rounded text-[13px] font-semibold cursor-pointer hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
// AUDIT: inspected, no changes.
