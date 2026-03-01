// src/components/ColumnSelector.tsx
'use client';

import { useState, useMemo, memo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
interface ColumnSelectorProps {
  visibleColumns: string[];
  onColumnsChange: (columns: string[]) => void;
  onClose: () => void;
  columnDefinitions: Record<string, { id: string; label: string }>;
  columnGroups: Array<{ id: string; label: string; icon: string; columns: string[] }>;
  defaultVisibleColumns: string[];
  selectedColumnsTitle?: string;
}

interface SortableItemProps {
  id: string;
  label: string;
  onRemove: (id: string) => void;
}

const SortableItem = memo(function SortableItem({ id, label, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          marginBottom: '4px',
          fontSize: '13px',
          color: '#333',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#999', cursor: 'grab' }}>☰</span>
          <span style={{ color: '#333' }}>{label}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
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
      </div>
    </div>
  );
});

const ColumnSelector = memo(function ColumnSelector({
  visibleColumns,
  onColumnsChange,
  onClose,
  columnDefinitions,
  columnGroups,
  defaultVisibleColumns,
  selectedColumnsTitle = 'My List View columns',
}: ColumnSelectorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(columnGroups.slice(0, 2).map((group) => group.id))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [tempVisibleColumns, setTempVisibleColumns] = useState<string[]>(visibleColumns);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
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

  const toggleColumn = (columnId: string) => {
    if (tempVisibleColumns.includes(columnId)) {
      setTempVisibleColumns(tempVisibleColumns.filter(id => id !== columnId));
    } else {
      setTempVisibleColumns([...tempVisibleColumns, columnId]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTempVisibleColumns((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = () => {
    onColumnsChange(tempVisibleColumns);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleReset = () => {
    setTempVisibleColumns([...defaultVisibleColumns]);
  };

  const currentlyVisible = useMemo(() => {
    return tempVisibleColumns
      .map(id => columnDefinitions[id])
      .filter(Boolean);
  }, [columnDefinitions, tempVisibleColumns]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return columnGroups;
    
    return columnGroups.map(group => {
      const filteredColumns = group.columns.filter(colId => {
        const col = columnDefinitions[colId];
        return col?.label.toLowerCase().includes(searchQuery.toLowerCase());
      });
      return filteredColumns.length > 0 ? { ...group, columns: filteredColumns } : null;
    }).filter(Boolean);
  }, [columnDefinitions, columnGroups, searchQuery]);

  return (
    <>
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

        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0
        }}>
          <div style={{
            flex: 1,
            borderRight: '1px solid #ddd',
            display: 'flex',
            flexDirection: 'column'
          }}>
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

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px'
            }}>
              {filteredGroups.map(group => {
                if (!group) return null;
                const groupColumns = group.columns
                  .map(colId => columnDefinitions[colId])
                  .filter(Boolean);
                const isExpanded = expandedGroups.has(group.id);

                return (
                  <div key={group.id} style={{ marginBottom: '4px' }}>
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

                    {isExpanded && (
                      <div style={{ paddingLeft: '28px', paddingTop: '4px' }}>
                        {groupColumns.map(col => {
                          if (!col) return null;
                          const isVisible = tempVisibleColumns.includes(col.id);
                          
                          return (
                            <label
                              key={col.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 8px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                color: '#333',
                                borderRadius: '3px',
                                marginBottom: '2px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f5f5f5';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isVisible}
                                onChange={() => toggleColumn(col.id)}
                                style={{ cursor: 'pointer' }}
                              />
                              <span style={{ color: '#333' }}>{col.label || col.id}</span>
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
                  ☰ {selectedColumnsTitle}
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
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={tempVisibleColumns}
                    strategy={verticalListSortingStrategy}
                  >
                    {currentlyVisible.map(col => {
                      if (!col) return null;
                      return (
                        <SortableItem
                          key={col.id}
                          id={col.id}
                          label={col.label || col.id}
                          onRemove={toggleColumn}
                        />
                      );
                    })}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>

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
});

export default ColumnSelector;
// AUDIT: inspected, no changes.
