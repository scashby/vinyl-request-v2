// src/app/edit-collection/components/ImportCLZModal.tsx
'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { cleanArtistName, normalizeArtist, normalizeTitle } from '../../../lib/importUtils';
import {
  buildIdentifyingFieldUpdates,
  detectConflicts,
  type FieldConflict,
  type PreviousResolution,
} from '../../../lib/conflictDetection';
import ConflictResolutionModal from './ConflictResolutionModal';

type ImportStage = 'upload' | 'matching' | 'preview' | 'importing' | 'conflicts' | 'complete';
type AlbumStatus = 'MATCHED' | 'NO_MATCH';
type MatchLevel = 'high' | 'medium' | 'low' | 'none';

type ReviewFilter = 'all' | 'needs_review' | MatchLevel;

interface ParsedCLZAlbum {
  artist: string;
  title: string;
  year: string;
  tracks: Array<{
    id: string;
    title: string;
    position: number;
    side: string | null;
    duration: string;
    type: 'track';
    artist: null;
  }>;
  barcode: string;
  catalog_number: string;
  artist_norm: string;
  title_norm: string;
  label: string | null;
  personal_notes: string;
  location: string;
}

type ExistingAlbum = Record<string, unknown> & {
  id: number;
  release_id: number | null;
  master_id: number | null;
  artist: string;
  title: string;
  year: string | null;
  label: string | null;
  catalog_number: string | null;
  barcode: string | null;
  country: string | null;
  location: string | null;
  media_condition: string | null;
  sleeve_condition: string | null;
  personal_notes: string | null;
};

interface MatchCandidate {
  id: number;
  artist: string;
  title: string;
  score: number;
  level: MatchLevel;
}

interface ComparedCLZAlbum extends ParsedCLZAlbum {
  status: AlbumStatus;
  existingId?: number;
  manualLink?: boolean;
  matchScore: number;
  matchLevel: MatchLevel;
  suggestedMatches: MatchCandidate[];
}

interface ImportCLZModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

function normalizeForScore(value: string): string {
  return normalizeTitle(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeArtistForScore(value: string): string {
  return normalizeForScore(cleanArtistName(value))
    .replace(/\b(feat|ft|featuring|with)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitArtistParts(value: string): string[] {
  return normalizeArtistForScore(value)
    .split(/\s*(?:,|&|\/|;|\+|\band\b)\s*/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function stripEditionText(value: string): string {
  return normalizeForScore(value)
    .replace(/\(([^)]*)\)/g, ' ')
    .replace(/\b(remaster(ed)?|reissue|deluxe|expanded|mono|stereo|anniversary|edition|version)\b/g, ' ')
    .replace(/\b\d{4}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value: string): Set<string> {
  const clean = normalizeForScore(value);
  if (!clean) return new Set();
  return new Set(clean.split(' ').filter(Boolean));
}

function bigrams(value: string): Set<string> {
  const clean = normalizeForScore(value).replace(/\s/g, '');
  if (clean.length < 2) return new Set(clean ? [clean] : []);
  const grams = new Set<string>();
  for (let i = 0; i < clean.length - 1; i += 1) {
    grams.add(clean.slice(i, i + 2));
  }
  return grams;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) intersection += 1;
  });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  a.forEach((gram) => {
    if (b.has(gram)) intersection += 1;
  });
  return (2 * intersection) / (a.size + b.size);
}

function textSimilarity(left: string, right: string): number {
  const a = normalizeForScore(left);
  const b = normalizeForScore(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const containment = a.includes(b) || b.includes(a);
  const tokenScore = jaccard(tokenSet(a), tokenSet(b));
  const diceScore = diceCoefficient(bigrams(a), bigrams(b));
  const weighted = (diceScore * 0.65) + (tokenScore * 0.35);

  if (containment && Math.min(a.length, b.length) >= 4) {
    return Math.max(weighted, 0.9);
  }

  return weighted;
}

function classifyMatchLevel(score: number): MatchLevel {
  if (score >= 82) return 'high';
  if (score >= 68) return 'medium';
  if (score >= 52) return 'low';
  return 'none';
}

function artistSimilarity(left: string, right: string): number {
  const fullScore = textSimilarity(normalizeArtistForScore(left), normalizeArtistForScore(right));
  const leftParts = splitArtistParts(left);
  const rightParts = splitArtistParts(right);
  if (leftParts.length === 0 || rightParts.length === 0) return fullScore;

  let bestPartScore = 0;
  let exactPartMatch = false;
  for (const leftPart of leftParts) {
    for (const rightPart of rightParts) {
      const score = textSimilarity(leftPart, rightPart);
      if (score > bestPartScore) bestPartScore = score;
      if (normalizeForScore(leftPart) === normalizeForScore(rightPart)) {
        exactPartMatch = true;
      }
    }
  }

  if (exactPartMatch && bestPartScore >= 0.95) {
    return Math.max(fullScore, 0.96);
  }

  return Math.max(fullScore, bestPartScore);
}

function cleanPosition(pos: string): number {
  const nums = pos.match(/\d+/);
  return nums ? parseInt(nums[0], 10) : 0;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function parseCLZXML(xmlText: string): ParsedCLZAlbum[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const musicList = xmlDoc.querySelector('musiclist');
  if (!musicList) return [];

  const albums: ParsedCLZAlbum[] = [];
  const musicElements = musicList.querySelectorAll('music');

  musicElements.forEach((music) => {
    const artistNode = music.querySelector('artists artist displayname');
    const artist = artistNode?.textContent || 'Unknown Artist';
    const title = music.querySelector('title')?.textContent || 'Unknown Title';
    const year = (
      music.querySelector('releaseyear')?.textContent
      || music.querySelector('releasedate year displayname')?.textContent
      || music.querySelector('releasedate date')?.textContent
      || ''
    ).trim();

    const labels: string[] = [];
    music.querySelectorAll('labels label displayname').forEach((node) => {
      if (node.textContent) labels.push(node.textContent);
    });
    const label = labels[0] ?? null;

    const tracks: ParsedCLZAlbum['tracks'] = [];
    const discsNodes = music.querySelectorAll('discs disc');

    if (discsNodes.length === 0) {
      const trackNodes = music.querySelectorAll('tracks track');
      trackNodes.forEach((track) => {
        const position = track.querySelector('position')?.textContent || '0';
        const seconds = parseInt(track.querySelector('length')?.textContent || '0', 10);
        const hash = track.querySelector('hash')?.textContent || '0';

        tracks.push({
          id: `clz-${hash}`,
          title: track.querySelector('title')?.textContent || '',
          position: cleanPosition(position),
          side: position[0]?.match(/[A-Z]/) ? position[0] : null,
          duration: formatDuration(seconds),
          type: 'track',
          artist: null,
        });
      });
    } else {
      discsNodes.forEach((disc) => {
        const trackNodes = disc.querySelectorAll('track');
        trackNodes.forEach((track) => {
          const position = track.querySelector('position')?.textContent || '0';
          const seconds = parseInt(track.querySelector('length')?.textContent || '0', 10);
          const hash = track.querySelector('hash')?.textContent || '0';

          tracks.push({
            id: `clz-${hash}`,
            title: track.querySelector('title')?.textContent || '',
            position: cleanPosition(position),
            side: position[0]?.match(/[A-Z]/) ? position[0] : null,
            duration: formatDuration(seconds),
            type: 'track',
            artist: null,
          });
        });
      });
    }

    const notes = music.querySelector('notes')?.textContent || '';
    const storage = music.querySelector('storagedevice')?.textContent || '';
    const slot = music.querySelector('slot')?.textContent || '';
    const location = `${storage} ${slot}`.trim();

    albums.push({
      artist,
      title,
      year,
      tracks,
      barcode: (
        music.querySelector('barcode')?.textContent
        || music.querySelector('upc')?.textContent
        || ''
      ).trim(),
      catalog_number: music.querySelector('labelnumber')?.textContent || '',
      label,
      artist_norm: normalizeArtist(artist),
      title_norm: normalizeTitle(title),
      personal_notes: notes,
      location,
    });
  });

  return albums;
}

function addToIndex(index: Map<string, number[]>, key: string, id: number) {
  if (!key) return;
  const arr = index.get(key);
  if (arr) {
    arr.push(id);
  } else {
    index.set(key, [id]);
  }
}

function pickSearchPrefixes(value: string): string[] {
  const clean = normalizeForScore(value);
  if (!clean) return [];
  const compact = clean.replace(/\s/g, '');
  const firstToken = clean.split(' ')[0] || '';
  return [compact.slice(0, 2), compact.slice(0, 4), firstToken.slice(0, 4)].filter(Boolean);
}

async function compareCLZAlbums(
  parsed: ParsedCLZAlbum[],
  existing: ExistingAlbum[],
  onProgress?: (current: number, total: number) => void,
): Promise<ComparedCLZAlbum[]> {
  const normalizedExisting = existing.map((album) => ({
    album,
    id: album.id,
    artistRaw: album.artist,
    artistNorm: normalizeArtistForScore(album.artist),
    artistParts: splitArtistParts(album.artist),
    titleNorm: normalizeForScore(album.title),
    titleBaseNorm: stripEditionText(album.title),
    titlePrefixes: pickSearchPrefixes(stripEditionText(album.title)),
    yearNum: album.year ? parseInt(album.year, 10) : null,
    barcodeNorm: normalizeForScore(album.barcode ?? ''),
    catNorm: normalizeForScore(album.catalog_number ?? ''),
  }));

  const byId = new Map<number, (typeof normalizedExisting)[number]>();
  const artistPrefixIndex = new Map<string, number[]>();
  const titlePrefixIndex = new Map<string, number[]>();
  const yearIndex = new Map<string, number[]>();
  const barcodeIndex = new Map<string, number[]>();
  const catIndex = new Map<string, number[]>();
  const exactIndex = new Map<string, number[]>();

  normalizedExisting.forEach((existingAlbum) => {
    byId.set(existingAlbum.id, existingAlbum);
    existingAlbum.artistParts.forEach((part) => {
      pickSearchPrefixes(part).forEach((prefix) => addToIndex(artistPrefixIndex, prefix, existingAlbum.id));
    });
    pickSearchPrefixes(existingAlbum.artistNorm).forEach((prefix) => addToIndex(artistPrefixIndex, prefix, existingAlbum.id));
    existingAlbum.titlePrefixes.forEach((prefix) => addToIndex(titlePrefixIndex, prefix, existingAlbum.id));
    if (existingAlbum.yearNum) addToIndex(yearIndex, String(existingAlbum.yearNum), existingAlbum.id);
    if (existingAlbum.barcodeNorm) addToIndex(barcodeIndex, existingAlbum.barcodeNorm, existingAlbum.id);
    if (existingAlbum.catNorm) addToIndex(catIndex, existingAlbum.catNorm, existingAlbum.id);
    addToIndex(exactIndex, `${existingAlbum.artistNorm}||${existingAlbum.titleNorm}`, existingAlbum.id);
    addToIndex(exactIndex, `${existingAlbum.artistNorm}||${existingAlbum.titleBaseNorm}`, existingAlbum.id);
  });

  const compared: ComparedCLZAlbum[] = [];

  for (let idx = 0; idx < parsed.length; idx += 1) {
    const clzAlbum = parsed[idx];
    const clzTitleNorm = normalizeForScore(clzAlbum.title);
    const clzTitleBaseNorm = stripEditionText(clzAlbum.title);
    const clzArtistNorm = normalizeArtistForScore(clzAlbum.artist);
    const clzArtistParts = splitArtistParts(clzAlbum.artist);
    const clzYearNum = clzAlbum.year ? parseInt(clzAlbum.year, 10) : null;
    const clzBarcodeNorm = normalizeForScore(clzAlbum.barcode);
    const clzCatNorm = normalizeForScore(clzAlbum.catalog_number);
    const exactKey = `${clzArtistNorm}||${clzTitleNorm}`;
    const exactBaseKey = `${clzArtistNorm}||${clzTitleBaseNorm}`;
    const exactIds = [
      ...(exactIndex.get(exactKey) ?? []),
      ...(exactIndex.get(exactBaseKey) ?? []),
    ];

    if (exactIds.length > 0) {
      const uniqueExact = Array.from(new Set(exactIds));
      const rankedExact = uniqueExact
        .map((id) => byId.get(id))
        .filter(Boolean) as (typeof normalizedExisting);
      rankedExact.sort((a, b) => {
        const aBarcode = a.barcodeNorm && clzBarcodeNorm && a.barcodeNorm === clzBarcodeNorm ? 1 : 0;
        const bBarcode = b.barcodeNorm && clzBarcodeNorm && b.barcodeNorm === clzBarcodeNorm ? 1 : 0;
        if (aBarcode !== bBarcode) return bBarcode - aBarcode;
        const aCat = a.catNorm && clzCatNorm && a.catNorm === clzCatNorm ? 1 : 0;
        const bCat = b.catNorm && clzCatNorm && b.catNorm === clzCatNorm ? 1 : 0;
        if (aCat !== bCat) return bCat - aCat;
        if (clzYearNum && a.yearNum && b.yearNum) {
          const aDiff = Math.abs(a.yearNum - clzYearNum);
          const bDiff = Math.abs(b.yearNum - clzYearNum);
          if (aDiff !== bDiff) return aDiff - bDiff;
        }
        return 0;
      });

      const bestExact = rankedExact[0];
      if (bestExact) {
        compared.push({
          ...clzAlbum,
          status: 'MATCHED',
          existingId: bestExact.id,
          manualLink: false,
          matchScore: 100,
          matchLevel: 'high',
          suggestedMatches: [
            {
              id: bestExact.id,
              artist: bestExact.album.artist,
              title: bestExact.album.title,
              score: 100,
              level: 'high',
            },
          ],
        });
        if (onProgress && (idx % 25 === 0 || idx === parsed.length - 1)) {
          onProgress(idx + 1, parsed.length);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        continue;
      }
    }

    const candidateIds = new Set<number>();
    if (clzBarcodeNorm) {
      (barcodeIndex.get(clzBarcodeNorm) ?? []).forEach((id) => candidateIds.add(id));
    }
    if (clzCatNorm) {
      (catIndex.get(clzCatNorm) ?? []).forEach((id) => candidateIds.add(id));
    }

    pickSearchPrefixes(clzTitleBaseNorm).forEach((prefix) => {
      (titlePrefixIndex.get(prefix) ?? []).forEach((id) => candidateIds.add(id));
    });
    pickSearchPrefixes(clzArtistNorm).forEach((prefix) => {
      (artistPrefixIndex.get(prefix) ?? []).forEach((id) => candidateIds.add(id));
    });
    clzArtistParts.forEach((part) => {
      pickSearchPrefixes(part).forEach((prefix) => {
        (artistPrefixIndex.get(prefix) ?? []).forEach((id) => candidateIds.add(id));
      });
    });
    if (clzYearNum) {
      [-1, 0, 1].forEach((offset) => {
        (yearIndex.get(String(clzYearNum + offset)) ?? []).forEach((id) => candidateIds.add(id));
      });
    }

    const fallbackPool = normalizedExisting.filter((candidate) => {
      const titleA = candidate.titleBaseNorm[0];
      const titleB = clzTitleBaseNorm[0];
      const artistA = candidate.artistNorm[0];
      const artistB = clzArtistNorm[0];
      return titleA === titleB || artistA === artistB;
    });

    let candidatesToScore = Array.from(candidateIds)
      .map((id) => byId.get(id))
      .filter(Boolean) as (typeof normalizedExisting);

    if (candidatesToScore.length < 60) {
      candidatesToScore = [
        ...candidatesToScore,
        ...fallbackPool.filter((candidate) => !candidateIds.has(candidate.id)).slice(0, 220),
      ];
    }

    if (candidatesToScore.length === 0) {
      candidatesToScore = normalizedExisting.slice(0, 220);
    }

    const candidates = candidatesToScore
      .map(({ album, artistRaw, titleNorm, titleBaseNorm, yearNum, barcodeNorm, catNorm }) => {
        const barcodeExact = !!clzBarcodeNorm && !!barcodeNorm && clzBarcodeNorm === barcodeNorm;
        const artistScore = artistSimilarity(clzAlbum.artist, artistRaw);
        const titleScore = Math.max(
          textSimilarity(clzTitleNorm, titleNorm),
          textSimilarity(clzTitleBaseNorm, titleBaseNorm),
        );

        let yearScore = 0;
        if (clzYearNum && yearNum) {
          const diff = Math.abs(clzYearNum - yearNum);
          if (diff === 0) yearScore = 1;
          else if (diff <= 1) yearScore = 0.7;
          else if (diff <= 3) yearScore = 0.35;
        }

        let catScore = 0;
        if (clzCatNorm && catNorm) {
          if (clzCatNorm === catNorm) catScore = 1;
          else if (clzCatNorm.includes(catNorm) || catNorm.includes(clzCatNorm)) catScore = 0.55;
        }

        let score = barcodeExact
          ? 100
          : Math.round((artistScore * 45) + (titleScore * 45) + (yearScore * 5) + (catScore * 5));

        if (!barcodeExact && (artistScore < 0.55 || titleScore < 0.55)) {
          score = Math.min(score, 69);
        }

        return {
          id: album.id,
          artist: album.artist,
          title: album.title,
          score,
          level: classifyMatchLevel(score),
        } satisfies MatchCandidate;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const suggestedMatches = candidates
      .filter((candidate) => candidate.score >= 52)
      .slice(0, 3);
    const best = candidates[0];

    const autoMatch = best && best.level === 'high';

    compared.push({
      ...clzAlbum,
      status: autoMatch ? 'MATCHED' : 'NO_MATCH',
      existingId: autoMatch ? best.id : undefined,
      manualLink: false,
      matchScore: best?.score ?? 0,
      matchLevel: best?.level ?? 'none',
      suggestedMatches,
    });

    if (onProgress && (idx % 25 === 0 || idx === parsed.length - 1)) {
      onProgress(idx + 1, parsed.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return compared;
}

export default function ImportCLZModal({ isOpen, onClose, onImportComplete }: ImportCLZModalProps) {
  const [stage, setStage] = useState<ImportStage>('upload');
  const [file, setFile] = useState<File | null>(null);

  const [comparedAlbums, setComparedAlbums] = useState<ComparedCLZAlbum[]>([]);
  const [existingAlbums, setExistingAlbums] = useState<ExistingAlbum[]>([]);
  const [linkQueries, setLinkQueries] = useState<Record<number, string>>({});
  const [resolutionTableMissing, setResolutionTableMissing] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');

  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [error, setError] = useState<string | null>(null);

  const [allConflicts, setAllConflicts] = useState<FieldConflict[]>([]);

  const [results, setResults] = useState({
    updated: 0,
    skipped: 0,
    noMatch: 0,
    errors: 0,
    conflicts: 0,
  });

  if (!isOpen) return null;

  const coerceYear = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isNaN(value) ? null : value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const firstRecord = <T,>(value: T | T[] | null | undefined): T | null => {
    if (!value) return null;
    if (Array.isArray(value)) return value[0] ?? null;
    return value;
  };

  const splitV3Updates = (updates: Record<string, unknown>) => {
    const inventoryUpdates: Record<string, unknown> = {};
    const releaseUpdates: Record<string, unknown> = {};

    Object.entries(updates).forEach(([key, value]) => {
      switch (key) {
        case 'location':
        case 'personal_notes':
        case 'media_condition':
          inventoryUpdates[key] = value ?? null;
          break;
        case 'sleeve_condition':
          inventoryUpdates.sleeve_condition = value ?? null;
          break;
        case 'label':
          releaseUpdates.label = value ?? null;
          break;
        case 'catalog_number':
          releaseUpdates.catalog_number = value ?? null;
          break;
        case 'barcode':
        case 'country':
          releaseUpdates[key] = value ?? null;
          break;
        case 'year':
          releaseUpdates.release_year = coerceYear(value);
          break;
        default:
          break;
      }
    });

    return { inventoryUpdates, releaseUpdates };
  };

  const applyAlbumUpdates = async (album: ExistingAlbum, updates: Record<string, unknown>) => {
    const { inventoryUpdates, releaseUpdates } = splitV3Updates(updates);
    const operations: Promise<unknown>[] = [];

    if (Object.keys(inventoryUpdates).length > 0) {
      operations.push(
        (async () => {
          await supabase
            .from('inventory')
            .update(inventoryUpdates as Record<string, unknown>)
            .eq('id', album.id);
        })()
      );
    }

    if (album.release_id && Object.keys(releaseUpdates).length > 0) {
      operations.push(
        (async () => {
          await supabase
            .from('releases')
            .update(releaseUpdates as Record<string, unknown>)
            .eq('id', album.release_id);
        })()
      );
    }

    if (operations.length > 0) {
      await Promise.all(operations);
    }
  };

  const isMissingResolutionTable = (err?: { message?: string; code?: string; status?: number } | null) => {
    if (!err) return false;
    if (err.code === '42P01') return true;
    if (err.status === 404) return true;
    return err.message?.includes('import_conflict_resolutions') ?? false;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleParseXML = async () => {
    if (!file) return;

    try {
      setError(null);
      setStage('matching');
      const text = await file.text();
      const parsed = parseCLZXML(text);

      if (parsed.length === 0) {
        setError('No albums found in XML file');
        return;
      }

      const { data: existing, error: dbError } = await supabase
        .from('inventory')
        .select(`
          id,
          location,
          media_condition,
          sleeve_condition,
          personal_notes,
          release:releases (
            id,
            label,
            catalog_number,
            barcode,
            country,
            release_year,
            master:masters (
              id,
              title,
              original_release_year,
              artist:artists ( name )
            )
          )
        `);

      if (dbError) {
        setError(`Database error: ${dbError.message}`);
        return;
      }

      const mappedExisting = (existing ?? []).map((row) => {
        const releaseRaw = firstRecord(row.release as unknown);
        const release = releaseRaw as {
          id?: number | null;
          label?: string | null;
          catalog_number?: string | null;
          barcode?: string | null;
          country?: string | null;
          release_year?: number | null;
          master?: {
            id?: number | null;
            title?: string | null;
            original_release_year?: number | null;
            artist?: { name?: string | null } | null;
          } | null;
        } | null;
        const masterRaw = firstRecord(release?.master as unknown);
        const master = masterRaw as {
          id?: number | null;
          title?: string | null;
          original_release_year?: number | null;
          artist?: { name?: string | null } | Array<{ name?: string | null }> | null;
        } | null;
        const artistRaw = firstRecord(master?.artist as unknown) as { name?: string | null } | null;
        const artistName = artistRaw?.name?.trim() || 'Unknown Artist';
        const title = master?.title?.trim() || 'Untitled';
        return {
          id: row.id as number,
          release_id: release?.id ?? null,
          master_id: master?.id ?? null,
          artist: artistName,
          title,
          year: (release?.release_year ?? master?.original_release_year)?.toString() ?? null,
          label: release?.label ?? null,
          catalog_number: release?.catalog_number ?? null,
          barcode: release?.barcode ?? null,
          country: release?.country ?? null,
          location: row.location ?? null,
          media_condition: row.media_condition ?? null,
          sleeve_condition: row.sleeve_condition ?? null,
          personal_notes: row.personal_notes ?? null,
        } satisfies ExistingAlbum;
      });

      const compared = await compareCLZAlbums(parsed, mappedExisting, (current, total) => {
        setProgress({
          current,
          total,
          status: `Matching album ${current} of ${total}`,
        });
      });
      setComparedAlbums(compared);
      setExistingAlbums(mappedExisting);
      setLinkQueries({});
      setReviewFilter('all');
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse XML');
      setStage('upload');
    }
  };

  const handleStartImport = async () => {
    setStage('importing');
    setError(null);

    try {
      const autoMatchedAlbums = comparedAlbums.filter(
        (album) => album.status === 'MATCHED' && !album.manualLink
      );
      const linkedAlbums = comparedAlbums.filter(
        (album) => album.status === 'MATCHED' && album.manualLink
      );
      const albumsToProcess = [...autoMatchedAlbums, ...linkedAlbums];

      setProgress({ current: 0, total: albumsToProcess.length, status: 'Processing...' });

      const resultCounts = {
        updated: 0,
        skipped: 0,
        noMatch: comparedAlbums.filter((a) => a.status === 'NO_MATCH').length,
        errors: 0,
        conflicts: 0,
      };

      const conflicts: FieldConflict[] = [];
      let missingResolutionTable = resolutionTableMissing;

      const processAlbum = async (album: ComparedCLZAlbum, index: number) => {
        setProgress({
          current: index + 1,
          total: albumsToProcess.length,
          status: `Processing ${album.artist} - ${album.title}`,
        });

        try {
          const existingAlbum = existingAlbums.find((e) => e.id === album.existingId);
          if (!existingAlbum) return;

          let safeResolutions: PreviousResolution[] = [];
          if (!missingResolutionTable) {
            const { data: resolutions, error: resolutionsError } = await supabase
              .from('import_conflict_resolutions')
              .select('*')
              .eq('album_id', album.existingId!)
              .eq('source', 'clz');
            if (resolutionsError) {
              if (isMissingResolutionTable(resolutionsError)) {
                missingResolutionTable = true;
                setResolutionTableMissing(true);
              } else {
                throw resolutionsError;
              }
            } else {
              safeResolutions = (resolutions || []) as PreviousResolution[];
            }
          }

          const clzData: Record<string, unknown> = {
            artist: album.artist,
            title: album.title,
            year: album.year,
            barcode: album.barcode,
            catalog_number: album.catalog_number,
            label: album.label,
            personal_notes: album.personal_notes,
            location: album.location,
          };

          const identifyingUpdates = buildIdentifyingFieldUpdates(existingAlbum, clzData);
          const { safeUpdates, conflicts: albumConflicts } = detectConflicts(
            existingAlbum,
            clzData,
            'clz',
            safeResolutions,
          );

          const updateData = {
            ...identifyingUpdates,
            ...safeUpdates,
          };

          if (Object.keys(updateData).length > 0) {
            await applyAlbumUpdates(existingAlbum, updateData);
          }

          if (Object.keys(updateData).length > 0 || albumConflicts.length > 0) {
            resultCounts.updated += 1;
          } else {
            resultCounts.skipped += 1;
          }

          if (albumConflicts.length > 0) {
            conflicts.push(...albumConflicts);
            resultCounts.conflicts += albumConflicts.length;
          }
        } catch (err) {
          console.error(`Error processing ${album.artist} - ${album.title}:`, err);
          resultCounts.errors += 1;
        }
      };

      let processedCount = 0;
      for (const album of autoMatchedAlbums) {
        await processAlbum(album, processedCount);
        processedCount += 1;
      }
      for (const album of linkedAlbums) {
        await processAlbum(album, processedCount);
        processedCount += 1;
      }

      setResults(resultCounts);

      if (conflicts.length > 0) {
        setAllConflicts(conflicts);
        setStage('conflicts');
      } else {
        setStage('complete');
        if (onImportComplete) onImportComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStage('preview');
    }
  };

  const handleConflictsResolved = () => {
    setStage('complete');
    if (onImportComplete) onImportComplete();
  };

  const handleClose = () => {
    setStage('upload');
    setFile(null);
    setComparedAlbums([]);
    setExistingAlbums([]);
    setLinkQueries({});
    setResolutionTableMissing(false);
    setReviewFilter('all');
    setProgress({ current: 0, total: 0, status: '' });
    setError(null);
    setAllConflicts([]);
    setResults({ updated: 0, skipped: 0, noMatch: 0, errors: 0, conflicts: 0 });
    onClose();
  };

  const handleLinkQueryChange = (index: number, value: string) => {
    setLinkQueries((prev) => ({ ...prev, [index]: value }));
  };

  const handleLinkAlbum = (index: number, selectedId: number) => {
    if (!selectedId) return;
    setComparedAlbums((prev) =>
      prev.map((album, idx) => {
        if (idx !== index) return album;
        const selectedCandidate = album.suggestedMatches.find((candidate) => candidate.id === selectedId);
        return {
          ...album,
          status: 'MATCHED',
          existingId: selectedId,
          manualLink: true,
          matchScore: selectedCandidate?.score ?? album.matchScore,
          matchLevel: selectedCandidate?.level ?? album.matchLevel,
        };
      })
    );
    setLinkQueries((prev) => ({ ...prev, [index]: '' }));
  };

  const getQueryMatches = (album: ComparedCLZAlbum, query: string): MatchCandidate[] => {
    const cleanQuery = normalizeForScore(query);
    if (cleanQuery.length < 2) return [];

    return existingAlbums
      .map((existing) => {
        const haystack = `${existing.artist} ${existing.title}`;
        const score = Math.round(textSimilarity(cleanQuery, normalizeForScore(haystack)) * 100);
        return {
          id: existing.id,
          artist: existing.artist,
          title: existing.title,
          score,
          level: classifyMatchLevel(score),
        } satisfies MatchCandidate;
      })
      .filter((candidate) => candidate.score >= 58)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  };

  const matchedCount = comparedAlbums.filter((a) => a.status === 'MATCHED').length;
  const noMatchCount = comparedAlbums.filter((a) => a.status === 'NO_MATCH').length;
  const highCount = comparedAlbums.filter((a) => a.matchLevel === 'high').length;
  const mediumCount = comparedAlbums.filter((a) => a.matchLevel === 'medium').length;
  const lowCount = comparedAlbums.filter((a) => a.matchLevel === 'low').length;
  const noneCount = comparedAlbums.filter((a) => a.matchLevel === 'none').length;

  const reviewedAlbums = comparedAlbums
    .map((album, index) => ({ album, index }))
    .filter(({ album }) => {
      if (reviewFilter === 'all') return true;
      if (reviewFilter === 'needs_review') return album.status !== 'MATCHED';
      return album.matchLevel === reviewFilter;
    });

  if (stage === 'conflicts') {
    return (
      <ConflictResolutionModal
        conflicts={allConflicts}
        source="clz"
        onComplete={handleConflictsResolved}
        onCancel={() => setStage('complete')}
      />
    );
  }

  const filterButtonClass = (value: ReviewFilter) => (
    `px-3 py-1.5 rounded border text-xs font-semibold ${reviewFilter === value
      ? 'bg-orange-500 border-orange-500 text-white'
      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`
  );

  const getLevelBadge = (level: MatchLevel) => {
    if (level === 'high') return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    if (level === 'medium') return 'bg-amber-100 text-amber-700 border-amber-300';
    if (level === 'low') return 'bg-rose-100 text-rose-700 border-rose-300';
    return 'bg-gray-100 text-gray-600 border-gray-300';
  };

  return (
    <div className="fixed inset-0 z-[30000] bg-black/55">
      <div className="h-full w-full bg-white flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 bg-orange-500 text-white flex justify-between items-center">
          <div>
            <h2 className="m-0 text-xl font-semibold">Import from CLZ Music Web</h2>
            <p className="m-0 text-sm text-white/90">Full-screen linking flow with fuzzy match confidence</p>
          </div>
          <button
            onClick={handleClose}
            className="bg-none border-none text-white text-3xl leading-none cursor-pointer p-0 hover:text-white/80"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 rounded mb-4 text-red-800 text-sm">
              {error}
            </div>
          )}

          {stage === 'upload' && (
            <div className="max-w-3xl mx-auto border border-gray-200 rounded-xl p-6 bg-gray-50">
              <h3 className="m-0 mb-3 text-xl font-semibold text-gray-900">Upload CLZ XML Export</h3>
              <p className="m-0 mb-4 text-sm text-gray-600">After upload, we score each album against your collection and bucket it into high, medium, low, or no match.</p>
              <input
                type="file"
                accept=".xml"
                onChange={handleFileChange}
                className="block w-full p-3 border border-gray-300 rounded text-sm bg-white"
              />
              {file && (
                <div className="mt-2 text-xs text-gray-500">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          )}

          {stage === 'matching' && (
            <div className="max-w-3xl mx-auto text-center py-10 px-5">
              <div className="w-full h-2 bg-gray-200 rounded overflow-hidden mb-3">
                <div
                  className="h-full bg-orange-500 transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
              <div className="text-sm text-gray-500 mb-2">{progress.current} / {progress.total}</div>
              <div className="text-[13px] text-gray-400">
                {progress.status || 'Computing fuzzy matches...'}
              </div>
            </div>
          )}

          {stage === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">XML Albums</div>
                  <div className="text-xl font-semibold text-gray-900">{comparedAlbums.length}</div>
                </div>
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Linked</div>
                  <div className="text-xl font-semibold text-emerald-600">{matchedCount}</div>
                </div>
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Unlinked</div>
                  <div className="text-xl font-semibold text-gray-900">{noMatchCount}</div>
                </div>
                <div className="border rounded-lg p-3 bg-emerald-50 border-emerald-200">
                  <div className="text-xs text-emerald-700">High</div>
                  <div className="text-xl font-semibold text-emerald-700">{highCount}</div>
                </div>
                <div className="border rounded-lg p-3 bg-amber-50 border-amber-200">
                  <div className="text-xs text-amber-700">Medium</div>
                  <div className="text-xl font-semibold text-amber-700">{mediumCount}</div>
                </div>
                <div className="border rounded-lg p-3 bg-rose-50 border-rose-200">
                  <div className="text-xs text-rose-700">Low/None</div>
                  <div className="text-xl font-semibold text-rose-700">{lowCount + noneCount}</div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-300 rounded text-[13px] text-amber-800">
                <strong>Safe Import Mode</strong>
                <br />
                Auto-links only high confidence matches. Medium/low candidates are shown below so you can link manually.
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setReviewFilter('all')} className={filterButtonClass('all')}>All</button>
                <button type="button" onClick={() => setReviewFilter('needs_review')} className={filterButtonClass('needs_review')}>Needs review</button>
                <button type="button" onClick={() => setReviewFilter('high')} className={filterButtonClass('high')}>High</button>
                <button type="button" onClick={() => setReviewFilter('medium')} className={filterButtonClass('medium')}>Medium</button>
                <button type="button" onClick={() => setReviewFilter('low')} className={filterButtonClass('low')}>Low</button>
                <button type="button" onClick={() => setReviewFilter('none')} className={filterButtonClass('none')}>No match</button>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-[13px] border-collapse">
                    <thead className="sticky top-0 bg-gray-50 z-[1]">
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 w-[26%]">Your Album (CLZ)</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 w-[26%]">Best Match</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 w-[12%]">Confidence</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 w-[36%]">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewedAlbums.map(({ album, index }) => {
                        const query = linkQueries[index] ?? '';
                        const queryMatches = getQueryMatches(album, query);
                        const allOptions = [...album.suggestedMatches, ...queryMatches]
                          .sort((a, b) => b.score - a.score)
                          .filter((candidate, candidateIndex, arr) => arr.findIndex((c) => c.id === candidate.id) === candidateIndex)
                          .slice(0, 5);
                        const linkedAlbum = album.existingId
                          ? existingAlbums.find((existing) => existing.id === album.existingId)
                          : null;

                        return (
                          <tr key={`${album.artist}-${album.title}-${index}`} className="border-b border-gray-100 last:border-none align-top">
                            <td className="px-3 py-3 text-gray-900">
                              <div className="font-semibold">{album.title}</div>
                              <div className="text-gray-600">{album.artist}</div>
                            </td>
                            <td className="px-3 py-3 text-gray-900">
                              {allOptions[0] ? (
                                <>
                                  <div className="font-semibold">{allOptions[0].title}</div>
                                  <div className="text-gray-600">{allOptions[0].artist}</div>
                                </>
                              ) : (
                                <span className="text-gray-400">No candidate</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded border text-xs font-semibold capitalize ${getLevelBadge(album.matchLevel)}`}>
                                {album.matchLevel} ({album.matchScore})
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              {album.status === 'MATCHED' && linkedAlbum ? (
                                <div className="mb-2 text-xs text-emerald-700 font-semibold">
                                  Linked: {linkedAlbum.artist} - {linkedAlbum.title}{album.manualLink ? ' (manual)' : ' (auto)'}
                                </div>
                              ) : (
                                <div className="mb-2 text-xs text-gray-500">Not linked yet</div>
                              )}
                              <div className="mb-2">
                                <input
                                  type="text"
                                  value={query}
                                  onChange={(event) => handleLinkQueryChange(index, event.target.value)}
                                  placeholder={`${album.artist} ${album.title}`}
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-[12px]"
                                />
                              </div>
                              <div className="space-y-1">
                                {allOptions.map((candidate) => (
                                  <button
                                    key={`${index}-${candidate.id}`}
                                    type="button"
                                    onClick={() => handleLinkAlbum(index, candidate.id)}
                                    className="w-full text-left px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-[12px] text-emerald-700 hover:bg-emerald-100"
                                  >
                                    Link: {candidate.artist} - {candidate.title} ({candidate.score})
                                  </button>
                                ))}
                                {allOptions.length === 0 && (
                                  <div className="text-[11px] text-gray-400">Type at least 2 characters to search and link manually.</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {stage === 'importing' && (
            <div className="max-w-3xl mx-auto text-center py-10 px-5">
              <div className="w-full h-2 bg-gray-200 rounded overflow-hidden mb-3">
                <div
                  className="h-full bg-orange-500 transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
              <div className="text-sm text-gray-500 mb-2">{progress.current} / {progress.total}</div>
              <div className="text-[13px] text-gray-400">{progress.status}</div>
            </div>
          )}

          {stage === 'complete' && (
            <div className="max-w-3xl mx-auto p-6 bg-green-50 border border-green-200 rounded-xl text-center">
              <div className="text-5xl mb-3">✓</div>
              <h3 className="m-0 mb-4 text-lg font-semibold text-green-700">Import Complete</h3>
              <div className="text-sm text-gray-500">
                <div><strong>{results.updated}</strong> albums updated</div>
                <div><strong>{results.skipped}</strong> albums skipped</div>
                <div><strong>{results.noMatch}</strong> albums not linked</div>
                {results.conflicts > 0 && <div><strong>{results.conflicts}</strong> conflicts resolved</div>}
                {results.errors > 0 && (
                  <div className="text-red-600 mt-2"><strong>{results.errors}</strong> errors occurred</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-white">
          {stage === 'upload' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-100 border border-gray-300 rounded text-sm font-medium cursor-pointer text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleParseXML}
                disabled={!file}
                className={`px-4 py-2 border-none rounded text-sm font-semibold text-white ${
                  file ? 'bg-orange-500 cursor-pointer hover:bg-orange-600' : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Continue
              </button>
            </>
          )}
          {stage === 'matching' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-100 border border-gray-300 rounded text-sm font-medium cursor-pointer text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          )}

          {stage === 'preview' && (
            <>
              <button
                onClick={() => setStage('upload')}
                className="px-4 py-2 bg-gray-100 border border-gray-300 rounded text-sm font-medium cursor-pointer text-gray-700 hover:bg-gray-200"
              >
                Back
              </button>
              <button
                onClick={handleStartImport}
                disabled={matchedCount === 0}
                className={`px-4 py-2 border-none rounded text-sm font-semibold text-white ${
                  matchedCount > 0 ? 'bg-orange-500 cursor-pointer hover:bg-orange-600' : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Start Import ({matchedCount})
              </button>
            </>
          )}

          {stage === 'complete' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-orange-500 border-none rounded text-sm font-semibold cursor-pointer text-white hover:bg-orange-600"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
// AUDIT: updated CLZ import with weighted fuzzy matching and full-screen linking UX.
