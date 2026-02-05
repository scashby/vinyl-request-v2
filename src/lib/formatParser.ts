export type UnknownElement = {
  element: string;
  fullFormatString: string;
  albumInfo?: {
    artist: string;
    title: string;
    discogsReleaseId?: string | number | null;
  };
};

export { parseDiscogsFormat, type ParsedFormat } from '../utils/formatUtils';
// AUDIT: inspected, no changes.
