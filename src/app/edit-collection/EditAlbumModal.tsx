'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from 'lib/supabaseClient';
import { parseDiscogsFormat } from 'lib/formatParser';
import type { Album } from 'types/album';
import type { Database, Json } from 'types/supabase';
import { MainTab, type MainTabRef } from './tabs/MainTab';
import { DetailsTab } from './tabs/DetailsTab';
import { TracksTab, type TracksTabRef } from './tabs/TracksTab';
import { PersonalTab } from './tabs/PersonalTab';
import { LinksTab } from './tabs/LinksTab';
import { ClassicalTab } from './tabs/ClassicalTab';
import { PeopleTab } from './tabs/PeopleTab';
import { UniversalBottomBar } from 'components/UniversalBottomBar';

const CoverTab = dynamic(() => import('./tabs/CoverTab').then(mod => mod.CoverTab));
const EnrichmentTab = dynamic(() => import('./tabs/EnrichmentTab').then(mod => mod.EnrichmentTab));
import { PickerModal } from './pickers/PickerModal';
import { EditModal } from './pickers/EditModal';
import ManagePickListsModal from './ManagePickListsModal';
import { fetchLocations, type PickerDataItem } from './pickers/pickerDataUtils';

type TabId =
  | 'main'
  | 'details'
  | 'enrichment'
  | 'tracks'
  | 'classical'
  | 'people'
  | 'personal'
  | 'cover'
  | 'links';

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
  { id: 'enrichment', label: 'Enhancement', IconComponent: TabIcons.bolt },
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

const formatSeconds = (seconds?: number | null) => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const buildFormatLabel = (release?: ReleaseRow | null) => {
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
               track_count,
               created_at,
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
                   credits
                 )
               ),
               master:masters (
                 id,
                 title,
                 original_release_year,
                 discogs_master_id,
                 cover_image_url,
                 genres,
                 styles,
                 musicbrainz_release_group_id,
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

        const normalizedRelease = release
          ? ({
              ...release,
              master,
            } as Album['release'])
          : null;

        const releaseTracks = (release?.release_tracks ?? []) as Array<{
          position?: string | null;
          side?: string | null;
          title_override?: string | null;
          recording?: {
            title?: string | null;
            duration_seconds?: number | null;
            credits?: unknown;
          } | null;
        }>;

        const creditsSource = releaseTracks
          .map((track) => track.recording?.credits)
          .find((credits) => typeof credits === 'object' && credits !== null) as
          | Record<string, unknown>
          | undefined;

        const albumPeople =
          creditsSource?.album_people && typeof creditsSource.album_people === 'object'
            ? (creditsSource.album_people as Record<string, unknown>)
            : {};
        const classical =
          creditsSource?.classical && typeof creditsSource.classical === 'object'
            ? (creditsSource.classical as Record<string, unknown>)
            : {};

        const toStringArray = (value: unknown): string[] | null => {
          if (!value) return null;
          if (Array.isArray(value)) {
            const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
            return items.length > 0 ? items : null;
          }
          if (typeof value === 'string' && value.trim().length > 0) return [value.trim()];
          return null;
        };

        const toStringValue = (value: unknown): string | null => {
          if (typeof value === 'string' && value.trim().length > 0) return value.trim();
          return null;
        };

        const tracks = releaseTracks
          .map((track) => ({
            position: track.position ?? '',
            title: track.title_override ?? track.recording?.title ?? '',
            artist: null,
            duration: formatSeconds(track.recording?.duration_seconds ?? null),
            type: 'track' as const,
            side: track.side ?? undefined,
          }))
          .filter((track) => track.title || track.position);

        const albumData: Album = {
          release: normalizedRelease,
          id: data.id,
          inventory_id: data.id,
          master_id: master?.id ?? null,
          release_id: release?.id ?? null,
          artist: artist?.name || '',
          title: master?.title || '',
          year: master?.original_release_year ? String(master.original_release_year) : null,
          format: buildFormatLabel(release),
          image_url: master?.cover_image_url || null,
          discogs_release_id: release?.discogs_release_id ?? null,
          spotify_album_id: release?.spotify_album_id ?? null,
          personal_notes: data.personal_notes ?? null,
          release_notes: release?.notes ?? null,
          media_condition: data.media_condition ?? '',
          sleeve_condition: data.sleeve_condition ?? null,
          genres: master?.genres || [],
          styles: master?.styles || [],
          tags,
          location: data.location ?? null,
          country: release?.country ?? null,
          barcode: release?.barcode ?? null,
          catalog_number: release?.catalog_number ?? null,
          label: release?.label ?? null,
          status,
          purchase_price: data.purchase_price ?? null,
          current_value: data.current_value ?? null,
          purchase_date: data.purchase_date ?? null,
          owner: data.owner ?? null,
          date_added: data.date_added ?? null,
          last_played_at: data.last_played_at ?? null,
          play_count: data.play_count ?? null,
          musicbrainz_release_group_id: master?.musicbrainz_release_group_id ?? null,
          tracks,
          sale_quantity: release?.qty ?? 1,
          composer: toStringValue(classical.composer ?? creditsSource?.composer),
          conductor: toStringValue(classical.conductor ?? creditsSource?.conductor),
          chorus: toStringValue(classical.chorus ?? creditsSource?.chorus),
          composition: toStringValue(classical.composition ?? creditsSource?.composition),
          orchestra: toStringValue(classical.orchestra ?? creditsSource?.orchestra),
          songwriters: toStringArray(albumPeople.songwriters ?? creditsSource?.songwriters),
          producers: toStringArray(albumPeople.producers ?? creditsSource?.producers),
          engineers: toStringArray(albumPeople.engineers ?? creditsSource?.engineers),
          musicians: toStringArray(albumPeople.musicians ?? creditsSource?.musicians),
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

  const handleFieldChange = <K extends keyof Album>(field: K, value: Album[K]) => {
    setEditedAlbum(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: value
      };
    });
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

        const status: string | null = editedAlbum.status ?? 'active';

        const inventoryUpdate = {
          personal_notes: editedAlbum.personal_notes ?? null,
          media_condition: editedAlbum.media_condition ?? null,
          sleeve_condition: editedAlbum.sleeve_condition ?? null,
          location: editedAlbum.location ?? null,
          purchase_price: editedAlbum.purchase_price ?? null,
          current_value: editedAlbum.current_value ?? null,
          purchase_date: editedAlbum.purchase_date ?? null,
          owner: editedAlbum.owner ?? null,
          date_added: editedAlbum.date_added ?? null,
          status,
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

            const recordingPayload = {
              title: trackTitle,
              duration_seconds: parseDurationToSeconds(track.duration),
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
                position: track.position,
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
          const releaseUpdate: Database['public']['Tables']['releases']['Update'] = {
            label: editedAlbum.label ?? null,
            catalog_number: editedAlbum.catalog_number ?? null,
            release_year: editedAlbum.year ? Number(editedAlbum.year) : null,
            barcode: editedAlbum.barcode ?? null,
            country: editedAlbum.country ?? null,
            discogs_release_id: editedAlbum.discogs_release_id ?? null,
            spotify_album_id: editedAlbum.spotify_album_id ?? null,
            qty: editedAlbum.sale_quantity ?? null,
          };

          const parsedFormat = editedAlbum.format
            ? parseDiscogsFormat(editedAlbum.format)
            : null;
          const resolvedMediaType = parsedFormat?.media_type ?? editedAlbum.release?.media_type ?? null;
          const resolvedFormatDetails = parsedFormat?.format_details ?? editedAlbum.release?.format_details ?? null;
          const resolvedQty = parsedFormat?.qty ?? editedAlbum.release?.qty ?? null;

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

          const creditsPayload = {
            album_people: {
              songwriters: editedAlbum.songwriters ?? [],
              producers: editedAlbum.producers ?? [],
              engineers: editedAlbum.engineers ?? [],
              musicians: editedAlbum.musicians ?? [],
            },
            classical: {
              composer: editedAlbum.composer ?? null,
              conductor: editedAlbum.conductor ?? null,
              chorus: editedAlbum.chorus ?? null,
              composition: editedAlbum.composition ?? null,
              orchestra: editedAlbum.orchestra ?? null,
            },
          };

          const { data: recordingRows, error: recordingRowsError } = await supabase
            .from('release_tracks')
            .select('recording_id')
            .eq('release_id', editedAlbum.release_id)
            .not('recording_id', 'is', null);

          if (recordingRowsError) {
            console.error('❌ Failed to load release recording IDs:', recordingRowsError);
            alert(`Failed to save credits: ${recordingRowsError.message}`);
            return;
          }

          const recordingIds = Array.from(
            new Set(
              (recordingRows ?? [])
                .map((row) => row.recording_id)
                .filter((id): id is number => typeof id === 'number')
            )
          );

          if (recordingIds.length > 0) {
            const { data: recordingsWithCredits, error: recordingsError } = await supabase
              .from('recordings')
              .select('id, credits')
              .in('id', recordingIds);

            if (recordingsError) {
              console.error('❌ Failed to load existing recording credits:', recordingsError);
              alert(`Failed to save credits: ${recordingsError.message}`);
              return;
            }

            for (const row of recordingsWithCredits ?? []) {
              const existing =
                row.credits && typeof row.credits === 'object' && !Array.isArray(row.credits)
                  ? (row.credits as Record<string, unknown>)
                  : {};
              const merged = {
                ...existing,
                album_people: creditsPayload.album_people,
                classical: creditsPayload.classical,
              };

              const { error: creditsError } = await supabase
                .from('recordings')
                .update({ credits: merged as unknown as Json })
                .eq('id', row.id);

              if (creditsError) {
                console.error('❌ Failed to update recording credits:', creditsError);
                alert(`Failed to save credits: ${creditsError.message}`);
                return;
              }
            }
          }
        }

        if (editedAlbum.master_id) {
          const masterUpdate: Database['public']['Tables']['masters']['Update'] = {
            title: editedAlbum.title ?? null,
            original_release_year: editedAlbum.year ? Number(editedAlbum.year) : null,
            genres: editedAlbum.genres ?? [],
            styles: editedAlbum.styles ?? [],
            cover_image_url: editedAlbum.image_url ?? null,
            discogs_master_id: editedAlbum.discogs_master_id ?? null,
            musicbrainz_release_group_id: editedAlbum.musicbrainz_release_group_id ?? null,
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

          const desiredTags = (editedAlbum.tags ?? [])
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
      <div className="bg-white rounded w-[90vw] max-w-[1100px] h-[85vh] flex flex-col overflow-hidden shadow-2xl">
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
        <div className="border-b border-gray-200 bg-white flex shrink-0 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.IconComponent;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 border-none bg-transparent text-[13px] cursor-pointer whitespace-nowrap flex items-center gap-1.5 font-sans transition-colors ${
                  activeTab === tab.id 
                    ? 'border-b-2 border-b-[#F7941D] text-gray-900 font-semibold' 
                    : 'border-b-2 border-b-transparent text-gray-500 font-normal hover:text-gray-700'
                }`}
              >
                <Icon />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-white relative">
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
