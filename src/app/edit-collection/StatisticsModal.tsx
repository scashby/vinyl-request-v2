// src/app/edit-collection/StatisticsModal.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { type V3Album } from '../../types/v3-types';
import { getAlbumArtist, getAlbumFormat, getAlbumGenres, getAlbumTitle, getAlbumYearValue } from './albumHelpers';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface StatisticsData {
  totalAlbums: number;
  totalArtists: number;
  totalDiscs: number;
  totalTracks: number;
  totalRuntime: { days: number; hours: number; minutes: number };
  formatData: Array<{ name: string; value: number; color: string }>;
  genreData: Array<{ name: string; count: number }>;
  yearData: Array<{ year: string; count: number }>;
  artistData: Array<{ name: string; count: number }>;
  recentAdditions: V3Album[];
  playedData: Array<{ name: string; value: number; color: string }>;
  mostPlayed: Array<{ album: V3Album; playCount: number }>;
  recentlyPlayed: Array<{ album: V3Album; lastPlayed: Date }>;
}

const FORMAT_COLORS: Record<string, string> = {
  'LP, Album': '#C44E52',
  'CD, Album': '#DD8452',
  'Cass, Album': '#55A868',
  '7", Single': '#4C72B0',
  'LP, Album, RE': '#8172B2',
  'LP, Album, Pit': '#CCB974',
  'Cass, Album, Dol': '#64B5CD',
  'LP, Album, Win': '#937860',
  'Cass, Comp': '#DA8BC3',
  'Other': '#8C8C8C',
};

interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  albums: V3Album[];
}

export function StatisticsModal({ isOpen, onClose, albums }: StatisticsModalProps) {
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateStatistics = useCallback(async () => {
    setLoading(true);
    
    try {
      // Calculate statistics from albums data
      const totalAlbums = albums.length;
      const totalArtists = new Set(albums.map((album) => getAlbumArtist(album))).size;
      const totalDiscs = albums.reduce((sum, album) => sum + (album.release?.qty || 1), 0);
      const totalTracks = albums.reduce((sum, album) => 
        sum + (album.release?.release_tracks?.length || 0), 0
      );

      // Calculate total runtime
      let totalSeconds = 0;
      albums.forEach(album => {
        album.release?.release_tracks?.forEach((track) => {
          const duration = track.recording?.duration_seconds ?? null;
          if (typeof duration === 'number') {
            totalSeconds += duration;
          }
        });
      });

      const totalRuntime = {
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60)
      };

      // Format data - TOP 9 FORMATS + OTHER
      const formatCounts: Record<string, number> = {};
      albums.forEach(album => {
        const format = getAlbumFormat(album) || 'Unknown';
        formatCounts[format] = (formatCounts[format] || 0) + 1;
      });

      // Sort formats by count and take top 9
      const sortedFormats = Object.entries(formatCounts)
        .sort((a, b) => b[1] - a[1]);
      
      const top9Formats = sortedFormats.slice(0, 9);
      const otherFormats = sortedFormats.slice(9);
      
      // Calculate "Other" count
      const otherCount = otherFormats.reduce((sum, [, count]) => sum + count, 0);
      
      // Build format data with top 9 + Other
      const formatData = top9Formats.map(([name, value]) => ({
        name,
        value,
        color: FORMAT_COLORS[name] || '#8C8C8C'
      }));
      
      if (otherCount > 0) {
        formatData.push({
          name: 'Other',
          value: otherCount,
          color: FORMAT_COLORS['Other']
        });
      }

      // Genre data
      const genreCounts: Record<string, number> = {};
      albums.forEach(album => {
        // FIXED: Only use canonical 'genres' field (removed spotify_genres)
        const genreList = getAlbumGenres(album) || [];
        const genres = (Array.isArray(genreList) ? genreList : []).map((g: string) => g.trim()).filter(Boolean);
        if (genres.length === 0) genres.push('Unknown');
        genres.forEach(genre => {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
      });

      const genreData = Object.entries(genreCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Year data
      const yearCounts: Record<string, number> = {};
      albums.forEach(album => {
        const year = getAlbumYearValue(album)?.toString() || 'Unknown';
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      });

      const yearData = Object.entries(yearCounts)
        .filter(([year]) => year !== 'Unknown')
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => parseInt(a.year) - parseInt(b.year));

      // Artist data
      const artistCounts: Record<string, number> = {};
      albums.forEach(album => {
        const artist = getAlbumArtist(album) || 'Unknown';
        artistCounts[artist] = (artistCounts[artist] || 0) + 1;
      });

      const artistData = Object.entries(artistCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Recent additions - DON'T SLICE HERE
      const recentAdditions = [...albums]
        .sort((a, b) => (b.date_added || '').localeCompare(a.date_added || ''));

      // Played data
      const playedCount = albums.filter(a => (a.play_count || 0) > 0).length;
      const notPlayedCount = totalAlbums - playedCount;

      const playedData = [
        { name: 'Played', value: playedCount, color: '#E8A87C' },
        { name: 'Not Played', value: notPlayedCount, color: '#89CFF0' }
      ];

      // Most played
      const mostPlayed = albums
        .filter(a => (a.play_count || 0) > 0)
        .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
        .slice(0, 10)
        .map(album => ({
          album,
          playCount: album.play_count || 0
        }));

      // Recently played - not available in current schema
      const recentlyPlayed: Array<{ album: V3Album; lastPlayed: Date }> = [];

      setStats({
        totalAlbums,
        totalArtists,
        totalDiscs,
        totalTracks,
        totalRuntime,
        formatData,
        genreData,
        yearData,
        artistData,
        recentAdditions,
        playedData,
        mostPlayed,
        recentlyPlayed
      });
    } catch (error) {
      console.error('Failed to calculate statistics:', error);
    } finally {
      setLoading(false);
    }
  }, [albums]);

  useEffect(() => {
    if (isOpen && albums.length > 0) {
      calculateStatistics();
    }
  }, [isOpen, albums, calculateStatistics]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[50000]"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[50001] flex flex-col bg-gray-100">
        {/* Header */}
        <div className="bg-[#2A2A2A] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <h1 className="m-0 text-lg font-semibold">Statistics</h1>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-white text-2xl cursor-pointer p-1 hover:text-gray-300"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="p-10 text-center text-gray-500">
              Calculating statistics...
            </div>
          ) : !stats ? (
            <div className="p-10 text-center text-gray-500">
              Failed to load statistics
            </div>
          ) : (
            <div className="max-w-[1400px] mx-auto">
              {/* Overview Stats */}
              <div className="bg-white rounded-lg p-8 mb-6 text-center shadow-sm">
                <div className="text-2xl font-semibold text-gray-900 mb-3">
                  {stats.totalAlbums} albums and {stats.totalArtists} Artists
                </div>
                <div className="text-base text-gray-500">
                  {stats.totalDiscs} discs, {stats.totalTracks} tracks / total runtime: {stats.totalRuntime.days} days, {stats.totalRuntime.hours} hours, {stats.totalRuntime.minutes} minutes
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Albums by Format */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <h2 className="m-0 mb-4 text-lg font-semibold text-gray-900">Albums by Format</h2>
                  
                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-4 gap-y-3 mb-5 justify-center text-xs">
                    {stats.formatData.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-900 whitespace-nowrap">{item.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Pie Chart */}
                  <div className="flex justify-center w-full h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.formatData}
                          cx="50%"
                          cy="50%"
                          innerRadius={0}
                          outerRadius={120}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {stats.formatData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Most Recent Additions */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <h2 className="m-0 mb-4 text-lg font-semibold text-gray-900">Most recent additions</h2>
                  <div className="flex flex-col gap-3">
                    {stats.recentAdditions.slice(0, 5).map((album) => {
                      const imageUrl = album.release?.master?.cover_image_url && album.release?.master?.cover_image_url.trim().toLowerCase() !== 'no'
                        ? album.release?.master?.cover_image_url.trim()
                        : '/images/placeholder.png';
                      return (
                        <div key={album.id} className="flex gap-3 items-center p-2 rounded border border-gray-200">
                          <Image
                            src={imageUrl}
                            alt={getAlbumTitle(album)}
                            width={60}
                            height={60}
                            unoptimized
                          />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-blue-600 mb-0.5 truncate">
                            {getAlbumTitle(album)}
                          </div>
                          <div className="text-[13px] text-gray-500 mb-0.5">{getAlbumArtist(album)}</div>
                          <div className="text-xs text-gray-400">{getAlbumFormat(album)} - {getAlbumYearValue(album) || 'Unknown'}</div>
                        </div>
                        <div className="text-right text-xs text-gray-500 shrink-0">
                          {album.release?.release_tracks?.length || 0} tracks<br />
                          {album.date_added ? new Date(album.date_added).toLocaleDateString() : ''}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Albums by Release Year */}
              <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
                <h2 className="m-0 mb-4 text-lg font-semibold text-gray-900">Albums by Release Year</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={stats.yearData}>
                    <defs>
                      <linearGradient id="colorYear" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E8A87C" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#E8A87C" stopOpacity={0.3}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#666' }} angle={-45} textAnchor="end" height={80} />
                    <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                    <Tooltip contentStyle={{ background: '#2A2A2A', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="count" stroke="#E8A87C" fillOpacity={1} fill="url(#colorYear)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Albums by Genre */}
              <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
                <h2 className="m-0 mb-4 text-lg font-semibold text-gray-900">Albums by Genre</h2>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={stats.genreData.slice(0, 15)}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} angle={-45} textAnchor="end" height={100} />
                    <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                    <Tooltip 
                      contentStyle={{ background: '#2A2A2A', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px' }}
                      cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                    />
                    <Bar dataKey="count" fill="#E8A87C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Albums by Artist */}
              <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
                <h2 className="m-0 mb-4 text-lg font-semibold text-gray-900">Albums by Artist</h2>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={stats.artistData.slice(0, 20)}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} angle={-45} textAnchor="end" height={120} />
                    <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                    <Tooltip 
                      contentStyle={{ background: '#2A2A2A', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px' }}
                      cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                    />
                    <Bar dataKey="count" fill="#E8A87C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Bottom Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Played */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <h2 className="m-0 mb-4 text-lg font-semibold text-gray-900">Played</h2>
                  <div className="w-full h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.playedData}
                          cx="50%"
                          cy="50%"
                          innerRadius={0}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {stats.playedData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-3 text-[13px]">
                    {stats.playedData.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-900">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Most Played */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <h2 className="m-0 mb-4 text-lg font-semibold text-gray-900">Most played</h2>
                  {stats.mostPlayed.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 text-sm">
                      No play data yet
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {stats.mostPlayed.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="text-[13px] text-gray-900 p-2 rounded bg-gray-50">
                          <div className="font-semibold">{getAlbumArtist(item.album)}</div>
                          <div className="text-gray-600">{getAlbumTitle(item.album)}</div>
                          <div className="text-gray-400 text-xs">{item.playCount} plays</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Most Recently Played */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <h2 className="m-0 mb-4 text-lg font-semibold text-gray-900">Most recently played</h2>
                  {stats.recentlyPlayed.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 text-sm">
                      No play data yet
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {stats.recentlyPlayed.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="text-[13px] text-gray-900 p-2 rounded bg-gray-50">
                          <div className="font-semibold">{getAlbumArtist(item.album)}</div>
                          <div className="text-gray-600">{getAlbumTitle(item.album)}</div>
                          <div className="text-gray-400 text-xs">{new Date(item.lastPlayed).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
