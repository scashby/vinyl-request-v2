// src/app/edit-collection/EditAlbumModal.tsx
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
  { id: 'main', label: 'Main', icon: 'fa-music' },
  { id: 'details', label: 'Details', icon: 'fa-circle-info' },
  { id: 'classical', label: 'Classical', icon: 'fa-violin' },
  { id: 'people', label: 'People', icon: 'fa-users' },
  { id: 'tracks', label: 'Tracks', icon: 'fa-list-ol' },
  { id: 'personal', label: 'Personal', icon: 'fa-user' },
  { id: 'cover', label: 'Cover', icon: 'fa-camera' },
  { id: 'links', label: 'Links', icon: 'fa-globe' },
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load Font Awesome
  useEffect(() => {
    if (!document.getElementById('font-awesome-css')) {
      const link = document.createElement('link');
      link.id = 'font-awesome-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    async function fetchAlbum() {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error: fetchError } = await supabase
          .from('collection')
          .select('*')
          .eq('id', albumId)
          .single();
        
        if (fetchError) {
          console.error('Error fetching album:', fetchError);
          setError('Failed to load album data');
          return;
        }
        
        if (data) {
          setAlbum(data as Album);
          setEditedAlbum(data as Album);
        } else {
          setError('Album not found');
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }
    
    fetchAlbum();
  }, [albumId]);

  // Loading state
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
        zIndex: 20001,
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '40px 60px',
          fontSize: '16px',
          color: '#333',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>Loading Album...</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Please wait</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !album || !editedAlbum) {
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
        zIndex: 20001,
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '40px 60px',
          fontSize: '16px',
          color: '#333',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', color: '#ef4444' }}>⚠️</div>
          <div style={{ fontWeight: '600', marginBottom: '8px', color: '#ef4444' }}>Error</div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>
            {error || 'Failed to load album data'}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
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
      zIndex: 20001,
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

        {/* Tabs */}
        <div style={{
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
          padding: '8px 16px',
          display: 'flex',
          gap: '4px',
        }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 12px',
                border: 'none',
                background: activeTab === tab.id ? '#F7941D' : 'transparent',
                borderRadius: '4px',
                color: activeTab === tab.id ? 'white' : '#6b7280',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? '500' : '400',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              <i className={`fa ${tab.icon}`} style={{ fontSize: '14px' }}></i>
              <span>{tab.label}</span>
            </button>
          ))}
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