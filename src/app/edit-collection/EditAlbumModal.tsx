'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from 'lib/supabaseClient';
import { parseDiscogsFormat } from 'lib/formatParser';
import type { Album } from 'types/album';
import type { Database } from 'types/supabase';
import { MainTab, type MainTabRef } from './tabs/MainTab';
import { DetailsTab } from './tabs/DetailsTab';
import { PeopleTab } from './tabs/PeopleTab';
import { TracksTab, type TracksTabRef } from './tabs/TracksTab';
import { PersonalTab } from './tabs/PersonalTab';
import { LinksTab } from './tabs/LinksTab';
import { UniversalBottomBar } from 'components/UniversalBottomBar';

const ClassicalTab = dynamic(() => import('./tabs/ClassicalTab').then(mod => mod.ClassicalTab));
const CoverTab = dynamic(() => import('./tabs/CoverTab').then(mod => mod.CoverTab));
const EnrichmentTab = dynamic(() => import('./tabs/EnrichmentTab').then(mod => mod.EnrichmentTab));
import { PickerModal } from './pickers/PickerModal';
import { EditModal } from './pickers/EditModal';
import ManagePickListsModal from './ManagePickListsModal';
import { fetchLocations, type PickerDataItem } from './pickers/pickerDataUtils';

type TabId = 'main' | 'details' | 'enrichment' | 'classical' | 'people' | 'tracks' | 'personal' | 'cover' | 'links';

// SVG icon components
const TabIcons = {
  bolt: () => (
    <svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor">
      <path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H64z"/>
    </svg>
  ),
  music: () => (
    <svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor">
      <path d="M499.1 6.3c8.1 6 12.9 15.6 12.9 25.7v72V368c0 44.2-43 80-96 80s-96-35.8-96-80s43-80 96-80c11.2 0 22 1.6 32 4.6V147L192 223.8V432c0 44.2-43 80-96 80s-96-35.8-96-80s43-80 96-80c11.2 0 22 1.6 32 4.6V200 128c0-14.1 9.3-26.6 22.8-30.7l320-96c9.7-2.9 20.2-1.1 28.3 5z"/>
    </svg>
  ),
  info: () => (
    <svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor">
      <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/>
    </svg>
  ),
  violin: () => (
    <svg width="14" height="14" viewBox="0 0 640 512" fill="currentColor">
      <path d="M606.7 32.1c-16.2-8.1-35.6-2.4-45.7 13.4L512 128l48 48 82.5-49c15.8-10.1 21.5-29.5 13.4-45.7l-3.4-6.8c-8.1-16.2-29.5-21.9-45.7-13.4zM461.3 202.7L352 96 288 32 224 96l-64 64-64 64L0 320s0 0 0 0c0 35.3 28.7 64 64 64c23.9 0 44.8-13.1 55.9-32.5C145.6 383.4 192.2 416 246.9 416c17.8 0 34.7-5.1 48.9-13.9L461.3 266.7c28.1-28.1 28.1-73.7 0-101.8c-3-3-6.2-5.7-9.5-8.2zM224 256a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm96-64a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/>
    </svg>
  ),
  users: () => (
    <svg width="14" height="14" viewBox="0 0 640 512" fill="currentColor">
      <path d="M144 0a80 80 0 1 1 0 160A80 80 0 1 1 144 0zM512 0a80 80 0 1 1 0 160A80 80 0 1 1 512 0zM0 298.7C0 239.8 47.8 192 106.7 192h42.7c15.9 0 31 3.5 44.6 9.7c-1.3 7.2-1.9 14.7-1.9 22.3c0 38.2 16.8 72.5 43.3 96c-.2 0-.4 0-.7 0H21.3C9.6 320 0 310.4 0 298.7zM405.3 320c-.2 0-.4 0-.7 0c26.6-23.5 43.3-57.8 43.3-96c0-7.6-.7-15-1.9-22.3c13.6-6.3 28.7-9.7 44.6-9.7h42.7C592.2 192 640 239.8 640 298.7c0 11.8-9.6 21.3-21.3 21.3H405.3zM224 224a96 96 0 1 1 192 0 96 96 0 1 1 -192 0zM128 485.3C128 411.7 187.7 352 261.3 352H378.7C452.3 352 512 411.7 512 485.3c0 14.7-11.9 26.7-26.7 26.7H154.7c-14.7 0-26.7-11.9-26.7-26.7z"/>
    </svg>
  ),
  listOrdered: () => (
    <svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor">
      <path d="M24 56c0-13.3 10.7-24 24-24H80c13.3 0 24 10.7 24 24V176h16c13.3 0 24 10.7 24 24s-10.7 24-24 24H40c-13.3 0-24-10.7-24-24s10.7-24 24-24H56V80H48C34.7 80 24 69.3 24 56zM86.7 341.2c-6.5-7.4-18.3-6.9-24 1.2L51.5 357.9c-7.7 10.8-22.7 13.3-33.5 5.6s-13.3-22.7-5.6-33.5l11.1-15.6c23.7-33.2 72.3-35.6 99.2-4.9c21.3 24.4 20.8 60.9-1.1 84.7L86.8 432H120c13.3 0 24 10.7 24 24s-10.7 24-24 24H32c-9.5 0-18.2-5.6-22-14.4s-2.1-18.9 4.3-25.9l72-78c5.3-5.8 5.4-14.6 .3-20.5zM224 64H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H224c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 160H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H224c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 160H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H224c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/>
    </svg>
  ),
  user: () => (
    <svg width="14" height="14" viewBox="0 0 448 512" fill="currentColor">
      <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/>
    </svg>
  ),
  camera: () => (
    <svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor">
      <path d="M149.1 64.8L138.7 96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H373.3L362.9 64.8C356.4 45.2 338.1 32 317.4 32H194.6c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z"/>
    </svg>
  ),
  globe: () => (
    <svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor">
      <path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/>
    </svg>
  ),
};

const TABS: { id: TabId; label: string; IconComponent: () => React.ReactElement }[] = [
  { id: 'main', label: 'Main', IconComponent: TabIcons.music },
  { id: 'details', label: 'Details', IconComponent: TabIcons.info },
  { id: 'enrichment', label: 'Facts/Sonic', IconComponent: TabIcons.bolt },
  { id: 'classical', label: 'Classical', IconComponent: TabIcons.violin },
  { id: 'people', label: 'People', IconComponent: TabIcons.users },
  { id: 'tracks', label: 'Tracks', IconComponent: TabIcons.listOrdered },
  { id: 'personal', label: 'Personal', IconComponent: TabIcons.user },
  { id: 'cover', label: 'Cover', IconComponent: TabIcons.camera },
  { id: 'links', label: 'Links', IconComponent: TabIcons.globe },
];

const parseDurationToSeconds = (duration?: string | null) => {
  if (!duration) return null;
  const parts = duration.split(':').map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
};

const extractIdFromUrl = (value: string | null | undefined, marker: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('http')) return trimmed;
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return null;
  const part = trimmed.slice(idx + marker.length);
  return part.split(/[/?#]/)[0] || null;
};

interface EditAlbumModalProps {
  albumId: number;
  onClose: () => void;
  onRefresh: () => void;
  onNavigate: (newAlbumId: number) => void;
  allAlbumIds: number[];
}

type ReleaseRow = Database['public']['Tables']['releases']['Row'];

type MasterTagLinkRow = {
  master_tags?: { name: string | null } | null;
};

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const asString = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const asStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') return [value];
  return [];
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

function normalizeEmpty<T>(value: T | null | undefined): T | null {
  if (value === undefined) return null;
  return value ?? null;
}

const discardEmpty = (record: Record<string, unknown>): Record<string, unknown> => {
  const next: Record<string, unknown> = {};
  Object.entries(record).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return;
    next[key] = value;
  });
  return next;
};

const getAlbumCredits = (credits: unknown) => {
  const record = asRecord(credits);
  const albumPeople = asRecord(record.album_people ?? record.albumPeople);
  const classical = asRecord(record.classical);
  const artwork = asRecord(record.artwork ?? record.album_artwork ?? record.albumArtwork);
  const albumDetails = asRecord(record.album_details ?? record.albumDetails ?? record.album_metadata);
  const rawCustomLinks = albumDetails.custom_links ?? albumDetails.links_list ?? albumDetails.customLinks;
  const customLinks = Array.isArray(rawCustomLinks)
    ? (rawCustomLinks
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const recordEntry = entry as Record<string, unknown>;
          const url = asString(recordEntry.url);
          const description = asString(recordEntry.description) ?? null;
          if (!url && !description) return null;
          return { url: url ?? '', description };
        })
        .filter((entry) => Boolean(entry)) as Array<{ url: string; description?: string | null }>)
    : [];

  return {
    albumPeople,
    classical,
    artwork,
    albumDetails,
    customLinks,
  };
};

const buildAlbumCredits = (album: Album): Record<string, unknown> => {
  const albumPeople = discardEmpty({
    musicians: album.musicians ?? undefined,
    producers: album.producers ?? undefined,
    engineers: album.engineers ?? undefined,
    songwriters: album.songwriters ?? undefined,
  });

  const classical = discardEmpty({
    composer: normalizeEmpty(album.composer),
    conductor: normalizeEmpty(album.conductor),
    chorus: normalizeEmpty(album.chorus),
    composition: normalizeEmpty(album.composition),
    orchestra: normalizeEmpty(album.orchestra),
  });

  const artwork = discardEmpty({
    back_image_url: normalizeEmpty(album.back_image_url),
    spine_image_url: normalizeEmpty(album.spine_image_url),
    inner_sleeve_images: album.inner_sleeve_images ?? undefined,
    vinyl_label_images: album.vinyl_label_images ?? undefined,
  });

  const albumDetails = discardEmpty({
    packaging: normalizeEmpty(album.packaging),
    vinyl_color: album.vinyl_color ?? undefined,
    vinyl_weight: normalizeEmpty(album.vinyl_weight),
    rpm: normalizeEmpty(album.rpm),
    spars_code: normalizeEmpty(album.spars_code),
    box_set: normalizeEmpty(album.box_set),
    sound: normalizeEmpty(album.sound),
    studio: normalizeEmpty(album.studio),
    disc_metadata: album.disc_metadata ?? undefined,
    matrix_numbers: album.matrix_numbers ?? undefined,
    master_release_date: normalizeEmpty(album.master_release_date),
    recording_date: normalizeEmpty(album.recording_date),
    tempo_bpm: album.tempo_bpm ?? undefined,
    musical_key: normalizeEmpty(album.musical_key),
    energy: album.energy ?? undefined,
    danceability: album.danceability ?? undefined,
    mood_acoustic: album.mood_acoustic ?? undefined,
    mood_electronic: album.mood_electronic ?? undefined,
    mood_happy: album.mood_happy ?? undefined,
    mood_sad: album.mood_sad ?? undefined,
    mood_aggressive: album.mood_aggressive ?? undefined,
    mood_relaxed: album.mood_relaxed ?? undefined,
    mood_party: album.mood_party ?? undefined,
    enrichment_sources: album.enrichment_sources ?? undefined,
    purchase_store: normalizeEmpty(album.purchase_store),
    signed_by: album.signed_by ?? undefined,
    my_rating: album.my_rating ?? undefined,
    last_cleaned_date: normalizeEmpty(album.last_cleaned_date),
    played_history: album.played_history ?? undefined,
    chart_positions: album.chart_positions ?? undefined,
    awards: album.awards ?? undefined,
    certifications: album.certifications ?? undefined,
    apple_music_id: normalizeEmpty(album.apple_music_id),
    lastfm_id: normalizeEmpty(album.lastfm_id),
    musicbrainz_url: normalizeEmpty(album.musicbrainz_url),
    links: discardEmpty({
      apple_music_url: normalizeEmpty(album.apple_music_url),
      lastfm_url: normalizeEmpty(album.lastfm_url),
      allmusic_url: normalizeEmpty(album.allmusic_url),
      wikipedia_url: normalizeEmpty(album.wikipedia_url),
      genius_url: normalizeEmpty(album.genius_url),
    }),
    custom_links: (album.custom_links ?? []).filter((link) => link.url || link.description),
  });

  return discardEmpty({
    album_people: albumPeople,
    classical,
    artwork,
    album_details: albumDetails,
  });
};

const secondsToDuration = (seconds?: number | null): string | null => {
  if (!seconds || Number.isNaN(seconds)) return null;
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const discNumberFromSide = (side?: string | null): number => {
  if (!side) return 1;
  const letter = side.trim().toUpperCase();
  if (!letter) return 1;
  const code = letter.charCodeAt(0) - 64;
  return Math.max(1, Math.ceil(code / 2));
};


export default function EditAlbumModal({ albumId, onClose, onRefresh, onNavigate, allAlbumIds }: EditAlbumModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('main');
  const [album, setAlbum] = useState<Album | null>(null);
  const [editedAlbum, setEditedAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mainTabRef = useRef<MainTabRef>(null);
  const tracksTabRef = useRef<TracksTabRef>(null);

  // Location picker state (shared across all tabs)
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showManageLocations, setShowManageLocations] = useState(false);
  const [showNewLocationModal, setShowNewLocationModal] = useState(false);
  const [locations, setLocations] = useState<PickerDataItem[]>([]);

  // Calculate current position and navigation availability
  const currentIndex = allAlbumIds.indexOf(albumId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allAlbumIds.length - 1;

  const buildFormatLabel = (
    release?: Pick<ReleaseRow, 'media_type' | 'format_details' | 'qty'> | null,
  ) => {
    if (!release) return '';
    const parts = [release.media_type, ...(release.format_details ?? [])].filter(Boolean);
    const base = parts.join(', ');
    const qty = release.qty ?? 1;
    if (!base) return '';
    return qty > 1 ? `${qty}x${base}` : base;
  };

  const extractTagNames = (links?: MasterTagLinkRow[] | null) => {
    if (!links) return [];
    return links
      .map((link) => link.master_tags?.name)
      .filter((name): name is string => Boolean(name));
  };


  const loadLocations = async () => {
    const locationsData = await fetchLocations();
    setLocations(locationsData);
  };

  // Load locations on mount
  useEffect(() => {
    if (album) {
      loadLocations();
    }
  }, [album]);

  // Navigation handlers
  const handlePrevious = async () => {
    if (!hasPrevious) return;
    
    // Save current changes first (without closing)
    if (editedAlbum) {
      await performSave();
    }
    
    // Navigate to previous album
    const previousAlbumId = allAlbumIds[currentIndex - 1];
    onNavigate(previousAlbumId);
  };

  const handleNext = async () => {
    if (!hasNext) return;
    
    // Save current changes first (without closing)
    if (editedAlbum) {
      await performSave();
    }
    
    // Navigate to next album
    const nextAlbumId = allAlbumIds[currentIndex + 1];
    onNavigate(nextAlbumId);
  };

  useEffect(() => {
    async function fetchAlbum() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('inventory')
          .select(
            `id,
             release_id,
             status,
             personal_notes,
             media_condition,
             sleeve_condition,
             location,
             date_added,
             purchase_price,
             current_value,
             purchase_date,
             owner,
             play_count,
             last_played_at,
             release:releases (
               id,
               master_id,
               media_type,
               label,
               catalog_number,
               barcode,
               country,
               release_date,
               release_year,
               discogs_release_id,
               spotify_album_id,
               packaging,
               vinyl_color,
               vinyl_weight,
               rpm,
               spars_code,
               box_set,
               sound,
               studio,
               disc_metadata,
               matrix_numbers,
               track_count,
               notes,
               qty,
               format_details,
               release_tracks:release_tracks (
                 id,
                 position,
                 side,
                 title_override,
                 recording:recordings (
                   id,
                   title,
                   duration_seconds,
                   credits,
                   notes,
                   lyrics,
                   lyrics_url,
                   is_cover,
                   original_artist,
                   track_artist
                 )
               ),
               master:masters (
                 id,
                 title,
                 original_release_year,
                 discogs_master_id,
                 musicbrainz_release_group_id,
                 cover_image_url,
                 genres,
                 styles,
                 notes,
                 sort_title,
                 subtitle,
                 musicians,
                 producers,
                 engineers,
                 songwriters,
                 composer,
                 conductor,
                 chorus,
                 composition,
                 orchestra,
                 chart_positions,
                 awards,
                 certifications,
                 cultural_significance,
                 critical_reception,
                 allmusic_rating,
                 allmusic_review,
                 pitchfork_score,
                 pitchfork_review,
                 recording_location,
                 master_release_date,
                 recording_date,
                 recording_year,
                 wikipedia_url,
                 allmusic_url,
                 apple_music_url,
                 lastfm_url,
                 spotify_url,
                 genius_url,
                 custom_links,
                 artist:artists (id, name),
                 master_tag_links:master_tag_links (
                   master_tags (name)
                 )
               )
             )`
          )
          .eq('id', albumId)
          .single();

        if (fetchError) {
          console.error('Error fetching album:', fetchError);
          setError('Failed to load album data');
          return;
        }

        if (!data) {
          setError('Album not found');
          return;
        }

        const release = toSingle(data.release);
        const master = toSingle(release?.master);
        const artist = toSingle(master?.artist);
        const tags = extractTagNames(master?.master_tag_links ?? null);
        const status = data.status ?? 'active';
        const releaseTracks = release?.release_tracks ?? [];
        const firstRecording = toSingle(releaseTracks[0]?.recording);
        const creditsInfo = getAlbumCredits(firstRecording?.credits);
        const albumDetails = creditsInfo.albumDetails;
        const albumPeople = creditsInfo.albumPeople;
        const classical = creditsInfo.classical;
        const artwork = creditsInfo.artwork;
        const customLinks = creditsInfo.customLinks;
        const links = asRecord(albumDetails.links ?? albumDetails.link ?? {});
        const trackList = (releaseTracks ?? []).map((track, index) => {
          const recording = toSingle(track.recording);
          const recordingCredits = asRecord(recording?.credits);
          const trackArtist = asString(recording?.track_artist ?? recordingCredits.track_artist);
          const discNumberRaw = recordingCredits.disc_number;
          const discNumber =
            typeof discNumberRaw === 'number'
              ? discNumberRaw
              : discNumberFromSide(track.side ?? undefined);

          return {
            position: track.position ?? `${index + 1}`,
            title: track.title_override || recording?.title || '',
            artist: trackArtist ?? null,
            duration: secondsToDuration(recording?.duration_seconds ?? null),
            type: 'track' as const,
            disc_number: discNumber,
            side: track.side ?? undefined,
            note: recording?.notes ?? null,
          };
        });
        const maxDiscNumber = trackList.reduce((max, track) => Math.max(max, track.disc_number ?? 1), 1);
        const uniqueSides = new Set(trackList.map((track) => track.side).filter(Boolean));

        let collectionStatus: Album['collection_status'] = 'in_collection';
        if (status === 'wishlist') collectionStatus = 'wish_list';
        if (status === 'incoming') collectionStatus = 'on_order';
        if (status === 'sold') collectionStatus = 'sold';

        const normalizedRelease = release
          ? ({
              ...release,
              master,
            } as Album['release'])
          : null;

        const albumData: Album = {
          release: normalizedRelease,
          id: data.id,
          inventory_id: data.id,
          master_id: master?.id ?? null,
          release_id: release?.id ?? null,
          artist: artist?.name || '',
          title: master?.title || '',
          year: release?.release_year
            ? String(release.release_year)
            : (master?.original_release_year ? String(master.original_release_year) : null),
          original_release_year: master?.original_release_year ?? null,
          format: buildFormatLabel(release),
          image_url: master?.cover_image_url || null,
          discogs_release_id: release?.discogs_release_id ?? null,
          discogs_master_id: master?.discogs_master_id ?? null,
          musicbrainz_id: master?.musicbrainz_release_group_id ?? null,
          spotify_id: release?.spotify_album_id ?? null,
          spotify_url: release?.spotify_album_id ? `https://open.spotify.com/album/${release.spotify_album_id}` : null,
          apple_music_url: asString(master?.apple_music_url ?? links.apple_music_url ?? albumDetails.apple_music_url),
          lastfm_url: asString(master?.lastfm_url ?? links.lastfm_url ?? albumDetails.lastfm_url),
          allmusic_url: asString(master?.allmusic_url ?? links.allmusic_url ?? albumDetails.allmusic_url),
          wikipedia_url: asString(master?.wikipedia_url ?? links.wikipedia_url ?? albumDetails.wikipedia_url),
          genius_url: asString(master?.genius_url ?? links.genius_url ?? albumDetails.genius_url),
          apple_music_id: asString(albumDetails.apple_music_id),
          lastfm_id: asString(albumDetails.lastfm_id),
          musicbrainz_url: asString(albumDetails.musicbrainz_url),
          custom_links: Array.isArray(master?.custom_links)
            ? (master?.custom_links as Array<{ url: string; description?: string | null }>)
            : customLinks,
          personal_notes: data.personal_notes ?? null,
          release_notes: release?.notes ?? null,
          master_notes: master?.notes ?? null,
          media_condition: data.media_condition ?? '',
          package_sleeve_condition: data.sleeve_condition ?? null,
          sleeve_condition: data.sleeve_condition ?? null,
          genres: master?.genres || [],
          styles: master?.styles || [],
          labels: release?.label ? [release.label] : [],
          label: release?.label ?? null,
          cat_no: release?.catalog_number ?? null,
          barcode: release?.barcode ?? null,
          country: release?.country ?? null,
          custom_tags: tags,
          location: data.location ?? null,
          collection_status: collectionStatus,
          for_sale: status === 'for_sale',
          tracks: trackList,
          disc_metadata: (release?.disc_metadata ?? albumDetails.disc_metadata) as Album['disc_metadata'],
          matrix_numbers: (release?.matrix_numbers ?? albumDetails.matrix_numbers) as Album['matrix_numbers'],
          discs: maxDiscNumber || release?.qty || null,
          sides: uniqueSides.size || null,
          back_image_url: asString(artwork.back_image_url),
          spine_image_url: asString(artwork.spine_image_url),
          inner_sleeve_images: asStringArray(artwork.inner_sleeve_images),
          vinyl_label_images: asStringArray(artwork.vinyl_label_images),
          musicians: master?.musicians ?? asStringArray(albumPeople.musicians),
          producers: master?.producers ?? asStringArray(albumPeople.producers),
          engineers: master?.engineers ?? asStringArray(albumPeople.engineers),
          songwriters: master?.songwriters ?? asStringArray(albumPeople.songwriters),
          composer: master?.composer ?? asString(classical.composer),
          conductor: master?.conductor ?? asString(classical.conductor),
          chorus: master?.chorus ?? asString(classical.chorus),
          composition: master?.composition ?? asString(classical.composition),
          orchestra: master?.orchestra ?? asString(classical.orchestra),
          packaging: asString(release?.packaging ?? albumDetails.packaging),
          vinyl_color: release?.vinyl_color ?? asStringArray(albumDetails.vinyl_color),
          vinyl_weight: asString(release?.vinyl_weight ?? albumDetails.vinyl_weight),
          rpm: asString(release?.rpm ?? albumDetails.rpm),
          spars_code: asString(release?.spars_code ?? albumDetails.spars_code),
          box_set: asString(release?.box_set ?? albumDetails.box_set),
          sound: asString(release?.sound ?? albumDetails.sound),
          studio: asString(release?.studio ?? albumDetails.studio),
          master_release_date: asString(master?.master_release_date ?? albumDetails.master_release_date),
          recording_date: asString(master?.recording_date ?? albumDetails.recording_date),
          recording_year: master?.recording_year ?? asNumber(albumDetails.recording_year),
          chart_positions: master?.chart_positions ?? asStringArray(albumDetails.chart_positions),
          awards: master?.awards ?? asStringArray(albumDetails.awards),
          certifications: master?.certifications ?? asStringArray(albumDetails.certifications),
          sort_title: master?.sort_title ?? asString(albumDetails.sort_title),
          subtitle: master?.subtitle ?? asString(albumDetails.subtitle),
          cultural_significance: asString(master?.cultural_significance ?? albumDetails.cultural_significance),
          critical_reception: asString(master?.critical_reception ?? albumDetails.critical_reception),
          recording_location: asString(master?.recording_location ?? albumDetails.recording_location),
          allmusic_rating: master?.allmusic_rating ?? albumDetails.allmusic_rating ?? null,
          allmusic_review: asString(master?.allmusic_review ?? albumDetails.allmusic_review),
          pitchfork_score: master?.pitchfork_score ?? albumDetails.pitchfork_score ?? null,
          pitchfork_review: asString(master?.pitchfork_review ?? albumDetails.pitchfork_review),
          tempo_bpm: typeof albumDetails.tempo_bpm === 'number' ? albumDetails.tempo_bpm : null,
          musical_key: asString(albumDetails.musical_key),
          energy: typeof albumDetails.energy === 'number' ? albumDetails.energy : null,
          danceability: typeof albumDetails.danceability === 'number' ? albumDetails.danceability : null,
          mood_acoustic: typeof albumDetails.mood_acoustic === 'number' ? albumDetails.mood_acoustic : null,
          mood_electronic: typeof albumDetails.mood_electronic === 'number' ? albumDetails.mood_electronic : null,
          mood_happy: typeof albumDetails.mood_happy === 'number' ? albumDetails.mood_happy : null,
          mood_sad: typeof albumDetails.mood_sad === 'number' ? albumDetails.mood_sad : null,
          mood_aggressive: typeof albumDetails.mood_aggressive === 'number' ? albumDetails.mood_aggressive : null,
          mood_relaxed: typeof albumDetails.mood_relaxed === 'number' ? albumDetails.mood_relaxed : null,
          mood_party: typeof albumDetails.mood_party === 'number' ? albumDetails.mood_party : null,
          enrichment_sources: asStringArray(albumDetails.enrichment_sources),
          purchase_store: asString(albumDetails.purchase_store),
          signed_by: asStringArray(albumDetails.signed_by),
          my_rating: typeof albumDetails.my_rating === 'number' ? albumDetails.my_rating : null,
          last_cleaned_date: asString(albumDetails.last_cleaned_date),
          played_history: (albumDetails.played_history as Album['played_history']) ?? null,
          owner: data.owner ?? null,
          purchase_price: data.purchase_price ?? null,
          current_value: data.current_value ?? null,
          purchase_date: data.purchase_date ?? null,
          play_count: data.play_count ?? null,
          last_played_at: data.last_played_at ?? null,
          date_added: data.date_added ?? null,
        };

        setAlbum(albumData);
        setEditedAlbum(albumData);
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }
    
    fetchAlbum();
  }, [albumId]);

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[20001]">
        <div className="bg-white rounded-lg px-16 py-10 text-center shadow-2xl">
          <div className="text-4xl mb-4">⏳</div>
          <div className="font-bold text-gray-900 mb-2">Loading Album...</div>
          <div className="text-sm text-gray-500">Please wait</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !album || !editedAlbum) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[20001]">
        <div className="bg-white rounded-lg px-16 py-10 text-center shadow-2xl">
          <div className="text-5xl mb-4 text-red-500">⚠️</div>
          <div className="font-bold text-red-500 mb-2">Error</div>
          <div className="text-sm text-gray-500 mb-6">
            {error || 'Failed to load album data'}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-500 text-white border-none rounded font-medium cursor-pointer hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleFieldChange = (field: keyof Album, value: unknown) => {
    setEditedAlbum(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: value as never
      };
    });
  };

  const updateRecordingAlbumCredits = async (releaseId: number, albumCredits: Record<string, unknown>) => {
    if (!releaseId || Object.keys(albumCredits).length === 0) return;

    const { data: releaseRow, error } = await supabase
      .from('releases')
      .select(`
        id,
        release_tracks:release_tracks (
          id,
          recording:recordings ( id, credits )
        )
      `)
      .eq('id', releaseId)
      .single();

    if (error || !releaseRow) {
      console.error('❌ Failed to load recordings for album credits:', error);
      return;
    }

    const releaseTracks = releaseRow.release_tracks ?? [];
    const updates: Promise<unknown>[] = [];

    releaseTracks.forEach((track) => {
      const recording = toSingle(track.recording);
      if (!recording?.id) return;
      const existingCredits = asRecord(recording.credits);
      const mergedCredits = {
        ...existingCredits,
        ...albumCredits,
      };
      updates.push(
        Promise.resolve(
          supabase
            .from('recordings')
            .update({ credits: mergedCredits as unknown as Database['public']['Tables']['recordings']['Update']['credits'] })
            .eq('id', recording.id)
        )
      );
    });

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  };

  // Core save logic - can be called with or without closing modal
  const performSave = async () => {
    if (!editedAlbum) return;
    
    try {
      console.log('💾 Starting save operation...');

      if (!editedAlbum.inventory_id) {
        throw new Error('Missing inventory ID for save.');
      }

      console.log('🧭 Saving via inventory tables...');

        let status: string | null = 'active';
        if (editedAlbum.collection_status === 'wish_list') status = 'wishlist';
        if (editedAlbum.collection_status === 'on_order') status = 'incoming';
        if (editedAlbum.collection_status === 'sold') status = 'sold';
        if (editedAlbum.collection_status === 'for_sale' || editedAlbum.for_sale) status = 'active';

        const inventoryUpdate = {
          personal_notes: editedAlbum.personal_notes ?? null,
          media_condition: editedAlbum.media_condition ?? null,
          sleeve_condition: editedAlbum.package_sleeve_condition ?? null,
          location: editedAlbum.location ?? null,
          status,
          owner: editedAlbum.owner ?? null,
          purchase_price: editedAlbum.purchase_price ?? null,
          current_value: editedAlbum.current_value ?? null,
          purchase_date: editedAlbum.purchase_date ?? null,
          play_count: editedAlbum.play_count ?? null,
          last_played_at: editedAlbum.last_played_at ?? null,
        };

        const { error: inventoryError } = await supabase
          .from('inventory')
          .update(inventoryUpdate)
          .eq('id', editedAlbum.inventory_id);

        if (inventoryError) {
          console.error('❌ Failed to update inventory:', inventoryError);
          alert(`Failed to save album: ${inventoryError.message}`);
          return;
        }

        const tracksData = tracksTabRef.current?.getTracksData();
        console.log('📊 Tracks data:', tracksData);

        if (tracksData && editedAlbum.release_id) {
          const { error: deleteError } = await supabase
            .from('release_tracks')
            .delete()
            .eq('release_id', editedAlbum.release_id);

          if (deleteError) {
            console.error('❌ Failed to clear release tracks:', deleteError);
            alert(`Failed to save tracks: ${deleteError.message}`);
            return;
          }

          for (const track of tracksData.tracks) {
            if (track.type === 'header') continue;
            const trackTitle = track.title?.trim() || '';
            if (!trackTitle) continue;

            const albumCredits = buildAlbumCredits(editedAlbum);
            const recordingCredits = discardEmpty({
              ...albumCredits,
              track_artist: track.artist ?? null,
              disc_number: track.disc_number ?? null,
            });

            // HELPER TO EXTRACT VALUES FROM THE JSON STRUCTURE
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const details = (recordingCredits as any).album_details || {};

            const recordingPayload = {
              title: trackTitle,
              duration_seconds: parseDurationToSeconds(track.duration),
              notes: track.note ?? null,
              track_artist: track.artist ?? null,
              credits: Object.keys(recordingCredits).length > 0
                ? (recordingCredits as unknown as Database['public']['Tables']['recordings']['Insert']['credits'])
                : undefined,
              // ADD THESE LINES TO SAVE TO COLUMNS:
              bpm: details.tempo_bpm ? Math.round(Number(details.tempo_bpm)) : null,
              energy: details.energy ? Number(details.energy) : null,
              danceability: details.danceability ? Number(details.danceability) : null,
              valence: details.mood_happy ? Number(details.mood_happy) : null,
              musical_key: details.musical_key || null
            };

            const { data: recording, error: recordingError } = await supabase
              .from('recordings')
              .insert([recordingPayload])
              .select('id')
              .single();

            if (recordingError || !recording) {
              console.error('❌ Failed to create recording:', recordingError);
              alert(`Failed to save track: ${recordingError?.message ?? 'Unknown error'}`);
              return;
            }

            const { error: releaseTrackError } = await supabase
              .from('release_tracks')
              .insert([{
                release_id: editedAlbum.release_id,
                recording_id: recording.id,
                position: String(track.position ?? ''),
                side: track.side ?? null,
              }]);

            if (releaseTrackError) {
              console.error('❌ Failed to link recording:', releaseTrackError);
              alert(`Failed to save track: ${releaseTrackError.message}`);
              return;
            }
          }
        }

        if (editedAlbum.release_id) {
          const trackCount = tracksData?.tracks?.filter((track) => track.type === 'track').length;
          const releaseUpdate: Database['public']['Tables']['releases']['Update'] = {
            label: editedAlbum.labels?.[0] ?? editedAlbum.label ?? null,
            catalog_number: editedAlbum.cat_no ?? editedAlbum.catalog_number ?? null,
            barcode: editedAlbum.barcode ?? null,
            country: editedAlbum.country ?? null,
            release_year: editedAlbum.year ? Number(editedAlbum.year) : null,
            discogs_release_id: extractIdFromUrl(editedAlbum.discogs_release_id, '/release/') ?? editedAlbum.discogs_release_id ?? null,
            spotify_album_id:
              editedAlbum.spotify_id ??
              extractIdFromUrl(editedAlbum.spotify_url, '/album/') ??
              editedAlbum.release?.spotify_album_id ??
              null,
            notes: editedAlbum.release_notes ?? null,
            track_count: typeof trackCount === 'number' ? trackCount : editedAlbum.release?.track_count ?? null,
            packaging: editedAlbum.packaging ?? null,
            vinyl_color: editedAlbum.vinyl_color ?? null,
            vinyl_weight: editedAlbum.vinyl_weight ?? null,
            rpm: editedAlbum.rpm ?? null,
            spars_code: editedAlbum.spars_code ?? null,
            box_set: editedAlbum.box_set ?? null,
            sound: editedAlbum.sound ?? null,
            studio: editedAlbum.studio ?? null,
            disc_metadata: editedAlbum.disc_metadata ?? null,
            matrix_numbers: editedAlbum.matrix_numbers ?? null,
          };

          const parsedFormat = editedAlbum.format
            ? parseDiscogsFormat(editedAlbum.format)
            : null;
          const resolvedMediaType = parsedFormat?.media_type ?? editedAlbum.release?.media_type ?? null;
          const resolvedFormatDetails = parsedFormat?.format_details ?? editedAlbum.release?.format_details ?? null;
          const resolvedQty = parsedFormat?.qty ?? editedAlbum.discs ?? editedAlbum.release?.qty ?? null;

          if (resolvedMediaType) {
            releaseUpdate.media_type = resolvedMediaType;
          }
          if (resolvedFormatDetails) {
            releaseUpdate.format_details = resolvedFormatDetails;
          }
          if (resolvedQty !== null && resolvedQty !== undefined) {
            releaseUpdate.qty = resolvedQty;
          }

          const { error: releaseError } = await supabase
            .from('releases')
            .update(releaseUpdate)
            .eq('id', editedAlbum.release_id);

          if (releaseError) {
            console.error('❌ Failed to update release:', releaseError);
            alert(`Failed to save album: ${releaseError.message}`);
            return;
          }
        }

        if (editedAlbum.master_id) {
          let mainArtistId: number | null | undefined = undefined;
          const artistName = editedAlbum.artist?.trim();
          if (artistName) {
            const { data: existingArtist, error: artistLookupError } = await supabase
              .from('artists')
              .select('id')
              .ilike('name', artistName)
              .maybeSingle();

            if (artistLookupError) {
              console.error('❌ Failed to lookup artist:', artistLookupError);
              alert(`Failed to save artist: ${artistLookupError.message}`);
              return;
            }

            if (existingArtist?.id) {
              mainArtistId = existingArtist.id;
            } else {
              const { data: createdArtist, error: artistCreateError } = await supabase
                .from('artists')
                .insert({ name: artistName })
                .select('id')
                .single();

              if (artistCreateError) {
                console.error('❌ Failed to create artist:', artistCreateError);
                alert(`Failed to save artist: ${artistCreateError.message}`);
                return;
              }
              mainArtistId = createdArtist?.id ?? null;
            }
          } else {
            mainArtistId = null;
          }

          const masterUpdate: Database['public']['Tables']['masters']['Update'] = {
            title: editedAlbum.title ?? null,
            sort_title: editedAlbum.sort_title ?? null,
            subtitle: editedAlbum.subtitle ?? null,
            original_release_year: editedAlbum.original_release_year
              ? Number(editedAlbum.original_release_year)
              : (editedAlbum.year ? Number(editedAlbum.year) : null),
            genres: editedAlbum.genres ?? [],
            styles: editedAlbum.styles ?? [],
            discogs_master_id: extractIdFromUrl(editedAlbum.discogs_master_id, '/master/') ?? editedAlbum.discogs_master_id ?? null,
            musicbrainz_release_group_id:
              editedAlbum.musicbrainz_id
                ? extractIdFromUrl(editedAlbum.musicbrainz_id, '/release-group/') ?? editedAlbum.musicbrainz_id
                : null,
            cover_image_url: editedAlbum.image_url ?? null,
            notes: editedAlbum.master_notes ?? null,
            musicians: editedAlbum.musicians ?? null,
            producers: editedAlbum.producers ?? null,
            engineers: editedAlbum.engineers ?? null,
            songwriters: editedAlbum.songwriters ?? null,
            composer: editedAlbum.composer ?? null,
            conductor: editedAlbum.conductor ?? null,
            chorus: editedAlbum.chorus ?? null,
            composition: editedAlbum.composition ?? null,
            orchestra: editedAlbum.orchestra ?? null,
            chart_positions: editedAlbum.chart_positions ?? null,
            awards: editedAlbum.awards ?? null,
            certifications: editedAlbum.certifications ?? null,
            cultural_significance: editedAlbum.cultural_significance ?? null,
            critical_reception: editedAlbum.critical_reception ?? null,
            allmusic_rating: typeof editedAlbum.allmusic_rating === 'number'
              ? editedAlbum.allmusic_rating
              : (editedAlbum.allmusic_rating ? Number(editedAlbum.allmusic_rating) : null),
            allmusic_review: editedAlbum.allmusic_review ?? null,
            pitchfork_score: typeof editedAlbum.pitchfork_score === 'number'
              ? editedAlbum.pitchfork_score
              : (editedAlbum.pitchfork_score ? Number(editedAlbum.pitchfork_score) : null),
            pitchfork_review: editedAlbum.pitchfork_review ?? null,
            recording_location: editedAlbum.recording_location ?? null,
            master_release_date: editedAlbum.master_release_date ?? null,
            recording_date: editedAlbum.recording_date ?? null,
            recording_year: editedAlbum.recording_year ?? null,
            wikipedia_url: editedAlbum.wikipedia_url ?? null,
            allmusic_url: editedAlbum.allmusic_url ?? null,
            apple_music_url: editedAlbum.apple_music_url ?? null,
            lastfm_url: editedAlbum.lastfm_url ?? null,
            spotify_url: editedAlbum.spotify_url ?? null,
            genius_url: editedAlbum.genius_url ?? null,
            custom_links: (editedAlbum.custom_links ?? []) as unknown as Database['public']['Tables']['masters']['Update']['custom_links'],
            main_artist_id: mainArtistId,
          };

          const { error: masterError } = await supabase
            .from('masters')
            .update(masterUpdate)
            .eq('id', editedAlbum.master_id);

          if (masterError) {
            console.error('❌ Failed to update master:', masterError);
            alert(`Failed to save album: ${masterError.message}`);
            return;
          }

          const desiredTags = (editedAlbum.custom_tags ?? [])
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);

          const desiredTagSet = new Set(desiredTags.map((tag) => tag.toLowerCase()));

          const { data: existingLinks, error: existingLinksError } = await supabase
            .from('master_tag_links')
            .select('tag_id, master_tags (name)')
            .eq('master_id', editedAlbum.master_id);

          if (existingLinksError) {
            console.error('❌ Failed to load existing tags:', existingLinksError);
            alert(`Failed to save tags: ${existingLinksError.message}`);
            return;
          }

          const existingByName = new Map(
            (existingLinks ?? [])
              .map((link) => {
                const name = toSingle(link.master_tags)?.name;
                return name ? [name.toLowerCase(), link.tag_id] : null;
              })
              .filter((entry): entry is [string, number] => Boolean(entry))
          );

          const tagsToRemove = (existingLinks ?? [])
            .filter((link) => {
              const name = toSingle(link.master_tags)?.name;
              return name ? !desiredTagSet.has(name.toLowerCase()) : false;
            })
            .map((link) => link.tag_id);

          for (const tagName of desiredTags) {
            if (existingByName.has(tagName.toLowerCase())) continue;

            const { data: existingTag, error: existingTagError } = await supabase
              .from('master_tags')
              .select('id')
              .ilike('name', tagName)
              .maybeSingle();

            if (existingTagError) {
              console.error('❌ Failed to lookup tag:', existingTagError);
              alert(`Failed to save tag: ${existingTagError.message}`);
              return;
            }

            let tagId = existingTag?.id;
            if (!tagId) {
              const { data: createdTag, error: createError } = await supabase
                .from('master_tags')
                .insert({ name: tagName, category: 'custom' })
                .select('id')
                .single();

              if (createError) {
                console.error('❌ Failed to create tag:', createError);
                alert(`Failed to save tag: ${createError.message}`);
                return;
              }

              tagId = createdTag?.id;
            }

            if (tagId) {
              const { error: linkError } = await supabase
                .from('master_tag_links')
                .insert({ master_id: editedAlbum.master_id, tag_id: tagId });

              if (linkError) {
                console.error('❌ Failed to link tag:', linkError);
                alert(`Failed to save tag: ${linkError.message}`);
                return;
              }
            }
          }

          if (tagsToRemove.length > 0) {
            const { error: deleteError } = await supabase
              .from('master_tag_links')
              .delete()
              .eq('master_id', editedAlbum.master_id)
              .in('tag_id', tagsToRemove);

            if (deleteError) {
              console.error('❌ Failed to remove tags:', deleteError);
              alert(`Failed to remove tags: ${deleteError.message}`);
              return;
            }
          }
        }

        if (editedAlbum.release_id) {
          const albumCredits = buildAlbumCredits(editedAlbum);
          await updateRecordingAlbumCredits(editedAlbum.release_id, albumCredits);
        }

      console.log('✅ Save complete!');
      onRefresh();
    } catch (err) {
      console.error('❌ Save failed:', err);
      alert(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw err; // Re-throw so navigation handlers know save failed
    }
  };

  // Save and close handler
  const handleSave = async () => {
    await performSave();
    // Note: Modal stays open - user can click X or Cancel to close
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[20001]">
      <div className="bg-white rounded w-[90vw] max-w-[1200px] h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header - BOLD TITLE */}
        <div className="bg-[#F7941D] text-white px-4 py-3 flex justify-between items-center shrink-0">
          <h2 className="m-0 text-lg font-bold font-sans">
            {album.title} / {album.artist}
          </h2>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-white text-2xl cursor-pointer p-0 leading-none font-light hover:text-white/80"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-[#f3f3f3] flex shrink-0 overflow-x-auto px-2">
          {TABS.map((tab) => {
            const Icon = tab.IconComponent;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 mx-1 my-2 rounded border text-[12px] cursor-pointer whitespace-nowrap flex items-center gap-1.5 font-sans transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#c9c9c9] bg-white text-gray-900 font-semibold shadow-sm'
                    : 'border-transparent bg-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <Icon />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto bg-white relative">
          <div className={activeTab === 'main' ? 'block h-full' : 'hidden'}>
            <MainTab ref={mainTabRef} album={editedAlbum} onChange={handleFieldChange} />
          </div>
          <div className={activeTab === 'details' ? 'block h-full' : 'hidden'}>
            <DetailsTab album={editedAlbum} onChange={handleFieldChange} />
          </div>
          <div className={activeTab === 'enrichment' ? 'block h-full' : 'hidden'}>
            <EnrichmentTab album={editedAlbum} onChange={handleFieldChange} />
          </div>
          <div className={activeTab === 'classical' ? 'block h-full' : 'hidden'}>
            <ClassicalTab album={editedAlbum} onChange={handleFieldChange} />
          </div>
          <div className={activeTab === 'people' ? 'block h-full' : 'hidden'}>
            <PeopleTab album={editedAlbum} onChange={handleFieldChange} />
          </div>
          <div className={activeTab === 'tracks' ? 'block h-full' : 'hidden'}>
            <TracksTab ref={tracksTabRef} album={editedAlbum} onChange={handleFieldChange} />
          </div>
          <div className={activeTab === 'personal' ? 'block h-full' : 'hidden'}>
            <PersonalTab album={editedAlbum} onChange={handleFieldChange} />
          </div>
          <div className={activeTab === 'cover' ? 'block h-full' : 'hidden'}>
            <CoverTab album={editedAlbum} onChange={handleFieldChange} />
          </div>
          <div className={activeTab === 'links' ? 'block h-full' : 'hidden'}>
            <LinksTab album={editedAlbum} onChange={handleFieldChange} />
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-200 p-3 bg-white shrink-0">
          <UniversalBottomBar
            album={editedAlbum}
            onChange={handleFieldChange}
            onPrevious={handlePrevious}
            onNext={handleNext}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            onCancel={onClose}
            onSave={handleSave}
            onOpenLocationPicker={() => {
              setShowLocationPicker(true);
            }}
          />
        </div>

        {/* Location Picker Modal - Shared across all tabs */}
        {showLocationPicker && (
          <PickerModal
            isOpen={true}
            onClose={() => setShowLocationPicker(false)}
            title="Select Location"
            mode="single"
            items={locations}
            selectedIds={editedAlbum.location ? [editedAlbum.location] : []}
            onSave={(selectedIds) => {
              if (selectedIds.length > 0) {
                handleFieldChange('location', selectedIds[0]);
              }
              setShowLocationPicker(false);
            }}
            onManage={() => {
              setShowLocationPicker(false);
              setShowManageLocations(true);
            }}
            onNew={() => {
              setShowLocationPicker(false);
              setShowNewLocationModal(true);
            }}
            searchPlaceholder="Search locations..."
            itemLabel="Location"
            showSortName={false}
          />
        )}

        {showManageLocations && (
          <ManagePickListsModal
            isOpen={true}
            onClose={() => {
              setShowManageLocations(false);
              loadLocations();
            }}
            initialList="location"
            hideListSelector={true}
          />
        )}

        {showNewLocationModal && (
          <EditModal
            isOpen={true}
            onClose={() => setShowNewLocationModal(false)}
            title="New Location"
            itemName=""
            onSave={(newName) => {
              handleFieldChange('location', newName);
              setLocations((prev) => {
                if (prev.some((item) => item.name === newName)) {
                  return prev;
                }
                return [...prev, { id: newName, name: newName, count: 0 }].sort((a, b) => a.name.localeCompare(b.name));
              });
              setShowNewLocationModal(false);
            }}
            itemLabel="Location"
            showSortName={false}
          />
        )}
      </div>
    </div>
  );
}
// AUDIT: updated for UI parity with CLZ reference.
