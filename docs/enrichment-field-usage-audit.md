# Enrichment Field Usage Audit (Full Site)

## Scope
- Public pages
- Edit/admin pages
- Game flows and APIs

## Classification Legend
- `actively_displayed`: Rendered in public/admin/edit UI.
- `used_but_hidden`: Used for processing/stats/diagnostics but not normally visible.
- `write_only`: Persisted but no active runtime consumer.
- `dead`: No active producer/consumer path.

## Field Matrix
| Field | Classification | Decision | Target Surface / Consumer |
|---|---|---|---|
| `lastfm_similar_albums` | actively_displayed | keep + show | Public album detail, edit enrichment tab, collection info panel |
| `critical_reception` | actively_displayed | keep + show | Public album detail, edit enrichment tab, admin metadata tab |
| `cultural_significance` | actively_displayed | keep + show | Public album detail, edit enrichment tab, admin metadata tab |
| `recording_location` | actively_displayed | keep + show | Public album detail, edit enrichment tab, admin metadata tab |
| `apple_music_editorial_notes` | actively_displayed | keep + show | Public album detail, edit enrichment tab, admin metadata tab |
| `pitchfork_score` | actively_displayed | keep + show | Public album detail, edit enrichment tab, admin metadata tab |
| `pitchfork_review` | actively_displayed | keep + show | Public album detail, edit enrichment tab, admin metadata tab |
| `chart_positions` | actively_displayed | keep + show | Public album detail, edit enrichment tab, admin metadata tab |
| `awards` | actively_displayed | keep + show | Public album detail, edit enrichment tab, admin metadata tab |
| `certifications` | actively_displayed | keep + show | Public album detail, edit enrichment tab, admin metadata tab |
| `companies` | actively_displayed | keep + show | Public album detail, edit enrichment tab, admin metadata tab |
| `lyrics_url` (track) | actively_displayed | keep + show | Public tracklist rows, edit tracks tab, admin tracklist tab |
| `is_cover` (track/album) | actively_displayed | keep + show | Public tracklist rows, edit tracks tab, admin tracklist tab, Original-or-Cover game data |
| `original_artist` (track/album) | actively_displayed | keep + show | Public tracklist rows, edit tracks tab, admin tracklist tab, Original-or-Cover game data |
| `original_year` (track credits) | actively_displayed | keep + show | Public tracklist rows, edit tracks tab, admin tracklist tab |
| `time_signature` (track credits) | actively_displayed | keep + show | Public tracklist rows, edit tracks tab |
| `enrichment_summary` | used_but_hidden | keep admin-only | Edit enrichment diagnostics panel |
| `enriched_metadata` | used_but_hidden | keep admin-only | Edit enrichment diagnostics panel |
| `allmusic_similar_albums` | dead | deprecate (soft) | Retain column/type for compatibility; no UI producer/consumer |
| `samples` | dead | remove from selection/stats | Marked non-enrichable until provider is restored |
| `sampled_by` | dead | remove from selection/stats | Marked non-enrichable until provider is restored |

## Notes
- No DB column drops in this pass.
- `allmusic_similar_albums` remains schema-compatible but is treated as deprecated.
- `samples`/`sampled_by` are excluded from enrichment selection and stats UX until a supported source is reintroduced.
