// Replace the CDOnlyTab function in src/app/admin/specialized-searches/page.tsx

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
  vinyl_count?: number;
  has_us_vinyl?: boolean;
  vinyl_countries?: string[];
  available_formats?: string[];
  format_check_method?: string;
  cd_only_tagged?: boolean;
  category?: 'no-vinyl' | 'no-us-vinyl' | 'limited-vinyl';
};

function CDOnlyTab() {
  const [view, setView] = useState<'scanner' | 'results'>('scanner');
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<CDOnlyAlbum[]>([]);
  const [filteredResults, setFilteredResults] = useState<CDOnlyAlbum[]>([]);
  const [stats, setStats] = useState({ 
    total: 0, 
    scanned: 0, 
    cdOnly: 0, 
    noVinyl: 0,
    noUSVinyl: 0,
    limitedVinyl: 0,
    errors: 0 
  });
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  
  const [artistFilter, setArtistFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'no-vinyl' | 'no-us-vinyl' | 'limited-vinyl'>('all');
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const applyFilters = useCallback(() => {
    let filtered = [...results];
    if (artistFilter) filtered = filtered.filter(a => a.artist.toLowerCase().includes(artistFilter.toLowerCase()));
    if (yearFilter) filtered = filtered.filter(a => a.year && a.year.includes(yearFilter));
    if (genreFilter) filtered = filtered.filter(a => a.discogs_genres && a.discogs_genres.some(g => g.toLowerCase().includes(genreFilter.toLowerCase())));
    if (categoryFilter !== 'all') filtered = filtered.filter(a => a.category === categoryFilter);
    setFilteredResults(filtered);
  }, [results, artistFilter, yearFilter, genreFilter, categoryFilter]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const checkAlbumFormats = async (album: CDOnlyAlbum): Promise<CDOnlyAlbum> => {
    const releaseId = album.discogs_release_id?.trim();
    
    if (!releaseId || releaseId === '' || releaseId === 'null' || releaseId === 'undefined') {
      return { ...album, available_formats: ['Unknown'], has_vinyl: false, format_check_method: 'No release ID' };
    }

    try {
      console.log(`\n🔍 Checking ${album.artist} - ${album.title} (Release ID: ${releaseId})`);
      
      // Step 1: Get the specific release to extract master_id
      const releaseResponse = await fetch(`/api/discogsProxy?releaseId=${encodeURIComponent(releaseId)}`);
      
      if (!releaseResponse.ok) {
        console.error(`❌ Release fetch failed: HTTP ${releaseResponse.status}`);
        return { ...album, available_formats: ['Error'], has_vinyl: false, format_check_method: 'API Error' };
      }
      
      const releaseData: DiscogsRelease & { master_id?: number } = await releaseResponse.json();
      console.log(`📀 Release data:`, {
        has_master: !!releaseData.master_id,
        master_id: releaseData.master_id,
        formats: releaseData.formats
      });
      
      if (!releaseData.master_id) {
        console.log(`⚠️ No master_id found, searching for vinyl versions...`);
        
        const searchParams = new URLSearchParams({
          artist: album.artist,
          release_title: album.title,
          format: 'vinyl',
          type: 'release'
        });
        
        const searchResponse = await fetch(
          `https://api.discogs.com/database/search?${searchParams.toString()}`,
          {
            headers: {
              'User-Agent': 'DeadwaxDialogues/1.0',
              'Authorization': `Discogs token=${process.env.NEXT_PUBLIC_DISCOGS_TOKEN}`
            }
          }
        );
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const hasVinylResults = searchData.results && searchData.results.length > 0;
          console.log(`🔍 Search results: ${searchData.results?.length || 0} vinyl versions found`);
          
          return {
            ...album,
            available_formats: hasVinylResults ? ['vinyl', 'cd'] : ['cd'],
            has_vinyl: hasVinylResults,
            vinyl_count: searchData.results?.length || 0,
            category: 'no-vinyl',
            format_check_method: 'Direct search (no master)'
          };
        }
        
        const availableFormats = new Set<string>();
        releaseData.formats?.forEach((f: DiscogsFormat) => { 
          if (f.name) availableFormats.add(f.name.toLowerCase()); 
        });
        
        return {
          ...album,
          available_formats: Array.from(availableFormats),
          has_vinyl: false,
          vinyl_count: 0,
          category: 'no-vinyl',
          format_check_method: 'No master, search failed'
        };
      }
      
      // Step 2: Get ALL versions under the master release
      console.log(`📚 Fetching versions for master ID: ${releaseData.master_id}`);
      const versionsResponse = await fetch(
        `/api/discogsProxy?masterId=${releaseData.master_id}&checkVersions=true`
      );
      
      if (!versionsResponse.ok) {
        console.error(`❌ Versions fetch failed: HTTP ${versionsResponse.status}`);
        return { ...album, available_formats: ['Error'], has_vinyl: false, format_check_method: 'API Error' };
      }
      
      const versionsData: { versions?: Array<{ format?: string; major_formats?: string[]; country?: string }> } = await versionsResponse.json();
      console.log(`📊 Found ${versionsData.versions?.length || 0} versions`);
      
      // Step 3: Analyze vinyl versions
      const allFormats = new Set<string>();
      let vinylCount = 0;
      let hasUSVinyl = false;
      const vinylCountries: string[] = [];
      
      if (versionsData.versions) {
        versionsData.versions.forEach((version) => {
          let isVinyl = false;
          
          // Check major_formats first (more reliable)
          if (version.major_formats) {
            version.major_formats.forEach(fmt => {
              const lowerFmt = fmt.toLowerCase();
              allFormats.add(lowerFmt);
              if (lowerFmt.includes('vinyl') || lowerFmt === 'lp' || lowerFmt.includes('12"') || lowerFmt.includes('7"')) {
                isVinyl = true;
              }
            });
          }
          
          // Fallback to format string
          if (version.format) {
            const lowerFmt = version.format.toLowerCase();
            allFormats.add(lowerFmt);
            if (lowerFmt.includes('vinyl') || lowerFmt.includes('lp') || lowerFmt.includes('12"') || lowerFmt.includes('7"')) {
              isVinyl = true;
            }
          }
          
          if (isVinyl) {
            vinylCount++;
            if (version.country) {
              vinylCountries.push(version.country);
              
              // Check if this is a US or worldwide release
              const country = version.country.toLowerCase();
              if (country === 'us' || 
                  country === 'usa' || 
                  country === 'united states' ||
                  country === 'worldwide' ||
                  country === 'international' ||
                  country === 'north america') {
                hasUSVinyl = true;
              }
            }
          }
        });
      }
      
      console.log(`${vinylCount > 0 ? '✅' : '❌'} Found ${vinylCount} vinyl versions`);
      if (vinylCount > 0) {
        console.log(`📍 Countries: ${vinylCountries.join(', ')}`);
        console.log(`🇺🇸 Has US/Worldwide vinyl: ${hasUSVinyl}`);
      }
      
      // Determine category
      let category: 'no-vinyl' | 'no-us-vinyl' | 'limited-vinyl' = 'no-vinyl';
      if (vinylCount === 0) {
        category = 'no-vinyl';
      } else if (!hasUSVinyl) {
        category = 'no-us-vinyl';
      } else if (vinylCount === 1) {
        category = 'limited-vinyl';
      }
      
      const shouldFlag = vinylCount === 0 || !hasUSVinyl || vinylCount === 1;
      
      return { 
        ...album, 
        available_formats: Array.from(allFormats), 
        has_vinyl: vinylCount > 0,
        vinyl_count: vinylCount,
        has_us_vinyl: hasUSVinyl,
        vinyl_countries: vinylCountries,
        category,
        format_check_method: `Master check (${versionsData.versions?.length || 0} versions, ${vinylCount} vinyl)`
      };
    } catch (error) {
      console.error(`❌ ERROR checking ${album.artist} - ${album.title}:`, error);
      return { ...album, available_formats: ['Error'], has_vinyl: false, format_check_method: 'Exception' };
    }
  };

  const runCDOnlyCheck = async () => {
    setScanning(true);
    setStatus('Fetching CD collection...');
    setProgress(0);
    setView('scanner');
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/collection?select=id,artist,title,year,discogs_release_id,image_url,discogs_genres,folder,format`,
        {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const allAlbums = await response.json();
      
      const allCDs = (allAlbums as Array<{
        id: number;
        artist: string;
        title: string;
        year: string | null;
        discogs_release_id: string | null;
        image_url: string | null;
        discogs_genres: string[] | null;
        folder: string | null;
        format: string | null;
      }>).filter((album) => {
        const format = (album.format || '').toLowerCase();
        const folder = (album.folder || '').toLowerCase();
        return format.includes('cd') || folder === 'cds';
      });
      
      const cdsWithReleaseId = allCDs.filter((album) => {
        const releaseId = album.discogs_release_id?.trim();
        return releaseId && releaseId !== '' && releaseId !== 'null' && releaseId !== 'undefined';
      });
      
      const skippedCount = allCDs.length - cdsWithReleaseId.length;
      
      if (cdsWithReleaseId.length === 0) {
        setStatus(`Found ${allCDs.length} CDs, but none have valid Discogs release IDs`);
        setScanning(false);
        return;
      }
      
      if (skippedCount > 0) {
        setStatus(`Found ${allCDs.length} CDs total. Checking ${cdsWithReleaseId.length} with release IDs (${skippedCount} skipped)`);
      } else {
        setStatus(`Checking ${cdsWithReleaseId.length} CDs...`);
      }
      
      await delay(2000);
      
      const results: CDOnlyAlbum[] = [];
      const errorList: Array<{album: string, error: string}> = [];
      
      for (let i = 0; i < cdsWithReleaseId.length; i++) {
        const album = cdsWithReleaseId[i];
        setStatus(`Checking ${i + 1}/${cdsWithReleaseId.length}: ${album.artist} - ${album.title}`);
        setProgress(((i + 1) / cdsWithReleaseId.length) * 100);
        
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
          cd_only_tagged: false
        });
        
        if (result.available_formats?.includes('Error')) {
          errorList.push({ album: `${result.artist} - ${result.title}`, error: 'Discogs API error' });
        } else {
          results.push(result);
        }
        
        if (i < cdsWithReleaseId.length - 1) await delay(1000);
      }
      
      // Filter to only "CD-Only" albums (no vinyl, no US vinyl, or limited vinyl)
      const cdOnly = results.filter(r => 
        r.category === 'no-vinyl' || 
        r.category === 'no-us-vinyl' || 
        r.category === 'limited-vinyl'
      );
      
      const noVinyl = results.filter(r => r.category === 'no-vinyl').length;
      const noUSVinyl = results.filter(r => r.category === 'no-us-vinyl').length;
      const limitedVinyl = results.filter(r => r.category === 'limited-vinyl').length;
      
      setResults(cdOnly);
      setStats({ 
        total: allCDs.length, 
        scanned: cdsWithReleaseId.length, 
        cdOnly: cdOnly.length,
        noVinyl,
        noUSVinyl,
        limitedVinyl,
        errors: errorList.length 
      });
      
      let statusMessage = `✅ Complete! Found ${cdOnly.length} CD-only albums (${noVinyl} no vinyl, ${noUSVinyl} no US vinyl, ${limitedVinyl} limited vinyl)`;
      if (skippedCount > 0) {
        statusMessage += ` (${skippedCount} CDs skipped - no release ID)`;
      }
      setStatus(statusMessage);
      
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
    const headers = ['Artist', 'Title', 'Year', 'Category', 'Vinyl Count', 'Has US Vinyl', 'Countries', 'Check Method'];
    const rows = filteredResults.map(a => [
      a.artist, 
      a.title, 
      a.year || '', 
      a.category || '',
      a.vinyl_count?.toString() || '0',
      a.has_us_vinyl ? 'Yes' : 'No',
      a.vinyl_countries?.join('; ') || '',
      a.format_check_method || ''
    ]);
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
    alert('Tagging requires a "notes" column in the collection table. This feature is currently disabled.');
  };

  const getCategoryLabel = (category: 'no-vinyl' | 'no-us-vinyl' | 'limited-vinyl') => {
    switch (category) {
      case 'no-vinyl': return '🚫 No Vinyl';
      case 'no-us-vinyl': return '🇺🇸 No US Vinyl';
      case 'limited-vinyl': return '⭐ Limited Vinyl (1 pressing)';
    }
  };

  const getCategoryColor = (category: 'no-vinyl' | 'no-us-vinyl' | 'limited-vinyl') => {
    switch (category) {
      case 'no-vinyl': return '#dc2626';
      case 'no-us-vinyl': return '#f59e0b';
      case 'limited-vinyl': return '#8b5cf6';
    }
  };

  return (
    <div>
      {view === 'scanner' && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>💿</div>
            <h2 style={{ fontSize: 'clamp(20px, 4vw, 24px)', fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>CD-Only Release Finder</h2>
            <p style={{ color: '#6b7280', fontSize: 'clamp(14px, 3vw, 16px)', maxWidth: 600, margin: '0 auto 24px' }}>
              Finds albums with no vinyl, no US vinyl releases, or only 1 limited vinyl pressing
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
              <div style={{ fontSize: 16, fontWeight: 600, color: '#92400e', marginBottom: 8, textAlign: 'center', wordWrap: 'break-word' }}>{status}</div>
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
              Found <strong>{stats.cdOnly}</strong> CD-only albums • 
              {stats.noVinyl} no vinyl • 
              {stats.noUSVinyl} no US vinyl • 
              {stats.limitedVinyl} limited vinyl • 
              {stats.errors} errors
              {filteredResults.length < results.length ? <> • Showing <strong>{filteredResults.length}</strong> filtered</> : null}
            </p>
          </div>

          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>🔍 Filters</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
                <input type="text" placeholder="Filter by artist..." value={artistFilter} onChange={(e) => setArtistFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }} />
                <input type="text" placeholder="Filter by year..." value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }} />
                <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}>
                  <option value="">All Genres</option>
                  {availableGenres.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button 
                  onClick={() => setCategoryFilter('all')} 
                  style={{ 
                    padding: '8px 16px', 
                    background: categoryFilter === 'all' ? '#8b5cf6' : '#f3f4f6', 
                    color: categoryFilter === 'all' ? 'white' : '#6b7280',
                    border: 'none', 
                    borderRadius: 6, 
                    fontSize: 13, 
                    fontWeight: 600,
                    cursor: 'pointer' 
                  }}
                >
                  All ({results.length})
                </button>
                <button 
                  onClick={() => setCategoryFilter('no-vinyl')} 
                  style={{ 
                    padding: '8px 16px', 
                    background: categoryFilter === 'no-vinyl' ? '#dc2626' : '#f3f4f6', 
                    color: categoryFilter === 'no-vinyl' ? 'white' : '#6b7280',
                    border: 'none', 
                    borderRadius: 6, 
                    fontSize: 13, 
                    fontWeight: 600,
                    cursor: 'pointer' 
                  }}
                >
                  🚫 No Vinyl ({stats.noVinyl})
                </button>
                <button 
                  onClick={() => setCategoryFilter('no-us-vinyl')} 
                  style={{ 
                    padding: '8px 16px', 
                    background: categoryFilter === 'no-us-vinyl' ? '#f59e0b' : '#f3f4f6', 
                    color: categoryFilter === 'no-us-vinyl' ? 'white' : '#6b7280',
                    border: 'none', 
                    borderRadius: 6, 
                    fontSize: 13, 
                    fontWeight: 600,
                    cursor: 'pointer' 
                  }}
                >
                  🇺🇸 No US Vinyl ({stats.noUSVinyl})
                </button>
                <button 
                  onClick={() => setCategoryFilter('limited-vinyl')} 
                  style={{ 
                    padding: '8px 16px', 
                    background: categoryFilter === 'limited-vinyl' ? '#8b5cf6' : '#f3f4f6', 
                    color: categoryFilter === 'limited-vinyl' ? 'white' : '#6b7280',
                    border: 'none', 
                    borderRadius: 6, 
                    fontSize: 13, 
                    fontWeight: 600,
                    cursor: 'pointer' 
                  }}
                >
                  ⭐ Limited ({stats.limitedVinyl})
                </button>
              </div>
              <button onClick={() => { setArtistFilter(''); setYearFilter(''); setGenreFilter(''); setCategoryFilter('all'); }} style={{ marginTop: 12, padding: '8px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>Clear All Filters</button>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 12 }}>⚡ Quick Actions</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setSelectedIds(new Set(filteredResults.map(a => a.id)))} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>Select All</button>
                <button onClick={() => setSelectedIds(new Set())} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>Clear</button>
                <button onClick={tagSelected} disabled={selectedIds.size === 0} style={{ padding: '8px 16px', background: selectedIds.size === 0 ? '#f3f4f6' : '#8b5cf6', color: selectedIds.size === 0 ? '#9ca3af' : 'white', border: 'none', borderRadius: 6, fontSize: 14, cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>🏷️ Tag ({selectedIds.size})</button>
                <button onClick={exportToCSV} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>📥 Export CSV</button>
                <button onClick={() => { setView('scanner'); setResults([]); setSelectedIds(new Set()); }} style={{ padding: '8px 16px', background: '#6b7280', color: 'white', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>🔄 New Scan</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
            {filteredResults.map((album) => (
              <div key={album.id} onClick={() => setSelectedIds(s => { const n = new Set(s); if (n.has(album.id)) { n.delete(album.id); } else { n.add(album.id); } return n; })} style={{ background: 'white', border: selectedIds.has(album.id) ? '2px solid #8b5cf6' : '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
                {album.image_url && <Image src={album.image_url} alt={`${album.artist} - ${album.title}`} width={180} height={180} style={{ objectFit: 'cover', width: '100%', height: 'auto', aspectRatio: '1' }} unoptimized />}
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.artist}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{album.title}</div>
                  {album.year && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{album.year}</div>}
                  {album.category && (
                    <div style={{ 
                      marginTop: 8, 
                      padding: '4px 8px', 
                      background: `${getCategoryColor(album.category)}20`, 
                      color: getCategoryColor(album.category), 
                      fontSize: 10, 
                      fontWeight: 700, 
                      borderRadius: 4, 
                      textAlign: 'center',
                      border: `1px solid ${getCategoryColor(album.category)}`
                    }}>
                      {getCategoryLabel(album.category)}
                    </div>
                  )}
                  {album.vinyl_count !== undefined && album.vinyl_count > 0 && (
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                      {album.vinyl_count} vinyl {album.vinyl_count === 1 ? 'version' : 'versions'}
                      {album.vinyl_countries && album.vinyl_countries.length > 0 && (
                        <div style={{ fontSize: 9 }}>{album.vinyl_countries.slice(0, 3).join(', ')}</div>
                      )}
                    </div>
                  )}
                  {album.format_check_method && <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 4 }}>{album.format_check_method}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}