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
  { id: 'tracks', label: 'Tracks', icon: '📋' },
  { id: 'personal', label: 'Personal', icon: '👤' },
  { id: 'cover', label: 'Cover', icon: '🖼️' },
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
        borderRadius: '8px',
        width: '100%',
        maxWidth: '1200px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Solid Orange Header - CLZ Style */}
        <div style={{
          background: '#F7941D',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{
              margin: 0,
              color: 'white',
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '2px',
            }}>
              {album.title} / {album.artist}
            </h2>
            <p style={{
              margin: 0,
              color: 'white',
              fontSize: '13px',
              opacity: 0.95,
            }}>
              {album.format} • {album.year}
            </p>
          </div>
          <button
            onClick={handleCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '28px',
              width: '32px',
              height: '32px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              lineHeight: '1',
              fontWeight: '300',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            ×
          </button>
        </div>

        {/* Tab Navigation - CLZ Style */}
        <div style={{
          borderBottom: '1px solid #e5e7eb',
          background: 'white',
          display: 'flex',
          overflowX: 'auto',
        }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: 'white',
                borderBottom: activeTab === tab.id ? '3px solid #F7941D' : '3px solid transparent',
                color: activeTab === tab.id ? '#F7941D' : '#6b7280',
                fontSize: '13px',
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
                  e.currentTarget.style.color = '#374151';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== tab.id) {
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
            <DetailsTab />
          )}
          {activeTab === 'classical' && (
            <ClassicalTab />
          )}
          {activeTab === 'people' && (
            <PeopleTab />
          )}
          {activeTab === 'tracks' && (
            <TracksTab />
          )}
          {activeTab === 'personal' && (
            <PersonalTab />
          )}
          {activeTab === 'cover' && (
            <CoverTab album={album} onChange={handleFieldChange} />
          )}
          {activeTab === 'links' && (
            <LinksTab />
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
          padding: '12px 20px',
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
                borderRadius: '4px',
                background: hasPrevious ? 'white' : '#f3f4f6',
                color: hasPrevious ? '#374151' : '#9ca3af',
                fontSize: '13px',
                fontWeight: '600',
                cursor: hasPrevious ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ◄ Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!hasNext}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: hasNext ? 'white' : '#f3f4f6',
                color: hasNext ? '#374151' : '#9ca3af',
                fontSize: '13px',
                fontWeight: '600',
                cursor: hasNext ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Next ►
            </button>
          </div>

          {/* Save/Cancel Actions */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '8px 20px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                color: '#374151',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#f9fafb';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'white';
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              style={{
                padding: '8px 24px',
                border: 'none',
                borderRadius: '4px',
                background: saving || !hasChanges ? '#9ca3af' : '#5DADE2',
                color: 'white',
                fontSize: '13px',
                fontWeight: '700',
                cursor: saving || !hasChanges ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => {
                if (!saving && hasChanges) {
                  e.currentTarget.style.background = '#4A9FD3';
                }
              }}
              onMouseOut={(e) => {
                if (!saving && hasChanges) {
                  e.currentTarget.style.background = '#5DADE2';
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