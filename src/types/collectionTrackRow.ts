export interface CollectionTrackRow {
  key: string;
  inventoryId: number;
  releaseTrackId: number | null;
  recordingId: number | null;
  albumArtist: string;
  albumTitle: string;
  trackArtist: string;
  trackTitle: string;
  position: string;
  side: string | null;
  durationSeconds: number | null;
  durationLabel: string;
  albumMediaType: string;
  trackFormatFacets: string[];
}
