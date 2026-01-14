// src/app/dj-sets/page.js
"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';

export default function DJSetsPage() {
  const [djSets, setDjSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');

  useEffect(() => {
    loadDJSets();
  }, []);

  const loadDJSets = async () => {
    try {
      const { data, error } = await supabase
        .from('dj_sets')
        .select(`
          *,
          events(title, date, location)
        `)
        .order('recorded_at', { ascending: false });

      if (error) throw error;
      setDjSets(data || []);
    } catch (error) {
      console.error('Error loading DJ sets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (setId, fileUrl, title) => {
    try {
      // Track download
      await supabase
        .from('dj_sets')
        .update({ download_count: (djSets.find(s => s.id === setId)?.download_count || 0) + 1 })
        .eq('id', setId);

      // Trigger download
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = `${title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredSets = djSets.filter(set => {
    const matchesSearch = set.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         set.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         set.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filterBy === 'all') return matchesSearch;
    if (filterBy === 'events') return matchesSearch && set.events;
    if (filterBy === 'standalone') return matchesSearch && !set.events;
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <header className="relative w-full h-[300px] flex items-center justify-center bg-[url('/images/event-header-still.jpg')] bg-cover bg-center">
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-8">
            <h1 className="font-serif-display text-4xl md:text-5xl font-bold text-white text-center m-0">Live Sessions & DJ Sets</h1>
          </div>
        </header>
        <main className="container-responsive py-12">
          <div className="text-center p-8">
            <h2 className="text-xl font-semibold text-gray-600">Loading Live Sessions & DJ Sets...</h2>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <header className="relative w-full h-[300px] flex items-center justify-center bg-[url('/images/event-header-still.jpg')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-8">
          <h1 className="font-serif-display text-4xl md:text-5xl font-bold text-white text-center m-0">DJ Sets</h1>
        </div>
      </header>
      
      <main className="container-responsive py-8">
        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 justify-center items-center px-4">
          <input
            type="text"
            placeholder="Search sets, events, tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-96 p-3 rounded-lg border border-gray-300 focus:border-blue-500 outline-none transition-colors"
          />
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            className="w-full md:w-48 p-3 rounded-lg border border-gray-300 bg-white outline-none cursor-pointer"
          >
            <option value="all">All Sets</option>
            <option value="events">Event Sets</option>
            <option value="standalone">Standalone Sets</option>
          </select>
        </div>

        {/* DJ Sets Grid */}
        <div className="px-4">
          {filteredSets.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-5xl mb-4">🎧</div>
              <h2 className="text-2xl font-bold mb-2">No DJ sets found</h2>
              <p>Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {filteredSets.map((set) => (
                <div
                  key={set.id}
                  className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col gap-4"
                >
                  {/* Header */}
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
                      {set.title}
                    </h3>
                    
                    {set.events && (
                      <div className="text-blue-500 text-sm font-semibold mb-2 flex items-center gap-2">
                        📍 {set.events.title}
                        {set.events.location && ` • ${set.events.location}`}
                      </div>
                    )}

                    <div className="text-xs text-gray-500 font-medium">
                      {formatDate(set.recorded_at || set.created_at)}
                      {set.download_count > 0 && ` • ${set.download_count} downloads`}
                    </div>
                  </div>

                  {/* Description */}
                  {set.description && (
                    <p className="text-sm text-gray-600 leading-relaxed p-3 bg-gray-50 rounded-lg border-l-4 border-gray-200">
                      {set.description}
                    </p>
                  )}

                  {/* Tags */}
                  {set.tags && set.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {set.tags.map((tag) => (
                        <span
                          key={tag}
                          className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Play Controls */}
                  <div className="mt-auto flex flex-col sm:flex-row gap-4">
                    {/* Large Play Button */}
                    <a
                      href={set.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-gradient-to-br from-blue-500 to-green-500 hover:to-green-600 text-white rounded-xl py-3 px-6 font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <span className="text-xl">▶</span>
                      <span>Play</span>
                    </a>

                    {/* Download Button */}
                    <a
                      href={set.download_url || set.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleDownload(set.id, set.file_url, set.title)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-3 px-4 font-semibold flex items-center justify-center gap-2 transition-colors duration-200"
                    >
                      ⬇ DL
                    </a>
                  </div>

                  {/* Track Listing */}
                  {set.track_listing && set.track_listing.length > 0 && (
                    <details className="mt-2 group">
                      <summary className="cursor-pointer font-semibold text-gray-700 text-sm py-2 border-b border-gray-200 list-none flex items-center justify-between group-open:text-blue-600">
                        <span>🎵 Track Listing ({set.track_listing.length})</span>
                        <span className="text-xs text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-2 max-h-48 overflow-y-auto">
                        <ol className="list-decimal list-inside space-y-1">
                          {set.track_listing.map((track, index) => (
                            <li
                              key={index}
                              className="text-xs text-gray-600 font-mono leading-tight"
                            >
                              {track}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}