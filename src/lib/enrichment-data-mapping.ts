// src/lib/enrichment-data-mapping.ts
/**
 * COMPLETE ENRICHMENT SYSTEM - DATA TO SERVICE MAPPING
 * Authoritative source for enrichment architecture
 * * ARCHITECTURE PRINCIPLES:
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
  | 'wikipedia'
  | 'discogs'
  | 'genius'
  | 'secondhandsongs'
  | 'theaudiodb'
  | 'rateyourmusic'
  | 'setlistfm'
  | 'wikidata'
  | 'fanarttv'
  | 'deezer'
  | 'musixmatch'
  | 'popsike'
  | 'pitchfork';

/**
 * Maps data categories to the services that can provide that data
 */
export const DATA_TO_SERVICES: Record<DataCategory, EnrichmentService[]> = {
  artwork: ['coverArtArchive', 'discogs', 'spotify', 'appleMusic', 'lastfm', 'theaudiodb', 'fanarttv', 'deezer'],
  credits: ['musicbrainz', 'appleMusic', 'discogs', 'wikidata'],
  tracklists: ['discogs', 'musicbrainz', 'spotify', 'appleMusic', 'lastfm', 'setlistfm', 'deezer'],
  // NOTE: acousticbrainz is not implemented in the current fetch pipeline.
  sonic_domain: [
    'spotify',
    'musicbrainz',
    'secondhandsongs',
  ],
  genres: ['discogs', 'spotify', 'appleMusic', 'lastfm', 'musicbrainz', 'rateyourmusic', 'theaudiodb', 'deezer'],
  streaming_links: [
    'spotify',
    'appleMusic',
    'lastfm',
    'musicbrainz',
    'wikipedia',
    'secondhandsongs',
    'setlistfm',
    'deezer',
    'musixmatch',
  ],
  reviews: ['lastfm', 'spotify', 'appleMusic', 'wikipedia', 'rateyourmusic', 'pitchfork'],
  // NOTE: billboard is not implemented in the current fetch pipeline.
  chart_data: ['wikipedia', 'rateyourmusic', 'wikidata'],
  release_metadata: ['musicbrainz', 'discogs', 'spotify', 'appleMusic', 'wikipedia', 'wikidata', 'popsike'],
  lyrics: ['genius', 'musixmatch'],
  similar_albums: ['lastfm'],
  cultural_context: ['wikipedia', 'wikidata', 'appleMusic'],
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
  sonic_domain: 'BPM, Key, Cover Songs, and Original Artist data',
  genres: 'Genre classifications, styles, moods, and folksonomy tags',
  streaming_links: 'Service IDs and links (Spotify, Apple, etc)',
  reviews: 'Professional reviews, ratings, playcounts, popularity scores, and editorial notes',
  chart_data: 'Chart positions, sales certifications (Gold/Platinum/Diamond), and awards',
  release_metadata: 'Labels, catalog numbers, barcodes, countries, release dates, release notes, and companies',
  lyrics: 'Song lyrics and Genius annotations with URLs',
  similar_albums: 'Algorithmically generated similar album recommendations',
  cultural_context: 'Historical significance, cultural impact, and master-level notes from Wikipedia',
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
    'songwriters'
  ],
  tracklists: [
    'tracks',
    'tracklists',
    'tracklist',
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
    // intentionally excludes samples/sampled_by (WhoSampled removed from enrichment)
  ],
  genres: [
    'genres',
    'styles',
    'tags'
  ],
  streaming_links: [
    'spotify_id',
    'apple_music_id',
    'lastfm_id',
    'musicbrainz_id',
    'wikipedia_url',
    'discogs_release_id',
    'discogs_master_id'
  ],
  reviews: [
    'critical_reception',
    'apple_music_editorial_notes',
    'pitchfork_score'
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
    'release_notes'
  ],
  lyrics: [
    'tracks.lyrics_url',
    'tracks.lyrics'
  ],
  similar_albums: [
    'lastfm_similar_albums'
  ],
  cultural_context: [
    'cultural_significance',
    'recording_location',
    'critical_reception',
    'master_notes',
    'wikipedia_url'
  ],
};

/**
 * Complete field to service mapping
 * Shows which services write to which database fields
 */
export const FIELD_TO_SERVICES: Record<string, EnrichmentService[]> = {
  // --- ARTWORK ---
  'image_url': ['coverArtArchive', 'discogs', 'spotify', 'appleMusic', 'lastfm', 'theaudiodb', 'fanarttv', 'deezer'],
  'back_image_url': ['coverArtArchive', 'discogs', 'theaudiodb'],
  'spine_image_url': ['coverArtArchive', 'discogs'],
  'inner_sleeve_images': ['coverArtArchive', 'discogs', 'theaudiodb', 'fanarttv'],
  'vinyl_label_images': ['coverArtArchive', 'discogs'],
  
  // --- CREDITS ---
  'musicians': ['musicbrainz', 'discogs'],
  'producers': ['musicbrainz', 'discogs'],
  'engineers': ['musicbrainz', 'discogs'],
  'songwriters': ['musicbrainz', 'discogs'],
  'composer': ['musicbrainz', 'appleMusic'],
  'conductor': ['musicbrainz'],
  'orchestra': ['musicbrainz'],
  'chorus': ['musicbrainz'],
  
  // --- TRACKLISTS ---
  'tracks': ['discogs', 'musicbrainz', 'spotify', 'appleMusic', 'lastfm'],
  'tracklists': ['discogs', 'musicbrainz', 'spotify', 'appleMusic'],
  'tracklist': ['discogs', 'musicbrainz', 'spotify', 'appleMusic', 'lastfm'],
  'disc_metadata': ['discogs'],

  // --- SONIC DOMAIN ---
  'is_cover': ['musicbrainz', 'discogs', 'secondhandsongs'],
  'original_artist': ['musicbrainz', 'discogs', 'secondhandsongs'],
  'original_year': ['musicbrainz', 'discogs', 'secondhandsongs'],
  'samples': [],
  'sampled_by': [],
  
  // --- AUDIO ANALYSIS ---
  'tempo_bpm': ['spotify'],
  'musical_key': ['spotify'],
  'time_signature': ['spotify'],
  'danceability': ['spotify'],
  'energy': ['spotify'],
  'mood_acoustic': ['spotify'],
  'mood_happy': ['spotify'],
  'mood_sad': ['spotify'],
  'mood_party': ['spotify'],
  'mood_relaxed': ['spotify'],
  'mood_aggressive': ['spotify'],
  'mood_electronic': ['spotify'],
  
  // --- GENRES & TAGS ---
  'genres': ['discogs', 'spotify', 'appleMusic', 'lastfm', 'musicbrainz', 'rateyourmusic', 'theaudiodb', 'deezer'],
  'styles': ['discogs', 'lastfm', 'theaudiodb'],
  'tags': ['lastfm', 'discogs', 'musicbrainz'], // Generic bucket
  
  // --- METADATA ---
  'original_release_date': ['musicbrainz', 'discogs', 'spotify', 'appleMusic', 'theaudiodb', 'deezer'],
  'labels': ['musicbrainz', 'discogs', 'spotify', 'appleMusic', 'theaudiodb', 'deezer'],
  'cat_no': ['musicbrainz', 'discogs'],
  'barcode': ['musicbrainz', 'discogs', 'deezer'],
  'country': ['musicbrainz', 'discogs', 'theaudiodb'],
  'recording_date': ['musicbrainz', 'wikipedia'],
  'master_release_date': ['discogs'],
  'studio': [],
  'companies': ['musicbrainz', 'discogs', 'spotify'],
  
  // --- CONTEXT ---
  'notes': ['wikipedia', 'discogs', 'appleMusic'],
  'release_notes': ['musicbrainz', 'discogs'],
  'master_notes': ['wikipedia', 'appleMusic'],
  'wikipedia_url': ['wikipedia'],
  'cultural_significance': ['wikipedia'],
  'recording_location': ['musicbrainz', 'wikipedia', 'wikidata'],
  'critical_reception': ['wikipedia'],
  'apple_music_editorial_notes': ['appleMusic'],
  
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
  'tracks.lyrics_url': ['genius'],

  // --- SIMILAR ALBUMS ---
  'lastfm_similar_albums': ['lastfm'],

  // --- REVIEWS & CHARTS (Newly Added) ---
  'pitchfork_score': ['pitchfork'],
  'awards': ['wikipedia', 'wikidata'],
  'certifications': ['wikipedia', 'wikidata']
  ,
  'chart_positions': ['wikipedia', 'wikidata']
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
  wikipedia: 'Wikipedia',
  discogs: 'Discogs',
  genius: 'Genius',
  secondhandsongs: 'SecondHandSongs',
  theaudiodb: 'TheAudioDB',
  rateyourmusic: 'Rate Your Music',
  setlistfm: 'Setlist.fm',
  wikidata: 'Wikidata',
  fanarttv: 'Fanart.tv',
  deezer: 'Deezer',
  musixmatch: 'Musixmatch',
  popsike: 'Popsike',
  pitchfork: 'Pitchfork'
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
  wikipedia: '📖',
  discogs: '💿',
  genius: '📝',
  secondhandsongs: '♻️',
  theaudiodb: '🔊',
  rateyourmusic: '📈',
  setlistfm: '🎤',
  wikidata: '🌐',
  fanarttv: '🎨',
  deezer: '⚡',
  musixmatch: '🎤',
  popsike: '💲',
  pitchfork: '⚡'
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
    wikipedia: false,
    wikidata: false,
    coverArtArchive: false,
    acousticbrainz: false,
    discogsMetadata: false,
    discogsTracklist: false,
    genius: false,
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
        case 'wikipedia': services.wikipedia = true; break;
        case 'wikidata': services.wikidata = true; break;
        case 'discogs': 
          services.discogsMetadata = true;
          services.discogsTracklist = true;
          break;
        case 'genius': services.genius = true; break;
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
// AUDIT: inspected, no changes.
