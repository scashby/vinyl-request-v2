// src/app/edit-collection/enrichment/FindCoverModal.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface FindCoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
  defaultQuery: string;
}

export function FindCoverModal({ isOpen, onClose, onSelectImage, defaultQuery }: FindCoverModalProps) {
  const [searchQuery, setSearchQuery] = useState(defaultQuery);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  
  // In real implementation, these would come from an API
  const availableFilters = [
    defaultQuery.split(' ')[0], // Album name
    'Source Tags & Codes',
    '606949323622'
  ];

  // Placeholder results - in real implementation, fetch from image search API
  const searchResults = [
    { url: '/api/placeholder/600/600', size: '600 x 600' },
    { url: '/api/placeholder/599/598', size: '599 x 598' },
    { url: '/api/placeholder/500/500', size: '500 x 500' },
    { url: '/api/placeholder/400/400', size: '400 x 400' },
    { url: '/api/placeholder/400/400', size: '400 x 400' },
    { url: '/api/placeholder/400/353', size: '400 x 353' },
    { url: '/api/placeholder/400/345', size: '400 x 345' },
    { url: '/api/placeholder/300/400', size: '300 x 400' },
    { url: '/api/placeholder/300/300', size: '300 x 300' },
    { url: '/api/placeholder/300/300', size: '300 x 300' },
  ];

  const toggleFilter = (filter: string) => {
    setSelectedFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 30000,
      paddingTop: '40px',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '1200px',
        width: '90%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#f97316',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Find Cover</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: 0,
              lineHeight: '1',
            }}
          >
            ×
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for album cover..."
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
                color: '#111827',
              }}
            />
            <button
              onClick={() => console.log('Searching:', searchQuery, selectedFilters)}
              style={{
                padding: '8px 24px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              Search
            </button>
          </div>
          
          {/* Filter Checkboxes */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {availableFilters.map(filter => (
              <label
                key={filter}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#374151',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedFilters.includes(filter)}
                  onChange={() => toggleFilter(filter)}
                  style={{ cursor: 'pointer' }}
                />
                {filter}
              </label>
            ))}
          </div>
        </div>

        {/* Results Grid */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '16px',
          }}>
            {searchResults.map((result, index) => (
              <div
                key={index}
                onClick={() => {
                  onSelectImage(result.url);
                  onClose();
                }}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  padding: '8px',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: '100%',
                  paddingBottom: '100%',
                  position: 'relative',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <Image
                    src={result.url}
                    alt={`Search result ${index + 1}`}
                    fill
                    style={{ objectFit: 'cover' }}
                    unoptimized
                  />
                </div>
                <div style={{
                  marginTop: '8px',
                  fontSize: '11px',
                  color: '#6b7280',
                  textAlign: 'center',
                }}>
                  {result.size}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}