// src/app/edit-collection/components/LinksTab.tsx
'use client';

import React, { useState } from 'react';
import { AlbumData } from 'types/';

interface Link {
  id: string;
  url: string;
  description?: string;
}

interface LinksTabProps {
  albumData: AlbumData;
  onFieldChange: (field: keyof AlbumData, value: Link[]) => void;
}

export default function LinksTab({ albumData, onFieldChange }: LinksTabProps) {
  const [links, setLinks] = useState<Link[]>(
    (albumData.links as Link[]) || []
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkDescription, setNewLinkDescription] = useState('');

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newLinks = [...links];
    const [removed] = newLinks.splice(draggedIndex, 1);
    newLinks.splice(dropIndex, 0, removed);
    
    setLinks(newLinks);
    onFieldChange('links' as keyof AlbumData, newLinks);
    setDraggedIndex(null);
  };

  const handleRemoveLink = (index: number) => {
    const newLinks = links.filter((_, i) => i !== index);
    setLinks(newLinks);
    onFieldChange('links' as keyof AlbumData, newLinks);
  };

  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return;

    const newLink: Link = {
      id: Date.now().toString(),
      url: newLinkUrl.trim(),
      description: newLinkDescription.trim() || undefined,
    };

    const newLinks = [...links, newLink];
    setLinks(newLinks);
    onFieldChange('links' as keyof AlbumData, newLinks);
    
    setNewLinkUrl('');
    setNewLinkDescription('');
    setShowAddLinkModal(false);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-4">
        {/* Links List */}
        <div className="space-y-1">
          {links.length === 0 ? (
            <div className="text-[#666666] text-[13px] py-4 text-center">
              No links added yet
            </div>
          ) : (
            links.map((link, index) => (
              <div
                key={link.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className={`
                  flex items-center gap-2 p-2 bg-[#2a2a2a] border border-[#555555] rounded
                  hover:bg-[#333333] cursor-move transition-colors
                  ${draggedIndex === index ? 'opacity-50' : ''}
                `}
              >
                {/* Drag Handle */}
                <div className="text-[#666666] flex-shrink-0 cursor-move">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                  </svg>
                </div>

                {/* Link Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-[#e8e6e3] text-[13px] truncate">
                    {link.url}
                  </div>
                  {link.description && (
                    <div className="text-[#999999] text-[12px] truncate">
                      {link.description}
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  className="flex-shrink-0 w-[24px] h-[24px] bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] border border-[#555555] rounded flex items-center justify-center transition-colors"
                  onClick={() => handleRemoveLink(index)}
                  title="Remove link"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add New Link Button */}
        <button
          type="button"
          className="h-[28px] px-4 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[13px] border border-[#555555] rounded flex items-center gap-2 transition-colors"
          onClick={() => setShowAddLinkModal(true)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Link
        </button>
      </div>

      {/* Add Link Modal */}
      {showAddLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#2a2a2a] border border-[#555555] rounded-lg p-6 w-[500px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-[#e8e6e3]">Add New Link</h2>
              <button
                type="button"
                className="text-[#999999] hover:text-[#e8e6e3] transition-colors"
                onClick={() => {
                  setShowAddLinkModal(false);
                  setNewLinkUrl('');
                  setNewLinkDescription('');
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* URL Input */}
              <div>
                <label className="block text-[13px] text-[#e8e6e3] mb-2">
                  URL <span className="text-[#ff6b6b]">*</span>
                </label>
                <input
                  type="url"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-[32px] px-3 bg-[#1a1a1a] text-[#e8e6e3] text-[13px] border border-[#555555] rounded focus:outline-none focus:border-[#666666]"
                  autoFocus
                />
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-[13px] text-[#e8e6e3] mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newLinkDescription}
                  onChange={(e) => setNewLinkDescription(e.target.value)}
                  placeholder="e.g., Official website, Bandcamp page..."
                  className="w-full h-[32px] px-3 bg-[#1a1a1a] text-[#e8e6e3] text-[13px] border border-[#555555] rounded focus:outline-none focus:border-[#666666]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="h-[32px] px-4 bg-[#3a3a3a] hover:bg-[#444444] text-[#e8e6e3] text-[13px] border border-[#555555] rounded transition-colors"
                  onClick={() => {
                    setShowAddLinkModal(false);
                    setNewLinkUrl('');
                    setNewLinkDescription('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-[32px] px-4 bg-[#4a7ba7] hover:bg-[#5a8bc7] text-white text-[13px] border border-[#5a8bc7] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleAddLink}
                  disabled={!newLinkUrl.trim()}
                >
                  Add Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}