// src/app/admin/specialized-searches/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from 'src/lib/supabaseClient';

type TabType = 'cd-only' | '1001-albums';

export default function SpecializedSearchesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('cd-only');

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', color: '#1f2937', margin: '0 0 8px 0' }}>
          🔎 Specialized Searches
        </h1>
        <p style={{ color: '#6b7280', fontSize: 16, margin: 0 }}>
          Advanced tools for managing your collection
        </p>
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          <button onClick={() => setActiveTab('cd-only')} style={{ flex: 1, padding: '16px 24px', background: activeTab === 'cd-only' ? '#8b5cf6' : 'white', color: activeTab === 'cd-only' ? 'white' : '#6b7280', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', borderBottom: activeTab === 'cd-only' ? '3px solid #7c3aed' : 'none' }}>
            💿 CD-Only Releases
          </button>
          <button onClick={() => setActiveTab('1001-albums')} style={{ flex: 1, padding: '16px 24px', background: activeTab === '1001-albums' ? '#8b5cf6' : 'white', color: activeTab === '1001-albums' ? 'white' : '#6b7280', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', borderBottom: activeTab === '1001-albums' ? '3px solid #7c3aed' : 'none' }}>
            📖 1001 Albums
          </button>
        </div>

        <div style={{ padding: 32 }}>
          {activeTab === 'cd-only' && <CDOnlyTab />}
          {activeTab === '1001-albums' && <Thousand1AlbumsTab />}
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <Link href="/admin/admin-dashboard" style={{ display: 'inline-block', padding: '12px 24px', background: '#6b7280', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

type CDOnlyAlbum = {
  id: number;
  artist: string;
  title: string;
  year: string | null;
  image_url: string | null;
  discogs_release_id: string | null;
  discogs_genres: string[] | null;
  folder: string | null;
  has_vinyl: boolean | null;
  available_formats?: string[];
  format_check_method?: string;
  cd_only_tagged?: boolean;
};

type DiscogsFormat = {
  name: string;
  qty?: string;
  descriptions?: string[];
};

type DiscogsRelease = {
  formats?: DiscogsFormat[];
  master_id?: number;
};

type DiscogsSearchResult = {
  master_id?: number;
  format?: string[];
};

type DiscogsSearchResponse = {
  results?: DiscogsSearchResult[];
};

function CDOnlyTab() {
  const [view, setView] = useState<'scanner' | 'results'>('scanner');
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<CDOnlyAlbum[]>([]);
  const [filteredResults, setFilteredResults] = useState<CDOnlyAlbum[]>([]);
  const [stats, setStats] = useState({ total: 0, scanned: 0, cdOnly: 0, errors: 0 });
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  
  const [artistFilter, setArtistFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const applyFilters = useCallback(() => {
    let filtered = [...results];
    if (artistFilter) filtered = filtered.filter(a => a.artist.toLowerCase().includes(artistFilter.toLowerCase()));
    if (yearFilter) filtered = filtered.filter(a => a.year && a.year.includes(yearFilter));
    if (genreFilter) filtered = filtered.filter(a => a.discogs_genres && a.discogs_genres.some(g => g.toLowerCase().includes(genreFilter.toLowerCase())));
    setFilteredResults(filtered);
  }, [results, artistFilter, yearFilter, genreFilter]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const checkAlbumFormats = async (album: CDOnlyAlbum): Promise<CDOnlyAlbum> => {
    if (!album.discogs_release_id) {
      return { ...album, available_formats: ['Unknown'], has_vinyl: false, format_check_method: 'No release ID' };
    }

    try {
      const DISCOGS_TOKEN = process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
      const response = await fetch(`https://api.discogs.com/releases/${album.discogs_release_id}`, {
        headers: { 'Authorization': `Discogs token=${DISCOGS_TOKEN}`, 'User-Agent': 'DeadwaxDialogues/1.0' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const releaseData: DiscogsRelease = await response.json();
      const masterId = releaseData.master_id;

      if (!masterId) {
        const availableFormats = new Set<string>();
        releaseData.formats?.forEach((f: DiscogsFormat) => { if (f.name) availableFormats.add(f.name.toLowerCase()); });
        const formatArray = Array.from(availableFormats);
        const hasCD = formatArray.some(f => f.includes('cd'));
        const hasVinyl = formatArray.some(f => f.includes('vinyl') || f.includes('lp') || f.includes('12"'));
        return { ...album, available_formats: formatArray, has_vinyl: !hasCD || hasVinyl, format_check_method: 'Single release' };
      }

      const searchQuery = encodeURIComponent(`${album.artist} ${album.title}`);
      const searchUrl = `https://api.discogs.com/database/search?q=${searchQuery}&type=release&per_page=100&token=${DISCOGS_TOKEN}`;
      const searchResponse = await fetch(searchUrl, { headers: { 'User-Agent': 'DeadwaxDialogues/1.0' }});
      
      if (!searchResponse.ok) throw new Error(`Search failed: ${searchResponse.status}`);
      
      const searchData: DiscogsSearchResponse = await searchResponse.json();
      const availableFormats = new Set<string>();
      let releaseCount = 0;
      
      searchData.results?.forEach((result: DiscogsSearchResult) => {
        if (result.master_id === masterId) {
          releaseCount++;
          result.format?.forEach((format: string) => availableFormats.add(format.toLowerCase()));
        }
      });
      
      const formatArray = Array.from(availableFormats);
      const hasCD = formatArray.some(f => f.includes('cd'));
      const hasVinyl = formatArray.some(f => f.includes('vinyl') || f.includes('lp') || f.includes('12"'));
      
      return { ...album, available_formats: formatArray, has_vinyl: !hasCD || hasVinyl, format_check_method: `Master (${releaseCount} releases)` };
    } catch {
      return { ...album, available_formats: ['Error'], has_vinyl: false, format_check_method: 'Error' };
    }
  };

  const runCDOnlyCheck = async () => {
    setScanning(true);
    setStatus('Fetching CD collection...');
    setProgress(0);
    setView('scanner');
    
    try {
      const { data: cdAlbums, error } = await supabase
        .from('collection')
        .select('id, artist, title, year, discogs_release_id, image_url, discogs_genres, folder, notes')
        .or('format.ilike.%CD%,folder.eq.CDs')
        .not('discogs_release_id', 'is', null);
      
      if (error) throw new Error(error.message);
      if (!cdAlbums || cdAlbums.length === 0) {
        setStatus('No CDs found');
        setScanning(false);
        return;
      }
      
      setStatus(`Checking ${cdAlbums.length} CDs...`);
      const results: CDOnlyAlbum[] = [];
      const errorList: Array<{album: string, error: string}> = [];
      
      for (let i = 0; i < cdAlbums.length; i++) {
        const album = cdAlbums[i];
        setStatus(`Checking ${i + 1}/${cdAlbums.length}: ${album.artist} - ${album.title}`);
        setProgress(((i + 1) / cdAlbums.length) * 100);
        
        const result = await checkAlbumFormats({
          id: album.id,
          artist: album.artist,
          title: album.title,
          year: album.year,
          discogs_release_id: album.discogs_release_id,
          image_url: album.image_url,
          discogs_genres: album.discogs_genres,
          folder: album.folder,
          has_vinyl: null,
          cd_only_tagged: album.notes?.includes('[CD-ONLY]') || false
        });
        
        if (result.available_formats?.includes('Error')) {
          errorList.push({ album: `${result.artist} - ${result.title}`, error: 'Discogs API error' });
        } else {
          results.push(result);
        }
        
        if (i < cdAlbums.length - 1) await delay(1000);
      }
      
      const cdOnly = results.filter(r => !r.has_vinyl);
      setResults(cdOnly);
      setStats({ total: cdAlbums.length, scanned: cdAlbums.length, cdOnly: cdOnly.length, errors: errorList.length });
      setStatus(`✅ Complete! Found ${cdOnly.length} CD-only albums`);
      setProgress(100);
      setView('results');
      
      const genres = new Set<string>();
      cdOnly.forEach(album => { album.discogs_genres?.forEach(g => genres.add(g)); });
      setAvailableGenres(Array.from(genres).sort());
    } catch (err) {
      setStatus(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setScanning(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Artist', 'Title', 'Year', 'Formats', 'Check Method'];
    const rows = filteredResults.map(a => [a.artist, a.title, a.year || '', (a.available_formats || []).join('; '), a.format_check_method || '']);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cd-only-releases-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const tagSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      for (const id of Array.from(selectedIds)) {
        const { data: album } = await supabase.from('collection').select('notes').eq('id', id).single();
        if (!album) continue;
        const currentNotes = album.notes || '';
        if (currentNotes.includes('[CD-ONLY]')) continue;
        const newNotes = currentNotes ? `[CD-ONLY] ${currentNotes}` : '[CD-ONLY]';
        await supabase.from('collection').update({ notes: newNotes }).eq('id', id);
      }
      setResults(results.map(a => selectedIds.has(a.id) ? { ...a, cd_only_tagged: true } : a));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Error tagging:', err);
    }
  };

  return (
    <div>
      {view === 'scanner' && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>💿</div>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>CD-Only Release Finder</h2>
            <p style={{ color: '#6b7280', fontSize: 16, maxWidth: 600, margin: '0 auto 24px' }}>
              Comprehensively checks Discogs to find albums never released on vinyl
            </p>
          </div>

          {!scanning && results.length === 0 && (
            <div style={{ textAlign: 'center' }}>
              <button onClick={runCDOnlyCheck} style={{ padding: '16px 32px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
                🚀 Start Comprehensive Scan
              </button>
            </div>
          )}

          {scanning && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12, textAlign: 'center' }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#92400e', marginBottom: 8, textAlign: 'center' }}>{status}</div>
              <div style={{ width: '100%', height: 8, background: '#e9ecef', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#8b5cf6', transition: 'width 0.3s' }} />
              </div>
              <p style={{ color: '#78350f', fontSize: 14, margin: 0, textAlign: 'center' }}>{Math.round(progress)}% complete</p>
            </div>
          )}
        </>
      )}

      {view === 'results' && (
        <>
          <div style={{ background: '#f0fdf4', border: '1px solid #10b981', borderRadius: 8, padding: 20, marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#065f46', marginBottom: 8 }}>✅ Scan Complete</h3>
            <p style={{ color: '#065f46', fontSize: 14, margin: 0 }}>
              Found <strong>{stats.cdOnly}</strong> CD-only releases • {stats.errors} errors
              {filteredResults.length < results.length ? <> • Showing <strong>{filteredResults.length}</strong> filtered</> : null}
            </p>
          </div>

          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>🔍 Filters</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <input type="text" placeholder="Filter by artist..." value={artistFilter} onChange={(e) => setArtistFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }} />
                <input type="text" placeholder="Filter by year..." value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }} />
                <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}>
                  <option value="">All Genres</option>
                  {availableGenres.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <button onClick={() => { setArtistFilter(''); setYearFilter(''); setGenreFilter(''); }} style={{ padding: '8px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>Clear</button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>⚡ Quick Actions</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setSelectedIds(new Set(filteredResults.map(a => a.id)))} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>Select All</button>
                <button onClick={() => setSelectedIds(new Set())} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>Clear</button>
                <button onClick={tagSelected} disabled={selectedIds.size === 0} style={{ padding: '8px 16px', background: selectedIds.size === 0 ? '#f3f4f6' : '#8b5cf6', color: selectedIds.size === 0 ? '#9ca3af' : 'white', border: 'none', borderRadius: 6, fontSize: 14, cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer' }}>🏷️ Tag ({selectedIds.size})</button>
                <button onClick={exportToCSV} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>📥 Export CSV</button>
                <button onClick={() => { setView('scanner'); setResults([]); setSelectedIds(new Set()); }} style={{ padding: '8px 16px', background: '#6b7280', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>🔄 New Scan</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {filteredResults.map((album) => (
              <div key={album.id} onClick={() => setSelectedIds(s => { const n = new Set(s); if (n.has(album.id)) { n.delete(album.id); } else { n.add(album.id); } return n; })} style={{ background: 'white', border: selectedIds.has(album.id) ? '2px solid #8b5cf6' : '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
                {album.cd_only_tagged && <div style={{ position: 'absolute', top: 8, left: 8, background: '#10b981', color: 'white', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 'bold', zIndex: 10 }}>🏷️</div>}
                {album.image_url && <Image src={album.image_url} alt={`${album.artist} - ${album.title}`} width={180} height={180} style={{ objectFit: 'cover', width: '100%', height: 180 }} unoptimized />}
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.artist}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{album.title}</div>
                  {album.year && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{album.year}</div>}
                  <div style={{ marginTop: 8, padding: '4px 8px', background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 600, borderRadius: 4, textAlign: 'center' }}>💿 CD Only</div>
                  {album.format_check_method && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{album.format_check_method}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type Id = number;

type A1001 = {
  id: Id;
  artist: string;
  album: string;
  year: number | null;
  artist_norm: string | null;
  album_norm: string | null;
};

type MatchStatus = "pending" | "linked" | "confirmed";

type MatchRow = {
  id: Id;
  album_1001_id: Id;
  collection_id: Id;
  review_status: MatchStatus | string;
  confidence: number | null;
  notes: string | null;
};

type CollectionRow = {
  id: Id;
  artist: string | null;
  title: string | null;
  year: number | null;
  format: string | null;
  image_url: string | null;
};

type StatusFilter = "unmatched" | "pending" | "confirmed" | "all";

type Toast = { kind: "info" | "ok" | "err"; msg: string };

function Thousand1AlbumsTab() {
  const [rows, setRows] = useState<A1001[]>([]);
  const [matchesBy, setMatchesBy] = useState<Record<Id, MatchRow[]>>({});
  const [collectionsBy, setCollectionsBy] = useState<Record<Id, CollectionRow>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("unmatched");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [running, setRunning] = useState<boolean>(false);
  const [searchInputs, setSearchInputs] = useState<Record<Id, string>>({});
  const [searchResults, setSearchResults] = useState<Record<Id, CollectionRow[]>>({});
  const [searchLoading, setSearchLoading] = useState<Record<Id, boolean>>({});
  const searchTimeouts = useRef<Record<Id, NodeJS.Timeout>>({});
  const [hasAutoMatchedSession, setHasAutoMatchedSession] = useState(false);
  const albumRefs = useRef<Record<Id, HTMLDivElement | null>>({});
  const [expandedAlbums, setExpandedAlbums] = useState<Record<Id, boolean>>({});

  const pushToast = useCallback((t: Toast) => {
    setToasts((ts) => [...ts, t]);
    window.setTimeout(() => setToasts((ts) => ts.slice(1)), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: batch1, error: e1a } = await supabase
      .from("one_thousand_one_albums")
      .select("id, artist, album, year, artist_norm, album_norm")
      .order("artist", { ascending: true })
      .order("album", { ascending: true })
      .range(0, 999);

    const { data: batch2, error: e1b } = await supabase
      .from("one_thousand_one_albums")
      .select("id, artist, album, year, artist_norm, album_norm")
      .order("artist", { ascending: true })
      .order("album", { ascending: true })
      .range(1000, 1999);

    if ((e1a && !batch1) || (e1b && !batch2)) {
      pushToast({ kind: "err", msg: `Failed loading 1001 list` });
      setRows([]);
      setMatchesBy({});
      setCollectionsBy({});
      setLoading(false);
      return;
    }

    const a1001 = [...(batch1 || []), ...(batch2 || [])];
    setRows(a1001);

    const aIds = a1001.map((r) => r.id);
    if (aIds.length === 0) {
      setMatchesBy({});
      setCollectionsBy({});
      setLoading(false);
      return;
    }

    const { data: mrows, error: e2 } = await supabase
      .from("collection_1001_review")
      .select("id, album_1001_id, collection_id, review_status, confidence, notes")
      .in("album_1001_id", aIds);

    if (e2 || !mrows) {
      pushToast({ kind: "err", msg: `Failed loading matches: ${e2?.message ?? "unknown error"}` });
      setMatchesBy({});
      setCollectionsBy({});
      setLoading(false);
      return;
    }

    const by: Record<Id, MatchRow[]> = {};
    const cids = new Set<Id>();
    for (const m of mrows) {
      if (!by[m.album_1001_id]) by[m.album_1001_id] = [];
      by[m.album_1001_id].push(m);
      cids.add(m.collection_id);
    }
    setMatchesBy(by);

    let cmap: Record<Id, CollectionRow> = {};
    if (cids.size > 0) {
      const { data: crows, error: e3 } = await supabase
        .from("collection")
        .select("id, artist, title, year, format, image_url")
        .in("id", Array.from(cids));

      if (e3) {
        pushToast({ kind: "err", msg: `Failed loading collection rows: ${e3.message}` });
      } else if (crows) {
        cmap = crows.reduce<Record<Id, CollectionRow>>((acc, r) => {
          acc[r.id] = r;
          return acc;
        }, {});
      }
    }
    setCollectionsBy(cmap);
    setLoading(false);
  }, [pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const runExact = useCallback(async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("match_1001_exact");
    setRunning(false);
    if (error) {
      pushToast({ kind: "err", msg: `Exact match failed: ${error.message}` });
      return;
    }
    const n = Number.isFinite(Number(data)) ? Number(data) : 0;
    pushToast({ kind: "ok", msg: `Found ${n} exact match${n !== 1 ? "es" : ""}` });
    await load();
  }, [pushToast, load]);

  const runFuzzy = useCallback(async (threshold = 0.7, yearSlop = 1) => {
    setRunning(true);
    const { data, error } = await supabase.rpc("match_1001_fuzzy", {
      threshold: parseFloat(threshold.toString()),
      year_slop: parseInt(yearSlop.toString()),
    });
    setRunning(false);
    if (error) {
      pushToast({ kind: "err", msg: `Fuzzy match failed: ${error.message}` });
      return;
    }
    const n = Number.isFinite(Number(data)) ? Number(data) : 0;
    pushToast({ kind: "ok", msg: `Found ${n} fuzzy match${n !== 1 ? "es" : ""}` });
    await load();
  }, [pushToast, load]);

  const runSameArtist = useCallback(async (threshold = 0.6, yearSlop = 1) => {
    setRunning(true);
    const { data, error } = await supabase.rpc("match_1001_same_artist", {
      threshold: parseFloat(threshold.toString()),
      year_slop: parseInt(yearSlop.toString()),
    });
    setRunning(false);
    if (error) {
      pushToast({ kind: "err", msg: `Same-artist match failed: ${error.message}` });
      return;
    }
    const n = Number.isFinite(Number(data)) ? Number(data) : 0;
    pushToast({ kind: "ok", msg: `Found ${n} same-artist match${n !== 1 ? "es" : ""}` });
    await load();
  }, [pushToast, load]);

  const runFuzzyArtist = useCallback(async (threshold = 0.7) => {
    setRunning(true);
    const { data, error } = await supabase.rpc("match_1001_fuzzy_artist", {
      threshold: parseFloat(threshold.toString()),
    });
    setRunning(false);
    if (error) {
      pushToast({ kind: "err", msg: `Fuzzy artist match failed: ${error.message}` });
      return;
    }
    const n = Number.isFinite(Number(data)) ? Number(data) : 0;
    pushToast({ kind: "ok", msg: `Found ${n} fuzzy artist match${n !== 1 ? "es" : ""}` });
    await load();
  }, [pushToast, load]);

  const runAggressive = useCallback(async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("match_1001_aggressive");
    setRunning(false);
    if (error) {
      pushToast({ kind: "err", msg: `Aggressive match failed: ${error.message}` });
      return;
    }
    const n = Number.isFinite(Number(data)) ? Number(data) : 0;
    pushToast({ kind: "ok", msg: `Found ${n} aggressive match${n !== 1 ? "es" : ""}` });
    await load();
  }, [pushToast, load]);

  useEffect(() => {
    if (hasAutoMatchedSession) return;
    if (loading || running || rows.length === 0) return;

    const unmatched = rows.filter((r) => {
      const ms = matchesBy[r.id] ?? [];
      return ms.length === 0;
    });

    if (unmatched.length > 0) {
      setHasAutoMatchedSession(true);
      pushToast({ kind: "info", msg: `Found ${unmatched.length} unmatched albums. Running auto-match...` });
      setTimeout(() => {
        void runExact();
      }, 500);
    }
  }, [rows, matchesBy, loading, running, pushToast, runExact, hasAutoMatchedSession]);

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      const ms = (matchesBy[r.id] ?? []).filter(m => m.review_status !== 'rejected');
      if (statusFilter === "all") return true;
      if (statusFilter === "unmatched") return ms.length === 0;
      if (statusFilter === "pending")
        return ms.some((m) => m.review_status === "pending" || m.review_status === "linked");
      if (statusFilter === "confirmed") return ms.some((m) => m.review_status === "confirmed");
      return true;
    });

    if (statusFilter === "all") {
      return filtered.sort((a, b) => {
        const artistA = (a.artist || "").toLowerCase();
        const artistB = (b.artist || "").toLowerCase();
        return artistA.localeCompare(artistB);
      });
    }

    return filtered.sort((a, b) => {
      const aMatches = (matchesBy[a.id] ?? []).filter(m => m.review_status !== 'rejected');
      const bMatches = (matchesBy[b.id] ?? []).filter(m => m.review_status !== 'rejected');

      const aHasPending = aMatches.some((m) => m.review_status === "pending" || m.review_status === "linked");
      const bHasPending = bMatches.some((m) => m.review_status === "pending" || m.review_status === "linked");
      const aUnmatched = aMatches.length === 0;
      const bUnmatched = bMatches.length === 0;
      const aConfirmed = aMatches.length > 0 && aMatches.every((m) => m.review_status === "confirmed");
      const bConfirmed = bMatches.length > 0 && bMatches.every((m) => m.review_status === "confirmed");

      if (aHasPending && !bHasPending) return -1;
      if (!aHasPending && bHasPending) return 1;
      if (aUnmatched && !bUnmatched) return -1;
      if (!aUnmatched && bUnmatched) return 1;
      if (aConfirmed && !bConfirmed) return 1;
      if (!aConfirmed && bConfirmed) return -1;

      return 0;
    });
  }, [rows, matchesBy, statusFilter]);

  const updateStatus = async (matchId: Id, albumId: Id, review_status: MatchStatus) => {
    const { error } = await supabase
      .from("collection_1001_review")
      .update({ review_status })
      .eq("id", matchId);
    if (error) {
      pushToast({ kind: "err", msg: `Update failed: ${error.message}` });
      return;
    }
    pushToast({ kind: "ok", msg: "Confirmed!" });
    await load();
    setTimeout(() => {
      albumRefs.current[albumId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const rejectMatch = async (matchId: Id, albumId: Id) => {
    const { error } = await supabase
      .from("collection_1001_review")
      .update({ review_status: 'rejected' })
      .eq("id", matchId);
    if (error) {
      pushToast({ kind: "err", msg: `Rejection failed: ${error.message}` });
      return;
    }
    pushToast({ kind: "ok", msg: "Rejected" });
    await load();
    setTimeout(() => {
      albumRefs.current[albumId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const searchCollection = async (albumId: Id, query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults((s) => ({ ...s, [albumId]: [] }));
      return;
    }

    setSearchLoading((s) => ({ ...s, [albumId]: true }));

    const { data, error } = await supabase
      .from("collection")
      .select("id, artist, title, year, format, image_url")
      .or(`artist.ilike.%${query}%,title.ilike.%${query}%`)
      .order("artist", { ascending: true })
      .limit(20);

    setSearchLoading((s) => ({ ...s, [albumId]: false }));

    if (error) {
      pushToast({ kind: "err", msg: `Search failed: ${error.message}` });
      return;
    }

    setSearchResults((s) => ({ ...s, [albumId]: data || [] }));
  };

  const handleSearchInput = (albumId: Id, value: string) => {
    setSearchInputs((s) => ({ ...s, [albumId]: value }));

    if (searchTimeouts.current[albumId]) {
      clearTimeout(searchTimeouts.current[albumId]);
    }

    searchTimeouts.current[albumId] = setTimeout(() => {
      void searchCollection(albumId, value);
    }, 300);
  };

  const linkFromSearch = async (albumId: Id, collectionId: Id) => {
    const result = await supabase.from("collection_1001_review").insert([
      {
        album_1001_id: albumId,
        collection_id: collectionId,
        review_status: "confirmed",
        confidence: 1.0,
        notes: "manual link via search",
      },
    ]);

    if (result.error && result.error.message.includes("uq_c1001_review_collection_final")) {
      const { data: existing } = await supabase
        .from("collection_1001_review")
        .select("id, album_1001_id, review_status")
        .eq("collection_id", collectionId)
        .neq("review_status", "rejected")
        .limit(1);

      if (existing && existing.length > 0) {
        const confirmed = window.confirm(
          "This pressing is already matched to another album from the 1001 list. Is this a set with multiple albums?\n\nClick OK to link both albums, or Cancel to keep only the existing match."
        );
        
        if (!confirmed) {
          return;
        }

        const { error: rpcError } = await supabase.rpc("manual_link_1001", {
          p_album_1001_id: albumId,
          p_collection_id: collectionId,
        });

        if (rpcError) {
          pushToast({ kind: "err", msg: `Link failed: ${rpcError.message}` });
          return;
        }
      }
    } else if (result.error) {
      pushToast({ kind: "err", msg: `Link failed: ${result.error.message}` });
      return;
    }

    setSearchInputs((s) => ({ ...s, [albumId]: "" }));
    setSearchResults((s) => ({ ...s, [albumId]: [] }));
    pushToast({ kind: "ok", msg: "Linked & Confirmed!" });
    await load();
    setTimeout(() => {
      albumRefs.current[albumId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const getCounts = () => {
    const unmatched = rows.filter((r) => {
      const ms = (matchesBy[r.id] ?? []).filter(m => m.review_status !== 'rejected');
      return ms.length === 0;
    }).length;
    const pending = rows.filter((r) => {
      const ms = (matchesBy[r.id] ?? []).filter(m => m.review_status !== 'rejected');
      return ms.some((m) => m.review_status === "pending" || m.review_status === "linked");
    }).length;
    const confirmed = rows.filter((r) => {
      const ms = (matchesBy[r.id] ?? []).filter(m => m.review_status !== 'rejected');
      return ms.some((m) => m.review_status === "confirmed");
    }).length;
    return { unmatched, pending, confirmed };
  };

  const counts = getCounts();

  const toggleExpanded = (albumId: Id) => {
    setExpandedAlbums((prev) => ({ ...prev, [albumId]: !prev[albumId] }));
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, background: '#f9fafb', borderRadius: 8 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 16, color: '#6b7280', fontWeight: 600 }}>Loading 1001 Albums data...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 50, display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
        {toasts.map((t, i) => (
          <div
            key={`${t.kind}-${i}-${t.msg}`}
            style={{
              background: t.kind === "err" ? "#fee2e2" : t.kind === "ok" ? "#d1fae5" : "#dbeafe",
              border: `2px solid ${t.kind === "err" ? "#f87171" : t.kind === "ok" ? "#34d399" : "#60a5fa"}`,
              color: t.kind === "err" ? "#991b1b" : t.kind === "ok" ? "#065f46" : "#1e40af",
              borderRadius: 10,
              padding: "14px 18px",
              fontWeight: 600,
              fontSize: 14,
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { value: "unmatched", label: "Need Attention", count: counts.unmatched, color: "#ef4444", bg: "#fef2f2" },
          { value: "pending", label: "Pending Review", count: counts.pending, color: "#f59e0b", bg: "#fffbeb" },
          { value: "confirmed", label: "Confirmed", count: counts.confirmed, color: "#10b981", bg: "#f0fdf4" },
          { value: "all", label: "All Albums", count: rows.length, color: "#6b7280", bg: "#f9fafb" },
        ].map((tab) => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value as StatusFilter)}
              style={{
                flex: "1 1 auto",
                minWidth: 120,
                padding: "10px 16px",
                border: isActive ? `2px solid ${tab.color}` : "2px solid #e5e7eb",
                borderRadius: 8,
                background: isActive ? tab.bg : "#ffffff",
                color: isActive ? tab.color : "#6b7280",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  background: isActive ? tab.color : "#d1d5db",
                  color: "#ffffff",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matching Actions</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => void runExact()}
            disabled={running}
            style={{
              padding: "8px 14px",
              background: running ? "#9ca3af" : "#3b82f6",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 13,
              cursor: running ? "not-allowed" : "pointer",
              opacity: running ? 0.6 : 1,
            }}
          >
            {running ? "Running..." : "Run Exact Match"}
          </button>
          <button
            onClick={() => void runFuzzy(0.7, 1)}
            disabled={running}
            style={{
              padding: "8px 14px",
              background: running ? "#9ca3af" : "#8b5cf6",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 13,
              cursor: running ? "not-allowed" : "pointer",
              opacity: running ? 0.6 : 1,
            }}
          >
            Run Fuzzy (0.70, ±1y)
          </button>
          <button
            onClick={() => void runSameArtist(0.6, 1)}
            disabled={running}
            style={{
              padding: "8px 14px",
              background: running ? "#9ca3af" : "#06b6d4",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 13,
              cursor: running ? "not-allowed" : "pointer",
              opacity: running ? 0.6 : 1,
            }}
          >
            Same-Artist (0.60, ±1y)
          </button>
          <button
            onClick={() => void runFuzzyArtist(0.7)}
            disabled={running}
            style={{
              padding: "8px 14px",
              background: running ? "#9ca3af" : "#ec4899",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 13,
              cursor: running ? "not-allowed" : "pointer",
              opacity: running ? 0.6 : 1,
            }}
          >
            Fuzzy Artist (0.70)
          </button>
          <button
            onClick={() => void runAggressive()}
            disabled={running}
            style={{
              padding: "8px 14px",
              background: running ? "#9ca3af" : "#f59e0b",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 13,
              cursor: running ? "not-allowed" : "pointer",
              opacity: running ? 0.6 : 1,
            }}
          >
            🔥 Aggressive (0.50)
          </button>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div style={{ background: "#ffffff", borderRadius: 8, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 6 }}>All done!</div>
          <div style={{ color: "#6b7280", fontSize: 14 }}>
            {statusFilter === "unmatched"
              ? "No unmatched albums. Switch to another tab to see matched albums."
              : "No albums in this category."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredRows.map((album) => {
            const matches = (matchesBy[album.id] ?? []).filter(m => m.review_status !== 'rejected');
            const isUnmatched = matches.length === 0;
            const hasPending = matches.some((m) => m.review_status === "pending" || m.review_status === "linked");
            const allConfirmed = matches.length > 0 && matches.every((m) => m.review_status === "confirmed");
            const isExpanded = expandedAlbums[album.id] ?? hasPending;
            
            return (
              <div
                key={album.id}
                ref={(el) => {
                  albumRefs.current[album.id] = el;
                }}
                style={{
                  background: "#ffffff",
                  border: isUnmatched
                    ? "2px solid #fca5a5"
                    : hasPending
                    ? "2px solid #fbbf24"
                    : "1px solid #e5e7eb",
                  borderRadius: 8,
                  overflow: "visible",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    cursor: matches.length > 0 || isUnmatched ? "pointer" : "default",
                  }}
                  onClick={() => {
                    if (matches.length > 0 || isUnmatched) toggleExpanded(album.id);
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ fontSize: 10, fontWeight: 900, color: '#ffffff' }}>1001</div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {album.artist} — {album.album}
                      </div>
                      {isUnmatched && (
                        <span style={{ background: "#fee2e2", color: "#991b1b", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>
                          Unmatched
                        </span>
                      )}
                      {hasPending && (
                        <span style={{ background: "#fef3c7", color: "#92400e", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>
                          Pending
                        </span>
                      )}
                      {allConfirmed && (
                        <span style={{ background: "#d1fae5", color: "#065f46", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          Confirmed
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", paddingLeft: 44 }}>
                      {album.year ?? "—"} • {matches.length > 0 ? `${matches.length} pressing${matches.length > 1 ? "s" : ""}` : "No matches"}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, flexShrink: 0, marginLeft: 16 }}>
                    {(matches.length > 0 || isUnmatched) && (isExpanded ? "▼ Collapse" : "▶ Expand")}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: "16px", background: "#f9fafb", borderTop: "1px solid #e5e7eb" }}>
                    {(isUnmatched || allConfirmed) && (
                      <div style={{ marginBottom: matches.length > 0 ? 16 : 0 }}>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                          Search your collection to link:
                        </label>
                        <div style={{ position: "relative", zIndex: 10000 }}>
                          <input
                            value={searchInputs[album.id] ?? ""}
                            onChange={(e) => handleSearchInput(album.id, e.target.value)}
                            placeholder={`Try "${album.artist}" or "${album.album}"`}
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              border: "2px solid #d1d5db",
                              borderRadius: 6,
                              fontSize: 14,
                              outline: "none",
                              transition: "border-color 0.2s",
                              color: "#111827",
                              backgroundColor: "#ffffff",
                              position: "relative",
                              zIndex: 1,
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = "#3b82f6";
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = "#d1d5db";
                            }}
                          />
                          {searchLoading[album.id] && (
                            <div
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                right: 0,
                                marginTop: 6,
                                padding: 10,
                                background: "#f9fafb",
                                border: "2px solid #e5e7eb",
                                borderRadius: 6,
                                color: "#6b7280",
                                fontSize: 13,
                                zIndex: 99999,
                              }}
                            >
                              Searching...
                            </div>
                          )}
                          {searchResults[album.id] && searchResults[album.id].length > 0 && (
                            <div
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                right: 0,
                                marginTop: 6,
                                background: "#ffffff",
                                border: "2px solid #e5e7eb",
                                borderRadius: 6,
                                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                                maxHeight: 300,
                                overflowY: "auto",
                                zIndex: 99999,
                              }}
                            >
                              {searchResults[album.id].map((result) => (
                                <div
                                  key={result.id}
                                  onClick={() => void linkFromSearch(album.id, result.id)}
                                  style={{
                                    display: "flex",
                                    gap: 10,
                                    padding: 10,
                                    cursor: "pointer",
                                    borderBottom: "1px solid #f3f4f6",
                                    transition: "background 0.2s",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#f9fafb";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "#ffffff";
                                  }}
                                >
                                  <Image
                                    src={
                                      result.image_url && result.image_url.trim().toLowerCase() !== "no"
                                        ? result.image_url
                                        : "/images/coverplaceholder.png"
                                    }
                                    alt={result.title || "cover"}
                                    width={40}
                                    height={40}
                                    unoptimized
                                    style={{ borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontWeight: 700,
                                        fontSize: 13,
                                        color: "#111827",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {result.artist || "Unknown Artist"}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 12,
                                        color: "#6b7280",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {result.title || "Unknown Title"}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                                      {result.year || "—"} • {result.format || "—"}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {searchInputs[album.id] &&
                            searchResults[album.id] &&
                            searchResults[album.id].length === 0 &&
                            !searchLoading[album.id] && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  left: 0,
                                  right: 0,
                                  marginTop: 6,
                                  padding: 10,
                                  background: "#fef2f2",
                                  border: "2px solid #fecaca",
                                  borderRadius: 6,
                                  color: "#991b1b",
                                  fontSize: 13,
                                  zIndex: 99999,
                                }}
                              >
                                No matches found. Try different search terms.
                              </div>
                            )}
                        </div>
                      </div>
                    )}

                    {matches.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {matches.map((match) => {
                          const collection = collectionsBy[match.collection_id];
                          const isConfirmed = match.review_status === "confirmed";
                          return (
                            <div
                              key={match.id}
                              style={{
                                display: "flex",
                                gap: 12,
                                padding: 12,
                                background: isConfirmed ? "#f0fdf4" : "#fffbeb",
                                border: `2px solid ${isConfirmed ? "#86efac" : "#fde68a"}`,
                                borderRadius: 6,
                                alignItems: "center",
                              }}
                            >
                              <Image
                                src={
                                  collection?.image_url && collection.image_url.trim().toLowerCase() !== "no"
                                    ? collection.image_url
                                    : "/images/coverplaceholder.png"
                                }
                                alt={collection?.title || "cover"}
                                width={50}
                                height={50}
                                unoptimized
                                style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      fontSize: 14,
                                      color: "#111827",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {collection?.artist || "Unknown"} — {collection?.title || "Unknown"}
                                  </div>
                                  <span
                                    style={{
                                      background: isConfirmed ? "#10b981" : "#f59e0b",
                                      color: "#ffffff",
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      fontSize: 10,
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    {isConfirmed ? "Confirmed" : "Pending"}
                                  </span>
                                  {typeof match.confidence === "number" && (
                                    <span
                                      style={{
                                        background: "#eef2ff",
                                        color: "#4f46e5",
                                        padding: "2px 6px",
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 700,
                                      }}
                                    >
                                      {(match.confidence * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 12, color: "#6b7280" }}>
                                  {collection?.year || "—"} • {collection?.format || "—"}
                                </div>
                                {match.notes && (
                                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, fontStyle: "italic" }}>
                                    {match.notes}
                                  </div>
                                )}
                              </div>
                              {!isConfirmed && (
                                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                  <button
                                    onClick={() => void updateStatus(match.id, album.id, "confirmed")}
                                    style={{
                                      padding: "6px 12px",
                                      background: "#10b981",
                                      color: "#ffffff",
                                      border: "none",
                                      borderRadius: 6,
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    ✓ Confirm
                                  </button>
                                  <button
                                    onClick={() => void rejectMatch(match.id, album.id)}
                                    style={{
                                      padding: "6px 12px",
                                      background: "#ef4444",
                                      color: "#ffffff",
                                      border: "none",
                                      borderRadius: 6,
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    ✕ Remove
                                  </button>
                                </div>
                              )}
                              {isConfirmed && (
                                <button
                                  onClick={() => void rejectMatch(match.id, album.id)}
                                  style={{
                                    padding: "6px 12px",
                                    background: "#ffffff",
                                    color: "#6b7280",
                                    border: "2px solid #d1d5db",
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  Unlink
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}