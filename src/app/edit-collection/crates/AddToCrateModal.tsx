// src/app/edit-collection/crates/AddToCrateModal.tsx
'use client';

import { useState, useEffect } from 'react';
import type { Crate } from '../../../types/crate';

interface AddToCrateModalProps {
  isOpen: boolean;
  onClose: () => void;
  crates: Crate[];
  onAddToCrates: (crateIds: number[]) => Promise<void>;
  selectedCount: number;
}

export function AddToCrateModal({
  isOpen,
  onClose,
  crates,
  onAddToCrates,
  selectedCount,
}: AddToCrateModalProps) {
  const [selectedCrateIds, setSelectedCrateIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCrateIds([]);
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter to manual crates only (smart crates auto-populate)
  const manualCrates = crates.filter(crate => !crate.is_smart);

  // Filter by search query
  const filteredCrates = manualCrates.filter(crate =>
    crate.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleCrate = (crateId: number) => {
    if (selectedCrateIds.includes(crateId)) {
      setSelectedCrateIds(selectedCrateIds.filter(id => id !== crateId));
    } else {
      setSelectedCrateIds([...selectedCrateIds, crateId]);
    }
  };

  const handleSave = async () => {
    if (selectedCrateIds.length === 0) return;
    
    setSaving(true);
    try {
      await onAddToCrates(selectedCrateIds);
      onClose();
    } catch (error) {
      console.error('Failed to add to crates:', error);
      alert('Failed to add albums to crates. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
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
          maxHeight: '600px',
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
            backgroundColor: 'white',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
            Add {selectedCount} Album{selectedCount !== 1 ? 's' : ''} to Crate
          </h3>
          <button
            onClick={handleCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6b7280',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: '1',
            }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <input
            type="text"
            placeholder="Search crates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {/* Crates List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 16px',
          }}
        >
          {filteredCrates.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '13px',
              }}
            >
              {searchQuery 
                ? 'No crates match your search' 
                : manualCrates.length === 0
                  ? 'No manual crates available. Smart crates auto-populate based on rules.'
                  : 'No crates available'}
            </div>
          ) : (
            filteredCrates.map((crate) => {
              const isSelected = selectedCrateIds.includes(crate.id);

              return (
                <label
                  key={crate.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    borderRadius: '3px',
                    marginBottom: '1px',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleCrate(crate.id)}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        margin: 0,
                      }}
                    />
                    <span style={{ fontSize: '13px', color: '#111827' }}>
                      {crate.icon} {crate.name}
                    </span>
                  </div>
                  {crate.album_count !== undefined && (
                    <span
                      style={{
                        fontSize: '13px',
                        color: '#6b7280',
                        fontWeight: '400',
                      }}
                    >
                      {crate.album_count}
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '13px', color: '#6b7280' }}>
            {selectedCrateIds.length} crate{selectedCrateIds.length !== 1 ? 's' : ''} selected
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCancel}
              disabled={saving}
              style={{
                padding: '6px 16px',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={selectedCrateIds.length === 0 || saving}
              style={{
                padding: '6px 16px',
                background: selectedCrateIds.length > 0 && !saving ? '#3b82f6' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: selectedCrateIds.length > 0 && !saving ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? 'Adding...' : 'Add to Crates'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}