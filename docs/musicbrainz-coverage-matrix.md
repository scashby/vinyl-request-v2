# MusicBrainz Coverage Matrix

Updated: 2026-02-17

This maps MusicBrainz WS/2 data to current Deadwax enrichment fields and DB targets.

## Implemented (Pulled + Written)

| MusicBrainz data | WS/2 source | App field | DB target | Status |
|---|---|---|---|---|
| Release-group MBID | `release.release-group.id` | `musicbrainz_id` | `masters.musicbrainz_release_group_id` | Implemented |
| First release date | `release.release-group.first-release-date` / `release-group.first-release-date` | `original_release_date` | `masters.master_release_date` (+ `masters.original_release_year`) | Implemented |
| Country | `release.country` | `country` | `releases.country` | Implemented |
| Barcode | `release.barcode` | `barcode` | `releases.barcode` | Implemented |
| Labels | `release.label-info[].label.name` | `labels` | `releases.label` (first), tags/history in workflow | Implemented |
| Catalog number | `release.label-info[].catalog-number` | `cat_no` | `releases.catalog_number` | Implemented |
| Genres | `release/release-group genres` | `genres` | `masters.genres` | Implemented |
| Tags | `release/release-group tags` | `tags` | `master_tags` via tag join | Implemented |
| Producers | artist relations | `producers` | `masters.producers` | Implemented |
| Engineers | artist relations | `engineers` | `masters.engineers` | Implemented |
| Musicians | performer/instrument/vocal relations | `musicians` | `masters.musicians` | Implemented |
| Songwriters | writer/lyricist/librettist/composer relations | `songwriters` | `masters.songwriters` | Implemented |
| Composer | composer relation | `composer` | `masters.composer` | Implemented |
| Conductor | conductor relation | `conductor` | `masters.conductor` | Implemented |
| Orchestra | orchestra relation | `orchestra` | `masters.orchestra` | Implemented |
| Chorus/Choir | choir relation | `chorus` | `masters.chorus` | Implemented |
| Release annotation | `release.annotation` | `release_notes` | `releases.notes` | Implemented |
| Track list | `media[].tracks[]` | `tracks`, `tracklist` | `release_tracks` + derived text | Implemented |
| Track durations | `track.length` / `recording.length` | `tracks[].duration` | `release_tracks.duration` | Implemented |
| Track artist credit | `track.artist-credit[]` | `tracks[].artist` | `release_tracks.artist` | Implemented |
| Media format summary | `media[].format` | `format` | `releases.media_type/format_details` parser path | Implemented |
| Cover detection | recording/work relations | `is_cover`, `original_artist`, `original_year` | recording credits JSON merge | Implemented |
| Recording date (best effort) | recording/work first-release dates | `recording_date`, `recording_year` | `masters.recording_date`, `masters.recording_year` | Implemented |
| Recording location (best effort) | release relations place/area | `recording_location` | `masters.recording_location` | Implemented |
| Companies/labels in relations | release label relations | `companies` | recording credits JSON | Implemented |

## Supported By Source Mapping (UI)

These fields are now mapped to MusicBrainz in `src/lib/enrichment-data-mapping.ts`:

- `tracks`, `tracklists`, `tracklist`
- `genres`
- `recording_date`
- `release_notes`
- `companies`
- `recording_location`

## Not Available Reliably From WS/2 (Current Pipeline)

| Field | Reason |
|---|---|
| `tempo_bpm`, `musical_key`, `time_signature`, dance/mood metrics | Not in MusicBrainz release metadata; sourced from Spotify/audio features. |
| `chart_positions`, `certifications`, `awards` | Not a standard MB release field; sourced from Wiki/Wikidata. |
| `apple_music_editorial_notes`, `pitchfork_score` | External editorial/rating sources only. |

## Could Be Added (Needs Schema/Model Changes First)

| MusicBrainz data | Why blocked currently |
|---|---|
| ISRCs per track (`recording.isrcs`) | No first-class per-track ISRC column in current write path. |
| Release status/package/script/language | No dedicated DB columns in release/master currently used by enrichment. |
| Label codes / release events by territory | No normalized release-event table in app schema. |
| Work-level attributes (classical depth) | Needs expanded credits schema in DB and UI. |

## Notes

- This matrix is for **your current app schema and enrichment workflow**, not the full raw MusicBrainz database dump.
- MusicBrainz DB schema has many internal/relational entities that are not practical to map 1:1 into the current album-centric model without additional tables.
