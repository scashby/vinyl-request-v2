# CHANGELOG.md

## [1.0.2] — 2025-06-04
### Added
- Fully rebuilt QueueSection with table-based layout for pixel precision
- Added dedicated `queue.css` stylesheet isolated from internal styles
- Implemented grid with exact alignment: #, cover image, Album/Artist, Side, Plus, Heart
- Album/Artist vertically aligned with center of image
- Artist name styling changed to light gray; title remains blue
- Side and index columns now centered under headers
- Row spacing reduced to match TIDAL example

### Fixed
- Heart column now aligned right and vertically centered
- Removed extra black space between Album/Artist and Side columns
- Number column width reduced and centered under header
- Ensured consistent padding between all columns

## [1.0.1] — 2025-06-02
### Changed
- LandingPage updated: “Now Playing” → “Dialogues”, “Admin” → “About”
- Removed Admin from nav; accessible only at `/admin`
- Breadcrumbs added to Events page using dynamic route parsing
- Breadcrumb spacing, font size, and separator corrected
- AlbumCard artist font and title spacing fixed
- Global style bleed from album-detail eliminated

## 0.6.0 – Chunk 6: Metadata Enrichment (2025-05-28)
- Admin page lists albums with missing year/format/image
- Fetches metadata from Discogs API
- Updates matching album entry in Supabase

## 0.5.0 – Chunk 5: Discogs CSV Import
- Admins can upload CSV files
- Parses with PapaParse, shows preview table
- Highlights duplicates
- Inserts new entries, updates existing ones based on artist/title/year

## 0.4.0 – Chunk 4: Queue + Now Playing
- Admins can view and remove requests via EditQueue
- Admins can assign Now Playing / Up Next via SetNowPlaying

## 0.3.0 – Chunk 3: Browse + Event Detail
- BrowsePage shows full collection
- EventDetail lets users submit or upvote sides
- Request writes to Supabase `requests` table

## 0.2.0 – Chunk 2: Layout + Theme
- Header, Footer, Layout component
- Vinyl-inspired Tailwind theming

## 0.1.0 – Chunk 1: Auth
- Supabase Auth UI + Google login
- ProtectedRoute and AuthProvider
