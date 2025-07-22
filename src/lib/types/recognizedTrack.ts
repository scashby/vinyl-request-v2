export interface RecognizedTrack {
  title: string;
  artist: string;
  album?: string;
  source: string;
  confidence?: number;
  image?: string;
}
