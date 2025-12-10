// src/app/edit-collection/EditAlbumModal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from 'lib/supabaseClient';
import type { Album } from 'types/album';
import { UniversalBottomBar } from 'components/UniversalBottomBar';
import { MainTab } from './tabs/MainTab';
import { DetailsTab } from './tabs/DetailsTab';
import { ClassicalTab } from './tabs/ClassicalTab';
import { PeopleTab } from './tabs/PeopleTab';
import { TracksTab } from './tabs/TracksTab';
import { PersonalTab } from './tabs/PersonalTab';
import { CoverTab } from './tabs/CoverTab';
import { LinksTab } from './tabs/LinksTab';

type TabId = 'main' | 'details' | 'classical' | 'people' | 'tracks' | 'personal' | 'cover' | 'links';

interface EditAlbumModalProps {
  albumId: number;
  onClose: () => void;
  onSave?: () => void;
  allAlbumIds?: number[]; // For Previous/Next navigation
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'main', label: 'Main', icon: '🎵' },
  { id: 'details', label: 'Details', icon: 'ℹ️' },
  { id: 'classical', label: 'Classical', icon: '🎻' },
  { id: 'people', label: 'People', icon: '👥' },
  { id: 'tracks', label: 'Tracks', icon: '🎼' },
  { id: 'personal', label: 'Personal', icon: '👤' },
  { id: 'cover', label: 'Cover', icon: '📀' },
  { id: 'links', label: 'Links', icon: '🔗' },
];

export default function EditAlbumModal({ 
  albumId, 
  onClose, 
  onSave,
  allAlbumIds = [] 
}: EditAlbumModalProps) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('main');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load album data
  const loadAlbum = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('collection')
        .select('*')
        .eq('id', albumId)
        .single();

      if (error) throw error;
      setAlbum(data as Album);
    } catch (error) {
      console.error('Error loading album:', error);
      alert('Failed to load album data');
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    loadAlbum();
  }, [loadAlbum]);

  const handleAlbumChange = (updates: Partial<Album>) => {
    if (!album) return;
    setAlbum({ ...album, ...updates });
    setHasChanges(true);
  };

  function handleFieldChange(field: keyof Album, value: string | number | string[] | null | boolean) {
    handleAlbumChange({ [field]: value });
  }

  async function handleSave() {
    if (!album) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('collection')
        .update(album)
        .eq('id', album.id);

      if (error) throw error;
      
      setHasChanges(false);
      if (onSave) onSave();
      alert('Album saved successfully!');
    } catch (error) {
      console.error('Error saving album:', error);
      alert('Failed to save album');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  }

  function handlePrevious() {
    const currentIndex = allAlbumIds.indexOf(albumId);
    if (currentIndex > 0) {
      const prevId = allAlbumIds[currentIndex - 1];
      // In real implementation, this would update the albumId prop
      // For now, we'll reload with the new ID
      window.location.hash = `#edit-${prevId}`;
    }
  }

  function handleNext() {
    const currentIndex = allAlbumIds.indexOf(albumId);
    if (currentIndex < allAlbumIds.length - 1) {
      const nextId = allAlbumIds[currentIndex + 1];
      window.location.hash = `#edit-${nextId}`;
    }
  }

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}>
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '8px',
          fontSize: '18px',
          fontWeight: '600',
        }}>
          Loading album...
        </div>
      </div>
    );
  }

  if (!album) {
    return null;
  }

  const currentIndex = allAlbumIds.indexOf(albumId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allAlbumIds.length - 1;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '1200px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Orange Header */}
        <div style={{
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{
              margin: 0,
              color: 'white',
              fontSize: '20px',
              fontWeight: '700',
              marginBottom: '4px',
            }}>
              {album.artist} / {album.title}
            </h2>
            <p style={{
              margin: 0,
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '14px',
            }}>
              {album.format} • {album.year}
            </p>
          </div>
          <button
            onClick={handleCancel}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
          display: 'flex',
          overflowX: 'auto',
        }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '14px 20px',
                border: 'none',
                background: activeTab === tab.id ? 'white' : 'transparent',
                borderBottom: activeTab === tab.id ? '3px solid #f97316' : '3px solid transparent',
                color: activeTab === tab.id ? '#f97316' : '#6b7280',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseOver={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.color = '#374151';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          background: 'white',
        }}>
          {activeTab === 'main' && (
            <MainTab album={album} onChange={handleFieldChange} />
          )}
          {activeTab === 'details' && (
            <DetailsTab album={album} onChange={handleFieldChange} />
          )}
          {activeTab === 'classical' && (
            <ClassicalTab album={album} onChange={handleFieldChange} />
          )}
          {activeTab === 'people' && (
            <PeopleTab album={album} onChange={handleFieldChange} />
          )}
          {activeTab === 'tracks' && (
            <TracksTab album={album} onChange={handleFieldChange} />
          )}
          {activeTab === 'personal' && (
            <PersonalTab album={album} onChange={handleFieldChange} />
          )}
          {activeTab === 'cover' && (
            <CoverTab album={album} onChange={handleFieldChange} />
          )}
          {activeTab === 'links' && (
            <LinksTab album={album} onChange={handleFieldChange} />
          )}
        </div>

        {/* Bottom Bar */}
        <UniversalBottomBar
          album={album}
          onChange={handleFieldChange}
        />

        {/* Footer Actions */}
        <div style={{
          borderTop: '1px solid #e5e7eb',
          padding: '16px 24px',
          background: '#f9fafb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Previous/Next Navigation */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePrevious}
              disabled={!hasPrevious}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                background: hasPrevious ? 'white' : '#f3f4f6',
                color: hasPrevious ? '#374151' : '#9ca3af',
                fontSize: '14px',
                fontWeight: '600',
                cursor: hasPrevious ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ← Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!hasNext}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                background: hasNext ? 'white' : '#f3f4f6',
                color: hasNext ? '#374151' : '#9ca3af',
                fontSize: '14px',
                fontWeight: '600',
                cursor: hasNext ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Next →
            </button>
          </div>

          {/* Save/Cancel Actions */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '10px 20px',
                border: '2px solid #d1d5db',
                borderRadius: '6px',
                background: 'white',
                color: '#374151',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#9ca3af';
                e.currentTarget.style.background = '#f9fafb';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.background = 'white';
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '6px',
                background: saving || !hasChanges ? '#9ca3af' : '#3b82f6',
                color: 'white',
                fontSize: '14px',
                fontWeight: '700',
                cursor: saving || !hasChanges ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => {
                if (!saving && hasChanges) {
                  e.currentTarget.style.background = '#2563eb';
                }
              }}
              onMouseOut={(e) => {
                if (!saving && hasChanges) {
                  e.currentTarget.style.background = '#3b82f6';
                }
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}