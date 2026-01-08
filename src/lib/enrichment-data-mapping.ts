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
  | 'audio_analysis'
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
  | 'genius';

/**
 * Maps data categories to the services that can provide that data
 */
export const DATA_TO_SERVICES: Record<DataCategory, EnrichmentService[]> = {
  artwork: ['coverArtArchive', 'musicbrainz', 'discogs', 'spotify', 'appleMusic', 'lastfm'],
  credits: ['musicbrainz', 'allmusic', 'appleMusic', 'discogs', 'genius'],
  tracklists: ['discogs', 'spotify', 'appleMusic', 'lastfm'],
  audio_analysis: ['acousticbrainz', 'musicbrainz', 'spotify'],
  genres: ['discogs', 'spotify', 'appleMusic', 'allmusic', 'lastfm'],
  streaming_links: ['spotify', 'appleMusic', 'lastfm', 'musicbrainz', 'allmusic', 'wikipedia'],
  reviews: ['allmusic', 'lastfm', 'spotify', 'appleMusic', 'wikipedia'],
  chart_data: ['wikipedia'],
  release_metadata: ['musicbrainz', 'discogs', 'spotify', 'appleMusic', 'wikipedia'],
  lyrics: ['genius'],
  similar_albums: ['lastfm', 'allmusic'],
  cultural_context: ['wikipedia'],
};

/**
 * Human-readable labels for data categories
 */
export const DATA_CATEGORY_LABELS: Record<DataCategory, string> = {
  artwork: 'Album Artwork',
  credits: 'Album Credits',
  tracklists: 'Track Listings',
  audio_analysis: 'Audio Analysis',
  genres: 'Genres & Tags',
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
  audio_analysis: 'Tempo (BPM), musical key, time signature, danceability, energy, and mood analysis',
  genres: 'Genre classifications, styles, moods, and tags from multiple sources',
  streaming_links: 'Service IDs and links (Spotify, Apple Music, Last.fm, MusicBrainz, AllMusic, Wikipedia)',
  reviews: 'Professional reviews, ratings, playcounts, popularity scores, and editorial notes',
  chart_data: 'Chart positions, sales certifications (Gold/Platinum/Diamond), and awards',
  release_metadata: 'Labels, catalog numbers, barcodes, countries, release dates, and recording studios',
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
  audio_analysis: '🎵',
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
  audio_analysis: [
    'tempo_bpm',
    'musical_key',
    'time_signature',
    'danceability',
    'energy',
    'mood_acoustic',
    'mood_happy',
    'mood_sad'
  ],
  genres: [
    'genres', // Canonical
    'styles', // Canonical
    'discogs_genres',
    'spotify_genres',
    'apple_music_genres',
    'lastfm_tags',
    'allmusic_styles'
  ],
  streaming_links: [
    'spotify_id',
    'apple_music_id',
    'lastfm_id',
    'musicbrainz_id',
    'allmusic_id',
    'wikipedia_url'
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
    'recording_location'
  ],
  lyrics: [
    'tracks.lyrics_url', // Special case - checked in track array
    'tracks.lyrics'
  ],
  similar_albums: [
    'lastfm_similar_albums',
    'allmusic_similar_albums'
  ],
  cultural_context: [
    'cultural_significance',
    'recording_location',
    'critical_reception'
  ],
};

/**
 * Complete field to service mapping
 * Shows which services write to which database fields
 */
export const FIELD_TO_SERVICES: Record<string, EnrichmentService[]> = {
  // CANONICAL ARTWORK
  'image_url': ['coverArtArchive', 'musicbrainz', 'discogs', 'spotify', 'appleMusic', 'lastfm'],
  'back_image_url': ['coverArtArchive', 'musicbrainz', 'discogs'],
  'spine_image_url': ['coverArtArchive', 'musicbrainz'],
  'inner_sleeve_images': ['coverArtArchive', 'musicbrainz'],
  'vinyl_label_images': ['coverArtArchive', 'musicbrainz'],
  
  // SERVICE-SPECIFIC ARTWORK
  'spotify_image_url': ['spotify'],
  'apple_music_artwork_url': ['appleMusic'],
  
  // CANONICAL CREDITS
  'musicians': ['musicbrainz', 'allmusic'],
  'producers': ['musicbrainz', 'allmusic'],
  'engineers': ['musicbrainz', 'allmusic'],
  'songwriters': ['musicbrainz', 'allmusic', 'genius'],
  'composer': ['musicbrainz', 'appleMusic', 'allmusic'],
  'conductor': ['musicbrainz'],
  'orchestra': ['musicbrainz'],
  'chorus': ['musicbrainz'],
  
  // SERVICE-SPECIFIC CREDITS
  'allmusic_credits': ['allmusic'],
  'apple_music_composer': ['appleMusic'],
  
  // CANONICAL TRACKLISTS
  'tracks': ['discogs', 'lastfm'],
  'tracklists': ['discogs'],
  'disc_metadata': ['discogs'],
  
  // SERVICE-SPECIFIC TRACKLISTS
  'spotify_tracks': ['spotify'],
  'apple_music_tracks': ['appleMusic'],
  
  // CANONICAL AUDIO ANALYSIS
  'tempo_bpm': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'musical_key': ['acousticbrainz', 'musicbrainz'],
  'time_signature': ['acousticbrainz', 'musicbrainz'],
  'danceability': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'energy': ['acousticbrainz', 'musicbrainz', 'spotify'],
  'mood_acoustic': ['acousticbrainz', 'musicbrainz'],
  'mood_aggressive': ['acousticbrainz', 'musicbrainz'],
  'mood_electronic': ['acousticbrainz', 'musicbrainz'],
  'mood_happy': ['acousticbrainz', 'musicbrainz'],
  'mood_party': ['acousticbrainz', 'musicbrainz'],
  'mood_relaxed': ['acousticbrainz', 'musicbrainz'],
  'mood_sad': ['acousticbrainz', 'musicbrainz'],
  
  // SERVICE-SPECIFIC AUDIO ANALYSIS (Spotify)
  'spotify_danceability': ['spotify'],
  'spotify_energy': ['spotify'],
  'spotify_valence': ['spotify'],
  'spotify_tempo': ['spotify'],
  'spotify_acousticness': ['spotify'],
  'spotify_instrumentalness': ['spotify'],
  'spotify_liveness': ['spotify'],
  'spotify_speechiness': ['spotify'],
  'spotify_loudness': ['spotify'],
  
  // SERVICE-SPECIFIC GENRES (incompatible taxonomies)
  'discogs_genres': ['discogs'],
  'discogs_styles': ['discogs'],
  'spotify_genres': ['spotify'],
  'apple_music_genres': ['appleMusic'],
  'apple_music_genre_names': ['appleMusic'],
  'lastfm_tags': ['lastfm'],
  'allmusic_moods': ['allmusic'],
  'allmusic_themes': ['allmusic'],
  'allmusic_styles': ['allmusic'],
  
  // STREAMING LINKS (service IDs)
  'spotify_id': ['spotify'],
  'spotify_url': ['spotify'],
  'apple_music_id': ['appleMusic'],
  'apple_music_url': ['appleMusic'],
  'lastfm_id': ['lastfm'],
  'lastfm_url': ['lastfm'],
  'musicbrainz_id': ['musicbrainz'],
  'musicbrainz_url': ['musicbrainz'],
  'allmusic_id': ['allmusic'],
  'allmusic_url': ['allmusic'],
  'wikipedia_url': ['wikipedia'],
  'dbpedia_uri': ['wikipedia'],
  
  // REVIEWS & RATINGS
  'allmusic_rating': ['allmusic'],
  'allmusic_review': ['allmusic'],
  'lastfm_playcount': ['lastfm'],
  'lastfm_listeners': ['lastfm'],
  'spotify_popularity': ['spotify'],
  'critical_reception': ['wikipedia'],
  'apple_music_editorial_notes': ['appleMusic'],
  
  // CHART DATA
  'chart_positions': ['wikipedia'],
  'certifications': ['wikipedia'],
  'awards': ['wikipedia'],
  
  // RELEASE METADATA
  'discogs_release_id': ['discogs'],
  'discogs_master_id': ['discogs'],
  'labels': ['musicbrainz', 'discogs', 'spotify', 'appleMusic'],
  'cat_no': ['musicbrainz', 'discogs'],
  'barcode': ['discogs'],
  'country': ['musicbrainz', 'discogs'],
  'recording_date': ['musicbrainz'],
  'original_release_date': ['musicbrainz'],
  'spotify_release_date': ['spotify'],
  'spotify_release_date_precision': ['spotify'],
  'apple_music_release_date': ['appleMusic'],
  'master_release_date': ['discogs'],
  'recording_location': ['wikipedia'],
  'studio': ['musicbrainz'],
  'spotify_label': ['spotify'],
  'apple_music_label': ['appleMusic'],
  'apple_music_record_label': ['appleMusic'],
  'spotify_available_markets': ['spotify'],
  'apple_music_copyright': ['appleMusic'],
  
  // LYRICS (track-level)
  'tracks.lyrics': ['genius'],
  'tracks.lyrics_url': ['genius'],
  'tracks.lyrics_source': ['genius'],
  
  // SIMILAR ALBUMS
  'lastfm_similar_albums': ['lastfm'],
  'allmusic_similar_albums': ['allmusic'],
  
  // CULTURAL CONTEXT
  'cultural_significance': ['wikipedia'],
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
  };

  categories.forEach(category => {
    const requiredServices = DATA_TO_SERVICES[category];
    
    requiredServices.forEach(service => {
      switch (service) {
        case 'musicbrainz':
          services.musicbrainz = true;
          break;
        case 'coverArtArchive':
          services.coverArtArchive = true;
          break;
        case 'acousticbrainz':
          services.acousticbrainz = true;
          break;
        case 'lastfm':
          services.lastfm = true;
          break;
        case 'spotify':
          services.spotifyEnhanced = true;
          break;
        case 'appleMusic':
          services.appleMusicEnhanced = true;
          break;
        case 'allmusic':
          services.allmusic = true;
          break;
        case 'wikipedia':
          services.wikipedia = true;
          break;
        case 'discogs':
          services.discogsMetadata = true;
          services.discogsTracklist = true;
          break;
        case 'genius':
          services.genius = true;
          break;
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