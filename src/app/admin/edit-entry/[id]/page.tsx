// src/app/admin/specialized-searches/page.tsx
// COMPLETE VERSION: Original functionality + New features
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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

// ============================================================================
// CD-ONLY TAB - ORIGINAL + NEW FEATURES
// ============================================================================

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
      
      const searchData: DiscogsSearchResponse = await response.json();
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
              {filteredResults.length < results.length && <> • Showing <strong>{filteredResults.length}</strong> filtered</>}
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
            {filteredResults.map((album) => {
              const isSelected = selectedIds.has(album.id);
              return (
                <div 
                  key={album.id} 
                  onClick={() => {
                    const newSet = new Set(selectedIds);
                    if (isSelected) {
                      newSet.delete(album.id);
                    } else {
                      newSet.add(album.id);
                    }
                    setSelectedIds(newSet);
                  }} 
                  style={{ background: 'white', border: isSelected ? '2px solid #8b5cf6' : '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                >
                  {isSelected && <div style={{ position: 'absolute', top: 8, right: 8, background: '#8b5cf6', color: 'white', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 'bold', zIndex: 10 }}>✓</div>}
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
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// 1001 ALBUMS TAB - ORIGINAL + NEW FEATURES
// ============================================================================

type A1001 = { id: number; artist: string; album: string; year: number | null; artist_norm: string | null; album_norm: string | null; };
type MatchRow = { id: number; album_1001_id: number; collection_id: number; review_status: string; confidence: number | null; notes: string | null; };
type CollectionRow = { id: number; artist: string | null; title: string | null; year: number | null; format: string | null; image_url: string | null; };
type StatusFilter = "unmatched" | "pending" | "confirmed" | "all" | "overview";

function Thousand1AlbumsTab() {
  const [view, setView] = useState<StatusFilter>('overview');
  const [rows, setRows] = useState<A1001[]>([]);
  const [matchesBy, setMatchesBy] = useState<Record<number, MatchRow[]>>({});
  const [collectionsBy, setCollectionsBy] = useState<Record<number, CollectionRow>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [searchInputs, setSearchInputs] = useState<Record<number, string>>({});
  const [searchResults, setSearchResults] = useState<Record<number, CollectionRow[]>>({});
  const searchTimeouts = useRef<Record<number, NodeJS.Timeout>>({});
  const [expandedAlbums, setExpandedAlbums] = useState<Record<number, boolean>>({});
  const [toasts, setToasts] = useState<Array<{kind: 'info'|'ok'|'err'; msg: string}>>([]);

  const pushToast = useCallback((t: {kind: 'info'|'ok'|'err'; msg: string}) => {
    setToasts(ts => [...ts, t]);
    setTimeout(() => setToasts(ts => ts.slice(1)), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: batch1 } = await supabase.from("one_thousand_one_albums").select("id, artist, album, year, artist_norm, album_norm").order("artist", { ascending: true }).range(0, 999);
    const { data: batch2 } = await supabase.from("one_thousand_one_albums").select("id, artist, album, year, artist_norm, album_norm").order("artist", { ascending: true }).range(1000, 1999);
    const a1001 = [...(batch1 || []), ...(batch2 || [])];
    setRows(a1001);
    const aIds = a1001.map(r => r.id);
    if (aIds.length === 0) { setMatchesBy({}); setCollectionsBy({}); setLoading(false); return; }
    const { data: mrows } = await supabase.from("collection_1001_review").select("id, album_1001_id, collection_id, review_status, confidence, notes").in("album_1001_id", aIds);
    const by: Record<number, MatchRow[]> = {};
    const cids = new Set<number>();
    (mrows || []).forEach(m => { if (!by[m.album_1001_id]) by[m.album_1001_id] = []; by[m.album_1001_id].push(m); cids.add(m.collection_id); });
    setMatchesBy(by);
    let cmap: Record<number, CollectionRow> = {};
    if (cids.size > 0) {
      const { data: crows } = await supabase.from("collection").select("id, artist, title, year, format, image_url").in("id", Array.from(cids));
      if (crows) cmap = crows.reduce<Record<number, CollectionRow>>((acc, r) => { acc[r.id] = r; return acc; }, {});
    }
    setCollectionsBy(cmap);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runExact = useCallback(async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("match_1001_exact");
    setRunning(false);
    if (error) { pushToast({ kind: "err", msg: `Exact match failed: ${error.message}` }); return; }
    const n = Number.isFinite(Number(data)) ? Number(data) : 0;
    pushToast({ kind: "ok", msg: `Found ${n} exact match${n !== 1 ? "es" : ""}` });
    await load();
  }, [pushToast, load]);

  const runFuzzy = useCallback(async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("match_1001_fuzzy", { threshold: 0.7, year_slop: 1 });
    setRunning(false);
    if (error) { pushToast({ kind: "err", msg: `Fuzzy match failed: ${error.message}` }); return; }
    pushToast({ kind: "ok", msg: `Found ${data || 0} fuzzy matches` });
    await load();
  }, [pushToast, load]);

  const updateStatus = useCallback(async (matchId: number, newStatus: string) => {
    const { error } = await supabase.from("collection_1001_review").update({ review_status: newStatus }).eq("id", matchId);
    if (error) { pushToast({ kind: "err", msg: `Update failed: ${error.message}` }); return; }
    pushToast({ kind: "ok", msg: "Status updated" });
    await load();
  }, [pushToast, load]);

  const rejectMatch = useCallback(async (matchId: number) => {
    const { error } = await supabase.from("collection_1001_review").delete().eq("id", matchId);
    if (error) { pushToast({ kind: "err", msg: `Delete failed: ${error.message}` }); return; }
    pushToast({ kind: "ok", msg: "Match removed" });
    await load();
  }, [pushToast, load]);

  const linkManually = useCallback(async (albumId: number, collectionId: number) => {
    const { error } = await supabase.from("collection_1001_review").insert([{ album_1001_id: albumId, collection_id: collectionId, review_status: "pending", confidence: 1.0 }]);
    if (error) { pushToast({ kind: "err", msg: `Link failed: ${error.message}` }); return; }
    pushToast({ kind: "ok", msg: "Linked!" });
    setSearchInputs(s => ({ ...s, [albumId]: "" }));
    setSearchResults(s => ({ ...s, [albumId]: [] }));
    await load();
  }, [pushToast, load]);

  const handleSearch = useCallback((albumId: number, term: string) => {
    setSearchInputs(s => ({ ...s, [albumId]: term }));
    if (searchTimeouts.current[albumId]) clearTimeout(searchTimeouts.current[albumId]);
    if (!term.trim()) { setSearchResults(s => ({ ...s, [albumId]: [] })); return; }
    searchTimeouts.current[albumId] = setTimeout(async () => {
      const { data } = await supabase.from("collection").select("id, artist, title, year, format, image_url").or(`artist.ilike.%${term}%,title.ilike.%${term}%`).limit(10);
      setSearchResults(s => ({ ...s, [albumId]: data || [] }));
    }, 300);
  }, []);

  const stats = { total: rows.length, unmatched: rows.filter(r => !matchesBy[r.id] || matchesBy[r.id].length === 0).length, pending: rows.filter(r => matchesBy[r.id]?.some(m => m.review_status === "pending")).length, confirmed: rows.filter(r => matchesBy[r.id]?.some(m => m.review_status === "confirmed")).length };

  const filteredRows = rows.filter(r => {
    const matches = matchesBy[r.id] || [];
    if (view === "unmatched") return matches.length === 0;
    if (view === "pending") return matches.some(m => m.review_status === "pending");
    if (view === "confirmed") return matches.some(m => m.review_status === "confirmed");
    return view === "all";
  });

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>;

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['overview', 'unmatched', 'pending', 'confirmed', 'all'] as StatusFilter[]).map(v => (
          <button key={v} onClick={() => setView(v)} style={{ padding: '8px 16px', background: view === v ? '#8b5cf6' : 'white', color: view === v ? 'white' : '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {v === 'overview' && `📊 Overview`}
            {v === 'unmatched' && `❓ Unmatched (${stats.unmatched})`}
            {v === 'pending' && `⏳ Pending (${stats.pending})`}
            {v === 'confirmed' && `✅ Confirmed (${stats.confirmed})`}
            {v === 'all' && `🔢 All (${stats.total})`}
          </button>
        ))}
      </div>

      {view === 'overview' && (
        <div style={{ background: '#f0fdf4', border: '1px solid #10b981', borderRadius: 8, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h3 style={{ fontSize: 20, fontWeight: 600, color: '#065f46', marginBottom: 12 }}>Collection Progress</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div><div style={{ fontSize: 32, fontWeight: 'bold', color: '#8b5cf6' }}>{stats.total}</div><div style={{ fontSize: 12, color: '#6b7280' }}>Total</div></div>
            <div><div style={{ fontSize: 32, fontWeight: 'bold', color: '#10b981' }}>{stats.confirmed}</div><div style={{ fontSize: 12, color: '#6b7280' }}>Confirmed</div></div>
            <div><div style={{ fontSize: 32, fontWeight: 'bold', color: '#f59e0b' }}>{stats.pending}</div><div style={{ fontSize: 12, color: '#6b7280' }}>Pending</div></div>
            <div><div style={{ fontSize: 32, fontWeight: 'bold', color: '#ef4444' }}>{stats.unmatched}</div><div style={{ fontSize: 12, color: '#6b7280' }}>Unmatched</div></div>
          </div>
          <p style={{ color: '#065f46', fontSize: 14, marginBottom: 24 }}>
            {Math.round((stats.confirmed / stats.total) * 100)}% complete
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={runExact} disabled={running} style={{ padding: '12px 24px', background: running ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer' }}>🎯 Run Exact Match</button>
            <button onClick={runFuzzy} disabled={running} style={{ padding: '12px 24px', background: running ? '#9ca3af' : '#8b5cf6', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer' }}>🔍 Run Fuzzy Match</button>
          </div>
        </div>
      )}

      {view !== 'overview' && (
        <div>
          {filteredRows.map(album => {
            const matches = matchesBy[album.id] || [];
            const isExpanded = expandedAlbums[album.id];
            return (
              <div key={album.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpandedAlbums(e => ({ ...e, [album.id]: !e[album.id] }))}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>{album.artist} — {album.album}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{album.year || '—'} • {matches.length} match{matches.length !== 1 ? 'es' : ''}</div>
                  </div>
                  <div style={{ fontSize: 20 }}>{isExpanded ? '▼' : '▶'}</div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 16 }}>
                    {matches.length === 0 && (
                      <div style={{ position: 'relative' }}>
                        <input type="text" placeholder="Search collection to link..." value={searchInputs[album.id] || ''} onChange={(e) => handleSearch(album.id, e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }} />
                        {searchResults[album.id] && searchResults[album.id].length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, maxHeight: 300, overflow: 'auto', zIndex: 100 }}>
                            {searchResults[album.id].map(result => (
                              <div key={result.id} onClick={() => linkManually(album.id, result.id)} style={{ display: 'flex', gap: 12, padding: 12, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                                <Image src={result.image_url && result.image_url.toLowerCase() !== 'no' ? result.image_url : '/images/coverplaceholder.png'} alt={result.title || 'cover'} width={40} height={40} unoptimized style={{ borderRadius: 4, objectFit: 'cover' }} />
                                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{result.artist} — {result.title}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>{result.year || '—'} • {result.format || '—'}</div></div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {matches.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {matches.map(match => {
                          const collection = collectionsBy[match.collection_id];
                          const isConfirmed = match.review_status === "confirmed";
                          return (
                            <div key={match.id} style={{ display: 'flex', gap: 12, padding: 12, background: isConfirmed ? '#f0fdf4' : '#fffbeb', border: `2px solid ${isConfirmed ? '#86efac' : '#fde68a'}`, borderRadius: 6, alignItems: 'center' }}>
                              <Image src={collection?.image_url && collection.image_url.toLowerCase() !== "no" ? collection.image_url : "/images/coverplaceholder.png"} alt={collection?.title || "cover"} width={50} height={50} unoptimized style={{ borderRadius: 6, objectFit: "cover" }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{collection?.artist} — {collection?.title}</div>
                                <div style={{ fontSize: 12, color: '#6b7280' }}>{collection?.year || '—'} • {collection?.format || '—'}</div>
                              </div>
                              {!isConfirmed && (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={() => updateStatus(match.id, "confirmed")} style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                                  <button onClick={() => rejectMatch(match.id)} style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕</button>
                                </div>
                              )}
                              {isConfirmed && <button onClick={() => rejectMatch(match.id)} style={{ padding: '6px 12px', background: 'white', color: '#6b7280', border: '2px solid #d1d5db', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Unlink</button>}
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

      {toasts.length > 0 && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
          {toasts.map((t, i) => (
            <div key={i} style={{ background: t.kind === 'err' ? '#fee' : t.kind === 'ok' ? '#d1fae5' : '#e0e7ff', border: '1px solid', borderColor: t.kind === 'err' ? '#fca5a5' : t.kind === 'ok' ? '#6ee7b7' : '#c7d2fe', borderRadius: 8, padding: '12px 16px', marginBottom: 8, fontSize: 14 }}>{t.msg}</div>
          ))}
        </div>
      )}
    </div>
  );
}