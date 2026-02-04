// src/lib/clzParser.ts

import { parseStringPromise } from 'xml2js';

interface CLZTrack {
  position: string;
  title: string;
  duration?: string; // Formatted as MM:SS or HH:MM:SS to match database
  artist?: string;
  side?: string;
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
  location?: string; // ADDED: New field for storage location

  // Condition
  media_condition?: string;
  package_sleeve_condition?: string;

  // Status & Organization
  collection_status?: string;
  custom_tags?: string[];

  // Track data
  tracks: CLZTrack[];

  // Genres from CLZ
  clz_genres?: string[];
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
    
    const position = getTextValue(trackObj.position) || '';
    const sideMatch = position.match(/^([A-Z])/);
    const side = sideMatch ? sideMatch[1] : undefined;

    return {
      position,
      title: getTextValue(trackObj.title) || 'Unknown Track',
      duration: formatDuration(durationSeconds),
      artist: trackArtist,
      side,
    };
  });
}

/**
 * Parses disc structure from CLZ XML
 */
function parseDiscs(discsNode: unknown): { tracks: CLZTrack[] } {
  if (!discsNode) {
    return { tracks: [] };
  }

  const discNodes = typeof discsNode === 'object' && discsNode !== null
    ? (discsNode as Record<string, unknown>).disc
    : undefined;

  if (!discNodes) {
    return { tracks: [] };
  }

  const discArray = Array.isArray(discNodes) ? discNodes : [discNodes];
  const allTracks: CLZTrack[] = [];

  discArray.forEach((disc) => {
    const discObj = disc as Record<string, unknown>;
    const discTracks = parseTracks(discObj.tracks);
    allTracks.push(...discTracks);
  });

  return { tracks: allTracks };
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
      const { tracks } = parseDiscs(album.discs);
      
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
      
      // Notes (may be in CDATA)
      // CHANGED: Mapped directly to internal variable for clean assignment
      const notes = getTextValue(album.notes);
      
      // Location (Storage + Slot)
      // ADDED: Logic to combine storage and slot into one location string
      const storage = getTextValue(album.storagedevice) || '';
      const slot = getTextValue(album.slot) || '';
      const location = `${storage} ${slot}`.trim();
      
      // Parse genres and tags
      const clz_genres = parseGenres(album.genres);
      const custom_tags = parseTags(album.tags);
      
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
        
        // Condition
        media_condition: getDisplayName(album.mediacondition),
        package_sleeve_condition: getDisplayName(album.condition),
        
        // Status
        collection_status: getDisplayName(album.collectionstatus),
        custom_tags,

        // Track data
        tracks,
        
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
