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

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="text-sm text-gray-600">
        V3 enrichment focuses on Discogs metadata, tracklists, and cover art.
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
