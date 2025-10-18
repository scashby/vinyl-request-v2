// src/app/admin/manage-tags/page.tsx
"use client";

import Link from 'next/link';

export default function ManageTagsPage() {
  return (
    <div style={{
      padding: 24,
      background: '#f8fafc',
      minHeight: '100vh',
      maxWidth: 1400,
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 'bold',
          color: '#1f2937',
          margin: '0 0 8px 0'
        }}>
          🏷️ Manage Tags
        </h1>
        <p style={{
          color: '#6b7280',
          fontSize: 16,
          margin: 0
        }}>
          Create and manage custom tags for collection organization and search
        </p>
      </div>

      {/* Coming Soon Card */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 40,
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          fontSize: 64,
          marginBottom: 16
        }}>
          🚧
        </div>
        <h2 style={{
          fontSize: 24,
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 12
        }}>
          Tag Management Coming Soon
        </h2>
        <p style={{
          color: '#6b7280',
          fontSize: 16,
          marginBottom: 24,
          maxWidth: 600,
          margin: '0 auto 24px'
        }}>
          This page will allow you to create, edit, and organize custom tags
          for your collection. Tags will help users discover albums by themes,
          moods, occasions, and more.
        </p>

        <div style={{
          display: 'inline-flex',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <Link
            href="/admin/edit-collection"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: '#8b5cf6',
              color: 'white',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 14
            }}
          >
            📚 Browse Collection
          </Link>
          <Link
            href="/admin/admin-dashboard"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: '#6b7280',
              color: 'white',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 14
            }}
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Planned Tag Categories */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
        marginTop: 24,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: 18,
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 16
        }}>
          📋 Planned Tag Categories
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 16
        }}>
          {/* Themes */}
          <div style={{
            padding: 16,
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: 8
          }}>
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#92400e',
              marginBottom: 8
            }}>
              🎃 Themes
            </div>
            <div style={{
              fontSize: 13,
              color: '#78350f',
              lineHeight: 1.6
            }}>
              Halloween, Christmas, Valentine&apos;s Day, Summer, Spring, Fall, Winter
            </div>
          </div>

          {/* Moods */}
          <div style={{
            padding: 16,
            background: '#dbeafe',
            border: '1px solid #3b82f6',
            borderRadius: 8
          }}>
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1e3a8a',
              marginBottom: 8
            }}>
              😊 Moods
            </div>
            <div style={{
              fontSize: 13,
              color: '#1e40af',
              lineHeight: 1.6
            }}>
              Party, Chill, Workout, Romantic, Energetic, Mellow, Upbeat
            </div>
          </div>

          {/* Occasions */}
          <div style={{
            padding: 16,
            background: '#fce7f3',
            border: '1px solid #ec4899',
            borderRadius: 8
          }}>
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#831843',
              marginBottom: 8
            }}>
              🎉 Occasions
            </div>
            <div style={{
              fontSize: 13,
              color: '#9f1239',
              lineHeight: 1.6
            }}>
              Wedding, Road Trip, Dinner Party, Study Session, Date Night
            </div>
          </div>

          {/* Special */}
          <div style={{
            padding: 16,
            background: '#f3e8ff',
            border: '1px solid #a855f7',
            borderRadius: 8
          }}>
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#581c87',
              marginBottom: 8
            }}>
              ⭐ Special
            </div>
            <div style={{
              fontSize: 13,
              color: '#6b21a8',
              lineHeight: 1.6
            }}>
              Rare Pressing, Colored Vinyl, Limited Edition, First Pressing, Import
            </div>
          </div>
        </div>
      </div>

      {/* Planned Features */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
        marginTop: 24,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{
          fontSize: 18,
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 16
        }}>
          🛠️ Planned Features
        </h3>
        <ul style={{
          color: '#6b7280',
          fontSize: 14,
          lineHeight: 1.8,
          paddingLeft: 24
        }}>
          <li>Create and organize tag categories</li>
          <li>Bulk tag assignment across multiple albums</li>
          <li>Tag usage statistics and suggestions</li>
          <li>Integration with Browse Collection filters</li>
          <li>Integration with Advanced Search page</li>
          <li>Inline tag editor in Edit Collection view</li>
          <li>Auto-tagging suggestions based on genres/metadata</li>
          <li>Import/export tag sets</li>
        </ul>
      </div>
    </div>
  );
}