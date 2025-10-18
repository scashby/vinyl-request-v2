// src/app/admin/specialized-searches/page.tsx
"use client";

import { useState } from 'react';
import Link from 'next/link';

type TabType = 'cd-only' | '1001-albums';

export default function SpecializedSearchesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('cd-only');

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
          🔎 Specialized Searches
        </h1>
        <p style={{
          color: '#6b7280',
          fontSize: 16,
          margin: 0
        }}>
          Find specific subsets of your collection with specialized search tools
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        marginBottom: 24
      }}>
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <button
            onClick={() => setActiveTab('cd-only')}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: activeTab === 'cd-only' ? '#8b5cf6' : 'white',
              color: activeTab === 'cd-only' ? 'white' : '#6b7280',
              border: 'none',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              borderBottom: activeTab === 'cd-only' ? '3px solid #7c3aed' : 'none'
            }}
          >
            💿 CD-Only Releases
          </button>
          <button
            onClick={() => setActiveTab('1001-albums')}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: activeTab === '1001-albums' ? '#8b5cf6' : 'white',
              color: activeTab === '1001-albums' ? 'white' : '#6b7280',
              border: 'none',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              borderBottom: activeTab === '1001-albums' ? '3px solid #7c3aed' : 'none'
            }}
          >
            📖 1001 Albums
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: 32 }}>
          {activeTab === 'cd-only' && (
            <CDOnlyTab />
          )}
          {activeTab === '1001-albums' && (
            <Thousand1AlbumsTab />
          )}
        </div>
      </div>

      {/* Back Link */}
      <div style={{ textAlign: 'center' }}>
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
  );
}

function CDOnlyTab() {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>💿</div>
        <h2 style={{
          fontSize: 24,
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 12
        }}>
          CD-Only Release Finder
        </h2>
        <p style={{
          color: '#6b7280',
          fontSize: 16,
          maxWidth: 600,
          margin: '0 auto'
        }}>
          Find albums in your collection that were never released on vinyl
        </p>
      </div>

      {/* Info Box */}
      <div style={{
        background: '#eff6ff',
        border: '1px solid #3b82f6',
        borderRadius: 8,
        padding: 20,
        marginBottom: 24
      }}>
        <h3 style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#1e40af',
          marginBottom: 8
        }}>
          ℹ️ About This Tool
        </h3>
        <p style={{
          color: '#1e40af',
          fontSize: 14,
          lineHeight: 1.6,
          margin: 0
        }}>
          This tool searches Discogs to identify albums in your collection that were
          only released on CD and never pressed to vinyl. Useful for identifying
          potential gaps in your vinyl collection or understanding format availability.
        </p>
      </div>

      {/* Coming Soon */}
      <div style={{
        background: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: 8,
        padding: 20,
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 12
        }}>
          🚧
        </div>
        <div style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#92400e',
          marginBottom: 8
        }}>
          CD-Only Finder Coming Soon
        </div>
        <p style={{
          color: '#78350f',
          fontSize: 14,
          margin: 0
        }}>
          This feature will scan your collection and cross-reference with Discogs
          to identify CD-only releases
        </p>
      </div>

      {/* Planned Features */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 12
        }}>
          📋 Planned Features
        </h3>
        <ul style={{
          color: '#6b7280',
          fontSize: 14,
          lineHeight: 1.8,
          paddingLeft: 24
        }}>
          <li>Automatic Discogs API scan of your collection</li>
          <li>Identify albums never pressed to vinyl</li>
          <li>Filter results by artist, year, or genre</li>
          <li>Export CD-only list to CSV</li>
          <li>Quick actions to mark or tag these albums</li>
        </ul>
      </div>
    </div>
  );
}

function Thousand1AlbumsTab() {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📖</div>
        <h2 style={{
          fontSize: 24,
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 12
        }}>
          1001 Albums Review Tool
        </h2>
        <p style={{
          color: '#6b7280',
          fontSize: 16,
          maxWidth: 600,
          margin: '0 auto'
        }}>
          Review and track albums from &quot;1001 Albums You Must Hear Before You Die&quot;
        </p>
      </div>

      {/* Info Box */}
      <div style={{
        background: '#f0fdf4',
        border: '1px solid #10b981',
        borderRadius: 8,
        padding: 20,
        marginBottom: 24
      }}>
        <h3 style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#065f46',
          marginBottom: 8
        }}>
          ℹ️ About This Tool
        </h3>
        <p style={{
          color: '#065f46',
          fontSize: 14,
          lineHeight: 1.6,
          margin: 0
        }}>
          Cross-reference your collection with the famous &quot;1001 Albums You Must Hear
          Before You Die&quot; book. Track which albums you own, which you&apos;ve listened to,
          and which are still on your wishlist.
        </p>
      </div>

      {/* Coming Soon */}
      <div style={{
        background: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: 8,
        padding: 20,
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 12
        }}>
          🚧
        </div>
        <div style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#92400e',
          marginBottom: 8
        }}>
          1001 Albums Tool Coming Soon
        </div>
        <p style={{
          color: '#78350f',
          fontSize: 14,
          margin: 0
        }}>
          This feature will help you track your progress through the
          1001 Albums list
        </p>
      </div>

      {/* Planned Features */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 12
        }}>
          📋 Planned Features
        </h3>
        <ul style={{
          color: '#6b7280',
          fontSize: 14,
          lineHeight: 1.8,
          paddingLeft: 24
        }}>
          <li>Import official 1001 Albums list</li>
          <li>Match against your current collection</li>
          <li>Track which albums you own vs. need</li>
          <li>Mark albums as &quot;listened&quot; or &quot;to listen&quot;</li>
          <li>Progress statistics and completion percentage</li>
          <li>Generate wishlist from missing albums</li>
          <li>Filter by decade, genre, or artist</li>
        </ul>
      </div>
    </div>
  );
}