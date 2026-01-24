// src/lib/clzParser.ts

import { parseStringPromise } from 'xml2js';

interface CLZTrack {
  position: string;
  title: string;
  duration?: string; // Formatted as MM:SS or HH:MM:SS to match database
  artist?: string;
  disc_number?: number; // Added to match database schema
}

interface CLZDisc {
  disc_number: number;
  track_count: number;
  tracks: CLZTrack[];
}

interface CLZCredit {
  name: string;
  role?: string;
}

export interface CLZAlbumData extends Record<string, unknown> {
  // Core album data
  artist: string;
  title: string;
  year?: string;
  format: string;
  barcode?: string;
  cat_no?: string;
  country?: string;
  labels?: string[];
  personal_notes?: string; // CHANGED: Renamed from 'notes'
  index_number?: number;
  location?: string; // ADDED: New field for storage location
  
  // Condition & Physical
  media_condition?: string;
  package_sleeve_condition?: string;
  vinyl_weight?: string;
  rpm?: string;
  vinyl_color?: string;
  packaging?: string;
  sound?: string;
  spars_code?: string;
  discs: number;
  
  // Dates
  date_added?: Date;
  modified_date?: Date;
  purchase_date?: Date;
  recording_date?: Date;
  original_release_date?: Date;
  
  // Status & Organization
  collection_status?: string;
  is_live: boolean;
  my_rating?: number;
  custom_tags?: string[];
  
  // Credits (as JSONB)
  musicians?: CLZCredit[];
  producers?: CLZCredit[];
  engineers?: CLZCredit[];
  songwriters?: CLZCredit[];
  composer?: string;
  conductor?: string;
  orchestra?: string;
  chorus?: string;
  
  // Track data
  tracks: CLZTrack[];
  disc_metadata: CLZDisc[];
  
  // Other
  studio?: string;
  extra?: string;
  
  // CLZ-specific identifiers
  clz_album_id?: string;
  clz_hash?: string;
  
  // Genres from CLZ
  clz_genres?: string[];
}

/**
 * Converts Unix timestamp to Date object
 */
function timestampToDate(timestamp: string | number | undefined): Date | undefined {
  if (!timestamp) return undefined;
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  if (isNaN(ts)) return undefined;
  return new Date(ts * 1000); // Unix timestamp is in seconds
}

/**
 * Convert seconds to MM:SS or HH:MM:SS format to match database
 */
function formatDuration(seconds: number | undefined): string | undefined {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return undefined;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Extracts text content from XML node, handling both direct values and nested structures
 */
function getTextValue(node: unknown): string | undefined {
  if (!node) return undefined;
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node) && node.length > 0) {
    return getTextValue(node[0]);
  }
  if (typeof node === 'object' && node !== null) {
    const obj = node as Record<string, unknown>;
    if ('displayname' in obj) return getTextValue(obj.displayname);
    if ('_' in obj) return getTextValue(obj._);
    if ('$' in obj && typeof obj.$ === 'object' && obj.$ !== null) {
      const attrs = obj.$ as Record<string, unknown>;
      if ('displayname' in attrs) return String(attrs.displayname);
    }
  }
  return undefined;
}

/**
 * Extracts displayname from a node
 */
function getDisplayName(node: unknown): string | undefined {
  if (!node) return undefined;
  if (Array.isArray(node) && node.length > 0) {
    return getDisplayName(node[0]);
  }
  if (typeof node === 'object' && node !== null) {
    const obj = node as Record<string, unknown>;
    if ('displayname' in obj) return getTextValue(obj.displayname);
  }
  return getTextValue(node);
}

/**
 * Extracts boolean value from node with boolvalue attribute
 */
function getBoolValue(node: unknown): boolean {
  if (!node) return false;
  if (typeof node === 'boolean') return node;
  if (typeof node === 'string') return node.toLowerCase() === 'yes' || node === '1' || node.toLowerCase() === 'true';
  if (Array.isArray(node) && node.length > 0) {
    return getBoolValue(node[0]);
  }
  if (typeof node === 'object' && node !== null) {
    const obj = node as Record<string, unknown>;
    if ('$' in obj && typeof obj.$ === 'object' && obj.$ !== null) {
      const attrs = obj.$ as Record<string, unknown>;
      if ('boolvalue' in attrs) {
        const val = String(attrs.boolvalue).toLowerCase();
        return val === '1' || val === 'yes' || val === 'true';
      }
    }
  }
  return false;
}

/**
 * Extracts array of display names from a collection of nodes
 */
function getDisplayNameArray(nodes: unknown): string[] {
  if (!nodes) return [];
  if (!Array.isArray(nodes)) {
    const val = getDisplayName(nodes);
    return val ? [val] : [];
  }
  return nodes
    .map(node => getDisplayName(node))
    .filter((val): val is string => val !== undefined);
}

/**
 * Parses artists from CLZ XML structure
 */
function parseArtists(artistsNode: unknown): string {
  if (!artistsNode) return 'Unknown Artist';
  
  const artists = typeof artistsNode === 'object' && artistsNode !== null
    ? (artistsNode as Record<string, unknown>).artist
    : undefined;
    
  if (!artists) return 'Unknown Artist';
  
  const artistNames = getDisplayNameArray(artists);
  return artistNames.length > 0 ? artistNames.join(', ') : 'Unknown Artist';
}

/**
 * Parses labels from comma-separated string into array
 */
function parseLabels(labelsString: string | undefined): string[] {
  if (!labelsString) return [];
  return labelsString
    .split(',')
    .map(label => label.trim())
    .filter(label => label.length > 0);
}

/**
 * Parses credits (musicians, producers, etc.) from CLZ XML
 */
function parseCredits(creditsNode: unknown): CLZCredit[] {
  if (!creditsNode) return [];
  
  const creditItems = typeof creditsNode === 'object' && creditsNode !== null
    ? Object.values(creditsNode as Record<string, unknown>)
    : [];
    
  if (!Array.isArray(creditItems) || creditItems.length === 0) return [];
  
  return creditItems
    .flat()
    .map(item => {
      const name = getDisplayName(item);
      return name ? { name } : null;
    })
    .filter((credit): credit is CLZCredit => credit !== null);
}

/**
 * Parses tracks from a disc
 */
function parseTracks(tracksNode: unknown): CLZTrack[] {
  if (!tracksNode) return [];
  
  const trackNodes = typeof tracksNode === 'object' && tracksNode !== null
    ? (tracksNode as Record<string, unknown>).track
    : undefined;
    
  if (!trackNodes) return [];
  
  const trackArray = Array.isArray(trackNodes) ? trackNodes : [trackNodes];
  
  return trackArray.map(track => {
    const trackObj = track as Record<string, unknown>;
    
    // Get track artist (if different from album artist)
    let trackArtist: string | undefined;
    if (trackObj.artists) {
      const artistsObj = trackObj.artists as Record<string, unknown>;
      if (artistsObj.artist) {
        const artistNames = getDisplayNameArray(artistsObj.artist);
        if (artistNames.length > 0) {
          trackArtist = artistNames.join(', ');
        }
      }
    }
    
    const length = getTextValue(trackObj.length);
    const durationSeconds = length ? parseInt(length, 10) : undefined;
    
    return {
      position: getTextValue(trackObj.position) || '',
      title: getTextValue(trackObj.title) || 'Unknown Track',
      duration: formatDuration(durationSeconds),
      artist: trackArtist
    };
  });
}

/**
 * Parses disc structure from CLZ XML
 */
function parseDiscs(discsNode: unknown): { tracks: CLZTrack[]; disc_metadata: CLZDisc[]; disc_count: number } {
  if (!discsNode) {
    return { tracks: [], disc_metadata: [], disc_count: 1 };
  }
  
  const discNodes = typeof discsNode === 'object' && discsNode !== null
    ? (discsNode as Record<string, unknown>).disc
    : undefined;
    
  if (!discNodes) {
    return { tracks: [], disc_metadata: [], disc_count: 1 };
  }
  
  const discArray = Array.isArray(discNodes) ? discNodes : [discNodes];
  
  const allTracks: CLZTrack[] = [];
  const discMetadata: CLZDisc[] = [];
  
  discArray.forEach((disc, idx) => {
    const discObj = disc as Record<string, unknown>;
    const discNumber = idx + 1;
    
    const discTracks = parseTracks(discObj.tracks);
    
    // Add disc_number to each track to match database schema
    const tracksWithDisc = discTracks.map(track => ({
      ...track,
      disc_number: discNumber
    }));
    
    discMetadata.push({
      disc_number: discNumber,
      track_count: discTracks.length,
      tracks: discTracks
    });
    
    allTracks.push(...tracksWithDisc);
  });
  
  return {
    tracks: allTracks,
    disc_metadata: discMetadata,
    disc_count: discArray.length
  };
}

/**
 * Parses genres from CLZ XML
 */
function parseGenres(genresNode: unknown): string[] {
  if (!genresNode) return [];
  
  const genreNodes = typeof genresNode === 'object' && genresNode !== null
    ? (genresNode as Record<string, unknown>).genre
    : undefined;
    
  if (!genreNodes) return [];
  
  return getDisplayNameArray(genreNodes);
}

/**
 * Parses tags from CLZ XML
 */
function parseTags(tagsNode: unknown): string[] {
  if (!tagsNode) return [];
  
  const tagNodes = typeof tagsNode === 'object' && tagsNode !== null
    ? (tagsNode as Record<string, unknown>).tag
    : undefined;
    
  if (!tagNodes) return [];
  
  return getDisplayNameArray(tagNodes);
}

/**
 * Comprehensive CLZ XML parser - extracts all available fields
 */
export async function parseCLZXML(xmlContent: string): Promise<CLZAlbumData[]> {
  try {
    const result = await parseStringPromise(xmlContent, {
      explicitArray: false,
      mergeAttrs: true,
      explicitRoot: true,
      trim: true
    });

    const musicList = result?.collectorz?.data?.musicinfo?.musiclist?.music;
    
    if (!musicList) {
      throw new Error('Invalid CLZ XML structure - no music data found');
    }

    const albums = Array.isArray(musicList) ? musicList : [musicList];

    return albums.map((album: Record<string, unknown>) => {
      // Parse disc structure first
      const { tracks, disc_metadata, disc_count } = parseDiscs(album.discs);
      
      // Extract all fields
      const artist = parseArtists(album.artists);
      const title = getTextValue(album.title) || 'Unknown Album';
      const format = getDisplayName(album.format) || 'Unknown';
      const labelsString = getDisplayName(album.label);
      const labels = parseLabels(labelsString);
      
      // Year handling
      let year: string | undefined;
      if (album.releasedate) {
        const releaseDateObj = album.releasedate as Record<string, unknown>;
        if (releaseDateObj.year) {
          year = getDisplayName(releaseDateObj.year);
        }
      }
      
      // Ratings (0-5 scale in CLZ)
      const ratingStr = getTextValue(album.myrating);
      const my_rating = ratingStr ? parseInt(ratingStr, 10) : undefined;
      
      // Notes (may be in CDATA)
      // CHANGED: Mapped directly to internal variable for clean assignment
      const notes = getTextValue(album.notes);
      
      // Location (Storage + Slot)
      // ADDED: Logic to combine storage and slot into one location string
      const storage = getTextValue(album.storagedevice) || '';
      const slot = getTextValue(album.slot) || '';
      const location = `${storage} ${slot}`.trim();
      
      // Index number
      const indexStr = getTextValue(album.index);
      const index_number = indexStr ? parseInt(indexStr, 10) : undefined;
      
      // Parse all credits
      const musicians = parseCredits(album.musicians);
      const producers = parseCredits(album.producers);
      const engineers = parseCredits(album.engineers);
      const songwriters = parseCredits(album.songwriters);
      
      const composer = getDisplayName(album.composers);
      const conductor = getDisplayName(album.conductors);
      const orchestra = getDisplayName(album.orchestras);
      const chorus = getDisplayName(album.choruses);
      
      // Parse genres and tags
      const clz_genres = parseGenres(album.genres);
      const custom_tags = parseTags(album.tags);
      
      // Dates - safely access nested timestamp properties
      const addedDateObj = album.addeddate as Record<string, unknown> | undefined;
      const modifiedDateObj = album.modifieddate as Record<string, unknown> | undefined;
      const date_added = timestampToDate(addedDateObj?.timestamp as string | number | undefined);
      const modified_date = timestampToDate(modifiedDateObj?.timestamp as string | number | undefined);
      
      // Other text fields
      const studio = getDisplayName(album.studios);
      const extra = getDisplayName(album.extras);
      
      const albumData: CLZAlbumData = {
        // Core data
        artist,
        title,
        year,
        format,
        barcode: getTextValue(album.upc),
        cat_no: getTextValue(album.labelnumber),
        country: getDisplayName(album.country),
        labels,
        // CHANGED: Map XML notes to personal_notes property
        personal_notes: notes,
        // ADDED: Map combined string to location property
        location: location || undefined,
        index_number,
        
        // Condition & Physical
        media_condition: getDisplayName(album.mediacondition),
        package_sleeve_condition: getDisplayName(album.condition),
        vinyl_weight: getTextValue(album.vinylweight),
        rpm: getTextValue(album.rpm),
        packaging: getTextValue(album.packaging),
        sound: getTextValue(album.sound),
        spars_code: getTextValue(album.sparscode),
        discs: disc_count,
        
        // Dates
        date_added,
        modified_date,
        
        // Status
        collection_status: getDisplayName(album.collectionstatus),
        is_live: getBoolValue(album.islive),
        my_rating: my_rating && !isNaN(my_rating) ? my_rating : undefined,
        custom_tags,
        
        // Credits
        musicians: musicians.length > 0 ? musicians : undefined,
        producers: producers.length > 0 ? producers : undefined,
        engineers: engineers.length > 0 ? engineers : undefined,
        songwriters: songwriters.length > 0 ? songwriters : undefined,
        composer,
        conductor,
        orchestra,
        chorus,
        
        // Track data
        tracks,
        disc_metadata,
        
        // Other
        studio,
        extra,
        
        // CLZ identifiers
        clz_album_id: getTextValue(album.bpalbumid),
        clz_hash: getTextValue(album.hash),
        
        // Genres
        clz_genres: clz_genres.length > 0 ? clz_genres : undefined
      };
      
      return albumData;
    });
  } catch (error) {
    console.error('Error parsing CLZ XML:', error);
    throw new Error(`Failed to parse CLZ XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper to convert CLZ album data to collection table insert format
 */
export function clzToCollectionRow(clzData: CLZAlbumData, defaultFolder: string = 'All Albums'): Record<string, unknown> {
  return {
    artist: clzData.artist,
    title: clzData.title,
    year: clzData.year,
    format: clzData.format,
    // CHANGED: Use location, fallback to defaultFolder (which acts as a location string)
    location: clzData.location || defaultFolder,
    barcode: clzData.barcode,
    cat_no: clzData.cat_no,
    country: clzData.country,
    labels: clzData.labels,
    // CHANGED: Write to personal_notes, removed deprecated 'notes'
    personal_notes: clzData.personal_notes,
    index_number: clzData.index_number,
    
    media_condition: clzData.media_condition || 'Unknown',
    package_sleeve_condition: clzData.package_sleeve_condition,
    vinyl_weight: clzData.vinyl_weight,
    rpm: clzData.rpm,
    packaging: clzData.packaging,
    sound: clzData.sound,
    spars_code: clzData.spars_code,
    discs: clzData.discs,
    
    date_added: clzData.date_added,
    modified_date: clzData.modified_date,
    
    collection_status: clzData.collection_status,
    is_live: clzData.is_live,
    my_rating: clzData.my_rating,
    custom_tags: clzData.custom_tags,
    
    musicians: clzData.musicians,
    producers: clzData.producers,
    engineers: clzData.engineers,
    songwriters: clzData.songwriters,
    composer: clzData.composer,
    conductor: clzData.conductor,
    orchestra: clzData.orchestra,
    chorus: clzData.chorus,
    
    tracks: clzData.tracks,
    disc_metadata: clzData.disc_metadata,
    
    studio: clzData.studio,
    extra: clzData.extra
  };
}