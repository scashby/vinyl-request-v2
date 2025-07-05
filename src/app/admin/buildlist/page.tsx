'use client';

import { useEffect, useState } from 'react';
import { supabase } from 'lib/supabaseClient';
import 'styles/build-list.css';

type Album = {
  id: string | number;
  artist: string;
  title: string;
  genre: string;
  year: number;
  format: string;
};

export default function BuildListPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [filtered, setFiltered] = useState<Album[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [genres, setGenres] = useState<string[]>([]);
  const [decades, setDecades] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedDecades, setSelectedDecades] = useState<string[]>([]);

  useEffect(() => {
    fetchAlbums();
  }, []);

  const fetchAlbums = async () => {
    const { data, error } = await supabase.from('collection').select('*');
    if (error || !data) {
      console.error('Fetch error:', error);
      return;
    }

    const valid = (data as Album[]).filter((a) => a.genre && a.year);
    setAlbums(valid);

    const genreSet = Array.from(new Set(valid.map((a) => a.genre))).sort();
    const decadeSet = Array.from(
      new Set(valid.map((a) => `${Math.floor(a.year / 10) * 10}s`))
    ).sort();

    setGenres(genreSet);
    setDecades(decadeSet);
  };

  const applyFilters = () => {
    let pool = [...albums];

    if (selectedGenres.length > 0) {
      pool = pool.filter((a) => selectedGenres.includes(a.genre));
    }

    if (selectedDecades.length > 0) {
      pool = pool.filter((a) =>
        selectedDecades.includes(`${Math.floor(a.year / 10) * 10}s`)
      );
    }

    setFiltered(pool);

    // ✅ THIS is the fix — guaranteed call, not dangling
    setSelected(new Set());
  };

  const toggleSelection = (id: string | number) => {
    const key = String(id);
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelected(next);
  };

  const getStats = () => {
    const selectedAlbums = filtered.filter((a) => selected.has(String(a.id)));
    return {
      genres: countBy(selectedAlbums, 'genre'),
      decades: countBy(selectedAlbums, (a) => `${Math.floor(a.year / 10) * 10}s`),
      formats: countBy(selectedAlbums, 'format'),
    };
  };

  const countBy = (
    items: Album[],
    key: keyof Album | ((a: Album) => string)
  ): [string, number][] => {
    const map = new Map<string, number>();
    for (const item of items) {
      const k = typeof key === 'function' ? key(item) : item[key];
      map.set(String(k), (map.get(String(k)) || 0) + 1);
    }
    return Array.from(map.entries()).sort();
  };

  const exportCSV = () => {
    const rows = filtered
      .filter((a) => selected.has(String(a.id)))
      .map((a) => `${a.artist},"${a.title}",${a.genre},${a.format},${a.year}`);
    const header = 'Artist,Title,Genre,Format,Year\n';
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'byov-list.csv';
    link.click();
  };

  const copyToClipboard = () => {
    const lines = filtered
      .filter((a) => selected.has(String(a.id)))
      .map((a) => `${a.artist} – ${a.title} (${a.year})`);
    navigator.clipboard.writeText(lines.join('\n'));
  };

  const stats = getStats();

  return (
    <div className="build-list">
      <h2>Build BYOV Crate</h2>

      <div className="filters">
        <label>Genres:</label>
        <select
          multiple
          onChange={(e) =>
            setSelectedGenres(
              Array.from(e.target.selectedOptions).map((o) => o.value)
            )
          }
        >
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <label>Decades:</label>
        <select
          multiple
          onChange={(e) =>
            setSelectedDecades(
              Array.from(e.target.selectedOptions).map((o) => o.value)
            )
          }
        >
          {decades.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <button onClick={applyFilters}>Filter Albums</button>
      </div>

      <div className="summary">
        <h4>Selection Summary:</h4>
        <p>
          <strong>Genres:</strong>{' '}
          {stats.genres.map(([g, n]) => `${g} (${n})`).join(', ') || 'None'}
        </p>
        <p>
          <strong>Decades:</strong>{' '}
          {stats.decades.map(([d, n]) => `${d} (${n})`).join(', ') || 'None'}
        </p>
        <p>
          <strong>Formats:</strong>{' '}
          {stats.formats.map(([f, n]) => `${f} (${n})`).join(', ') || 'None'}
        </p>
      </div>

      <div className="results">
        {filtered.map((a) => (
          <label key={a.id} className="album-row">
            <input
              type="checkbox"
              checked={selected.has(String(a.id))}
              onChange={() => toggleSelection(a.id)}
            />
            <span>
              <strong>{a.artist}</strong> – <em>{a.title}</em> ({a.year})<br />
              <small>
                {a.genre} | {a.format} | {Math.floor(a.year / 10) * 10}s
              </small>
            </span>
          </label>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="actions">
          <button onClick={copyToClipboard}>Copy to Clipboard</button>
          <button onClick={exportCSV}>Download CSV</button>
        </div>
      )}
    </div>
  );
}
