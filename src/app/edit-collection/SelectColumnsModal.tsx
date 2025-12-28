// src/app/edit-collection/SelectColumnsModal.tsx
'use client';

import { useState } from 'react';

interface SelectColumnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialColumns: string[];
  onSave: (columns: string[], name?: string) => void;
}

const COLUMN_FIELDS = {
  Main: ['Artist', 'Artist Sort', 'Barcode', 'Cat No', 'Format', 'Genre', 'Label', 'Original Release Date', 'Original Release Year', 'Recording Date', 'Recording Year', 'Release Date', 'Release Year', 'Sort Title', 'Subtitle', 'Title'],
  Details: ['Box Set', 'Country', 'Extra', 'Is Live', 'Media Condition', 'Package/Sleeve Condition', 'Packaging', 'RPM', 'Sound', 'SPARS', 'Storage Device', 'Storage Device Slot', 'Studio', 'Vinyl Color', 'Vinyl Weight'],
  Edition: ['Discs', 'Length', 'Tracks'],
  Classical: ['Chorus', 'Composer', 'Composition', 'Conductor', 'Orchestra'],
  People: ['Engineer', 'Musician', 'Producer', 'Songwriter'],
  Personal: ['Added Date', 'Added Year', 'Collection Status', 'Current Value', 'Index', 'Last Cleaned Date', 'Last Cleaned Year', 'Last Played Date', 'Location', 'Modified Date', 'My Rating', 'Notes', 'Owner', 'Play Count', 'Played Year', 'Purchase Date', 'Purchase Price', 'Purchase Store', 'Purchase Year', 'Quantity', 'Signed by', 'Tags'],
  Loan: ['Due Date', 'Loan Date', 'Loaned To'],
};

export function SelectColumnsModal({ isOpen, onClose, initialColumns, onSave }: SelectColumnsModalProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(initialColumns);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Main']));
  const [favoriteName, setFavoriteName] = useState('');

  if (!isOpen) return null;

  const toggleCategory = (category: string) => {
    const next = new Set(expandedCategories);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    setExpandedCategories(next);
  };

  const toggleColumn = (column: string) => {
    if (selectedColumns.includes(column)) {
      setSelectedColumns(selectedColumns.filter(c => c !== column));
    } else {
      setSelectedColumns([...selectedColumns, column]);
    }
  };

  const handleSave = () => {
    onSave(selectedColumns, favoriteName || undefined);
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
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          width: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {/* Orange Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%)',
            color: 'white',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>Select Column Fields</div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              lineHeight: '1',
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto', background: 'white' }}>
          {/* Name field */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#1a1a1a' }}>
              Name
            </label>
            <input
              type="text"
              value={favoriteName}
              onChange={(e) => setFavoriteName(e.target.value)}
              placeholder="Save as favorite..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D8D8D8',
                borderRadius: '4px',
                fontSize: '14px',
                color: '#1a1a1a',
              }}
            />
          </div>

          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#1a1a1a' }}>
            Columns
          </div>

          <input
            type="text"
            placeholder="🔍"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #D8D8D8',
              borderRadius: '4px',
              marginBottom: '12px',
              fontSize: '14px',
              color: '#1a1a1a',
            }}
          />

          {Object.entries(COLUMN_FIELDS).map(([category, fields]) => (
            <div key={category} style={{ marginBottom: '8px' }}>
              <button
                onClick={() => toggleCategory(category)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#2A2A2A',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{category}</span>
                <span>{expandedCategories.has(category) ? '▼' : '▶'}</span>
              </button>
              {expandedCategories.has(category) && (
                <div style={{ padding: '8px 0' }}>
                  {fields
                    .filter(field => !searchQuery || field.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(field => (
                      <label
                        key={field}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#1a1a1a',
                          background: selectedColumns.includes(field) ? '#F0F0F0' : 'white',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(field)}
                          onChange={() => toggleColumn(field)}
                          style={{ marginRight: '10px' }}
                        />
                        {field}
                      </label>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #E8E8E8',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'white',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: 'white',
              color: '#1a1a1a',
              border: '1px solid #D8D8D8',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 20px',
              background: '#4FC3F7',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 500,
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