// src/app/admin/manage-metadata/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { supabase } from 'lib/supabaseClient';

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
  discogs_genres: string[];
  discogs_styles: string[];
  image_url: string | null;
};

type MetadataStats = {
  name: string;
  count: number;
  albums: Album[];
};

type TabType = 'tags' | 'genres' | 'styles';

export default function ManageMetadata() {
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([]);
  const [genreStats, setGenreStats] = useState<MetadataStats[]>([]);
  const [styleStats, setStyleStats] = useState<MetadataStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('tags');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [newTag, setNewTag] = useState({
    tag_name: '',
    category: 'theme' as 'theme' | 'mood' | 'occasion' | 'special',
    color: '#3b82f6',
    description: ''
  });

  // Metadata renaming
  const [renamingItem, setRenamingItem] = useState<{ type: 'genre' | 'style'; oldName: string; newName: string } | null>(null);
  const [renaming, setRenaming] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadTagDefinitions(),
      calculateGenreStats(),
      calculateStyleStats()
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

  async function calculateGenreStats() {
    const { data, error } = await supabase
      .from('collection')
      .select('id, artist, title, discogs_genres, image_url');
    
    if (error) {
      console.error('Error calculating genre stats:', error);
      return;
    }

    const genreMap = new Map<string, Album[]>();
    
    data?.forEach(album => {
      if (album.discogs_genres && Array.isArray(album.discogs_genres)) {
        album.discogs_genres.forEach((genre: string) => {
          if (!genreMap.has(genre)) {
            genreMap.set(genre, []);
          }
          genreMap.get(genre)?.push({
            id: album.id,
            artist: album.artist,
            title: album.title,
            custom_tags: [],
            discogs_genres: album.discogs_genres,
            discogs_styles: [],
            image_url: album.image_url
          });
        });
      }
    });

    const stats: MetadataStats[] = Array.from(genreMap.entries()).map(([name, albums]) => ({
      name,
      count: albums.length,
      albums
    })).sort((a, b) => b.count - a.count);

    setGenreStats(stats);
  }

  async function calculateStyleStats() {
    const { data, error } = await supabase
      .from('collection')
      .select('id, artist, title, discogs_styles, image_url');
    
    if (error) {
      console.error('Error calculating style stats:', error);
      return;
    }

    const styleMap = new Map<string, Album[]>();
    
    data?.forEach(album => {
      if (album.discogs_styles && Array.isArray(album.discogs_styles)) {
        album.discogs_styles.forEach((style: string) => {
          if (!styleMap.has(style)) {
            styleMap.set(style, []);
          }
          styleMap.get(style)?.push({
            id: album.id,
            artist: album.artist,
            title: album.title,
            custom_tags: [],
            discogs_genres: [],
            discogs_styles: album.discogs_styles,
            image_url: album.image_url
          });
        });
      }
    });

    const stats: MetadataStats[] = Array.from(styleMap.entries()).map(([name, albums]) => ({
      name,
      count: albums.length,
      albums
    })).sort((a, b) => b.count - a.count);

    setStyleStats(stats);
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

    const { error: defError } = await supabase
      .from('tag_definitions')
      .delete()
      .eq('id', id);

    if (defError) {
      console.error('Error deleting tag definition:', defError);
      alert('Error deleting tag');
      return;
    }

    // Remove tag from all albums - fetch ALL albums and filter client-side
    const { data: allAlbums, error: fetchError } = await supabase
      .from('collection')
      .select('id, custom_tags');
    
    if (fetchError) {
      console.error('Error fetching albums:', fetchError);
      return;
    }

    if (allAlbums) {
      const albumsWithTag = allAlbums.filter(album => 
        album.custom_tags && Array.isArray(album.custom_tags) && album.custom_tags.includes(tagName)
      );

      for (const album of albumsWithTag) {
        const updatedTags = (album.custom_tags || []).filter(t => t !== tagName);
        const { error: updateError } = await supabase
          .from('collection')
          .update({ custom_tags: updatedTags })
          .eq('id', album.id);
        
        if (updateError) {
          console.error(`Error updating album ${album.id}:`, updateError);
        }
      }
    }

    loadData();
  }

  async function renameMetadata() {
    if (!renamingItem || !renamingItem.newName.trim()) {
      alert('New name is required');
      return;
    }

    if (renamingItem.oldName === renamingItem.newName) {
      setRenamingItem(null);
      return;
    }

    setRenaming(true);

    try {
      const field = renamingItem.type === 'genre' ? 'discogs_genres' : 'discogs_styles';
      
      type AlbumWithMetadata = {
        id: number;
        discogs_genres?: string[];
        discogs_styles?: string[];
      };

      const { data: albumsWithItem, error: fetchError } = await supabase
        .from('collection')
        .select(`id, ${field}`)
        .returns<AlbumWithMetadata[]>();

      if (fetchError) {
        throw fetchError;
      }

      if (albumsWithItem) {
        // Filter albums that contain the old name
        const filteredAlbums = albumsWithItem.filter(album => {
          const items = album[field as keyof AlbumWithMetadata];
          return Array.isArray(items) && items.includes(renamingItem.oldName);
        });

        for (const album of filteredAlbums) {
          const items = album[field as keyof AlbumWithMetadata] as string[] || [];
          const updated = items.map((item: string) => 
            item === renamingItem.oldName ? renamingItem.newName : item
          );
          
          const { error: updateError } = await supabase
            .from('collection')
            .update({ [field]: updated })
            .eq('id', album.id);
          
          if (updateError) {
            console.error(`Error updating album ${album.id}:`, updateError);
          }
        }
      }

      setRenamingItem(null);
      loadData();
      alert(`Successfully renamed "${renamingItem.oldName}" to "${renamingItem.newName}"`);
    } catch (error) {
      console.error('Error renaming:', error);
      alert('Error renaming item');
    } finally {
      setRenaming(false);
    }
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

  const tabStyle = (tab: TabType) => ({
    padding: '12px 24px',
    background: activeTab === tab ? '#3b82f6' : 'transparent',
    color: activeTab === tab ? 'white' : '#6b7280',
    border: 'none',
    borderRadius: '8px 8px 0 0',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  });

  if (loading) {
    return (
      <div style={{ 
        padding: 24, 
        background: '#f8fafc', 
        minHeight: '100vh', 
        maxWidth: 1600, 
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
          <div style={{ fontSize: 18, color: '#6b7280' }}>Loading metadata...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh', maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', color: '#1f2937', margin: '0 0 8px 0' }}>
          🏷️ Manage Tags
        </h1>
        <p style={{ color: '#6b7280', fontSize: 16, margin: 0 }}>
          Manage custom tags, genres, and styles across your collection
        </p>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 8, borderBottom: '2px solid #e5e7eb' }}>
        <button onClick={() => setActiveTab('tags')} style={tabStyle('tags')}>
          🏷️ Custom Tags
        </button>
        <button onClick={() => setActiveTab('genres')} style={tabStyle('genres')}>
          🎵 Genres ({genreStats.length})
        </button>
        <button onClick={() => setActiveTab('styles')} style={tabStyle('styles')}>
          🎨 Styles ({styleStats.length})
        </button>
      </div>

      {/* TAGS TAB */}
      {activeTab === 'tags' && (
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

      {/* GENRES TAB */}
      {activeTab === 'genres' && (
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
              Genre Usage Statistics
            </h2>
          </div>

          {genreStats.length === 0 ? (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>
              No genres have been applied to albums yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {genreStats.map(stat => {
                const isExpanded = expandedItems.has(`genre-${stat.name}`);
                const displayedAlbums = isExpanded ? stat.albums : stat.albums.slice(0, 10);
                
                return (
                  <div key={stat.name} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
                          {stat.name}
                        </span>
                        <span style={{ marginLeft: 8, fontSize: 14, color: '#6b7280' }}>
                          ({stat.count} album{stat.count !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <button
                        onClick={() => setRenamingItem({ type: 'genre', oldName: stat.name, newName: stat.name })}
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
                        ✏️ Rename
                      </button>
                      {stat.albums.length > 10 && (
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedItems);
                            if (isExpanded) {
                              newExpanded.delete(`genre-${stat.name}`);
                            } else {
                              newExpanded.add(`genre-${stat.name}`);
                            }
                            setExpandedItems(newExpanded);
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {isExpanded ? 'Show Less' : `Show All ${stat.count}`}
                        </button>
                      )}
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: 8
                    }}>
                      {displayedAlbums.map(album => (
                        <div
                          key={album.id}
                          style={{
                            background: '#f9fafb',
                            borderRadius: 6,
                            overflow: 'hidden',
                            border: '1px solid #e5e7eb'
                          }}
                        >
                          <div style={{
                            width: '100%',
                            aspectRatio: '1',
                            background: '#e5e7eb',
                            overflow: 'hidden',
                            position: 'relative'
                          }}>
                            {album.image_url ? (
                              <Image 
                                src={album.image_url} 
                                alt={`${album.title} by ${album.artist}`}
                                fill
                                sizes="120px"
                                style={{
                                  objectFit: 'cover'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 32,
                                color: '#9ca3af'
                              }}>
                                ♪
                              </div>
                            )}
                          </div>
                          <div style={{ padding: 8 }}>
                            <div style={{ 
                              fontWeight: 600, 
                              color: '#1f2937', 
                              marginBottom: 2,
                              fontSize: 11,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {album.title}
                            </div>
                            <div style={{ 
                              color: '#6b7280',
                              fontSize: 10,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {album.artist}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STYLES TAB */}
      {activeTab === 'styles' && (
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
              Style Usage Statistics
            </h2>
          </div>

          {styleStats.length === 0 ? (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>
              No styles have been applied to albums yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {styleStats.map(stat => {
                const isExpanded = expandedItems.has(`style-${stat.name}`);
                const displayedAlbums = isExpanded ? stat.albums : stat.albums.slice(0, 10);
                
                return (
                  <div key={stat.name} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
                          {stat.name}
                        </span>
                        <span style={{ marginLeft: 8, fontSize: 14, color: '#6b7280' }}>
                          ({stat.count} album{stat.count !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <button
                        onClick={() => setRenamingItem({ type: 'style', oldName: stat.name, newName: stat.name })}
                        style={{
                          padding: '6px 12px',
                          background: '#ec4899',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Rename
                      </button>
                      {stat.albums.length > 10 && (
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedItems);
                            if (isExpanded) {
                              newExpanded.delete(`style-${stat.name}`);
                            } else {
                              newExpanded.add(`style-${stat.name}`);
                            }
                            setExpandedItems(newExpanded);
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {isExpanded ? 'Show Less' : `Show All ${stat.count}`}
                        </button>
                      )}
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: 8
                    }}>
                      {displayedAlbums.map(album => (
                        <div
                          key={album.id}
                          style={{
                            background: '#f9fafb',
                            borderRadius: 6,
                            overflow: 'hidden',
                            border: '1px solid #e5e7eb'
                          }}
                        >
                          <div style={{
                            width: '100%',
                            aspectRatio: '1',
                            background: '#e5e7eb',
                            overflow: 'hidden',
                            position: 'relative'
                          }}>
                            {album.image_url ? (
                              <Image 
                                src={album.image_url} 
                                alt={`${album.title} by ${album.artist}`}
                                fill
                                sizes="120px"
                                style={{
                                  objectFit: 'cover'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 32,
                                color: '#9ca3af'
                              }}>
                                ♪
                              </div>
                            )}
                          </div>
                          <div style={{ padding: 8 }}>
                            <div style={{ 
                              fontWeight: 600, 
                              color: '#1f2937', 
                              marginBottom: 2,
                              fontSize: 11,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {album.title}
                            </div>
                            <div style={{ 
                              color: '#6b7280',
                              fontSize: 10,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {album.artist}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rename Modal */}
      {renamingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            maxWidth: 500,
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ padding: 24, borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 }}>
                ✏️ Rename {renamingItem.type === 'genre' ? 'Genre' : 'Style'}
              </div>
              <div style={{ fontSize: 14, color: '#6b7280' }}>
                This will update all albums using this {renamingItem.type}
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 6
                }}>
                  Current Name
                </label>
                <input
                  type="text"
                  value={renamingItem.oldName}
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    color: '#9ca3af',
                    backgroundColor: '#f3f4f6'
                  }}
                />
              </div>

              <div style={{ marginBottom: 0 }}>
                <label style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 6
                }}>
                  New Name
                </label>
                <input
                  type="text"
                  value={renamingItem.newName}
                  onChange={e => setRenamingItem({ ...renamingItem, newName: e.target.value })}
                  placeholder="Enter new name..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    color: '#1f2937',
                    backgroundColor: 'white'
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div style={{
              padding: 24,
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12
            }}>
              <button
                onClick={() => setRenamingItem(null)}
                disabled={renaming}
                style={{
                  padding: '10px 20px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: renaming ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={renameMetadata}
                disabled={renaming || !renamingItem.newName.trim()}
                style={{
                  padding: '10px 20px',
                  background: renaming || !renamingItem.newName.trim() ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: renaming || !renamingItem.newName.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {renaming ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}