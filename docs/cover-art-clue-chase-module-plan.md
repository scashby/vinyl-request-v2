# Cover Art Clue Chase Module Plan

## Summary
- Game: Cover Art Clue Chase
- Core mechanic: reveal album art in stages with optional audio clue fallback.
- Environment: single DJ, two turntables, brewery floor, limited tech.
- Round shape: 8-14 rounds to keep pacing realistic with prep-heavy image deck flow.

## Host, Assistant, Jumbotron Scope
- Host console (required): stage progression controls, score lock, and pacing timer with solo-host shortcuts.
- Assistant console (optional): score-entry helper and next-round deck readiness checks.
- Jumbotron (required): staged reveal canvas, round/state indicator, scoring legend, and standby pacing timer.

## Data Model Proposal
- `cacc_sessions`
- Includes required event linkage: `event_id bigint REFERENCES public.events(id) ON DELETE SET NULL`.
- Stores session config: `round_count`, 3/2/1 score knobs, `audio_clue_enabled`, pacing budget fields, display flags, and status lifecycle.
- `cacc_session_rounds`
- One row per round (`round_number`, optional `round_title`, and round status).
- `cacc_session_calls`
- One call per round with answer key (`artist`, `title`, optional `release_year`) and staged reveal assets (`reveal_level_1_image_url`, `reveal_level_2_image_url`, `reveal_level_3_image_url`) plus optional `audio_clue_source`.
- `cacc_session_teams`
- Team/table roster rows.
- `cacc_team_scores`
- Per-team per-call scoring outcome with guessed text, reveal stage used, optional audio-clue marker, and awarded points.
- `cacc_session_events`
- Append-only audit/event stream for host actions.

## API Route Skeleton Plan
- `GET /api/games/cover-art-clue-chase/events`
- Event list for setup and history filters.
- `GET /api/games/cover-art-clue-chase/sessions?eventId=`
- Event-aware setup list including `event_id`, `event_title`, and call progress metrics.
- `POST /api/games/cover-art-clue-chase/sessions`
- Creates session with event linkage, teams, rounds, calls, score model, and pacing budget.
- `GET /api/games/cover-art-clue-chase/sessions/[id]`
- Returns session + linked event payload + call totals.
- `PATCH /api/games/cover-art-clue-chase/sessions/[id]`
- Runtime updates for title, event linkage, display flags, and status.
- `GET /api/games/cover-art-clue-chase/sessions/history?eventId=`
- Event-filtered admin history metrics.

## Development Phases
1. MVP
- Core schema and indexes, setup + history pages, event selector/filter, and host/assistant/jumbotron skeletons.
- Session create/list/get/history APIs wired to event-aware behavior.
2. Runtime Controls
- Stage reveal flow, per-team score entry, lock/advance actions, and scoreboard aggregation.
- Round safeguards for missing reveal assets and failed media loads.
3. Polish
- Jumbotron transitions and clearer stage-state visuals.
- Deck import tools (CSV/image manifest) to reduce prep load.
- Host analytics and session event timeline for post-night review.

## Risks and Mitigations
- Prep overhead for 3 image stages per round is high.
- Mitigation: preflight checklist + deck parser validation before session creation.
- Solo host overload during reveal/scoring transitions.
- Mitigation: one-path host controls, quick presets, and optional assistant-only score helper.
- Vinyl reset delays can kill momentum.
- Mitigation: visible pacing timer with target gap and mandatory buffer in setup.
- Asset failures (broken URL, wrong stage order) can stall rounds.
- Mitigation: ingest validation for required stage URLs and stage-order verification checklist.
- Brewery visibility/noise issues reduce clarity.
- Mitigation: high-contrast jumbotron prompts with persistent scoring legend and stage labels.

## Event Linkage Status
- Implemented in schema and APIs:
- `event_id` included in session model with nullable FK to `public.events(id)` and `ON DELETE SET NULL`.
- Setup includes event selector and event-filtered session list.
- History view includes event filter.
- Create/list/get/history APIs expose event-aware behavior.
