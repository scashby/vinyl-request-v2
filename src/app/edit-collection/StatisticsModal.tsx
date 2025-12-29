// src/app/edit-collection/StatisticsModal.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Album } from '../../types/album';
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
  recentAdditions: Album[];
  playedData: Array<{ name: string; value: number; color: string }>;
  mostPlayed: Array<{ album: Album; playCount: number }>;
  recentlyPlayed: Array<{ album: Album; lastPlayed: Date }>;
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
  albums: Album[];
}

export function StatisticsModal({ isOpen, onClose, albums }: StatisticsModalProps) {
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateStatistics = useCallback(async () => {
    setLoading(true);
    
    try {
      // Calculate statistics from albums data
      const totalAlbums = albums.length;
      const totalArtists = new Set(albums.map(a => a.artist)).size;
      const totalDiscs = albums.reduce((sum, a) => sum + (a.discs || 1), 0);
      const totalTracks = albums.reduce((sum, a) => 
        sum + (a.tracks?.filter((t) => t.type === 'track').length || 0), 0
      );

      // Calculate total runtime
      let totalSeconds = 0;
      albums.forEach(album => {
        album.tracks?.forEach((track) => {
          if (track.duration) {
            const parts = track.duration.split(':');
            if (parts.length === 2) {
              totalSeconds += parseInt(parts[0]) * 60 + parseInt(parts[1]);
            } else if (parts.length === 3) {
              totalSeconds += parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
            }
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
        const format = album.format || 'Unknown';
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
        const genreString = album.discogs_genres || album.spotify_genres || '';
        const genres = (Array.isArray(genreString) ? genreString : genreString.split(',')).map((g: string) => g.trim()).filter(Boolean);
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
        const year = album.year?.toString() || 'Unknown';
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      });

      const yearData = Object.entries(yearCounts)
        .filter(([year]) => year !== 'Unknown')
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => parseInt(a.year) - parseInt(b.year));

      // Artist data
      const artistCounts: Record<string, number> = {};
      albums.forEach(album => {
        const artist = album.artist || 'Unknown';
        artistCounts[artist] = (artistCounts[artist] || 0) + 1;
      });

      const artistData = Object.entries(artistCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Recent additions
      const recentAdditions = [...albums]
        .sort((a, b) => (b.date_added || '').localeCompare(a.date_added || ''))
        .slice(0, 10);

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
      const recentlyPlayed: Array<{ album: Album; lastPlayed: Date }> = [];

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
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 50000,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50001,
          display: 'flex',
          flexDirection: 'column',
          background: '#F5F5F5',
        }}
      >
        {/* Header */}
        <div style={{ background: '#2A2A2A', color: 'white', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>📊</span>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Statistics</h1>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
              Calculating statistics...
            </div>
          ) : !stats ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
              Failed to load statistics
            </div>
          ) : (
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              {/* Overview Stats */}
              <div style={{ background: 'white', borderRadius: '8px', padding: '32px', marginBottom: '24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: '24px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>
                  {stats.totalAlbums} albums and {stats.totalArtists} Artists
                </div>
                <div style={{ fontSize: '16px', color: '#666' }}>
                  {stats.totalDiscs} discs, {stats.totalTracks} tracks / total runtime: {stats.totalRuntime.days} days, {stats.totalRuntime.hours} hours, {stats.totalRuntime.minutes} minutes
                </div>
              </div>

              {/* Charts Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                {/* Albums by Format */}
                <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>Albums by Format</h2>
                  
                  {/* Legend - Horizontal above chart */}
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '12px 16px',
                    marginBottom: '20px',
                    fontSize: '12px',
                    justifyContent: 'center'
                  }}>
                    {stats.formatData.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '12px', height: '12px', background: item.color, borderRadius: '2px', flexShrink: 0 }} />
                        <span style={{ color: '#1a1a1a', whiteSpace: 'nowrap' }}>{item.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Pie Chart - Centered */}
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', height: '300px' }}>
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
                <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>Most recent additions</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {stats.recentAdditions.slice(0, 5).map((album) => (
                      <div key={album.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '8px', borderRadius: '4px', border: '1px solid #E8E8E8' }}>
                        <Image 
                          src={album.image_url || ''} 
                          alt={album.title}
                          width={60}
                          height={60}
                          style={{
                            width: '60px',
                            height: '60px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            flexShrink: 0
                          }}
                          unoptimized
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0066cc', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {album.title}
                          </div>
                          <div style={{ fontSize: '13px', color: '#666', marginBottom: '2px' }}>{album.artist}</div>
                          <div style={{ fontSize: '12px', color: '#999' }}>{album.format} - {album.year || 'Unknown'}</div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '12px', color: '#666', flexShrink: 0 }}>
                          {album.tracks?.filter((t) => t.type === 'track').length || 0} tracks<br />
                          {album.date_added ? new Date(album.date_added).toLocaleDateString() : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Albums by Release Year */}
              <div style={{ background: 'white', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>Albums by Release Year</h2>
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
              <div style={{ background: 'white', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>Albums by Genre</h2>
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
              <div style={{ background: 'white', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>Albums by Artist</h2>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                {/* Played */}
                <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>Played</h2>
                  <div style={{ width: '100%', height: '250px' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', fontSize: '13px' }}>
                    {stats.playedData.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '12px', height: '12px', background: item.color, borderRadius: '2px' }} />
                        <span style={{ color: '#1a1a1a' }}>{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Most Played */}
                <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>Most played</h2>
                  {stats.mostPlayed.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
                      No play data yet
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {stats.mostPlayed.slice(0, 5).map((item, idx) => (
                        <div key={idx} style={{ fontSize: '13px', color: '#1a1a1a', padding: '8px', borderRadius: '4px', background: '#F8F8F8' }}>
                          <div style={{ fontWeight: 600 }}>{item.album.artist}</div>
                          <div style={{ color: '#666' }}>{item.album.title}</div>
                          <div style={{ color: '#999', fontSize: '12px' }}>{item.playCount} plays</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Most Recently Played */}
                <div style={{ background: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>Most recently played</h2>
                  {stats.recentlyPlayed.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
                      No play data yet
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {stats.recentlyPlayed.slice(0, 5).map((item, idx) => (
                        <div key={idx} style={{ fontSize: '13px', color: '#1a1a1a', padding: '8px', borderRadius: '4px', background: '#F8F8F8' }}>
                          <div style={{ fontWeight: 600 }}>{item.album.artist}</div>
                          <div style={{ color: '#666' }}>{item.album.title}</div>
                          <div style={{ color: '#999', fontSize: '12px' }}>{new Date(item.lastPlayed).toLocaleDateString()}</div>
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