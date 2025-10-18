// src/app/admin/sale-items/page.tsx
"use client";

import Link from 'next/link';

export default function SaleItemsPage() {
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
          💰 Sale Items & Merchandise
        </h1>
        <p style={{
          color: '#6b7280',
          fontSize: 16,
          margin: 0
        }}>
          Manage items available for sale through various platforms
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
          Sale Items Management Coming Soon
        </h2>
        <p style={{
          color: '#6b7280',
          fontSize: 16,
          marginBottom: 24,
          maxWidth: 600,
          margin: '0 auto 24px'
        }}>
          This page will allow you to view and manage items marked for sale,
          including pricing, inventory tracking, and integration with external
          sales platforms.
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

      {/* External Platforms Card */}
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
          🔗 External Sales Platforms
        </h3>
        <p style={{
          color: '#6b7280',
          fontSize: 14,
          marginBottom: 16
        }}>
          In the meantime, manage your sales through these platforms:
        </p>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12
        }}>
          <Link
            href="https://admin.shopify.com/store/kstusk-d1?ui_locales=en"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: 16,
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🛍️</div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#1f2937',
              marginBottom: 4
            }}>
              Shopify Store
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Manage online store
            </div>
          </Link>

          <Link
            href="https://www.discogs.com/seller/socialblunders/profile"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: 16,
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>💿</div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#1f2937',
              marginBottom: 4
            }}>
              Discogs Seller
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Manage marketplace listings
            </div>
          </Link>

          <Link
            href="https://www.moo.com/us/account/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: 16,
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🐄</div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#1f2937',
              marginBottom: 4
            }}>
              Moo Print
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Business cards & merch
            </div>
          </Link>

          <Link
            href="https://www.vistaprint.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: 16,
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🖨️</div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#1f2937',
              marginBottom: 4
            }}>
              Vistaprint
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Printing & promotional
            </div>
          </Link>
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
          📋 Planned Features
        </h3>
        <ul style={{
          color: '#6b7280',
          fontSize: 14,
          lineHeight: 1.8,
          paddingLeft: 24
        }}>
          <li>View all albums marked as &quot;Sale&quot; folder</li>
          <li>Set pricing and manage sale status</li>
          <li>Track inventory across platforms</li>
          <li>Sync with Shopify and Discogs</li>
          <li>Generate sale reports</li>
          <li>Bulk pricing updates</li>
        </ul>
      </div>
    </div>
  );
}