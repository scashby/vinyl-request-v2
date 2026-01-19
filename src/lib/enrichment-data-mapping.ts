// src/lib/enrichment-data-mapping.ts
/**
 * COMPLETE ENRICHMENT SYSTEM - DATA TO SERVICE MAPPING
 * Authoritative source for enrichment architecture
 * 
 * ARCHITECTURE PRINCIPLES:
 * 1. CANONICAL fields (musicians, image_url, tempo_bpm) - all services merge here
 * 2. SERVICE-SPECIFIC fields (spotify_id, discogs_genres) - unique per service
 * 3. Stats check ACTUAL DATA not service presence
 */

export type DataCategory = 
  | 'artwork'
  | 'credits'
  | 'tracklists'
  | 'sonic_domain'
  | 'genres'
  | 'streaming_links'
  | 'reviews'
  | 'chart_data'
  | 'release_metadata'
  | 'lyrics'
  | 'similar_albums'
  | 'cultural_context';

export type EnrichmentService = 
  | 'musicbrainz'
  | 'coverArtArchive'
  | 'acousticbrainz'
  | 'lastfm'
  | 'spotify'
  | 'appleMusic'
  | 'allmusic'
  | 'wikipedia'
  | 'discogs'
  | 'genius'
  | 'whosampled'
  | 'secondhandsongs'
  | 'theaudiodb'
  | 'rateyourmusic'
  | 'setlistfm'
  | 'wikidata';

/**
 * Maps data categories to the services that can provide that data
 */
export const DATA_TO_SERVICES: Record<DataCategory, EnrichmentService[]> = {
  artwork: ['coverArtArchive', 'musicbrainz', 'discogs', 'spotify', 'appleMusic', 'lastfm', 'theaudiodb'],
  credits: ['musicbrainz', 'allmusic', 'appleMusic', 'discogs', 'genius', 'wikidata'],
  tracklists: ['discogs', 'spotify', 'appleMusic', 'lastfm', 'setlistfm'],
  sonic_domain: ['acousticbrainz', 'musicbrainz', 'spotify', 'whosampled', 'secondhandsongs'],
  genres: ['discogs', 'spotify', 'appleMusic', 'allmusic', 'lastfm', 'musicbrainz', 'rateyourmusic', 'theaudiodb'],
  streaming_links: ['spotify', 'appleMusic', 'lastfm', 'musicbrainz', 'allmusic', 'wikipedia', 'whosampled', 'secondhandsongs', 'setlistfm'],
  reviews: ['allmusic', 'lastfm', 'spotify', 'appleMusic', 'wikipedia', 'rateyourmusic'],
  chart_data: ['wikipedia', 'rateyourmusic'],
  release_metadata: ['musicbrainz', 'discogs', 'spotify', 'appleMusic', 'wikipedia', 'wikidata'],
  lyrics: ['genius'],
  similar_albums: ['lastfm', 'allmusic', 'rateyourmusic'],
  cultural_context: ['wikipedia', 'wikidata'],
};

/**
 * Human-readable labels for data categories
 */
export const DATA_CATEGORY_LABELS: Record<DataCategory, string> = {
  artwork: 'Album Artwork',
  credits: 'Album Credits',
  tracklists: 'Track Listings',
  sonic_domain: 'Sonic Domain (Audio & Covers)',
  genres: 'Genres, Styles & Tags',
  streaming_links: 'Streaming Links',
  reviews: 'Reviews & Ratings',
  chart_data: 'Chart Positions & Awards',
  release_metadata: 'Release Metadata',
  lyrics: 'Lyrics & Annotations',
  similar_albums: 'Similar Albums',
  cultural_context: 'Cultural Context',
};

/**
 * Detailed descriptions for data categories
 */
export const DATA_CATEGORY_DESCRIPTIONS: Record<DataCategory, string> = {
  artwork: 'Front cover, back cover, spine, inner sleeves, and vinyl label images',
  credits: 'Musicians, producers, engineers, songwriters, composers, and conductors',
  tracklists: 'Complete track listings with durations, ISRCs, and per-track artists',
  sonic_domain: 'BPM, Key, Cover Songs, Original Artists, Samples, and Remix data',
  genres: 'Genre classifications, styles, moods, and folksonomy tags',
  streaming_links: 'Service IDs and links (Spotify, Apple, WhoSampled, SecondHandSongs, etc)',
  reviews: 'Professional reviews, ratings, playcounts, popularity scores, and editorial notes',
  chart_data: 'Chart positions, sales certifications (Gold/Platinum/Diamond), and awards',
  release_metadata: 'Labels, catalog numbers, barcodes, countries, release dates, notes, and companies',
  lyrics: 'Song lyrics and Genius annotations with URLs',
  similar_albums: 'Algorithmically generated similar album recommendations',
  cultural_context: 'Historical significance, cultural impact, and recording locations from Wikipedia',
};

/**
 * Icons for data categories (for UI display)
 */
export const DATA_CATEGORY_ICONS: Record<DataCategory, string> = {
  artwork: '🖼️',
  credits: '👥',
  tracklists: '📝',
  sonic_domain: '🎹',
  genres: '🏷️',
  streaming_links: '🔗',
  reviews: '⭐',
  chart_data: '📊',
  release_metadata: '💿',
  lyrics: '📄',
  similar_albums: '🔄',
  cultural_context: '🏛️',
};

/**
 * Database fields to check for each data category
 * Used by stats endpoint to count missing data
 */
export const DATA_CATEGORY_CHECK_FIELDS: Record<DataCategory, string[]> = {
  artwork: [
    'image_url',
    'back_image_url',
    'spine_image_url',
    'inner_sleeve_images',
    'vinyl_label_images'
  ],
  credits: [
    'musicians',
    'producers',
    'engineers',
    'songwriters',
    'composer',
    'conductor',
    'orchestra',
    'chorus'
  ],
  tracklists: [
    'tracks',
    'tracklists',
    'disc_metadata'
  ],
  sonic_domain: [
    'tempo_bpm',
    'musical_key',
    'time_signature',
    'danceability',
    'energy',
    'mood_acoustic',
    'mood_happy',
    'mood_sad',
    // Sonic Domain
    'is_cover',
    'original_artist',
    'original_year',
    'samples',
    'sampled_by'
  ],
  genres: [
    'genres',
    'styles',
    'tags', // Generic Bucket
    'discogs_genres',
    'spotify_genres',
    'apple_music_genres',
    'allmusic_styles'
  ],
  streaming_links: [
    'spotify_id',
    'apple_music_id',
    'lastfm_id',
    'musicbrainz_id',
    'allmusic_id',
    'wikipedia_url',
    'discogs_release_id',
    'discogs_master_id'
  ],
  reviews: [
    'allmusic_rating',
    'allmusic_review',
    'lastfm_playcount',
    'lastfm_listeners',
    'spotify_popularity',
    'critical_reception',
    'apple_music_editorial_notes'
  ],
  chart_data: [
    'chart_positions',
    'certifications',
    'awards'
  ],
  release_metadata: [
    'labels',
    'cat_no',
    'barcode',
    'country',
    'recording_date',
    'original_release_date',
    'studio',
    'recording_location',
    'companies',
    'notes'
  ],
  lyrics: [
    'tracks.lyrics_url',
    'tracks.lyrics'
  ],
  similar_albums: [
    'lastfm_similar_albums',
    'allmusic_similar_albums'
  ],
  cultural_context: [
    'cultural_significance',
    'recording_location',
    'critical_reception',
    'notes', // Maps to Wikipedia Summaries
    'wikipedia_url'
  ],
};

/**
 * Complete field to service mapping
 * Shows which services write to which database fields
 */
export const FIELD_TO_SERVICES: Record<string, EnrichmentService[]> = {
  // --- ARTWORK ---
  'image_url': ['coverArtArchive', 'musicbrainz', 'discogs', 'spotify', 'appleMusic', 'lastfm'],
  'back_image_url': ['coverArtArchive', 'musicbrainz', 'discogs'],
  'spine_image_url': ['coverArtArchive', 'musicbrainz', 'discogs'],
  'inner_sleeve_images': ['coverArtArchive', 'musicbrainz', 'discogs'],
  'vinyl_label_images': ['coverArtArchive', 'musicbrainz', 'discogs'],
  
  // --- CREDITS ---
  'musicians': ['musicbrainz', 'discogs', 'allmusic'],
  'producers': ['musicbrainz', 'discogs', 'allmusic'],
  'engineers': ['musicbrainz', 'discogs', 'allmusic'],
  'songwriters': ['musicbrainz', 'allmusic', 'genius', 'discogs'],
  'composer': ['musicbrainz', 'appleMusic', 'allmusic'],
  'conductor': ['musicbrainz'],
  'orchestra': ['musicbrainz'],
  'chorus': ['musicbrainz'],
  
  // --- TRACKLISTS ---
  'tracks': ['discogs', 'spotify', 'appleMusic', 'lastfm'],
  'tracklists': ['discogs', 'spotify', 'appleMusic'],
  'disc_metadata': ['discogs'],

  // --- SONIC DOMAIN ---
  'is_cover': ['musicbrainz', 'discogs', 'secondhandsongs'],
  'original_artist': ['musicbrainz', 'discogs', 'secondhandsongs'],
  'original_year': ['musicbrainz', 'discogs', 'secondhandsongs'],
  'samples': ['whosampled'],
  'sampled_by': ['whosampled'],
  
  // --- AUDIO ANALYSIS ---
  'tempo_bpm': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'musical_key': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'time_signature': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'danceability': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'energy': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'mood_acoustic': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'mood_happy': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'mood_sad': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'mood_party': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'mood_relaxed': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'mood_aggressive': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'mood_electronic': ['acousticbrainz', 'musicbrainz', 'spotify'],
  
  // --- GENRES & TAGS ---
  'genres': ['discogs', 'spotify', 'appleMusic', 'lastfm', 'allmusic'],
  'styles': ['discogs', 'lastfm', 'allmusic'],
  'tags': ['lastfm', 'discogs', 'musicbrainz'], // Generic bucket
  
  // --- METADATA ---
  'original_release_date': ['musicbrainz', 'discogs', 'spotify', 'appleMusic'],
  'labels': ['musicbrainz', 'discogs', 'spotify', 'appleMusic'],
  'cat_no': ['musicbrainz', 'discogs'],
  'barcode': ['musicbrainz', 'discogs'],
  'country': ['musicbrainz', 'discogs'],
  'recording_date': ['musicbrainz'],
  'master_release_date': ['discogs'],
  'studio': ['musicbrainz'],
  'companies': ['discogs'],
  
  // --- CONTEXT ---
  'notes': ['wikipedia', 'discogs', 'appleMusic'],
  'wikipedia_url': ['wikipedia'],
  'cultural_significance': ['wikipedia'],
  'critical_reception': ['wikipedia'],
  
  // --- LINKS ---
  'spotify_id': ['spotify'],
  'apple_music_id': ['appleMusic'],
  'lastfm_id': ['lastfm'],
  'musicbrainz_id': ['musicbrainz'],
  'discogs_release_id': ['discogs'],
  'discogs_master_id': ['discogs'],
  'genius_url': ['genius'],

  // --- LYRICS ---
  'tracks.lyrics': ['genius'],
  'tracks.lyrics_url': ['genius']
};

/**
 * Service display names for UI
 */
export const SERVICE_DISPLAY_NAMES: Record<EnrichmentService, string> = {
  musicbrainz: 'MusicBrainz',
  coverArtArchive: 'Cover Art Archive',
  acousticbrainz: 'AcousticBrainz',
  lastfm: 'Last.fm',
  spotify: 'Spotify',
  appleMusic: 'Apple Music',
  allmusic: 'AllMusic',
  wikipedia: 'Wikipedia',
  discogs: 'Discogs',
  genius: 'Genius',
  whosampled: 'WhoSampled',
  secondhandsongs: 'SecondHandSongs',
  theaudiodb: 'TheAudioDB',
  rateyourmusic: 'Rate Your Music',
  setlistfm: 'Setlist.fm',
  wikidata: 'Wikidata'
};

/**
 * Service icons for UI
 */
export const SERVICE_ICONS: Record<EnrichmentService, string> = {
  musicbrainz: '🎼',
  coverArtArchive: '🖼️',
  acousticbrainz: '🎵',
  lastfm: '📻',
  spotify: '🎧',
  appleMusic: '🍎',
  allmusic: '⭐',
  wikipedia: '📖',
  discogs: '💿',
  genius: '📝',
  whosampled: '✂️',
  secondhandsongs: '♻️',
  theaudiodb: '🔊',
  rateyourmusic: '📈',
  setlistfm: '🎤',
  wikidata: '🌐'
};

/**
 * Convert selected data categories to service boolean flags
 * Used by enrichment modal to determine which services to call
 */
export function dataCategoriesToServices(
  categories: DataCategory[]
): Record<string, boolean> {
  const services: Record<string, boolean> = {
    musicbrainz: false,
    lastfm: false,
    spotifyEnhanced: false,
    appleMusicEnhanced: false,
    allmusic: false,
    wikipedia: false,
    coverArtArchive: false,
    acousticbrainz: false,
    discogsMetadata: false,
    discogsTracklist: false,
    genius: false,
    whosampled: false,
    secondhandsongs: false
  };

  categories.forEach(category => {
    const requiredServices = DATA_TO_SERVICES[category];
    
    requiredServices.forEach(service => {
      switch (service) {
        case 'musicbrainz': services.musicbrainz = true; break;
        case 'coverArtArchive': services.coverArtArchive = true; break;
        case 'acousticbrainz': services.acousticbrainz = true; break;
        case 'lastfm': services.lastfm = true; break;
        case 'spotify': services.spotifyEnhanced = true; break;
        case 'appleMusic': services.appleMusicEnhanced = true; break;
        case 'allmusic': services.allmusic = true; break;
        case 'wikipedia': services.wikipedia = true; break;
        case 'discogs': 
          services.discogsMetadata = true;
          services.discogsTracklist = true;
          break;
        case 'genius': services.genius = true; break;
        case 'whosampled': services.whosampled = true; break;
        case 'secondhandsongs': services.secondhandsongs = true; break;
      }
    });
  });

  return services;
}

/**
 * Get all unique services for given categories
 */
export function getServicesForCategories(categories: DataCategory[]): EnrichmentService[] {
  const servicesSet = new Set<EnrichmentService>();
  
  categories.forEach(category => {
    DATA_TO_SERVICES[category].forEach(service => {
      servicesSet.add(service);
    });
  });
  
  return Array.from(servicesSet);
}

/**
 * Get human-readable service list for categories
 */
export function getServiceNamesForCategories(categories: DataCategory[]): string[] {
  const services = getServicesForCategories(categories);
  return services.map(service => SERVICE_DISPLAY_NAMES[service]);
}

/**
 * Check if a field is canonical or service-specific
 */
export function isCanonicalField(fieldName: string): boolean {
  const canonicalFields = [
    'musicians', 'producers', 'engineers', 'songwriters', 'composer', 'conductor', 'orchestra', 'chorus',
    'image_url', 'back_image_url', 'spine_image_url', 'inner_sleeve_images', 'vinyl_label_images',
    'tracks', 'tracklists', 'disc_metadata',
    'tempo_bpm', 'musical_key', 'time_signature', 'danceability', 'energy',
    'mood_acoustic', 'mood_aggressive', 'mood_electronic', 'mood_happy', 'mood_party', 'mood_relaxed', 'mood_sad',
    'labels', 'cat_no', 'barcode', 'country', 'recording_date', 'original_release_date', 'studio'
  ];
  
  return canonicalFields.includes(fieldName);
}

/**
 * Get the category for a given field
 */
export function getFieldCategory(fieldName: string): DataCategory | null {
  for (const [category, fields] of Object.entries(DATA_CATEGORY_CHECK_FIELDS)) {
    if (fields.includes(fieldName)) {
      return category as DataCategory;
    }
  }
  return null;
}