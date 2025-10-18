// src/app/admin/edit-collection/page.tsx - WITH TAG EDITING
'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';

type Album = {
  id: number;
  artist: string;
  title: string;
  year: string | null;
  folder: string;
  image_url: string | null;
  custom_tags: string[];
};

type TagDefinition = {
  id: number;
  tag_name: string;
  category: 'theme' | 'mood' | 'occasion' | 'special';
  color: string;
  description: string;
};

export default function BrowseCollection() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [savingTags, setSavingTags] = useState(false);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('collection')
      .select('id, artist, title, year, folder, image_url, custom_tags')
      .order('artist', { ascending: true })
      .order('title', { ascending: true });
    
    if (error) {
      console.error('Error loading albums:', error);
    } else {
      setAlbums(data || []);
    }
    
    setLoading(false);
  }, []);

  const loadTagDefinitions = useCallback(async () => {
    const { data, error } = await supabase
      .from('tag_definitions')
      .select('*')
      .order('category', { ascending: true })
      .order('tag_name', { ascending: true });
    
    if (error) {
      console.error('Error loading tag definitions:', error);
    } else {
      setTagDefinitions(data || []);
    }
  }, []);

  useEffect(() => {
    loadAlbums();
    loadTagDefinitions();
  }, [loadAlbums, loadTagDefinitions]);

  const filteredAlbums = albums.filter(album => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      album.artist.toLowerCase().includes(term) ||
      album.title.toLowerCase().includes(term)
    );
  });

  const openTagEditor = (album: Album) => {
    setSelectedAlbum(album);
  };

  const closeTagEditor = () => {
    setSelectedAlbum(null);
  };

  const toggleTag = (tagName: string) => {
    if (!selectedAlbum) return;
    
    const currentTags = selectedAlbum.custom_tags || [];
    const newTags = currentTags.includes(tagName)
      ? currentTags.filter(t => t !== tagName)
      : [...currentTags, tagName];
    
    setSelectedAlbum({
      ...selectedAlbum,
      custom_tags: newTags
    });
  };

  const saveTags = async () => {
    if (!selectedAlbum) return;
    
    setSavingTags(true);
    
    const { error } = await supabase
      .from('collection')
      .update({ custom_tags: selectedAlbum.custom_tags })
      .eq('id', selectedAlbum.id);
    
    if (error) {
      console.error('Error saving tags:', error);
      alert('Error saving tags: ' + error.message);
    } else {
      // Update local state
      setAlbums(albums.map(a => 
        a.id === selectedAlbum.id ? selectedAlbum : a
      ));
      closeTagEditor();
    }
    
    setSavingTags(false);
  };

  const getTagColor = (tagName: string): string => {
    const tagDef = tagDefinitions.find(t => t.tag_name === tagName);
    return tagDef?.color || '#3b82f6';
  };

  const categoryColors = {
    theme: '#f97316',
    mood: '#8b5cf6',
    occasion: '#14b8a6',
    special: '#eab308'
  };

  const groupedTags = tagDefinitions.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, TagDefinition[]>);

  return (
    <div style={{
      padding: 24,
      background: '#f8fafc',
      minHeight: '100vh',
      maxWidth: 1600,
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: 32
      }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 'bold',
          color: '#1f2937',
          margin: '0 0 8px 0'
        }}>
          Browse Collection
        </h1>
        <p style={{
          color: '#6b7280',
          fontSize: 16,
          margin: 0
        }}>
          {albums.length} albums • Click any album to edit tags
        </p>
      </div>

      {/* Search Bar */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by artist or title..."
            style={{
              flex: '1 1 300px',
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14,
              backgroundColor: 'white',
              color: '#1f2937'
            }}
          />
          
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                padding: '12px 20px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          )}

          <button
            onClick={loadAlbums}
            disabled={loading}
            style={{
              padding: '12px 20px',
              background: loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>

          <Link
            href="/admin/manage-tags"
            style={{
              padding: '12px 20px',
              background: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            🏷️ Manage Tags
          </Link>
        </div>

        {searchTerm && (
          <div style={{
            marginTop: 16,
            padding: 12,
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 6,
            fontSize: 14,
            color: '#0c4a6e',
            fontWeight: 600
          }}>
            📊 Showing {filteredAlbums.length} of {albums.length} albums
          </div>
        )}
      </div>

      {/* Album Grid */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        {loading ? (
          <div style={{
            color: '#6b7280',
            textAlign: 'center',
            padding: 40,
            fontSize: 16
          }}>
            Loading albums...
          </div>
        ) : filteredAlbums.length === 0 ? (
          <div style={{
            color: '#6b7280',
            textAlign: 'center',
            padding: 40
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              No albums found
            </div>
            <div style={{ fontSize: 14 }}>
              {searchTerm ? 'Try a different search term' : 'Your collection is empty'}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 16
          }}>
            {filteredAlbums.map(album => (
              <div
                key={album.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  background: '#f9fafb',
                  position: 'relative'
                }}
              >
                {/* Edit Entry Link */}
                <Link
                  href={`/admin/edit-entry/${album.id}`}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    padding: '4px 8px',
                    background: 'rgba(59, 130, 246, 0.9)',
                    color: 'white',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    textDecoration: 'none',
                    zIndex: 10
                  }}
                >
                  ✏️
                </Link>

                {/* Album Image */}
                <div
                  onClick={() => openTagEditor(album)}
                  style={{
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <Image
                    src={album.image_url || '/images/placeholder.png'}
                    alt={album.title}
                    width={180}
                    height={180}
                    style={{
                      width: '100%',
                      height: 'auto',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      borderRadius: 6
                    }}
                    unoptimized
                  />
                  {/* Tag indicator overlay */}
                  <div style={{
                    position: 'absolute',
                    bottom: 4,
                    left: 4,
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600
                  }}>
                    🏷️ {album.custom_tags?.length || 0}
                  </div>
                </div>

                {/* Album Info */}
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1f2937',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {album.title}
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#6b7280',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {album.artist}
                </div>
                <div style={{
                  fontSize: 11,
                  color: '#9ca3af',
                  display: 'flex',
                  gap: 4,
                  flexWrap: 'wrap'
                }}>
                  {album.year && <span>{album.year}</span>}
                  {album.folder && <span>• {album.folder}</span>}
                </div>

                {/* Tags Display */}
                {album.custom_tags && album.custom_tags.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    marginTop: 4
                  }}>
                    {album.custom_tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        style={{
                          padding: '2px 6px',
                          background: getTagColor(tag),
                          color: 'white',
                          borderRadius: 3,
                          fontSize: 10,
                          fontWeight: 600
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                    {album.custom_tags.length > 3 && (
                      <span style={{
                        padding: '2px 6px',
                        background: '#e5e7eb',
                        color: '#6b7280',
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 600
                      }}>
                        +{album.custom_tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tag Editor Modal */}
      {selectedAlbum && (
        <div
          onClick={closeTagEditor}
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
            zIndex: 50,
            padding: 24
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 32,
              maxWidth: 600,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              marginBottom: 24,
              paddingBottom: 16,
              borderBottom: '2px solid #e5e7eb'
            }}>
              <Image
                src={selectedAlbum.image_url || '/images/placeholder.png'}
                alt={selectedAlbum.title}
                width={80}
                height={80}
                style={{
                  borderRadius: 8,
                  objectFit: 'cover'
                }}
                unoptimized
              />
              <div style={{ flex: 1 }}>
                <h2 style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: '#1f2937',
                  margin: '0 0 4px 0'
                }}>
                  {selectedAlbum.title}
                </h2>
                <div style={{
                  fontSize: 14,
                  color: '#6b7280',
                  marginBottom: 8
                }}>
                  {selectedAlbum.artist}
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#9ca3af'
                }}>
                  {selectedAlbum.custom_tags?.length || 0} tags selected
                </div>
              </div>
            </div>

            {/* Tag Categories */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              marginBottom: 24
            }}>
              {Object.entries(groupedTags).map(([category, tags]) => (
                <div key={category}>
                  <h3 style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: categoryColors[category as keyof typeof categoryColors],
                    margin: '0 0 12px 0',
                    textTransform: 'capitalize'
                  }}>
                    {category}
                  </h3>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8
                  }}>
                    {tags.map(tag => {
                      const isSelected = selectedAlbum.custom_tags?.includes(tag.tag_name);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.tag_name)}
                          style={{
                            padding: '8px 12px',
                            background: isSelected ? tag.color : 'white',
                            color: isSelected ? 'white' : '#1f2937',
                            border: isSelected ? 'none' : `2px solid ${tag.color}`,
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isSelected ? '✓ ' : ''}{tag.tag_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {tagDefinitions.length === 0 && (
              <div style={{
                padding: 20,
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: 8,
                textAlign: 'center',
                marginBottom: 24
              }}>
                <div style={{ fontSize: 14, color: '#92400e', marginBottom: 8 }}>
                  No tags defined yet
                </div>
                <Link
                  href="/admin/manage-tags"
                  style={{
                    color: '#d97706',
                    fontWeight: 600,
                    fontSize: 14
                  }}
                >
                  Create tags in Tag Management →
                </Link>
              </div>
            )}

            {/* Actions */}
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
              paddingTop: 16,
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                onClick={closeTagEditor}
                disabled={savingTags}
                style={{
                  padding: '10px 20px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: savingTags ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveTags}
                disabled={savingTags}
                style={{
                  padding: '10px 20px',
                  background: savingTags ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: savingTags ? 'not-allowed' : 'pointer'
                }}
              >
                {savingTags ? 'Saving...' : 'Save Tags'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}