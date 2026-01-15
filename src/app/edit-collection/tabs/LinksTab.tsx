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
    <div className="p-5">
      {/* Table Header */}
      <div className="grid grid-cols-[40px_40px_1fr_1fr] gap-2 px-2 py-2 border-b-2 border-gray-200 text-[13px] font-semibold text-gray-500 mb-1">
        <div></div>
        <div></div>
        <div>URL</div>
        <div>Description</div>
      </div>

      {/* Links Table */}
      <div className="flex flex-col">
        {links.map((link, index) => (
          <div
            key={link.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(index)}
            className={`grid grid-cols-[40px_40px_1fr_1fr] gap-2 px-2 py-2 border-b border-gray-200 items-center ${
              draggedIndex === index ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'
            }`}
          >
            {/* Drag Handle */}
            <div className="flex justify-center text-gray-400 text-lg cursor-grab active:cursor-grabbing">
              ≡
            </div>

            {/* Checkbox */}
            <div className="flex justify-center">
              <input
                type="checkbox"
                className="cursor-pointer"
              />
            </div>

            {/* URL Input */}
            <div>
              <input
                type="text"
                value={link.url}
                onChange={(e) => handleUpdateLink(index, 'url', e.target.value)}
                placeholder="https://"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[13px] text-gray-900 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Description Input */}
            <div>
              <input
                type="text"
                value={link.description || ''}
                onChange={(e) => handleUpdateLink(index, 'description', e.target.value)}
                placeholder="Description"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[13px] text-gray-900 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        ))}
      </div>

      {/* New Link Button */}
      <div className="mt-4">
        <button
          onClick={handleAddLink}
          className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded text-[13px] font-medium cursor-pointer hover:bg-gray-200"
        >
          + New Link
        </button>
      </div>
    </div>
  );
}