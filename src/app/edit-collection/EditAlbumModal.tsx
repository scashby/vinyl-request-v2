'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from 'lib/supabaseClient';
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

interface EditAlbumModalProps {
  albumId: number;
  onClose: () => void;
  onRefresh: () => void;
  onNavigate: (newAlbumId: number) => void;
  allAlbumIds: number[];
}

type InventoryRow = Database['public']['Tables']['inventory']['Row'];
type ReleaseRow = Database['public']['Tables']['releases']['Row'];
type MasterRow = Database['public']['Tables']['masters']['Row'];
type ArtistRow = Database['public']['Tables']['artists']['Row'];

type MasterTagLinkRow = {
  master_tags?: { name: string | null } | null;
};

type InventoryQueryRow = InventoryRow & {
  release?: (ReleaseRow & {
    master?: (MasterRow & {
      artist?: ArtistRow | null;
      master_tag_links?: MasterTagLinkRow[] | null;
    }) | null;
  }) | null;
};

export default function EditAlbumModal({ albumId, onClose, onRefresh, onNavigate, allAlbumIds }: EditAlbumModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('main');
  const [album, setAlbum] = useState<Album | null>(null);
  const [editedAlbum, setEditedAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mainTabRef = useRef<MainTabRef>(null);
  const tracksTabRef = useRef<TracksTabRef>(null);
  const releaseIdRef = useRef<number | null>(null);
  const masterIdRef = useRef<number | null>(null);

  // Location picker state (shared across all tabs)
  const [showLocationPicker, setShowLocationPicker] = useState(false);
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

  const mapInventoryToAlbum = (row: InventoryQueryRow): Album => {
    const release = row.release ?? null;
    const master = release?.master ?? null;
    const artist = master?.artist?.name ?? 'Unknown Artist';
    const label = release?.label ?? null;
    const tags = extractTagNames(master?.master_tag_links ?? null);
    const status = row.status ?? 'active';

    let collectionStatus: Album['collection_status'] = 'in_collection';
    if (status === 'wishlist') collectionStatus = 'wish_list';
    if (status === 'incoming') collectionStatus = 'on_order';
    if (status === 'sold') collectionStatus = 'sold';

    return {
      id: row.id,
      artist,
      secondary_artists: null,
      sort_artist: null,
      title: master?.title ?? 'Untitled',
      sort_title: null,
      year: master?.original_release_year ? String(master.original_release_year) : null,
      year_int: master?.original_release_year ?? null,
      image_url: master?.cover_image_url ?? null,
      back_image_url: null,
      index_number: null,
      collection_status: collectionStatus,
      for_sale: false,
      location: row.location ?? null,
      storage_device: null,
      storage_device_slot: null,
      slot: null,
      country: release?.country ?? null,
      studio: null,
      recording_location: null,
      date_added: row.date_added ?? null,
      modified_date: null,
      last_reviewed_at: null,
      decade: master?.original_release_year ? Math.floor(master.original_release_year / 10) * 10 : null,
      personal_notes: row.personal_notes ?? null,
      release_notes: release?.notes ?? null,
      extra: null,
      format: buildFormatLabel(release),
      media_condition: row.media_condition ?? '',
      package_sleeve_condition: row.sleeve_condition ?? null,
      barcode: release?.barcode ?? null,
      cat_no: release?.catalog_number ?? null,
      packaging: null,
      rpm: null,
      vinyl_weight: null,
      vinyl_color: null,
      discs: release?.qty ?? null,
      sides: null,
      length_seconds: null,
      sound: null,
      spars_code: null,
      is_live: null,
      is_box_set: null,
      box_set: null,
      time_signature: null,
      tracks: null,
      discogs_id: null,
      discogs_release_id: release?.discogs_release_id ?? null,
      discogs_master_id: master?.discogs_master_id ?? null,
      spotify_id: null,
      spotify_url: null,
      spotify_album_id: release?.spotify_album_id ?? null,
      apple_music_id: null,
      apple_music_url: null,
      musicbrainz_id: null,
      musicbrainz_url: null,
      lastfm_id: null,
      lastfm_url: null,
      allmusic_id: null,
      allmusic_url: null,
      wikipedia_url: null,
      dbpedia_uri: null,
      original_release_date: null,
      original_release_year: master?.original_release_year ?? null,
      recording_date: null,
      recording_year: null,
      master_release_date: release?.release_date ?? null,
      genres: master?.genres ?? null,
      styles: master?.styles ?? null,
      custom_tags: tags.length > 0 ? tags : null,
      labels: label ? [label] : null,
      enrichment_sources: null,
      finalized_fields: null,
      musicians: null,
      producers: null,
      engineers: null,
      songwriters: null,
      writers: null,
      chorus: null,
      composer: null,
      composition: null,
      conductor: null,
      orchestra: null,
      owner: row.owner ?? null,
      due_date: null,
      loan_date: null,
      loaned_to: null,
      last_cleaned_date: null,
      last_played_date: null,
      play_count: row.play_count ?? null,
      my_rating: null,
      signed_by: null,
      purchase_price: row.purchase_price ?? null,
      current_value: row.current_value ?? null,
      purchase_date: row.purchase_date ?? null,
      purchase_store: null,
      sale_price: null,
      sell_price: null,
      sale_platform: null,
      sale_quantity: null,
      sale_notes: null,
      wholesale_cost: null,
      pricing_notes: null,
      subtitle: null,
      played_history: null,
      blocked: null,
      blocked_sides: null,
      blocked_tracks: null,
      disc_metadata: null,
      matrix_numbers: null,
      inner_sleeve_images: null,
      enriched_metadata: null,
      cultural_significance: null,
      tempo_bpm: null,
      musical_key: null,
      energy: null,
      danceability: null,
      valence: null,
    };
  };

  // Load locations on mount
  useEffect(() => {
    const loadLocations = async () => {
      const locationsData = await fetchLocations();
      setLocations(locationsData);
    };
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
          .select(`
            id,
            status,
            location,
            media_condition,
            sleeve_condition,
            date_added,
            purchase_price,
            current_value,
            purchase_date,
            owner,
            personal_notes,
            play_count,
            release:releases (
              id,
              media_type,
              format_details,
              qty,
              label,
              catalog_number,
              barcode,
              country,
              release_date,
              discogs_release_id,
              spotify_album_id,
              notes,
              master:masters (
                id,
                title,
                original_release_year,
                cover_image_url,
                discogs_master_id,
                genres,
                styles,
                artist:artists (
                  name
                ),
                master_tag_links (
                  master_tags (
                    name
                  )
                )
              )
            )
          `)
          .eq('id', albumId)
          .single();
        
        if (fetchError) {
          console.error('Error fetching album:', fetchError);
          setError('Failed to load album data');
          return;
        }
        
        if (data) {
          const row = data as InventoryQueryRow;
          releaseIdRef.current = row.release?.id ?? null;
          masterIdRef.current = row.release?.master?.id ?? null;
          const mapped = mapInventoryToAlbum(row);
          setAlbum(mapped);
          setEditedAlbum(mapped);
        } else {
          setError('Album not found');
        }
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
      
      // 1. Get tracks data from TracksTab (if available)
      const tracksData = tracksTabRef.current?.getTracksData();
      console.log('📊 Tracks data:', tracksData);
      
      const inventoryUpdate = {
        location: editedAlbum.location ?? null,
        media_condition: editedAlbum.media_condition ?? null,
        sleeve_condition: editedAlbum.package_sleeve_condition ?? null,
        date_added: editedAlbum.date_added ?? null,
        purchase_price: editedAlbum.purchase_price ?? null,
        current_value: editedAlbum.current_value ?? null,
        purchase_date: editedAlbum.purchase_date ?? null,
        owner: editedAlbum.owner ?? null,
        personal_notes: editedAlbum.personal_notes ?? null,
        play_count: editedAlbum.play_count ?? null,
      };

      const releaseUpdate = {
        label: editedAlbum.labels?.[0] ?? null,
        catalog_number: editedAlbum.cat_no ?? null,
        barcode: editedAlbum.barcode ?? null,
        country: editedAlbum.country ?? null,
        release_date: editedAlbum.master_release_date ?? null,
        notes: editedAlbum.release_notes ?? null,
        qty: editedAlbum.discs ?? null,
      };

      const masterUpdate = {
        title: editedAlbum.title ?? null,
        original_release_year: editedAlbum.original_release_year ?? (editedAlbum.year_int ?? null),
        cover_image_url: editedAlbum.image_url ?? null,
        genres: editedAlbum.genres ?? null,
        styles: editedAlbum.styles ?? null,
      };

      const { error: inventoryError } = await supabase
        .from('inventory')
        .update(inventoryUpdate)
        .eq('id', albumId);

      if (inventoryError) {
        console.error('❌ Failed to update inventory:', inventoryError);
        alert(`Failed to save album: ${inventoryError.message}`);
        return;
      }

      if (releaseIdRef.current) {
        const { error: releaseError } = await supabase
          .from('releases')
          .update(releaseUpdate)
          .eq('id', releaseIdRef.current);
        if (releaseError) {
          console.error('❌ Failed to update release:', releaseError);
          alert(`Failed to save release: ${releaseError.message}`);
          return;
        }
      }

      if (masterIdRef.current) {
        const { error: masterError } = await supabase
          .from('masters')
          .update(masterUpdate)
          .eq('id', masterIdRef.current);
        if (masterError) {
          console.error('❌ Failed to update master:', masterError);
          alert(`Failed to save master: ${masterError.message}`);
          return;
        }
      }
      
      if (tracksData && tracksData.tracks.length > 0) {
        console.warn('Track syncing to V3 release_tracks is not implemented yet.');
      }
      
      console.log('✅ Save complete!');
      onRefresh(); // Notify parent to refresh data
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
              // TODO: Open manage locations modal
              alert('Manage locations will be implemented');
            }}
            onNew={() => {
              // TODO: Open new location modal
              alert('New location will be implemented');
            }}
            searchPlaceholder="Search locations..."
            itemLabel="Location"
            showSortName={false}
          />
        )}
      </div>
    </div>
  );
}
