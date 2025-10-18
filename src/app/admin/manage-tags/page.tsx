// src/app/admin/manage-tags/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';

type TagDefinition = {
  id: number;
  tag_name: string;
  category: 'theme' | 'mood' | 'occasion' | 'special';
  color: string;
  description: string;
};

type Album = {
  id: number;
  artist: string;
  title: string;
  custom_tags: string[];
  image_url: string | null;
};

type TagStats = {
  tag_name: string;
  count: number;
  albums: Album[];
};

export default function ManageTags() {
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([]);
  const [tagStats, setTagStats] = useState<TagStats[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'definitions' | 'usage' | 'bulk'>('definitions');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newTag, setNewTag] = useState({
    tag_name: '',
    category: 'theme' as 'theme' | 'mood' | 'occasion' | 'special',
    color: '#3b82f6',
    description: ''
  });
  const [selectedAlbums, setSelectedAlbums] = useState<number[]>([]);
  const [bulkTagAction, setBulkTagAction] = useState<'add' | 'remove'>('add');
  const [selectedBulkTag, setSelectedBulkTag] = useState<string>('');

const loadData = useCallback(async () => {
  setLoading(true);
  await Promise.all([
    loadTagDefinitions(),
    loadAlbums(),
    calculateTagStats()
  ]);
  setLoading(false);
}, []);

useEffect(() => {
  loadData();
}, [loadData]);

  async function loadTagDefinitions() {
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
  }

  async function loadAlbums() {
    const { data, error } = await supabase
      .from('collection')
      .select('id, artist, title, custom_tags, image_url')
      .order('artist', { ascending: true });
    
    if (error) {
      console.error('Error loading albums:', error);
    } else {
      setAlbums(data || []);
    }
  }

  async function calculateTagStats() {
    const { data, error } = await supabase
      .from('collection')
      .select('id, artist, title, custom_tags, image_url');
    
    if (error) {
      console.error('Error calculating tag stats:', error);
      return;
    }

    const tagMap = new Map<string, Album[]>();
    
    data?.forEach(album => {
      if (album.custom_tags && Array.isArray(album.custom_tags)) {
        album.custom_tags.forEach((tag: string) => {
          if (!tagMap.has(tag)) {
            tagMap.set(tag, []);
          }
          tagMap.get(tag)?.push(album);
        });
      }
    });

    const stats: TagStats[] = Array.from(tagMap.entries()).map(([tag_name, albums]) => ({
      tag_name,
      count: albums.length,
      albums
    })).sort((a, b) => b.count - a.count);

    setTagStats(stats);
  }

  async function createTag() {
    if (!newTag.tag_name.trim()) {
      alert('Tag name is required');
      return;
    }

    const { error } = await supabase
      .from('tag_definitions')
      .insert([newTag]);

    if (error) {
      console.error('Error creating tag:', error);
      alert('Error creating tag: ' + error.message);
    } else {
      setNewTag({
        tag_name: '',
        category: 'theme',
        color: '#3b82f6',
        description: ''
      });
      loadTagDefinitions();
    }
  }

  async function deleteTag(id: number, tagName: string) {
    if (!confirm(`Delete tag "${tagName}"? This will also remove it from all albums.`)) {
      return;
    }

    // Delete from tag_definitions
    const { error: defError } = await supabase
      .from('tag_definitions')
      .delete()
      .eq('id', id);

    if (defError) {
      console.error('Error deleting tag definition:', defError);
      alert('Error deleting tag');
      return;
    }

    // Remove tag from all albums
    const albumsWithTag = albums.filter(a => a.custom_tags?.includes(tagName));
    
    for (const album of albumsWithTag) {
      const updatedTags = album.custom_tags.filter(t => t !== tagName);
      await supabase
        .from('collection')
        .update({ custom_tags: updatedTags })
        .eq('id', album.id);
    }

    loadData();
  }

  async function applyBulkTags() {
    if (selectedAlbums.length === 0) {
      alert('Please select albums first');
      return;
    }

    if (!selectedBulkTag) {
      alert('Please select a tag');
      return;
    }

    for (const albumId of selectedAlbums) {
      const album = albums.find(a => a.id === albumId);
      if (!album) continue;

      let updatedTags = [...(album.custom_tags || [])];

      if (bulkTagAction === 'add') {
        if (!updatedTags.includes(selectedBulkTag)) {
          updatedTags.push(selectedBulkTag);
        }
      } else {
        updatedTags = updatedTags.filter(t => t !== selectedBulkTag);
      }

      await supabase
        .from('collection')
        .update({ custom_tags: updatedTags })
        .eq('id', albumId);
    }

    setSelectedAlbums([]);
    setSelectedBulkTag('');
    loadData();
    alert(`${bulkTagAction === 'add' ? 'Added' : 'Removed'} tag for ${selectedAlbums.length} albums`);
  }

  const filteredDefinitions = selectedCategory === 'all' 
    ? tagDefinitions 
    : tagDefinitions.filter(t => t.category === selectedCategory);

  const categoryColors = {
    theme: '#f97316',
    mood: '#8b5cf6',
    occasion: '#14b8a6',
    special: '#eab308'
  };

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh', maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', color: '#1f2937', margin: '0 0 8px 0' }}>
          Tag Management
        </h1>
        <p style={{ color: '#6b7280', fontSize: 16, margin: 0 }}>
          Create, organize, and apply tags to your collection
        </p>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 8, borderBottom: '2px solid #e5e7eb' }}>
        <button
          onClick={() => setActiveTab('definitions')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'definitions' ? '#3b82f6' : 'transparent',
            color: activeTab === 'definitions' ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Tag Definitions
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'usage' ? '#3b82f6' : 'transparent',
            color: activeTab === 'usage' ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Tag Usage
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'bulk' ? '#3b82f6' : 'transparent',
            color: activeTab === 'bulk' ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Bulk Tagging
        </button>
      </div>

      {/* Tag Definitions Tab */}
      {activeTab === 'definitions' && (
        <div>
          {/* Create New Tag */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 }}>
              Create New Tag
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                  Tag Name
                </label>
                <input
                  type="text"
                  value={newTag.tag_name}
                  onChange={e => setNewTag({ ...newTag, tag_name: e.target.value })}
                  placeholder="e.g., Halloween"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                  Category
                </label>
                <select
                  value={newTag.category}
                  onChange={e => setNewTag({ ...newTag, category: e.target.value as 'theme' | 'mood' | 'occasion' | 'special' })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                >
                  <option value="theme">Theme</option>
                  <option value="mood">Mood</option>
                  <option value="occasion">Occasion</option>
                  <option value="special">Special</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                  Color
                </label>
                <input
                  type="color"
                  value={newTag.color}
                  onChange={e => setNewTag({ ...newTag, color: e.target.value })}
                  style={{
                    width: '100%',
                    height: 38,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                  Description
                </label>
                <input
                  type="text"
                  value={newTag.description}
                  onChange={e => setNewTag({ ...newTag, description: e.target.value })}
                  placeholder="Optional description"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                />
              </div>
              <button
                onClick={createTag}
                style={{
                  padding: '8px 24px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Create Tag
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '8px 16px',
                background: selectedCategory === 'all' ? '#3b82f6' : '#f3f4f6',
                color: selectedCategory === 'all' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              All Categories
            </button>
            <button
              onClick={() => setSelectedCategory('theme')}
              style={{
                padding: '8px 16px',
                background: selectedCategory === 'theme' ? categoryColors.theme : '#f3f4f6',
                color: selectedCategory === 'theme' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Themes
            </button>
            <button
              onClick={() => setSelectedCategory('mood')}
              style={{
                padding: '8px 16px',
                background: selectedCategory === 'mood' ? categoryColors.mood : '#f3f4f6',
                color: selectedCategory === 'mood' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Moods
            </button>
            <button
              onClick={() => setSelectedCategory('occasion')}
              style={{
                padding: '8px 16px',
                background: selectedCategory === 'occasion' ? categoryColors.occasion : '#f3f4f6',
                color: selectedCategory === 'occasion' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Occasions
            </button>
            <button
              onClick={() => setSelectedCategory('special')}
              style={{
                padding: '8px 16px',
                background: selectedCategory === 'special' ? categoryColors.special : '#f3f4f6',
                color: selectedCategory === 'special' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Special
            </button>
          </div>

          {/* Tag List */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 20,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 }}>
              Available Tags ({filteredDefinitions.length})
            </h2>
            {filteredDefinitions.length === 0 ? (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>
                No tags found. Create your first tag above!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredDefinitions.map(tag => (
                  <div
                    key={tag.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: 12,
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        background: tag.color
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>
                        {tag.tag_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {tag.description || 'No description'}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '4px 12px',
                        background: categoryColors[tag.category],
                        color: 'white',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        textTransform: 'capitalize'
                      }}
                    >
                      {tag.category}
                    </div>
                    <button
                      onClick={() => deleteTag(tag.id, tag.tag_name)}
                      style={{
                        padding: '6px 12px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tag Usage Tab */}
      {activeTab === 'usage' && (
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 }}>
            Tag Usage Statistics
          </h2>
          {tagStats.length === 0 ? (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>
              No tags have been applied to albums yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {tagStats.map(stat => {
                const tagDef = tagDefinitions.find(t => t.tag_name === stat.tag_name);
                return (
                  <div key={stat.tag_name} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      {tagDef && (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            background: tagDef.color
                          }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
                          {stat.tag_name}
                        </span>
                        <span style={{ marginLeft: 8, fontSize: 14, color: '#6b7280' }}>
                          ({stat.count} album{stat.count !== 1 ? 's' : ''})
                        </span>
                      </div>
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                      gap: 8
                    }}>
                      {stat.albums.slice(0, 10).map(album => (
                        <div
                          key={album.id}
                          style={{
                            padding: 8,
                            background: '#f9fafb',
                            borderRadius: 6,
                            fontSize: 12
                          }}
                        >
                          <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: 2 }}>
                            {album.title}
                          </div>
                          <div style={{ color: '#6b7280' }}>
                            {album.artist}
                          </div>
                        </div>
                      ))}
                      {stat.albums.length > 10 && (
                        <div style={{
                          padding: 8,
                          background: '#f3f4f6',
                          borderRadius: 6,
                          fontSize: 12,
                          color: '#6b7280',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          +{stat.albums.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bulk Tagging Tab */}
      {activeTab === 'bulk' && (
        <div>
          {/* Bulk Actions Panel */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 }}>
              Bulk Tag Actions
            </h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                  Action
                </label>
                <select
                  value={bulkTagAction}
                  onChange={e => setBulkTagAction(e.target.value as 'add' | 'remove')}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                >
                  <option value="add">Add Tag</option>
                  <option value="remove">Remove Tag</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                  Select Tag
                </label>
                <select
                  value={selectedBulkTag}
                  onChange={e => setSelectedBulkTag(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                >
                  <option value="">Choose a tag...</option>
                  {tagDefinitions.map(tag => (
                    <option key={tag.id} value={tag.tag_name}>
                      {tag.tag_name} ({tag.category})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={applyBulkTags}
                disabled={selectedAlbums.length === 0 || !selectedBulkTag}
                style={{
                  padding: '8px 24px',
                  background: selectedAlbums.length === 0 || !selectedBulkTag ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: selectedAlbums.length === 0 || !selectedBulkTag ? 'not-allowed' : 'pointer'
                }}
              >
                Apply to {selectedAlbums.length} Album{selectedAlbums.length !== 1 ? 's' : ''}
              </button>
            </div>
            {selectedAlbums.length > 0 && (
              <div style={{
                marginTop: 12,
                padding: 12,
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: 6,
                fontSize: 14,
                color: '#0c4a6e'
              }}>
                ✓ {selectedAlbums.length} album{selectedAlbums.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>

          {/* Album Selection */}
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 20,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
                Select Albums ({albums.length})
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setSelectedAlbums(albums.map(a => a.id))}
                  style={{
                    padding: '6px 12px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedAlbums([])}
                  style={{
                    padding: '6px 12px',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12
            }}>
              {albums.map(album => {
                const isSelected = selectedAlbums.includes(album.id);
                return (
                  <div
                    key={album.id}
                    onClick={() => {
                      setSelectedAlbums(prev =>
                        isSelected
                          ? prev.filter(id => id !== album.id)
                          : [...prev, album.id]
                      );
                    }}
                    style={{
                      border: isSelected ? '3px solid #3b82f6' : '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: 8,
                      background: isSelected ? '#eff6ff' : '#f9fafb',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      width: '100%',
                      aspectRatio: '1',
                      background: '#e5e7eb',
                      borderRadius: 4,
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 32
                    }}>
                      {isSelected ? '✓' : '♪'}
                    </div>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#1f2937',
                      marginBottom: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {album.title}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {album.artist}
                    </div>
                    {album.custom_tags && album.custom_tags.length > 0 && (
                      <div style={{
                        fontSize: 10,
                        color: '#9ca3af',
                        marginTop: 4,
                        display: 'flex',
                        gap: 4,
                        flexWrap: 'wrap'
                      }}>
                        {album.custom_tags.slice(0, 2).map(tag => (
                          <span
                            key={tag}
                            style={{
                              padding: '2px 6px',
                              background: '#e5e7eb',
                              borderRadius: 3
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        {album.custom_tags.length > 2 && (
                          <span style={{ padding: '2px 6px' }}>
                            +{album.custom_tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}