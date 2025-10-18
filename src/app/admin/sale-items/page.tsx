// src/app/admin/sale-items/page.tsx - Complete Merchandise Management
'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';

type SaleItem = {
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
  sale_quantity: number | null;
  sale_notes: string | null;
};

const PLATFORMS = [
  { value: 'discogs', label: 'Discogs', url: 'https://www.discogs.com/sell/list', color: '#333' },
  { value: 'shopify', label: 'Shopify Store', url: 'https://deadwaxdialogues.com/admin', color: '#96bf48' },
  { value: 'ebay', label: 'eBay', url: 'https://www.ebay.com/sh/lst/active', color: '#e53238' },
  { value: 'reverb', label: 'Reverb LP', url: 'https://reverb.com/my/listings', color: '#ff6600' },
  { value: 'other', label: 'Other', url: null, color: '#6b7280' }
];

export default function SaleItemsPage() {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterFolder, setFilterFolder] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<SaleItem>>({});
  const [saving, setSaving] = useState(false);

  const [availableFolders, setAvailableFolders] = useState<string[]>([]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('collection')
      .select('id,artist,title,year,format,image_url,folder,for_sale,sale_price,sale_platform,sale_quantity,sale_notes')
      .eq('for_sale', true)
      .order('artist', { ascending: true });

    if (!error && data) {
      setItems(data as SaleItem[]);
      
      const folders = Array.from(new Set(data.map((item: SaleItem) => item.folder).filter(Boolean)));
      setAvailableFolders(folders.sort());
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = items.filter(item => {
    if (filterPlatform !== 'all' && item.sale_platform !== filterPlatform) return false;
    if (filterFolder !== 'all' && item.folder !== filterFolder) return false;
    if (minPrice && (!item.sale_price || item.sale_price < parseFloat(minPrice))) return false;
    if (maxPrice && (!item.sale_price || item.sale_price > parseFloat(maxPrice))) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!item.artist.toLowerCase().includes(term) && !item.title.toLowerCase().includes(term)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: items.length,
    totalValue: items.reduce((sum, item) => sum + (item.sale_price || 0), 0),
    byPlatform: items.reduce((acc, item) => {
      const platform = item.sale_platform || 'unlisted';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    totalQuantity: items.reduce((sum, item) => sum + (item.sale_quantity || 0), 0)
  };

  const startEdit = (item: SaleItem) => {
    setEditingId(item.id);
    setEditValues({
      sale_price: item.sale_price,
      sale_platform: item.sale_platform,
      sale_quantity: item.sale_quantity,
      sale_notes: item.sale_notes
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async (id: number) => {
    setSaving(true);
    
    const { error } = await supabase
      .from('collection')
      .update(editValues)
      .eq('id', id);

    if (!error) {
      await loadItems();
      setEditingId(null);
      setEditValues({});
    }
    
    setSaving(false);
  };

  const removeFromSale = async (id: number) => {
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
      .eq('id', id);

    if (!error) {
      await loadItems();
    }
  };

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
          💰 Sale Items & Merchandise
        </h1>
        <p style={{
          color: '#6b7280',
          fontSize: 16,
          margin: 0
        }}>
          Manage pricing, inventory, and listings across platforms
        </p>
      </div>

      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          padding: 20,
          borderRadius: 12,
          color: 'white'
        }}>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>Total Items</div>
          <div style={{ fontSize: 32, fontWeight: 'bold' }}>{stats.total}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            {stats.totalQuantity} copies available
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          padding: 20,
          borderRadius: 12,
          color: 'white'
        }}>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>Total Value</div>
          <div style={{ fontSize: 32, fontWeight: 'bold' }}>
            ${stats.totalValue.toFixed(2)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            Avg: ${stats.total > 0 ? (stats.totalValue / stats.total).toFixed(2) : '0.00'}
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          padding: 20,
          borderRadius: 12,
          color: 'white'
        }}>
          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>By Platform</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>
            {Object.entries(stats.byPlatform).map(([platform, count]) => (
              <div key={platform} style={{ marginBottom: 4 }}>
                {platform}: {count}
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: 20,
          borderRadius: 12,
          border: '2px solid #e5e7eb'
        }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
            Quick Links
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PLATFORMS.filter(p => p.url).map(platform => (
              <a
                key={platform.value}
                href={platform.url!}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: platform.color,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {platform.label} →
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#1f2937',
          margin: '0 0 16px 0'
        }}>
          🔍 Filter Items
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#374151',
              marginBottom: 4
            }}>
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Artist or title..."
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
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#374151',
              marginBottom: 4
            }}>
              Platform
            </label>
            <select
              value={filterPlatform}
              onChange={e => setFilterPlatform(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                backgroundColor: 'white'
              }}
            >
              <option value="all">All Platforms</option>
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
              <option value="unlisted">Unlisted</option>
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#374151',
              marginBottom: 4
            }}>
              Folder
            </label>
            <select
              value={filterFolder}
              onChange={e => setFilterFolder(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                backgroundColor: 'white'
              }}
            >
              <option value="all">All Folders</option>
              {availableFolders.map(folder => (
                <option key={folder} value={folder}>{folder}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#374151',
              marginBottom: 4
            }}>
              Min Price
            </label>
            <input
              type="number"
              value={minPrice}
              onChange={e => setMinPrice(e.target.value)}
              placeholder="$0"
              step="0.01"
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
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#374151',
              marginBottom: 4
            }}>
              Max Price
            </label>
            <input
              type="number"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              placeholder="$999"
              step="0.01"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>
        </div>

        <div style={{
          marginTop: 12,
          padding: 8,
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 6,
          fontSize: 13,
          color: '#0c4a6e'
        }}>
          Showing {filteredItems.length} of {items.length} sale items
        </div>
      </div>

      {/* Items List */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            Loading sale items...
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏷️</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              {items.length === 0 ? 'No items for sale yet' : 'No items match your filters'}
            </div>
            <div style={{ fontSize: 14 }}>
              {items.length === 0 ? (
                <>Mark items for sale from <Link href="/admin/edit-collection" style={{ color: '#3b82f6' }}>Browse Collection</Link></>
              ) : (
                'Try adjusting your filter settings'
              )}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{
                  background: '#f9fafb',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
                    Album
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
                    Price
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
                    Platform
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
                    Qty
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
                    Notes
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      background: editingId === item.id ? '#fef3c7' : 'white'
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Image
                          src={item.image_url || '/images/placeholder.png'}
                          alt={item.title}
                          width={50}
                          height={50}
                          style={{
                            borderRadius: 4,
                            objectFit: 'cover'
                          }}
                          unoptimized
                        />
                        <div>
                          <div style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#1f2937',
                            marginBottom: 2
                          }}>
                            {item.title}
                          </div>
                          <div style={{
                            fontSize: 13,
                            color: '#6b7280'
                          }}>
                            {item.artist}
                          </div>
                          <div style={{
                            fontSize: 12,
                            color: '#9ca3af'
                          }}>
                            {item.year} • {item.format} • {item.folder}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {editingId === item.id ? (
                        <input
                          type="number"
                          value={editValues.sale_price ?? ''}
                          onChange={e => setEditValues({ ...editValues, sale_price: parseFloat(e.target.value) || null })}
                          step="0.01"
                          placeholder="0.00"
                          style={{
                            width: 80,
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            fontSize: 13
                          }}
                        />
                      ) : (
                        <span style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: item.sale_price ? '#059669' : '#9ca3af'
                        }}>
                          {item.sale_price ? `$${item.sale_price.toFixed(2)}` : 'Not set'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {editingId === item.id ? (
                        <select
                          value={editValues.sale_platform ?? ''}
                          onChange={e => setEditValues({ ...editValues, sale_platform: e.target.value || null })}
                          style={{
                            width: 120,
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            fontSize: 13,
                            backgroundColor: 'white'
                          }}
                        >
                          <option value="">Select...</option>
                          {PLATFORMS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{
                          fontSize: 13,
                          color: item.sale_platform ? '#1f2937' : '#9ca3af',
                          fontWeight: item.sale_platform ? 500 : 400
                        }}>
                          {item.sale_platform 
                            ? PLATFORMS.find(p => p.value === item.sale_platform)?.label || item.sale_platform
                            : 'Unlisted'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {editingId === item.id ? (
                        <input
                          type="number"
                          value={editValues.sale_quantity ?? ''}
                          onChange={e => setEditValues({ ...editValues, sale_quantity: parseInt(e.target.value) || null })}
                          min="1"
                          style={{
                            width: 60,
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            fontSize: 13
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 14, color: '#1f2937' }}>
                          {item.sale_quantity || 1}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: 200 }}>
                      {editingId === item.id ? (
                        <input
                          type="text"
                          value={editValues.sale_notes ?? ''}
                          onChange={e => setEditValues({ ...editValues, sale_notes: e.target.value || null })}
                          placeholder="Condition, details..."
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            fontSize: 13
                          }}
                        />
                      ) : (
                        <span style={{
                          fontSize: 13,
                          color: item.sale_notes ? '#1f2937' : '#9ca3af',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.sale_notes || '—'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {editingId === item.id ? (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => saveEdit(item.id)}
                            disabled={saving}
                            style={{
                              padding: '6px 12px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            style={{
                              padding: '6px 12px',
                              background: '#6b7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <Link
                            href={`/admin/edit-entry/${item.id}`}
                            style={{
                              padding: '6px 12px',
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'inline-block'
                            }}
                          >
                            Edit Full
                          </Link>
                          <button
                            onClick={() => startEdit(item)}
                            style={{
                              padding: '6px 12px',
                              background: '#8b5cf6',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Quick Edit
                          </button>
                          <button
                            onClick={() => removeFromSale(item.id)}
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
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}