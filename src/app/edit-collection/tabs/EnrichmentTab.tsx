// src/app/edit-collection/tabs/EnrichmentTab.tsx
'use client';

import React, { useMemo, useState } from 'react';
import type { Album } from 'types/album';
import { FindCoverModal } from '../enrichment/FindCoverModal';

interface EnrichmentTabProps {
  album: Album;
  onChange: <K extends keyof Album>(field: K, value: Album[K]) => void;
}

type EnrichResult = {
  success: boolean;
  skipped?: boolean;
  error?: string;
  message?: string;
  data?: {
    updates?: {
      release?: Record<string, unknown>;
      master?: Record<string, unknown>;
    };
    tracks?: Array<{
      position: string;
      title: string;
      artist: string | null;
      duration: string | null;
      type: 'track';
      side?: string;
    }>;
    totalTracks?: number;
  };
};

export function EnrichmentTab({ album, onChange }: EnrichmentTabProps) {
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [loadingTracklist, setLoadingTracklist] = useState(false);
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [loadingMusicBrainz, setLoadingMusicBrainz] = useState(false);
  const [showFindCover, setShowFindCover] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const hasDiscogsId = useMemo(() => Boolean(album.discogs_release_id), [album.discogs_release_id]);

  const handleDiscogsMetadata = async () => {
    if (!album.id) return;
    setLoadingMetadata(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/enrich-sources/discogs-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: album.id })
      });
      const data = (await res.json()) as EnrichResult;
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Discogs metadata failed');
      }

      const updates = data.data?.updates;
      if (updates?.release?.discogs_release_id) {
        onChange('discogs_release_id', updates.release.discogs_release_id as Album['discogs_release_id']);
      }
      if (updates?.master?.discogs_master_id) {
        onChange('discogs_master_id', updates.master.discogs_master_id as Album['discogs_master_id']);
      }
      if (updates?.master?.cover_image_url) {
        onChange('image_url', updates.master.cover_image_url as Album['image_url']);
      }
      if (updates?.master?.genres) {
        onChange('genres', updates.master.genres as Album['genres']);
      }
      if (updates?.master?.styles) {
        onChange('styles', updates.master.styles as Album['styles']);
      }

      setStatusMessage(data.skipped ? 'No new metadata found.' : 'Discogs metadata updated.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Discogs metadata failed.');
    } finally {
      setLoadingMetadata(false);
    }
  };

  const handleDiscogsTracklist = async () => {
    if (!album.id) return;
    setLoadingTracklist(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/enrich-sources/discogs-tracklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: album.id })
      });
      const data = (await res.json()) as EnrichResult;
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Discogs tracklist failed');
      }
      if (data.data?.tracks && data.data.tracks.length > 0) {
        onChange('tracks', data.data.tracks as Album['tracks']);
      }
      setStatusMessage(`Tracklist updated (${data.data?.totalTracks ?? 0} tracks).`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Discogs tracklist failed.');
    } finally {
      setLoadingTracklist(false);
    }
  };

  const handleSpotifyEnrich = async () => {
    if (!album.id) return;
    setLoadingSpotify(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/enrich-sources/spotify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: album.id })
      });
      const data = (await res.json()) as { success?: boolean; error?: string; data?: { spotify?: { id?: string } } };
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Spotify enrichment failed');
      }
      const spotifyId = data.data?.spotify?.id;
      if (spotifyId) {
        onChange('spotify_album_id', spotifyId as Album['spotify_album_id']);
      }
      setStatusMessage(spotifyId ? 'Spotify album ID updated.' : 'No Spotify match found.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Spotify enrichment failed.');
    } finally {
      setLoadingSpotify(false);
    }
  };

  const handleMusicBrainzEnrich = async () => {
    if (!album.id) return;
    setLoadingMusicBrainz(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/enrich-sources/musicbrainz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: album.id })
      });
      const data = (await res.json()) as { success?: boolean; error?: string; data?: { musicbrainz?: { id?: string } } };
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'MusicBrainz enrichment failed');
      }
      const mbId = data.data?.musicbrainz?.id;
      if (mbId) {
        onChange('musicbrainz_release_group_id', mbId as Album['musicbrainz_release_group_id']);
      }
      setStatusMessage(mbId ? 'MusicBrainz release group ID updated.' : 'No MusicBrainz match found.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'MusicBrainz enrichment failed.');
    } finally {
      setLoadingMusicBrainz(false);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="text-sm text-gray-600">
        V3 enrichment pulls Discogs metadata/tracklists, cover art, and external IDs from Spotify and MusicBrainz.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          onClick={handleDiscogsMetadata}
          disabled={loadingMetadata}
          className="px-4 py-2.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loadingMetadata ? 'Fetching Discogs Metadata…' : 'Fetch Discogs Metadata'}
        </button>

        <button
          onClick={handleDiscogsTracklist}
          disabled={loadingTracklist || !hasDiscogsId}
          className="px-4 py-2.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
        >
          {loadingTracklist ? 'Fetching Tracklist…' : 'Fetch Discogs Tracklist'}
        </button>

        <button
          onClick={handleSpotifyEnrich}
          disabled={loadingSpotify}
          className="px-4 py-2.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60"
        >
          {loadingSpotify ? 'Searching Spotify…' : 'Find Spotify Album ID'}
        </button>

        <button
          onClick={handleMusicBrainzEnrich}
          disabled={loadingMusicBrainz}
          className="px-4 py-2.5 text-sm bg-slate-700 text-white rounded hover:bg-slate-800 disabled:opacity-60"
        >
          {loadingMusicBrainz ? 'Searching MusicBrainz…' : 'Find MusicBrainz Release Group'}
        </button>

        <button
          onClick={() => setShowFindCover(true)}
          className="px-4 py-2.5 text-sm bg-gray-700 text-white rounded hover:bg-gray-800"
        >
          Find Cover Art
        </button>
      </div>

      {statusMessage && (
        <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-3 py-2">
          {statusMessage}
        </div>
      )}

      {!hasDiscogsId && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Tracklist enrichment requires a Discogs Release ID. Run “Fetch Discogs Metadata” first if missing.
        </div>
      )}

      <FindCoverModal
        isOpen={showFindCover}
        onClose={() => setShowFindCover(false)}
        onSelectImage={(imageUrl) => onChange('image_url', imageUrl as Album['image_url'])}
        defaultQuery={`${album.artist ?? ''} ${album.title ?? ''}`.trim()}
        artist={album.artist ?? undefined}
        title={album.title ?? undefined}
      />
    </div>
  );
}
