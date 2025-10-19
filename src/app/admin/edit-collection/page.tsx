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
  decade: number | null;
};

type TagDefinition = {
  id: string;
  name: string;
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

    // Load albums
    const { data, error } = await supabase
      .from('collection')
      .select('id,artist,title,year,format,image_url,folder,for_sale,sale_price,sale_platform,custom_tags,media_condition,discogs_genres,discogs_styles,spotify_genres,apple_music_genres,spotify_label,apple_music_label,decade')
      .order('artist', { ascending: true })
      .limit(1000);

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
    
    // Basic fields
    const artist = album.artist.toLowerCase();
    const title = album.title.toLowerCase();
    const format = album.format?.toLowerCase() || '';
    const folder = album.folder?.toLowerCase() || '';
    const year = album.year?.toLowerCase() || '';
    const decade = album.decade?.toString() || '';
    const condition = album.media_condition?.toLowerCase() || '';
    
    // Array fields - custom tags
    const tags = album.custom_tags?.map(t => t.toLowerCase()).join(' ') || '';
    
    // Array fields - genres and styles from multiple sources
    const discogsGenres = album.discogs_genres?.map(g => g.toLowerCase()).join(' ') || '';
    const discogsStyles = album.discogs_styles?.map(s => s.toLowerCase()).join(' ') || '';
    const spotifyGenres = album.spotify_genres?.map(g => g.toLowerCase()).join(' ') || '';
    const appleMusicGenres = album.apple_music_genres?.map(g => g.toLowerCase()).join(' ') || '';
    
    // Labels
    const spotifyLabel = album.spotify_label?.toLowerCase() || '';
    const appleMusicLabel = album.apple_music_label?.toLowerCase() || '';
    
    // Combine everything into one searchable string
    const searchableText = `${artist} ${title} ${format} ${folder} ${year} ${decade} ${condition} ${tags} ${discogsGenres} ${discogsStyles} ${spotifyGenres} ${appleMusicGenres} ${spotifyLabel} ${appleMusicLabel}`;
    
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
            placeholder="Search across artist, title, format, year, condition, tags, genres, styles, labels..."
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 15
            }}
          />
          {searchQuery && (
            <div style={{
              marginTop: 8,
              fontSize: 13,
              color: '#6b7280'
            }}>
              Found {filteredAlbums.length} album{filteredAlbums.length !== 1 ? 's' : ''}
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
                    const tagDef = tagDefinitions.find(t => t.name === tagName);
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
              <h3 style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#1f2937',
                marginBottom: 16
              }}>
                Select Tags
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
                    {category}
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8
                  }}>
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.name)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 6,
                          border: `2px solid ${tag.color}`,
                          background: albumTags.includes(tag.name) ? tag.color : 'white',
                          color: albumTags.includes(tag.name) ? 'white' : tag.color,
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {albumTags.includes(tag.name) ? '✓ ' : ''}{tag.name}
                      </button>
                    ))}
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
                    fontSize: 14
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
                    backgroundColor: 'white'
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
                    fontSize: 14
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
                    fontFamily: 'inherit'
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