'use client';

import { useEffect, useState } from 'react';
import { supabase } from 'lib/supabaseClient';
import 'styles/build-list.css';

type Album = {
  id: string;
  artist: string;
  title: string;
  genre: string;
  year: number;
};

export default function BuildListPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [filtered, setFiltered] = useState<Album[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [decades, setDecades] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedDecades, setSelectedDecades] = useState<string[]>([]);
  const [limit, setLimit] = useState<number>(10);

  useEffect(() => {
    fetchAlbums();
  }, []);

  const fetchAlbums = async () => {
    const { data, error } = await supabase.from('collection').select('*');

    if (error || !data) {
      console.error('Fetch error:', error);
      return;
    }

    const valid = (data as Album[]).filter(
      (a: Album) => !!a.genre && !!a.year
    );

    setAlbums(valid);

    const genreSet = Array.from(new Set(valid.map((a: Album) => a.genre)));
    const decadeSet = Array.from(
      new Set(valid.map((a: Album) => `${Math.floor(a.year / 10) * 10}s`))
    );

    setGenres(genreSet.sort());
    setDecades(decadeSet.sort());
  };

  const handleFilter = () => {
    let pool = [...albums];

    if (selectedGenres.length) {
      pool = pool.filter((a: Album) => selectedGenres.includes(a.genre));
    }

    if (selectedDecades.length) {
      pool = pool.filter((a: Album) =>
        selectedDecades.includes(`${Math.floor(a.year / 10) * 10}s`)
      );
    }

    const shuffled = pool.sort(() => 0.5 - Math.random());
    setFiltered(shuffled.slice(0, limit));
  };

  return (
    <div className="build-list">
      <h2>Build Album List</h2>

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

        <label># of Albums:</label>
        <input
          type="number"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          min={1}
          max={100}
        />

        <button onClick={handleFilter}>Generate List</button>
      </div>

      <div className="results">
        {filtered.map((a) => (
          <div key={a.id} className="album-card">
            <strong>{a.artist}</strong> – <em>{a.title}</em> ({a.year})<br />
            <small>
              {a.genre} | {Math.floor(a.year / 10) * 10}s
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}
