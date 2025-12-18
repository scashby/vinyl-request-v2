// src/app/edit-collection/enrichment/FindCoverModal.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface FindCoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
  defaultQuery: string;
}

interface ImageResult {
  url: string;
  width: number;
  height: number;
  source: 'spotify' | 'lastfm' | 'musicbrainz';
}

export function FindCoverModal({ isOpen, onClose, onSelectImage, defaultQuery }: FindCoverModalProps) {
  const [searchQuery, setSearchQuery] = useState(defaultQuery);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<ImageResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Extract filter options from query
  const availableFilters = defaultQuery.split(' ').filter(term => term.length > 3).slice(0, 3);

  const performSearch = useCallback(async (query: string, filters: string[]) => {
    setIsSearching(true);
    
    try {
      // Build search query with filters
      let finalQuery = query;
      if (filters.length > 0) {
        finalQuery = `${query} ${filters.join(' ')}`;
      }

      // Call our API route that uses Spotify, Last.fm, and MusicBrainz
      const response = await fetch(
        `/api/search-covers?q=${encodeURIComponent(finalQuery)}`
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json() as { results: ImageResult[] };
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Pre-search on mount
  useEffect(() => {
    if (isOpen) {
      performSearch(defaultQuery, selectedFilters);
    }
  }, [isOpen, defaultQuery, selectedFilters, performSearch]);

  const handleSearch = () => {
    performSearch(searchQuery, selectedFilters);
  };

  const toggleFilter = (filter: string) => {
    setSelectedFilters(prev => {
      const newFilters = prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter];
      return newFilters;
    });
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 30000,
      paddingTop: '40px',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '1400px',
        width: '95%',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#f97316',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Find Cover</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: 0,
              lineHeight: '1',
            }}
          >
            ×
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for album cover..."
              style={{
                flex: 1,
                padding: '6px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#111827',
              }}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              style={{
                padding: '6px 20px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                cursor: isSearching ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                opacity: isSearching ? 0.7 : 1,
              }}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
            
            {/* Filter Checkboxes */}
            {availableFilters.map(filter => (
              <label
                key={filter}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#374151',
                  whiteSpace: 'nowrap',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedFilters.includes(filter)}
                  onChange={() => toggleFilter(filter)}
                  style={{ cursor: 'pointer' }}
                />
                {filter}
              </label>
            ))}
          </div>
        </div>

        {/* Results Grid */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
        }}>
          {isSearching ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              Searching Spotify, Last.fm, and MusicBrainz...
            </div>
          ) : searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              No results found. Try a different search.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: '12px',
            }}>
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  onClick={() => {
                    onSelectImage(result.url);
                    onClose();
                  }}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    padding: '6px',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    width: '100%',
                    paddingBottom: '100%',
                    position: 'relative',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}>
                    <Image
                      src={result.url}
                      alt={`Search result ${index + 1}`}
                      fill
                      style={{ objectFit: 'cover' }}
                      unoptimized
                    />
                  </div>
                  <div style={{
                    marginTop: '6px',
                    fontSize: '10px',
                    color: '#6b7280',
                    textAlign: 'center',
                  }}>
                    {result.width} × {result.height}
                    <div style={{ fontSize: '9px', opacity: 0.7 }}>
                      {result.source}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}