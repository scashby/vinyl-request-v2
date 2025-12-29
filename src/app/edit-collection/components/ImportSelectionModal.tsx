// src/app/edit-collection/components/ImportSelectionModal.tsx
// Modal for selecting which type of import to perform

'use client';

import React from 'react';

interface ImportSelectionModalProps {
  onSelectImportType: (type: 'csv' | 'discogs' | 'clz' | 'enrich') => void;
  onCancel: () => void;
}

export default function ImportSelectionModal({
  onSelectImportType,
  onCancel,
}: ImportSelectionModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'white',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Black Header Bar */}
      <div
        style={{
          background: '#2A2A2A',
          color: 'white',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: 0,
          }}
        >
          ◀ Back
        </button>
        <div style={{ fontSize: '16px', fontWeight: 500, color: 'white' }}>Import Data</div>
        <button
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '28px',
            cursor: 'pointer',
            lineHeight: '1',
            padding: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'white',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <p style={{ fontSize: '15px', color: '#666', marginBottom: '24px' }}>
            Select the type of data you want to import or enrich:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* CSV Import */}
            <button
              onClick={() => onSelectImportType('csv')}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'white',
                border: '2px solid #D8D8D8',
                borderRadius: '6px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#4FC3F7';
                e.currentTarget.style.background = '#F0F9FF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#D8D8D8';
                e.currentTarget.style.background = 'white';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'start' }}>
                <div style={{ 
                  flexShrink: 0, 
                  width: '48px', 
                  height: '48px', 
                  background: '#E8F5E9', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginRight: '16px' 
                }}>
                  <span style={{ fontSize: '24px' }}>📄</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>
                    CSV Import
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                    Import album data from a CSV file with format parsing
                  </p>
                </div>
              </div>
            </button>

            {/* Discogs Import */}
            <button
              onClick={() => onSelectImportType('discogs')}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'white',
                border: '2px solid #D8D8D8',
                borderRadius: '6px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#4FC3F7';
                e.currentTarget.style.background = '#F0F9FF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#D8D8D8';
                e.currentTarget.style.background = 'white';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'start' }}>
                <div style={{ 
                  flexShrink: 0, 
                  width: '48px', 
                  height: '48px', 
                  background: '#E3F2FD', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginRight: '16px' 
                }}>
                  <span style={{ fontSize: '24px' }}>💿</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>
                    Discogs CSV Import
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                    Import your collection from a Discogs CSV export
                  </p>
                </div>
              </div>
            </button>

            {/* CLZ Import */}
            <button
              onClick={() => onSelectImportType('clz')}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'white',
                border: '2px solid #D8D8D8',
                borderRadius: '6px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#4FC3F7';
                e.currentTarget.style.background = '#F0F9FF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#D8D8D8';
                e.currentTarget.style.background = 'white';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'start' }}>
                <div style={{ 
                  flexShrink: 0, 
                  width: '48px', 
                  height: '48px', 
                  background: '#F3E5F5', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginRight: '16px' 
                }}>
                  <span style={{ fontSize: '24px' }}>📦</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>
                    CLZ Music Web Import
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                    Import your collection from CLZ Music Web CSV/XML export
                  </p>
                </div>
              </div>
            </button>

            {/* Enrich Existing */}
            <button
              onClick={() => onSelectImportType('enrich')}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'white',
                border: '2px solid #D8D8D8',
                borderRadius: '6px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#4FC3F7';
                e.currentTarget.style.background = '#F0F9FF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#D8D8D8';
                e.currentTarget.style.background = 'white';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'start' }}>
                <div style={{ 
                  flexShrink: 0, 
                  width: '48px', 
                  height: '48px', 
                  background: '#FFF3E0', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginRight: '16px' 
                }}>
                  <span style={{ fontSize: '24px' }}>⚡</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>
                    Enrich Existing Albums
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                    Add missing metadata to existing albums using Discogs
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}