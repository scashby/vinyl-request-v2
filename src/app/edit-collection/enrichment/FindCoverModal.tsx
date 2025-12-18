// src/app/edit-collection/enrichment/FindCoverModal.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface FindCoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
  defaultQuery: string;
  artist?: string;
  title?: string;
  barcode?: string;
  coverType?: 'front' | 'back';
  year?: string;
  discogsId?: string;
}

interface ImageResult {
  url: string;
  width: number;
  height: number;
  source: 'discogs' | 'google' | 'lastfm';
  type?: 'front' | 'back';
}

type SearchSource = 'both' | 'discogs' | 'google';

export function FindCoverModal({ 
  isOpen, 
  onClose, 
  onSelectImage, 
  defaultQuery,
  artist,
  title,
  barcode,
  coverType = 'front',
  year,
  discogsId
}: FindCoverModalProps) {
  const [searchQuery, setSearchQuery] = useState(defaultQuery);
  const [searchResults, setSearchResults] = useState<ImageResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchSource, setSearchSource] = useState<SearchSource>('both');
  
  // Search term toggles
  const [includeArtist, setIncludeArtist] = useState(true);
  const [includeTitle, setIncludeTitle] = useState(true);
  const [includeYear, setIncludeYear] = useState(true);
  const [includeCoverType, setIncludeCoverType] = useState(true);
  const [includeBarcode, setIncludeBarcode] = useState(false);
  const [includeDiscogsId, setIncludeDiscogsId] = useState(false);

  const performSearch = useCallback(async (source?: SearchSource) => {
    setIsSearching(true);
    const sourceToUse = source || searchSource;
    
    try {
      const params = new URLSearchParams();
      if (barcode) params.append('barcode', barcode);
      if (artist) params.append('artist', artist);
      if (title) params.append('title', title);
      params.append('type', coverType);
      params.append('q', searchQuery);
      params.append('source', sourceToUse);

      const response = await fetch(`/api/search-covers?${params.toString()}`);

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
  }, [searchQuery, barcode, artist, title, coverType, searchSource]);

  useEffect(() => {
    if (isOpen) {
      // Initial auto-search with 'both' source
      performSearch('both');
    }
  }, [isOpen, performSearch]);

  const buildSearchQuery = () => {
    const parts: string[] = [];
    if (includeArtist && artist) parts.push(artist);
    if (includeTitle && title) parts.push(title);
    if (includeYear && year) parts.push(year);
    if (includeCoverType) parts.push(coverType === 'front' ? 'front cover' : 'back cover');
    if (includeBarcode && barcode) parts.push(barcode);
    if (includeDiscogsId && discogsId) parts.push(discogsId);
    
    return parts.join(' ');
  };

  const handleBuildSearch = () => {
    const query = buildSearchQuery();
    setSearchQuery(query);
  };

  const handleManualSearch = () => {
    performSearch();
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
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 30000,
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '95vw',
        maxWidth: '1800px',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#f97316',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Find Cover</h2>
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

        {/* Search Controls */}
        <div style={{ 
          padding: '8px 12px', 
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
        }}>
          {/* Search term toggles */}
          <div style={{ 
            display: 'flex', 
            gap: '6px', 
            marginBottom: '6px',
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '11px', color: '#6b7280', alignSelf: 'center', marginRight: '4px' }}>Include:</span>
            
            {artist && (
              <button
                onClick={() => setIncludeArtist(!includeArtist)}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '3px',
                  backgroundColor: includeArtist ? '#3b82f6' : 'white',
                  color: includeArtist ? 'white' : '#374151',
                  cursor: 'pointer',
                  fontWeight: includeArtist ? '600' : '400',
                }}
              >
                Artist
              </button>
            )}
            
            {title && (
              <button
                onClick={() => setIncludeTitle(!includeTitle)}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '3px',
                  backgroundColor: includeTitle ? '#3b82f6' : 'white',
                  color: includeTitle ? 'white' : '#374151',
                  cursor: 'pointer',
                  fontWeight: includeTitle ? '600' : '400',
                }}
              >
                Title
              </button>
            )}
            
            {year && (
              <button
                onClick={() => setIncludeYear(!includeYear)}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '3px',
                  backgroundColor: includeYear ? '#3b82f6' : 'white',
                  color: includeYear ? 'white' : '#374151',
                  cursor: 'pointer',
                  fontWeight: includeYear ? '600' : '400',
                }}
              >
                Year
              </button>
            )}
            
            <button
              onClick={() => setIncludeCoverType(!includeCoverType)}
              style={{
                padding: '3px 8px',
                fontSize: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '3px',
                backgroundColor: includeCoverType ? '#3b82f6' : 'white',
                color: includeCoverType ? 'white' : '#374151',
                cursor: 'pointer',
                fontWeight: includeCoverType ? '600' : '400',
              }}
            >
              {coverType === 'front' ? 'Front' : 'Back'} Cover
            </button>
            
            {barcode && (
              <button
                onClick={() => setIncludeBarcode(!includeBarcode)}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '3px',
                  backgroundColor: includeBarcode ? '#3b82f6' : 'white',
                  color: includeBarcode ? 'white' : '#374151',
                  cursor: 'pointer',
                  fontWeight: includeBarcode ? '600' : '400',
                }}
              >
                Barcode
              </button>
            )}
            
            {discogsId && (
              <button
                onClick={() => setIncludeDiscogsId(!includeDiscogsId)}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '3px',
                  backgroundColor: includeDiscogsId ? '#3b82f6' : 'white',
                  color: includeDiscogsId ? 'white' : '#374151',
                  cursor: 'pointer',
                  fontWeight: includeDiscogsId ? '600' : '400',
                }}
              >
                Discogs ID
              </button>
            )}
            
            <button
              onClick={handleBuildSearch}
              style={{
                padding: '3px 8px',
                fontSize: '10px',
                border: '1px solid #10b981',
                borderRadius: '3px',
                backgroundColor: '#10b981',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                marginLeft: '8px',
              }}
            >
              Build Query
            </button>
          </div>

          {/* Search bar with source selector */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap' }}>
            {/* Source selector */}
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              {['both', 'discogs', 'google'].map((source) => (
                <button
                  key={source}
                  onClick={() => setSearchSource(source as SearchSource)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '3px',
                    backgroundColor: searchSource === source ? '#1f2937' : 'white',
                    color: searchSource === source ? 'white' : '#374151',
                    cursor: 'pointer',
                    fontWeight: searchSource === source ? '600' : '400',
                    textTransform: 'capitalize',
                  }}
                >
                  {source}
                </button>
              ))}
            </div>
            
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
              placeholder={`Search for ${coverType} cover...`}
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                padding: '5px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#111827',
              }}
            />
            <button
              onClick={handleManualSearch}
              disabled={isSearching}
              style={{
                padding: '5px 16px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: isSearching ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                opacity: isSearching ? 0.7 : 1,
              }}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Results Grid */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px',
        }}>
          {isSearching ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              Searching {searchSource === 'both' ? 'Discogs, Google, and Last.fm' : searchSource === 'discogs' ? 'Discogs and Last.fm' : 'Google Images'}...
            </div>
          ) : searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              No results found. Try a different search.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '10px',
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
                      alt={`${result.type || coverType} cover ${index + 1}`}
                      fill
                      style={{ objectFit: 'cover' }}
                      unoptimized
                    />
                  </div>
                  <div style={{
                    marginTop: '4px',
                    fontSize: '9px',
                    color: '#6b7280',
                    textAlign: 'center',
                  }}>
                    {result.width} × {result.height}
                    <div style={{ fontSize: '8px', opacity: 0.7 }}>
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