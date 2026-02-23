export type LibraryAlbumListQuery = {
  q?: string;
  artist?: string;
  title?: string;
  location?: string;
  mediaType?: string;
  page?: number;
  pageSize?: number;
  includeTracks?: boolean;
};

export type LibraryAlbumListResponse<T> = {
  ok: true;
  page: number;
  pageSize: number;
  hasMore: boolean;
  data: T[];
};

export type LibraryTrackSearchResult = {
  track_key: string;
  inventory_id: number | null;
  release_id: number | null;
  recording_id: number | null;
  position: string | null;
  side: string | null;
  track_title: string | null;
  track_artist: string | null;
  album_title: string | null;
  album_artist: string | null;
  score: number;
};

export type LibraryRecordingResponse = {
  ok: true;
  recording: {
    id: number;
    title: string | null;
    track_artist: string | null;
    lyrics: string | null;
    lyrics_url: string | null;
    credits: unknown | null;
  };
};

export type LibraryTrackSavePayload = {
  releaseId: number;
  // TracksTabRef.getTracksData().tracks
  tracks: Array<{
    position: string;
    title: string;
    artist: string | null;
    duration: string | null;
    note?: string | null;
    type: "track" | "header";
    disc_number: number;
    side?: string;
    credits?: unknown | null;
    bpm?: number | null;
    musical_key?: string | null;
    energy?: number | null;
    danceability?: number | null;
    valence?: number | null;
    is_cover?: boolean | null;
    original_artist?: string | null;
  }>;
};

export type LibraryTrackSaveResult = {
  ok: true;
  releaseId: number;
  updatedReleaseTrackCount: number;
  insertedReleaseTrackCount: number;
  deletedReleaseTrackCount: number;
  updatedRecordingCount: number;
  insertedRecordingCount: number;
};
