// src/app/dj-sets/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import { Container } from 'components/ui/Container';
import { useActiveTheme } from 'src/lib/useActiveTheme';

interface Event {
  id: number;
  title: string;
  date: string;
  location?: string;
}

interface DJSet {
  id: number;
  title: string;
  description?: string;
  tags?: string[];
  file_url: string;
  download_url?: string;
  recorded_at?: string;
  created_at: string;
  download_count: number;
  track_listing?: string[];
  events?: Event;
}

const CARD_TILT_VARS = ["--dwd-tilt-1", "--dwd-tilt-2", "--dwd-tilt-3", "--dwd-tilt-4"];

export default function DJSetsPage() {
  const [djSets, setDjSets] = useState<DJSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const { cssVars } = useActiveTheme();

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
      setDjSets((data as unknown as DJSet[]) || []);
    } catch (error) {
      console.error('Error loading DJ sets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (setId: number, fileUrl: string, title: string) => {
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

  const formatDate = (dateString: string) => {
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

  return (
    <div
      className="min-h-screen font-[family-name:var(--dwd-font-body)] bg-[var(--dwd-bg)] text-[var(--dwd-ink)]"
      style={cssVars}
    >
      <Container size="xl">
        <div className="pt-16 pb-10 md:pt-20">
          <div className="font-[family-name:var(--dwd-font-display)] [text-transform:var(--dwd-headline-transform)] text-4xl md:text-5xl mb-3">
            DJ Sets
          </div>
          <p className="text-lg text-[var(--dwd-ink-soft)] max-w-xl">
            Recorded sets from residency nights and private events, free to stream or download.
          </p>
        </div>
      </Container>

      {loading ? (
        <Container size="xl">
          <div className="text-center py-16 text-lg text-[var(--dwd-ink-faint)]">Loading&hellip;</div>
        </Container>
      ) : (
        <Container size="xl">
          <div className="pb-20">
            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-10 justify-center items-center">
              <input
                type="text"
                placeholder="Search sets, events, tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-96 p-3 rounded-lg outline-none transition-colors bg-[var(--dwd-bg-card)] text-[var(--dwd-ink)] [border:var(--dwd-card-border)]"
              />
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                className="w-full md:w-48 p-3 rounded-lg outline-none cursor-pointer bg-[var(--dwd-bg-card)] text-[var(--dwd-ink)] [border:var(--dwd-card-border)]"
              >
                <option value="all">All Sets</option>
                <option value="events">Event Sets</option>
                <option value="standalone">Standalone Sets</option>
              </select>
            </div>

            {/* DJ Sets Grid */}
            {filteredSets.length === 0 ? (
              <div className="text-center py-16 text-[var(--dwd-ink-faint)]">
                <div className="text-2xl font-bold mb-2">No DJ sets found</div>
                <p>Try adjusting your search or filter criteria</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredSets.map((set, i) => (
                  <div
                    key={set.id}
                    className="p-6 flex flex-col gap-4 transition-transform hover:!rotate-0 hover:-translate-y-1 bg-[var(--dwd-bg-card)] [border:var(--dwd-card-border)] [border-radius:var(--dwd-card-radius)] [box-shadow:var(--dwd-card-shadow)]"
                    style={{ transform: `rotate(var(${CARD_TILT_VARS[i % CARD_TILT_VARS.length]}))` }}
                  >
                    {/* Header */}
                    <div>
                      <h3 className="text-2xl font-bold mb-2 leading-tight">
                        {set.title}
                      </h3>

                      {set.events && (
                        <div className="text-[var(--dwd-accent-1)] text-sm font-semibold mb-2">
                          {set.events.title}
                          {set.events.location && ` • ${set.events.location}`}
                        </div>
                      )}

                      <div className="text-xs text-[var(--dwd-ink-faint)] font-medium">
                        {formatDate(set.recorded_at || set.created_at)}
                        {set.download_count > 0 && ` • ${set.download_count} downloads`}
                      </div>
                    </div>

                    {/* Description */}
                    {set.description && (
                      <p
                        className="text-sm text-[var(--dwd-ink-soft)] leading-relaxed p-3 rounded-lg border-l-4 bg-[var(--dwd-bg)]"
                        style={{ borderLeftColor: 'var(--dwd-accent-1)' }}
                      >
                        {set.description}
                      </p>
                    )}

                    {/* Tags */}
                    {set.tags && set.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {set.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 rounded-full text-xs font-semibold"
                            style={{ background: 'color-mix(in srgb, var(--dwd-accent-2) 15%, transparent)', color: 'var(--dwd-accent-2)' }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Play Controls */}
                    <div className="mt-auto flex flex-col sm:flex-row gap-3">
                      <a
                        href={set.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 rounded-full py-3 px-6 font-bold flex items-center justify-center gap-2 transition-colors bg-[var(--dwd-accent-1)] text-[var(--dwd-bg)] hover:bg-[var(--dwd-accent-1-hover)]"
                      >
                        Play
                      </a>

                      <a
                        href={set.download_url || set.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleDownload(set.id, set.file_url, set.title)}
                        className="rounded-full py-3 px-4 font-bold flex items-center justify-center gap-2 transition-opacity bg-transparent text-[var(--dwd-ink)] border-2 border-[var(--dwd-ink)] hover:opacity-65"
                      >
                        Download
                      </a>
                    </div>

                    {/* Track Listing */}
                    {set.track_listing && set.track_listing.length > 0 && (
                      <details className="mt-2 group">
                        <summary className="cursor-pointer font-semibold text-sm py-2 border-b border-[var(--dwd-ink)]/10 list-none flex items-center justify-between group-open:text-[var(--dwd-accent-1)]">
                          <span>Track Listing ({set.track_listing.length})</span>
                          <span className="text-xs text-[var(--dwd-ink-faint)] group-open:rotate-180 transition-transform">&#9660;</span>
                        </summary>
                        <div className="rounded-lg p-4 mt-2 max-h-48 overflow-y-auto bg-[var(--dwd-bg)] [border:var(--dwd-card-border)]">
                          <ol className="list-decimal list-inside space-y-1">
                            {set.track_listing.map((track, index) => (
                              <li
                                key={index}
                                className="text-xs text-[var(--dwd-ink-soft)] font-mono leading-tight"
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
        </Container>
      )}
    </div>
  );
}
