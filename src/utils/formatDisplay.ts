const MEDIA_LABELS: Record<string, string> = {
  vinyl: 'Vinyl',
  lp: 'LP',
  cd: 'CD',
  'compact disc': 'CD',
  cassette: 'Cassette',
  cass: 'Cassette',
  '8-track': '8-Track',
  '8 track': '8-Track',
  'box set': 'Box Set',
  'all media': 'All Media',
  dvd: 'DVD',
  'blu-ray': 'Blu-ray',
};

const TYPE_LABELS: Record<string, string> = {
  'maxi-single': 'Maxi-Single',
  single: 'Single',
  ep: 'EP',
  'mini-album': 'Mini-Album',
  album: 'Album',
};

const SIZE_LABELS = ['7"', '10"', '12"'] as const;

function normalizeToken(token: string): string {
  return token.replace(/\s+/g, ' ').trim();
}

function extractDiscCount(token: string): { count?: number; remainder: string } {
  const match = token.match(/^(\d+)x\s*(.+)$/i);
  if (match) {
    return { count: Number(match[1]), remainder: normalizeToken(match[2]) };
  }
  return { remainder: normalizeToken(token) };
}

export function getDisplayFormat(format: string): string {
  if (!format || format.trim() === '') return '—';

  const tokens = format
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  let discCount: number | undefined;
  const cleanedTokens: string[] = [];

  tokens.forEach((token) => {
    const { count, remainder } = extractDiscCount(token);
    if (count && !discCount) discCount = count;
    cleanedTokens.push(remainder);
  });

  const normalizedTokens = cleanedTokens.map((token) => token.toLowerCase());
  const hasVinyl =
    normalizedTokens.includes('vinyl') ||
    normalizedTokens.includes('lp') ||
    SIZE_LABELS.some((size) => normalizedTokens.includes(size.toLowerCase()));

  const size = SIZE_LABELS.find((label) => normalizedTokens.includes(label.toLowerCase()));
  const typeKey = Object.keys(TYPE_LABELS).find((key) => normalizedTokens.includes(key));

  let baseLabel: string | undefined;

  if (hasVinyl) {
    if (size && typeKey) {
      baseLabel = `${size} ${TYPE_LABELS[typeKey]}`;
    } else if (size) {
      baseLabel = size;
    } else if (typeKey && TYPE_LABELS[typeKey] !== 'Album') {
      baseLabel = TYPE_LABELS[typeKey];
    } else if (normalizedTokens.includes('lp')) {
      baseLabel = 'LP';
    } else {
      baseLabel = 'Vinyl';
    }
  } else {
    const mediaKey = Object.keys(MEDIA_LABELS).find((key) => normalizedTokens.includes(key));
    baseLabel = mediaKey ? MEDIA_LABELS[mediaKey] : undefined;
  }

  if (!baseLabel) {
    return format;
  }

  if (discCount && discCount > 1) {
    return `${discCount}x${baseLabel}`;
  }

  return baseLabel;
}
// AUDIT: inspected, no changes.
