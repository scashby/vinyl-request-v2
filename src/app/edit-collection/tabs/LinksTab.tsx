// src/app/edit-collection/tabs/LinksTab.tsx
'use client';

import React, { useState } from 'react';
import type { Album } from 'types/album';

interface Link {
  id: string;
  url: string;
  description?: string;
}

interface LinksTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

export function LinksTab({ album, onChange }: LinksTabProps) {
  const [links, setLinks] = useState<Link[]>(() => {
    if (!album.extra) return [{ id: '1', url: '', description: '' }];
    try {
      const parsed = JSON.parse(album.extra);
      const parsedLinks = Array.isArray(parsed) ? parsed : [];
      return parsedLinks.length > 0 ? parsedLinks : [{ id: '1', url: '', description: '' }];
    } catch {
      return [{ id: '1', url: '', description: '' }];
    }
  });
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const updateLinks = (newLinks: Link[]) => {
    setLinks(newLinks);
    // Filter out completely empty links before saving
    const nonEmptyLinks = newLinks.filter(link => link.url || link.description);
    const jsonString = nonEmptyLinks.length > 0 ? JSON.stringify(nonEmptyLinks) : null;
    onChange('extra', jsonString as Album['extra']);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newLinks = [...links];
    const [removed] = newLinks.splice(draggedIndex, 1);
    newLinks.splice(dropIndex, 0, removed);
    
    updateLinks(newLinks);
    setDraggedIndex(null);
  };

  const handleUpdateLink = (index: number, field: 'url' | 'description', value: string) => {
    const newLinks = links.map((link, i) => 
      i === index ? { ...link, [field]: value } : link
    );
    updateLinks(newLinks);
  };

  const handleAddLink = () => {
    const newLink: Link = {
      id: Date.now().toString(),
      url: '',
      description: '',
    };
    updateLinks([...links, newLink]);
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* Table Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '40px 40px 1fr 1fr',
        gap: '8px',
        padding: '8px',
        borderBottom: '2px solid #e5e7eb',
        fontSize: '13px',
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: '4px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div></div>
        <div></div>
        <div>URL</div>
        <div>Description</div>
      </div>

      {/* Links Table - Always show at least one row */}
      {links.map((link, index) => (
        <div
          key={link.id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(index)}
          style={{
            display: 'grid',
            gridTemplateColumns: '40px 40px 1fr 1fr',
            gap: '8px',
            padding: '8px',
            borderBottom: '1px solid #e5e7eb',
            alignItems: 'center',
            backgroundColor: draggedIndex === index ? '#f3f4f6' : 'white',
          }}
        >
          {/* Drag Handle */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            color: '#9ca3af',
            fontSize: '18px',
            cursor: 'grab',
          }}>
            ≡
          </div>

          {/* Checkbox */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
          }}>
            <input
              type="checkbox"
              style={{ cursor: 'pointer' }}
            />
          </div>

          {/* URL Input */}
          <div>
            <input
              type="text"
              value={link.url}
              onChange={(e) => handleUpdateLink(index, 'url', e.target.value)}
              placeholder="https://"
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#111827',
                backgroundColor: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            />
          </div>

          {/* Description Input */}
          <div>
            <input
              type="text"
              value={link.description || ''}
              onChange={(e) => handleUpdateLink(index, 'description', e.target.value)}
              placeholder="Description"
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#111827',
                backgroundColor: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            />
          </div>
        </div>
      ))}

      {/* New Link Button */}
      <div style={{ marginTop: '16px' }}>
        <button
          onClick={handleAddLink}
          style={{
            padding: '8px 16px',
            background: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '13px',
            cursor: 'pointer',
            fontWeight: '500',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          + New Link
        </button>
      </div>
    </div>
  );
}