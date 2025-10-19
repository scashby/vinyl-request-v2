// src/app/admin/edit-collection/page.tsx - WITH SALE FUNCTIONALITY
'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';

type Album = {
  id: number;
  artist: string;
  title: string;
  year: string | null;
  format: string;
  image_url: string | null;
  folder: string;
  for_sale: boolean;
  sale_price: number | null;
  sale_platform: string | null;
  custom_tags: string[] | null;
  media_condition: string | null;
  discogs_genres: string[] | null;
  discogs_styles: string[] | null;
  spotify_genres: string[] | null;
  apple_music_genres: string[] | null;
  spotify_label: string | null;
  apple_music_label: string | null;
  apple_music_genre: string | null;
  decade: number | null;
  tracklists: string | null;
  discogs_source: string | null;
  discogs_notes: string | null;
  sale_notes: string | null;
  pricing_notes: string | null;
  is_1001: boolean;
  steves_top_200: boolean;
  this_weeks_top_10: boolean;
  inner_circle_preferred: boolean;
  discogs_master_id: string | null;
  discogs_release_id: string | null;
  master_release_id: string | null;
  spotify_id: string | null;
  apple_music_id: string | null;
};

type TagDefinition = {
  id: string;
  tag_name: string;
  category: string;
  color: string;
};

const PLATFORMS = [
  { value: 'discogs', label: 'Discogs' },
  { value: 'shopify', label: 'Shopify Store' },
  { value: 'ebay', label: 'eBay' },
  { value: 'reverb', label: 'Reverb LP' },
  { value: 'other', label: 'Other' }
];

export default function EditCollectionPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([]);
  const [editingTagsFor, setEditingTagsFor] = useState<number | null>(null);
  const [albumTags, setAlbumTags] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  
  // Sale modal state
  const [saleModalAlbum, setSaleModalAlbum] = useState<Album | null>(null);
  const [salePrice, setSalePrice] = useState('');
  const [salePlatform, setSalePlatform] = useState('');
  const [saleQuantity, setSaleQuantity] = useState('1');
  const [saleNotes, setSaleNotes] = useState('');
  const [savingSale, setSavingSale] = useState(false);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    
    // Load tag definitions
    const { data: tagDefs } = await supabase
      .from('tag_definitions')
      .select('*')
      .order('category', { ascending: true });
    
    if (tagDefs) {
      setTagDefinitions(tagDefs as TagDefinition[]);
    }

    // Load albums - SELECT ALL TEXT/ARRAY/BOOLEAN FIELDS FROM SCHEMA
    const { data, error } = await supabase
      .from('collection')
      .select('id,artist,title,year,format,image_url,folder,for_sale,sale_price,sale_platform,custom_tags,media_condition,discogs_genres,discogs_styles,spotify_genres,apple_music_genres,apple_music_genre,spotify_label,apple_music_label,decade,tracklists,discogs_source,discogs_notes,sale_notes,pricing_notes,is_1001,steves_top_200,this_weeks_top_10,inner_circle_preferred,discogs_master_id,discogs_release_id,master_release_id,spotify_id,apple_music_id')
      .order('artist', { ascending: true });

    if (!error && data) {
      setAlbums(data as Album[]);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const filteredAlbums = albums.filter(album => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    
    // ALL TEXT FIELDS FROM SCHEMA
    const artist = album.artist.toLowerCase();
    const title = album.title.toLowerCase();
    const format = album.format?.toLowerCase() || '';
    const folder = album.folder?.toLowerCase() || '';
    const year = album.year?.toLowerCase() || '';
    const decade = album.decade?.toString() || '';
    const condition = album.media_condition?.toLowerCase() || '';
    const tracklists = album.tracklists?.toLowerCase() || '';
    const discogsSource = album.discogs_source?.toLowerCase() || '';
    const discogsNotes = album.discogs_notes?.toLowerCase() || '';
    const saleNotes = album.sale_notes?.toLowerCase() || '';
    const pricingNotes = album.pricing_notes?.toLowerCase() || '';
    const salePlatform = album.sale_platform?.toLowerCase() || '';
    
    // ALL ID FIELDS (in case someone searches by ID)
    const discogsMasterId = album.discogs_master_id?.toLowerCase() || '';
    const discogsReleaseId = album.discogs_release_id?.toLowerCase() || '';
    const masterReleaseId = album.master_release_id?.toLowerCase() || '';
    const spotifyId = album.spotify_id?.toLowerCase() || '';
    const appleMusicId = album.apple_music_id?.toLowerCase() || '';
    
    // ALL ARRAY FIELDS
    const tags = album.custom_tags?.map(t => t.toLowerCase()).join(' ') || '';
    const discogsGenres = album.discogs_genres?.map(g => g.toLowerCase()).join(' ') || '';
    const discogsStyles = album.discogs_styles?.map(s => s.toLowerCase()).join(' ') || '';
    const spotifyGenres = album.spotify_genres?.map(g => g.toLowerCase()).join(' ') || '';
    const appleMusicGenres = album.apple_music_genres?.map(g => g.toLowerCase()).join(' ') || '';
    
    // ALL LABEL FIELDS
    const spotifyLabel = album.spotify_label?.toLowerCase() || '';
    const appleMusicLabel = album.apple_music_label?.toLowerCase() || '';
    const appleMusicGenre = album.apple_music_genre?.toLowerCase() || '';
    
    // ALL BOOLEAN BADGE FIELDS - convert to searchable keywords
    const badges = [];
    if (album.is_1001) badges.push('1001', '1001 albums', 'thousand and one', '1001albums');
    if (album.steves_top_200) badges.push('top 200', 'steves top 200', 'top200', 'steve');
    if (album.this_weeks_top_10) badges.push('top 10', 'top10', 'this week', 'weekly');
    if (album.inner_circle_preferred) badges.push('inner circle', 'preferred', 'innercircle');
    if (album.for_sale) badges.push('for sale', 'selling', 'available');
    const badgeText = badges.join(' ');
    
    // COMBINE ABSOLUTELY EVERYTHING
    const searchableText = `${artist} ${title} ${format} ${folder} ${year} ${decade} ${condition} ${tracklists} ${discogsSource} ${discogsNotes} ${saleNotes} ${pricingNotes} ${salePlatform} ${tags} ${discogsGenres} ${discogsStyles} ${spotifyGenres} ${appleMusicGenres} ${appleMusicGenre} ${spotifyLabel} ${appleMusicLabel} ${badgeText} ${discogsMasterId} ${discogsReleaseId} ${masterReleaseId} ${spotifyId} ${appleMusicId}`;
    
    return searchableText.includes(query);
  });

  const openTagEditor = (album: Album) => {
    setEditingTagsFor(album.id);
    setAlbumTags(album.custom_tags || []);
  };

  const toggleTag = (tagName: string) => {
    setAlbumTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const addCustomTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !albumTags.includes(trimmed)) {
      setAlbumTags(prev => [...prev, trimmed]);
      setNewTagInput('');
    }
  };

  const removeTag = (tagName: string) => {
    setAlbumTags(prev => prev.filter(t => t !== tagName));
  };

  const exportResults = () => {
    const csv = [
      ['Artist', 'Title', 'Year', 'Format', 'Folder', 'Condition', 'Tags'].join(','),
      ...filteredAlbums.map(album => [
        `"${album.artist}"`,
        `"${album.title}"`,
        album.year || '',
        album.format,
        album.folder,
        album.media_condition || '',
        `"${(album.custom_tags || []).join(', ')}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collection-search-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printResults = () => {
    window.print();
  };

  const saveTags = async () => {
    if (!editingTagsFor) return;
    
    setSavingTags(true);
    
    const { error } = await supabase
      .from('collection')
      .update({ custom_tags: albumTags })
      .eq('id', editingTagsFor);

    if (!error) {
      await loadAlbums();
      setEditingTagsFor(null);
    }
    
    setSavingTags(false);
  };

  const openSaleModal = (album: Album) => {
    setSaleModalAlbum(album);
    setSalePrice(album.sale_price?.toString() || '');
    setSalePlatform(album.sale_platform || '');
    setSaleQuantity('1');
    setSaleNotes('');
  };

  const closeSaleModal = () => {
    setSaleModalAlbum(null);
    setSalePrice('');
    setSalePlatform('');
    setSaleQuantity('1');
    setSaleNotes('');
  };

  const markForSale = async () => {
    if (!saleModalAlbum) return;
    
    setSavingSale(true);
    
    const { error } = await supabase
      .from('collection')
      .update({
        for_sale: true,
        sale_price: salePrice ? parseFloat(salePrice) : null,
        sale_platform: salePlatform || null,
        sale_quantity: parseInt(saleQuantity) || 1,
        sale_notes: saleNotes || null
      })
      .eq('id', saleModalAlbum.id);

    if (!error) {
      await loadAlbums();
      closeSaleModal();
    }
    
    setSavingSale(false);
  };

  const removeFromSale = async (albumId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Remove this item from sale?')) return;
    
    const { error } = await supabase
      .from('collection')
      .update({
        for_sale: false,
        sale_price: null,
        sale_platform: null,
        sale_quantity: null,
        sale_notes: null
      })
      .eq('id', albumId);

    if (!error) {
      await loadAlbums();
    }
  };

  const tagsByCategory = tagDefinitions.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, TagDefinition[]>);

  const editingAlbum = albums.find(a => a.id === editingTagsFor);

  return (
    <div style={{
      padding: 24,
      background: '#f8fafc',
      minHeight: '100vh',
      maxWidth: 1400,
      margin: '0 auto'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32,
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <h1 style={{
            fontSize: 32,
            fontWeight: 'bold',
            color: '#1f2937',
            margin: '0 0 8px 0'
          }}>
            📚 Browse & Edit Collection
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: 16,
            margin: 0
          }}>
            Your daily collection browser - {filteredAlbums.length} albums
          </p>
        </div>

        <Link
          href="/admin/manage-tags"
          style={{
            background: '#8b5cf6',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none'
          }}
        >
          🏷️ Manage Tags
        </Link>
      </div>

      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div>
          <label style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: '#374151',
            marginBottom: 6
          }}>
            Search Collection
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search everything: artist, title, tracks, format, year, tags, genres, styles, labels, notes..."
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 15,
              color: '#1f2937',
              backgroundColor: 'white'
            }}
          />
          {searchQuery && (
            <div style={{
              marginTop: 8,
              fontSize: 13,
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Found {filteredAlbums.length} album{filteredAlbums.length !== 1 ? 's' : ''}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={exportResults}
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
                  📥 Export CSV
                </button>
                <button
                  onClick={printResults}
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
                  🖨️ Print
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 40,
          textAlign: 'center',
          color: '#6b7280'
        }}>
          Loading albums...
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
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                position: 'relative',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Sale Badge */}
              {album.for_sale && (
                <div style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: '#10b981',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  💰 ${album.sale_price?.toFixed(2) || '—'}
                </div>
              )}

              {/* Album Cover - clickable for tags */}
              <div
                onClick={() => openTagEditor(album)}
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  borderRadius: 6,
                  overflow: 'hidden'
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
                    objectFit: 'cover'
                  }}
                  unoptimized
                />
                
                {/* Tag count overlay */}
                {album.custom_tags && album.custom_tags.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    background: 'rgba(139, 92, 246, 0.9)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600
                  }}>
                    🏷️ {album.custom_tags.length}
                  </div>
                )}
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

              {/* NEW: Format, Folder, Year, Condition */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 11,
                color: '#6b7280',
                borderTop: '1px solid #f3f4f6',
                paddingTop: 8
              }}>
                {album.format && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span style={{ fontWeight: 600, color: '#3b82f6' }}>💿</span>
                    <span style={{ fontWeight: 600 }}>{album.format}</span>
                  </div>
                )}
                {album.folder && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span style={{ fontWeight: 600, color: '#8b5cf6' }}>📁</span>
                    <span>{album.folder}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  {album.year && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <span style={{ fontWeight: 600, color: '#f59e0b' }}>📅</span>
                      <span>{album.year}</span>
                    </div>
                  )}
                  {album.media_condition && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <span style={{ fontWeight: 600, color: '#10b981' }}>✓</span>
                      <span style={{ fontWeight: 600 }}>{album.media_condition}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags Preview */}
              {album.custom_tags && album.custom_tags.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 4
                }}>
                  {album.custom_tags.slice(0, 3).map(tagName => {
                    const tagDef = tagDefinitions.find(t => t.tag_name === tagName);
                    return (
                      <span
                        key={tagName}
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 3,
                          background: tagDef?.color || '#6b7280',
                          color: 'white',
                          fontWeight: 500
                        }}
                      >
                        {tagName}
                      </span>
                    );
                  })}
                  {album.custom_tags.length > 3 && (
                    <span style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      color: '#6b7280'
                    }}>
                      +{album.custom_tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: 6,
                marginTop: 4
              }}>
                <Link
                  href={`/admin/edit-entry/${album.id}`}
                  style={{
                    flex: 1,
                    padding: '6px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    textAlign: 'center',
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
                >
                  ✏️ Edit
                </Link>
                
                {album.for_sale ? (
                  <button
                    onClick={(e) => removeFromSale(album.id, e)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    🚫 Unsell
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openSaleModal(album);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    💰 Sell
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tag Editor Modal */}
      {editingTagsFor && editingAlbum && (
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
            maxWidth: 800,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              padding: 24,
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              gap: 16
            }}>
              <Image
                src={editingAlbum.image_url || '/images/placeholder.png'}
                alt={editingAlbum.title}
                width={80}
                height={80}
                style={{
                  borderRadius: 8,
                  objectFit: 'cover'
                }}
                unoptimized
              />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: '#1f2937',
                  marginBottom: 4
                }}>
                  {editingAlbum.title}
                </div>
                <div style={{
                  fontSize: 16,
                  color: '#6b7280'
                }}>
                  {editingAlbum.artist}
                </div>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              {/* Current Tags Section */}
              {albumTags.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#1f2937',
                    marginBottom: 12
                  }}>
                    Current Tags ({albumTags.length})
                  </h3>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    padding: 16,
                    background: '#f3f4f6',
                    borderRadius: 8
                  }}>
                    {albumTags.map(tagName => {
                      const tagDef = tagDefinitions.find(t => t.tag_name === tagName);
                      return (
                        <div
                          key={tagName}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 12px',
                            borderRadius: 6,
                            background: tagDef?.color || '#6b7280',
                            color: 'white',
                            fontSize: 14,
                            fontWeight: 600
                          }}
                        >
                          <span>{tagName}</span>
                          <button
                            onClick={() => removeTag(tagName)}
                            style={{
                              background: 'rgba(255,255,255,0.3)',
                              border: 'none',
                              borderRadius: 4,
                              color: 'white',
                              cursor: 'pointer',
                              padding: '2px 6px',
                              fontSize: 12,
                              fontWeight: 'bold'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add Custom Tag */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#1f2937',
                  marginBottom: 12
                }}>
                  Add Custom Tag
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && addCustomTag()}
                    placeholder="Type tag name and press Enter..."
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontSize: 14,
                      color: '#1f2937',
                      backgroundColor: 'white'
                    }}
                  />
                  <button
                    onClick={addCustomTag}
                    disabled={!newTagInput.trim()}
                    style={{
                      padding: '10px 20px',
                      background: newTagInput.trim() ? '#10b981' : '#9ca3af',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: newTagInput.trim() ? 'pointer' : 'not-allowed'
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Quick Select from Pre-defined Tags */}
              <h3 style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#1f2937',
                marginBottom: 16
              }}>
                Quick Select
              </h3>

              {Object.entries(tagsByCategory).map(([category, tags]) => (
                <div key={category} style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                    letterSpacing: '0.5px'
                  }}>
                    {category} ({tags.length} tags)
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8
                  }}>
                    {tags.length === 0 ? (
                      <div style={{ color: '#9ca3af', fontSize: 13 }}>No tags in this category</div>
                    ) : (
                      tags.map(tag => {
                        const isSelected = albumTags.includes(tag.tag_name);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.tag_name)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 6,
                              border: `2px solid ${tag.color}`,
                              background: isSelected ? tag.color : 'white',
                              color: isSelected ? 'white' : tag.color,
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              whiteSpace: 'nowrap',
                              minWidth: 60
                            }}
                          >
                            {isSelected && '✓ '}{tag.tag_name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              padding: 24,
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12
            }}>
              <button
                onClick={() => setEditingTagsFor(null)}
                disabled={savingTags}
                style={{
                  padding: '10px 20px',
                  background: '#6b7280',
                  color: 'white',
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

      {/* Sale Modal */}
      {saleModalAlbum && (
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
            <div style={{
              padding: 24,
              borderBottom: '1px solid #e5e7eb'
            }}>
              <div style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#1f2937',
                marginBottom: 4
              }}>
                💰 Mark for Sale
              </div>
              <div style={{
                fontSize: 14,
                color: '#6b7280'
              }}>
                {saleModalAlbum.artist} - {saleModalAlbum.title}
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
                  Sale Price (USD)
                </label>
                <input
                  type="number"
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    color: '#1f2937',
                    backgroundColor: 'white'
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 6
                }}>
                  Platform
                </label>
                <select
                  value={salePlatform}
                  onChange={e => setSalePlatform(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    backgroundColor: 'white',
                    color: '#1f2937'
                  }}
                >
                  <option value="">Select platform...</option>
                  {PLATFORMS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 6
                }}>
                  Quantity
                </label>
                <input
                  type="number"
                  value={saleQuantity}
                  onChange={e => setSaleQuantity(e.target.value)}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    color: '#1f2937',
                    backgroundColor: 'white'
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
                  Notes (Optional)
                </label>
                <textarea
                  value={saleNotes}
                  onChange={e => setSaleNotes(e.target.value)}
                  placeholder="Condition, special details..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    color: '#1f2937',
                    backgroundColor: 'white'
                  }}
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
                onClick={closeSaleModal}
                disabled={savingSale}
                style={{
                  padding: '10px 20px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: savingSale ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={markForSale}
                disabled={savingSale}
                style={{
                  padding: '10px 20px',
                  background: savingSale ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: savingSale ? 'not-allowed' : 'pointer'
                }}
              >
                {savingSale ? 'Saving...' : 'Mark for Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}