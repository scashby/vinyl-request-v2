// src/app/edit-collection/components/EditAlbumModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabaseClient';
import type { Album } from 'types/album';
import { MainTab } from './tabs/MainTab';
import { DetailsTab } from './tabs/DetailsTab';
import { ClassicalTab } from './tabs/ClassicalTab';
import { PeopleTab } from './tabs/PeopleTab';
import { TracksTab } from './tabs/TracksTab';
import { PersonalTab } from './tabs/PersonalTab';
import { CoverTab } from './tabs/CoverTab';
import { LinksTab } from './tabs/LinksTab';
import { UniversalBottomBar } from 'components/UniversalBottomBar';

type TabId = 'main' | 'details' | 'classical' | 'people' | 'tracks' | 'personal' | 'cover' | 'links';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'main', label: 'Main', icon: '♪' },
  { id: 'details', label: 'Details', icon: 'ⓘ' },
  { id: 'classical', label: 'Classical', icon: '𝄞' },
  { id: 'people', label: 'People', icon: '👥' },
  { id: 'tracks', label: 'Tracks', icon: '☰' },
  { id: 'personal', label: 'Personal', icon: '👤' },
  { id: 'cover', label: 'Cover', icon: '📷' },
  { id: 'links', label: 'Links', icon: '🔗' },
];

interface EditAlbumModalProps {
  albumId: number;
  onClose: () => void;
  onSave: () => void;
  allAlbumIds: number[];
}

export default function EditAlbumModal({ albumId, onClose, onSave }: EditAlbumModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('main');
  const [album, setAlbum] = useState<Album | null>(null);
  const [editedAlbum, setEditedAlbum] = useState<Album | null>(null);

  useEffect(() => {
    async function fetchAlbum() {
      const { data } = await supabase
        .from('collection')
        .select('*')
        .eq('id', albumId)
        .single();
      
      if (data) {
        setAlbum(data as Album);
        setEditedAlbum(data as Album);
      }
    }
    fetchAlbum();
  }, [albumId]);

  if (!album || !editedAlbum) {
    return null;
  }

  const handleFieldChange = (field: keyof Album, value: string | number | string[] | null | boolean) => {
    setEditedAlbum(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const handleSave = () => {
    onSave();
    onClose();
  };

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
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '4px',
        width: '90vw',
        maxWidth: '1100px',
        height: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header - BOLD TITLE */}
        <div style={{
          backgroundColor: '#F7941D',
          color: 'white',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 'bold',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            {album.title} / {album.artist}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: '1',
              fontWeight: '300',
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs - ROUNDED WHITE CONTAINER */}
        <div style={{
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '4px',
            display: 'inline-flex',
            gap: '4px',
            border: '1px solid #e5e7eb',
          }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: activeTab === tab.id ? '#F7941D' : 'transparent',
                  borderRadius: '16px',
                  color: activeTab === tab.id ? 'white' : '#6b7280',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                <span style={{ fontSize: '14px' }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          background: 'white',
        }}>
          {activeTab === 'main' && (
            <MainTab album={editedAlbum} onChange={handleFieldChange} />
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
            <CoverTab album={editedAlbum} onChange={handleFieldChange} />
          )}
          {activeTab === 'links' && (
            <LinksTab />
          )}
        </div>

        {/* Bottom Bar */}
        <div style={{
          borderTop: '1px solid #e5e7eb',
          padding: '12px 16px',
          background: 'white',
        }}>
          <UniversalBottomBar
            album={editedAlbum}
            onChange={handleFieldChange}
            onPrevious={() => console.log('Previous')}
            onNext={() => console.log('Next')}
            onCancel={onClose}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}