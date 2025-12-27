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
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              outline: 'none',
              color: '#111827'
            }}
          />
          <button
            onClick={onNew}
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
            New {itemLabel}
          </button>
          <button
            onClick={onManage}
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
            Manage {itemLabel}s
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ width: '40px', padding: '8px' }}></th>
                <th 
                  style={{ 
                    padding: '8px 12px', 
                    textAlign: 'left', 
                    cursor: showSortName ? 'pointer' : 'default',
                    verticalAlign: 'top'
                  }}
                  onClick={showSortName ? handleSortToggle : undefined}
                >
                  {showSortName ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Name</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                        <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>Sort Name</span>
                        {sortBy === 'sortName' && (
                          <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                            {sortDirection === 'asc' ? '▼' : '▲'}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Name</span>
                  )}
                </th>
                <th style={{ width: '60px', padding: '8px 12px', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
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
                      style={{
                        backgroundColor: isSelected ? '#eff6ff' : (index % 2 === 0 ? 'white' : '#f9fafb'),
                        borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer'
                      }}
                    >
                      <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <input
                          type={mode === 'single' ? 'radio' : 'checkbox'}
                          checked={isSelected}
                          onChange={() => handleSelectionChange(item.id)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            margin: 0,
                          }}
                          onClick={(e) => e.stopPropagation()} 
                        />
                      </td>
                      <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                        {showSortName ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '13px', color: '#111827', fontWeight: '500' }}>
                              {item.name}
                            </span>
                            <span style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                              {sortName}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#111827', fontWeight: '500' }}>
                            {item.name}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', verticalAlign: 'middle', fontSize: '13px', color: '#4b5563' }}>
                        {item.count}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            backgroundColor: 'white'
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
  );
}