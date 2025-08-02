// src/app/admin/audio-recognition/collection/page.tsx - FIXED ESLint Errors

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from 'types/supabase';
import Image from 'next/image';

interface CollectionMatch {
  id: number;
  artist: string;
  title: string;
  album: string;
  year?: string;
  image_url?: string;
  folder?: string;
}

interface UnmatchedRecognition {
  id: number;
  artist: string;
  title: string;
  album: string;
  confidence: number;
  created_at: string;
  source: string;
}

export default function FixedCollectionMatchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient<Database>();

  const [matches, setMatches] = useState<CollectionMatch[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [artistQuery, setArtistQuery] = useState('');
  const [titleQuery, setTitleQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [unmatchedRecognitions, setUnmatchedRecognitions] = useState<UnmatchedRecognition[]>([]);
  const [selectedRecognition, setSelectedRecognition] = useState<number | null>(null);
  const [status, setStatus] = useState('');

  // Load unmatched recognitions - FIXED: Added useCallback to resolve exhaustive-deps
  const loadUnmatchedRecognitions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('audio_recognition_logs')
        .select('*')
        .eq('confirmed', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setUnmatchedRecognitions(data.map(item => ({
          id: item.id,
          artist: item.artist || 'Unknown Artist',
          title: item.title || 'Unknown Title',
          album: item.album || 'Unknown Album',
          confidence: item.confidence || 0,
          created_at: item.created_at || new Date().toISOString(),
          source: item.source || item.service || 'Unknown'
        })));
      }
    } catch (error) {
      console.error('Error fetching unmatched recognitions:', error);
    }
  }, [supabase]);

  // Perform collection search - FIXED: Added useCallback to resolve exhaustive-deps
  const performSearch = useCallback(async (artist: string = artistQuery, title: string = titleQuery) => {
    if (!artist && !title && !searchQuery) {
      setMatches([]);
      setStatus('Enter search terms to find albums in your collection');
      return;
    }

    setLoading(true);
    setStatus('Searching collection...');

    try {
      let query = supabase
        .from('collection')
        .select('id, artist, title, year, image_url, folder');

      if (searchQuery) {
        // General search across all fields
        query = query.or(`artist.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%`);
      } else {
        // Specific field searches
        if (artist) {
          query = query.ilike('artist', `%${artist}%`);
        }
        if (title) {
          query = query.ilike('title', `%${title}%`);
        }
      }

      const { data, error } = await query
        .order('artist', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Search error:', error);
        setStatus('❌ Error searching collection');
        setMatches([]);
        return;
      }

      const collectionMatches = (data || []).map(item => ({
        id: item.id,
        artist: item.artist || 'Unknown Artist',
        title: item.title || 'Unknown Title',
        album: item.title || 'Unknown Album', // Using title as album for vinyl
        year: item.year || undefined,
        image_url: item.image_url || undefined,
        folder: item.folder || undefined
      }));

      setMatches(collectionMatches);
      setStatus(collectionMatches.length ? 
        `Found ${collectionMatches.length} matches in your collection` : 
        'No matches found in your collection'
      );

    } catch (error) {
      console.error('Search error:', error);
      setStatus('❌ Search failed');
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [artistQuery, titleQuery, searchQuery, supabase]);

  // Initialize search from URL params - FIXED: Added proper dependencies
  useEffect(() => {
    const artist = searchParams.get('artist') || '';
    const title = searchParams.get('title') || '';
    
    if (artist || title) {
      setArtistQuery(artist);
      setTitleQuery(title);
      performSearch(artist, title);
    }

    loadUnmatchedRecognitions();
  }, [searchParams, performSearch, loadUnmatchedRecognitions]); // FIXED: Added missing dependencies

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Clear specific field queries when using general search
    if (value) {
      setArtistQuery('');
      setTitleQuery('');
    }
    
    // Debounced search
    const timeoutId = setTimeout(() => {
      performSearch();
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Handle field-specific search
  const handleFieldSearch = () => {
    setSearchQuery(''); // Clear general search when using specific fields
    performSearch();
  };

  // Select from unmatched recognitions
  const selectFromUnmatched = (recognition: UnmatchedRecognition) => {
    setSelectedRecognition(recognition.id);
    setArtistQuery(recognition.artist);
    setTitleQuery(recognition.title);
    setSearchQuery('');
    performSearch(recognition.artist, recognition.title);
  };

  // Confirm selection and update now playing
  const handleConfirm = async () => {
    if (selected === null) {
      setStatus('Please select a match first');
      return;
    }

    const selectedMatch = matches.find(m => m.id === selected);
    if (!selectedMatch) {
      setStatus('Selected match not found');
      return;
    }

    try {
      setStatus('🔄 Setting now playing...');
      
      // Update now playing
      const { error: nowPlayingError } = await supabase
        .from('now_playing')
        .upsert({
          id: 1,
          artist: selectedMatch.artist,
          title: selectedMatch.title,
          album_title: selectedMatch.album,
          album_id: selectedMatch.id,
          started_at: new Date().toISOString(),
          service_used: 'collection_match',
          recognition_confidence: 1.0,
          updated_at: new Date().toISOString()
        });

      if (nowPlayingError) {
        throw nowPlayingError;
      }

      // Mark recognition as confirmed if we selected from unmatched
      if (selectedRecognition) {
        await supabase
          .from('audio_recognition_logs')
          .update({ confirmed: true })
          .eq('id', selectedRecognition);
      }

      // Set album context
      await supabase.from('album_context').delete().neq('id', 0);
      await supabase.from('album_context').insert({
        artist: selectedMatch.artist,
        title: selectedMatch.album,
        album: selectedMatch.album,
        year: selectedMatch.year || new Date().getFullYear().toString(),
        collection_id: selectedMatch.id,
        source: 'collection_match',
        created_at: new Date().toISOString()
      });

      setStatus('✅ Track set as now playing and album context updated!');
      
      setTimeout(() => {
        router.push('/admin/audio-recognition/');
      }, 2000);

    } catch (error) {
      console.error('Confirm error:', error);
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Collection Match</h1>
              <p className="text-gray-600">Search your collection and match recognized tracks</p>
            </div>
            <Link 
              href="/admin/audio-recognition"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              ← Back to Recognition
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Message */}
        {status && (
          <div className={`mb-6 p-4 rounded-lg ${
            status.includes('❌') ? 'bg-red-100 border border-red-300 text-red-700' :
            status.includes('✅') ? 'bg-green-100 border border-green-300 text-green-700' :
            'bg-blue-100 border border-blue-300 text-blue-700'
          }`}>
            {status}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Search Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow border p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Search Your Collection</h2>
              
              {/* General Search */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Search
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search artist or album title..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>

              <div className="text-center text-gray-500 text-sm my-4">— OR —</div>

              {/* Specific Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Artist
                  </label>
                  <input
                    type="text"
                    value={artistQuery}
                    onChange={(e) => setArtistQuery(e.target.value)}
                    placeholder="Enter artist name"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Album Title
                  </label>
                  <input
                    type="text"
                    value={titleQuery}
                    onChange={(e) => setTitleQuery(e.target.value)}
                    placeholder="Enter album title"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              <button
                onClick={handleFieldSearch}
                disabled={loading}
                className="w-full mt-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {loading ? '🔄 Searching...' : '🔍 Search Collection'}
              </button>
            </div>

            {/* Search Results */}
            <div className="bg-white rounded-lg shadow border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold">
                  Search Results {matches.length > 0 && `(${matches.length})`}
                </h3>
              </div>

              {loading && (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Searching collection...</p>
                </div>
              )}

              {!loading && matches.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  {artistQuery || titleQuery || searchQuery ? 
                    'No matches found. Try different search terms.' : 
                    'Enter search terms to find albums in your collection.'
                  }
                </div>
              )}

              {!loading && matches.length > 0 && (
                <div className="max-h-96 overflow-y-auto">
                  {matches.map((match) => (
                    <div
                      key={match.id}
                      className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                        selected === match.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelected(match.id)}
                    >
                      <div className="flex items-center gap-4">
                        <Image
                          src={match.image_url || '/images/coverplaceholder.png'}
                          alt={match.title}
                          width={60}
                          height={60}
                          className="object-cover rounded-lg flex-shrink-0"
                          unoptimized
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-lg truncate">
                            {match.artist}
                          </div>
                          <div className="text-gray-900 truncate">
                            {match.title}
                          </div>
                          <div className="text-sm text-gray-600 truncate">
                            {match.album} {match.year && `• ${match.year}`}
                          </div>
                          {match.folder && (
                            <div className="text-xs text-gray-500 truncate">
                              📁 {match.folder}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {selected === match.id && (
                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selected !== null && (
                <div className="p-6 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={handleConfirm}
                    className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    ✅ Set as Now Playing &amp; Update Album Context
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Unmatched Recognitions Sidebar */}
          <div>
            <div className="bg-white rounded-lg shadow border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Unmatched Recognitions</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Recent recognitions needing manual matching
                </p>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {unmatchedRecognitions.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    No unmatched recognitions
                  </div>
                ) : (
                  unmatchedRecognitions.map((recognition) => (
                    <div
                      key={recognition.id}
                      className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                        selectedRecognition === recognition.id ? 'bg-yellow-50 border-yellow-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => selectFromUnmatched(recognition)}
                    >
                      <div className="font-medium text-sm truncate">
                        {recognition.artist}
                      </div>
                      <div className="text-gray-900 text-sm truncate">
                        {recognition.title}
                      </div>
                      <div className="text-xs text-gray-600 truncate">
                        {recognition.album}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {recognition.source}
                        </span>
                        <span className="text-xs font-medium text-blue-600">
                          {Math.round(recognition.confidence * 100)}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(recognition.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {unmatchedRecognitions.length > 0 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={loadUnmatchedRecognitions}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    🔄 Refresh List
                  </button>
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3">Quick Actions</h4>
              <div className="space-y-2">
                <Link
                  href="/admin/audio-recognition"
                  className="block w-full py-2 px-3 bg-blue-600 text-white rounded text-sm text-center hover:bg-blue-700 transition-colors"
                >
                  🎵 Back to Recognition
                </Link>
                <Link
                  href="/now-playing-tv"
                  target="_blank"
                  className="block w-full py-2 px-3 bg-purple-600 text-white rounded text-sm text-center hover:bg-purple-700 transition-colors"
                >
                  📺 View TV Display
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-3">How to Use Collection Match</h3>
          <ol className="list-decimal list-inside space-y-2 text-green-800">
            <li><strong>Search:</strong> Use quick search or specific artist/album fields to find matches</li>
            <li><strong>Select:</strong> Click on a match from your collection to select it</li>
            <li><strong>Confirm:</strong> Click &ldquo;Set as Now Playing&rdquo; to update the TV display</li>
            <li><strong>Unmatched List:</strong> Click on unmatched recognitions to search for them automatically</li>
            <li><strong>Priority Order:</strong> Your collection is searched in order: vinyl → cassettes → 45s</li>
          </ol>
        </div>
      </div>
    </div>
  );
}