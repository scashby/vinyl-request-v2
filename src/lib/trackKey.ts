type BuildCollectionTrackKeyInput = {
  inventoryId: number;
  releaseTrackId?: number | null;
  position?: string | number | null;
  recordingId?: number | null;
  fallbackIndex?: number;
};

const normalizePosition = (position: string | number | null | undefined, fallbackIndex: number): string => {
  const text = String(position ?? '').trim();
  return text || String(fallbackIndex + 1);
};

export const buildCollectionTrackKey = ({
  inventoryId,
  releaseTrackId,
  position,
  recordingId,
  fallbackIndex = 0,
}: BuildCollectionTrackKeyInput): string => {
  const positionToken = normalizePosition(position, fallbackIndex);
  const releaseToken = releaseTrackId != null ? String(releaseTrackId) : `p:${positionToken}`;
  const recordingToken = recordingId != null ? String(recordingId) : String(fallbackIndex);
  return `${inventoryId}:${releaseToken}:${recordingToken}`;
};

export const buildLegacyTrackKeyCandidates = ({
  inventoryId,
  releaseTrackId,
  position,
  fallbackIndex = 0,
}: Omit<BuildCollectionTrackKeyInput, 'recordingId'>): string[] => {
  const candidates: string[] = [];
  const normalizedPosition = normalizePosition(position, fallbackIndex);

  if (releaseTrackId != null) {
    candidates.push(`${inventoryId}:${releaseTrackId}`);
  }

  if (normalizedPosition) {
    candidates.push(`${inventoryId}:${normalizedPosition}`);
  }

  return candidates;
};
