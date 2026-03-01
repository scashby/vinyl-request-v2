'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SortField } from './ManageSortFavoritesModal';

interface SortSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  favoriteName: string;
  fields: SortField[];
  sortFields: Record<string, string[]>;
  onSave: (fields: SortField[]) => void;
}

export default function SortSelectorModal({
  isOpen,
  onClose,
  favoriteName,
  fields,
  sortFields,
  onSave,
}: SortSelectorModalProps) {
  const [selectedFields, setSelectedFields] = useState<SortField[]>(fields);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Main']));

  const firstGroup = useMemo(() => Object.keys(sortFields)[0] ?? 'Main', [sortFields]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedFields(fields);
    setSearchQuery('');
    setExpandedGroups(new Set([firstGroup]));
  }, [fields, firstGroup, isOpen]);

  if (!isOpen) return null;

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleField = (field: string) => {
    const existing = selectedFields.find((item) => item.field === field);
    if (existing) {
      setSelectedFields((prev) => prev.filter((item) => item.field !== field));
      return;
    }
    setSelectedFields((prev) => [...prev, { field, direction: 'asc' }]);
  };

  const toggleDirection = (field: string) => {
    setSelectedFields((prev) =>
      prev.map((item) =>
        item.field === field
          ? { ...item, direction: item.direction === 'asc' ? 'desc' : 'asc' }
          : item
      )
    );
  };

  const removeField = (field: string) => {
    setSelectedFields((prev) => prev.filter((item) => item.field !== field));
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/60 z-[31000]" />
      <div
        onClick={(event) => event.stopPropagation()}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-md shadow-xl z-[31001] w-full max-w-[900px] max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="bg-[#FF8C42] text-white px-4 py-3 rounded-t-md flex justify-between items-center shrink-0">
          <h2 className="m-0 text-base font-semibold">Select Sort Fields</h2>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-white text-2xl cursor-pointer p-1 leading-none hover:text-white/80"
          >
            ×
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 shrink-0">
          <h3 className="m-0 text-xl font-semibold text-gray-800">
            {favoriteName.trim() || '— Select one or more fields —'}
          </h3>
        </div>

        <div className="flex-1 flex gap-3 p-3 overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto pr-3 border-r border-gray-200">
            <input
              type="text"
              placeholder="Search fields..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full mb-2 px-2.5 py-1.5 border border-gray-200 rounded text-[13px] text-gray-900 outline-none focus:border-blue-400 transition-colors"
            />

            {Object.entries(sortFields).map(([groupName, groupFields]) => {
              const isExpanded = expandedGroups.has(groupName);
              const filteredFields = searchQuery
                ? groupFields.filter((field) => field.toLowerCase().includes(searchQuery.toLowerCase()))
                : groupFields;

              if (filteredFields.length === 0) return null;

              return (
                <div key={groupName} className="mb-1">
                  <button
                    onClick={() => toggleGroup(groupName)}
                    className="w-full flex items-center gap-2 p-2 bg-[#2C2C2C] text-white border-none rounded cursor-pointer text-[13px] font-semibold text-left hover:bg-[#3a3a3a]"
                  >
                    <span className={`text-[10px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                      ▶
                    </span>
                    <span>{groupName}</span>
                  </button>

                  {isExpanded && (
                    <div className="pl-3 pt-1">
                      {filteredFields.map((field) => {
                        const isSelected = selectedFields.some((item) => item.field === field);
                        return (
                          <label
                            key={field}
                            className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer text-[13px] rounded mb-0.5 text-gray-900 transition-colors ${
                              isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleField(field)}
                              className="cursor-pointer accent-blue-500"
                            />
                            <span>{field}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="w-[280px] flex flex-col min-h-0">
            <div className="text-[13px] font-semibold mb-2 text-gray-800">
              Selected Fields ({selectedFields.length})
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-md p-2 min-h-0">
              {selectedFields.map((sortField) => (
                <div
                  key={sortField.field}
                  className="flex items-center gap-2 mb-1.5 p-2 bg-white rounded border border-gray-200 shadow-sm"
                >
                  <span className="text-base text-gray-400">☰</span>
                  <span className="flex-1 text-[13px] text-gray-900">{sortField.field}</span>
                  <button
                    onClick={() => toggleDirection(sortField.field)}
                    className="px-2 py-1 bg-blue-600 text-white border-none rounded text-[10px] font-bold cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    {sortField.direction.toUpperCase()}
                  </button>
                  <button
                    onClick={() => removeField(sortField.field)}
                    className="bg-transparent border-none text-gray-400 text-xl cursor-pointer leading-none p-0 hover:text-red-500 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 border border-gray-200 rounded text-[13px] cursor-pointer text-gray-800 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(selectedFields)}
            className="px-4 py-2 bg-[#5BA3D0] text-white border-none rounded text-[13px] font-semibold cursor-pointer hover:bg-[#4a8eb8] transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}
