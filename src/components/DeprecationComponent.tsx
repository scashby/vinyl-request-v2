"use client";

import React from 'react';
import Link from 'next/link';

export default function DeprecationComponent() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '50vh',
      padding: '2rem',
      textAlign: 'center',
      background: '#f9fafb',
      borderRadius: '0.5rem',
      border: '1px solid #e5e7eb',
      maxWidth: '600px',
      margin: '4rem auto'
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1rem' }}>
        Page Moved
      </h2>
      <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>
        This page has moved to the Edit Collection tool.
      </p>
      <Link 
        href="/admin/edit-collection" 
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#2563eb',
          color: 'white',
          fontWeight: '600',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          transition: 'background-color 0.2s'
        }}
      >
        Go to Edit Collection
      </Link>
    </div>
  );
}