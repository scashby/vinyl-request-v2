// src/components/ColumnSelector.tsx
'use client';

import { useState } from 'react';
import { ColumnId, COLUMN_DEFINITIONS, COLUMN_GROUPS, canHideColumn } from '../app/edit-collection/columnDefinitions';

interface ColumnSelectorProps {
  visibleColumns: ColumnId[];
  onColumnsChange: (columns: ColumnId[]) => void;
  onClose: () => void;
}

export default function ColumnSelector({ visibleColumns, onColumnsChange, onClose }: ColumnSelectorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['main', 'details', 'edition']) // Main groups expanded by default
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [tempVisibleColumns, setTempVisibleColumns] = useState<ColumnId[]>(visibleColumns);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleColumn = (columnId: ColumnId) => {
    if (!canHideColumn(columnId)) return;
    
    if (tempVisibleColumns.includes(columnId)) {
      setTempVisibleColumns(tempVisibleColumns.filter(id => id !== columnId));
    } else {
      setTempVisibleColumns([...tempVisibleColumns, columnId]);
    }
  };

  const handleSave = () => {
    onColumnsChange(tempVisibleColumns);
    onClose();
  };

  const handleCancel = () => {
    setTempVisibleColumns(visibleColumns);
    onClose();
  };

  const handleReset = () => {
    // Reset to all 14 default columns
    const defaultCols: ColumnId[] = [
      'checkbox', 'owned', 'for_sale', 'image',
      'artist', 'title', 'release_date', 'format',
      'discs', 'tracks', 'length', 'genre', 'label', 'added_date'
    ];
    setTempVisibleColumns(defaultCols);
  };

  // Get currently visible column definitions for right panel
  const currentlyVisible = tempVisibleColumns
    .map(id => COLUMN_DEFINITIONS[id])
    .filter(Boolean);

  // Filter groups by search query
  const filteredGroups = searchQuery 
    ? COLUMN_GROUPS.map(group => {
        const filteredColumns = group.columns.filter(colId => {
          const col = COLUMN_DEFINITIONS[colId];
          return col?.label.toLowerCase().includes(searchQuery.toLowerCase());
        });
        return filteredColumns.length > 0 ? { ...group, columns: filteredColumns } : null;
      }).filter(Boolean)
    : COLUMN_GROUPS;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleCancel}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'white',
        borderRadius: '8px',
        width: '900px',
        maxHeight: '80vh',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
      }}>
        {/* Header - CLZ Orange */}
        <div style={{
          background: '#FF8C42',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            Select Column Fields
          </h3>
          <button
            onClick={handleCancel}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: '1'
            }}
          >
            ×
          </button>
        </div>

        {/* Body - Two Panel Layout */}
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0
        }}>
          {/* Left Panel: Available Columns */}
          <div style={{
            flex: 1,
            borderRight: '1px solid #ddd',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Search */}
            <div style={{ padding: '16px', borderBottom: '1px solid #ddd' }}>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#999',
                  fontSize: '14px'
                }}>
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Search columns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Group List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px'
            }}>
              {filteredGroups.map(group => {
                if (!group) return null;
                const groupColumns = group.columns
                  .map(colId => COLUMN_DEFINITIONS[colId])
                  .filter(Boolean);
                const isExpanded = expandedGroups.has(group.id);

                return (
                  <div key={group.id} style={{ marginBottom: '4px' }}>
                    {/* Group Header */}
                    <button
                      onClick={() => toggleGroup(group.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: isExpanded ? '#2C2C2C' : '#3a3a3a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ 
                        fontSize: '10px',
                        transition: 'transform 0.2s',
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                      }}>
                        ▶
                      </span>
                      <span>{group.icon}</span>
                      <span>{group.label}</span>
                    </button>

                    {/* Column Checkboxes */}
                    {isExpanded && (
                      <div style={{ paddingLeft: '28px', paddingTop: '4px' }}>
                        {groupColumns.map(col => {
                          if (!col) return null;
                          const isVisible = tempVisibleColumns.includes(col.id);
                          const isDisabled = !canHideColumn(col.id);
                          
                          return (
                            <label
                              key={col.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 8px',
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                fontSize: '13px',
                                borderRadius: '3px',
                                marginBottom: '2px',
                                opacity: isDisabled ? 0.6 : 1
                              }}
                              onMouseEnter={(e) => {
                                if (!isDisabled) {
                                  e.currentTarget.style.background = '#f5f5f5';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isVisible}
                                onChange={() => toggleColumn(col.id)}
                                disabled={isDisabled}
                                style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                              />
                              <span>{col.label}</span>
                              {isDisabled && <span style={{ fontSize: '11px', color: '#999' }}>(always visible)</span>}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Currently Visible Columns */}
          <div style={{
            width: '300px',
            background: '#fafafa',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #ddd',
              background: 'white'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>
                  ☰ My List View columns
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {currentlyVisible.length} columns selected
              </div>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px'
            }}>
              {currentlyVisible.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: '#999',
                  fontSize: '13px',
                  padding: '20px'
                }}>
                  No columns selected
                </div>
              ) : (
                currentlyVisible.map(col => {
                  if (!col) return null;
                  const isRemovable = canHideColumn(col.id);
                  
                  return (
                    <div
                      key={col.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'white',
                        border: '1px solid #e0e0e0',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>☰</span>
                        <span>{col.label}</span>
                        {!isRemovable && <span style={{ fontSize: '11px', color: '#999' }}>(locked)</span>}
                      </div>
                      {isRemovable && (
                        <button
                          onClick={() => toggleColumn(col.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#999',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '0 4px',
                            lineHeight: '1'
                          }}
                          title="Remove column"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #ddd',
          background: '#fafafa',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={handleReset}
            style={{
              padding: '8px 16px',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#666'
            }}
          >
            Reset to Default
          </button>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '8px 20px',
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#666'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 20px',
                background: '#5BA3D0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'white',
                fontWeight: 500
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}