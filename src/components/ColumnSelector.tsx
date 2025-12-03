// src/components/ColumnSelector.tsx
'use client';

import { useState } from 'react';
import { ColumnId, COLUMN_GROUPS, COLUMN_DEFINITIONS } from '../lib/collection-columns';

interface ColumnSelectorProps {
  visibleColumns: ColumnId[];
  onColumnsChange: (columns: ColumnId[]) => void;
  onClose: () => void;
}

export default function ColumnSelector({ visibleColumns, onColumnsChange, onClose }: ColumnSelectorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(COLUMN_GROUPS.map(g => g.id))
  );

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
    if (visibleColumns.includes(columnId)) {
      onColumnsChange(visibleColumns.filter(id => id !== columnId));
    } else {
      onColumnsChange([...visibleColumns, columnId]);
    }
  };

  const toggleGroupColumns = (groupId: string, show: boolean) => {
    const group = COLUMN_GROUPS.find(g => g.id === groupId);
    if (!group) return;

    if (show) {
      const newColumns = [...new Set([...visibleColumns, ...group.columns])];
      onColumnsChange(newColumns);
    } else {
      onColumnsChange(visibleColumns.filter(id => !group.columns.includes(id)));
    }
  };

  const showAllColumns = () => {
    onColumnsChange(COLUMN_DEFINITIONS.map(col => col.id));
  };

  const hideAllColumns = () => {
    onColumnsChange([]);
  };

  const resetToDefaults = () => {
    onColumnsChange(['image', 'artist', 'title', 'year', 'format', 'folder']);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        maxWidth: 900,
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          padding: 20,
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
              Select Columns
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0 0' }}>
              Choose which columns to display in the table view
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              color: '#6b7280',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap'
        }}>
          <button
            onClick={resetToDefaults}
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🔄 Reset to Defaults
          </button>
          <button
            onClick={showAllColumns}
            style={{
              padding: '8px 16px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ✓ Show All
          </button>
          <button
            onClick={hideAllColumns}
            style={{
              padding: '8px 16px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ✕ Hide All
          </button>
          <div style={{ marginLeft: 'auto', fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center' }}>
            <strong style={{ color: '#1f2937' }}>{visibleColumns.length}</strong>
            <span style={{ marginLeft: 4 }}>columns selected</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {COLUMN_GROUPS.map(group => {
            const groupColumns = group.columns.map(colId => COLUMN_DEFINITIONS.find(c => c.id === colId)).filter(Boolean);
            const visibleCount = groupColumns.filter(col => col && visibleColumns.includes(col.id)).length;
            const isExpanded = expandedGroups.has(group.id);

            return (
              <div key={group.id} style={{ marginBottom: 20 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                  padding: '8px 12px',
                  background: '#f9fafb',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
                onClick={() => toggleGroup(group.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{group.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#1f2937' }}>
                      {group.label}
                    </span>
                    <span style={{
                      fontSize: 12,
                      color: '#6b7280',
                      background: 'white',
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid #e5e7eb'
                    }}>
                      {visibleCount}/{groupColumns.length} visible
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroupColumns(group.id, true);
                      }}
                      style={{
                        padding: '4px 10px',
                        background: 'white',
                        color: group.color,
                        border: `1px solid ${group.color}`,
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Show All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroupColumns(group.id, false);
                      }}
                      style={{
                        padding: '4px 10px',
                        background: 'white',
                        color: '#6b7280',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Hide All
                    </button>
                    <span style={{ fontSize: 16, color: '#9ca3af' }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 8,
                    paddingLeft: 20
                  }}>
                    {groupColumns.map(col => {
                      if (!col) return null;
                      const isVisible = visibleColumns.includes(col.id);
                      return (
                        <label
                          key={col.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            background: isVisible ? `${group.color}15` : 'white',
                            border: `1px solid ${isVisible ? group.color : '#e5e7eb'}`,
                            borderRadius: 6,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => toggleColumn(col.id)}
                            style={{
                              width: 16,
                              height: 16,
                              cursor: 'pointer',
                              accentColor: group.color
                            }}
                          />
                          <span style={{
                            fontSize: 13,
                            color: isVisible ? '#1f2937' : '#6b7280',
                            fontWeight: isVisible ? 600 : 400
                          }}>
                            {col.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{
          padding: 20,
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          fontSize: 12,
          color: '#6b7280',
          textAlign: 'center'
        }}>
          Column preferences are saved automatically and will persist across sessions
        </div>
      </div>
    </div>
  );
}