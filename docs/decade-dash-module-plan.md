# Decade Dash Module Plan

## Summary
- Game: Decade Dash
- Core mechanic: Spin track, teams select a decade card/paddle.
- Environment: single DJ, two turntables, brewery floor, limited tech.
- Round shape: 12-20 rounds to keep energy high while preserving cue buffer.

## Host, Assistant, Jumbotron Scope
- Host console (required): full round lifecycle, reveal/score controls, pacing timer, and solo-host-safe shortcuts.
- Assistant console (optional): score-entry helper and discrepancy check only.
- Jumbotron (required for crowd clarity): current round state, decade options during lock window, reveal state, scoreboard, and pacing standby timer.

## Data Model Proposal
- `dd_sessions`
- Contains `event_id bigint REFERENCES public.events(id) ON DELETE SET NULL`.
- Stores session-level config: `round_count`, `adjacent_scoring_enabled`, `exact_points`, `adjacent_points`, timing budget fields, display flags, and status.
- `dd_session_rounds`
- One row per round with `round_number`, optional `round_title`, and status (`pending|active|closed`).
- `dd_session_calls`
- One call per round with `call_index`, optional track metadata (`artist`, `title`, `release_year`, `source_label`), canonical `decade_start`, and optional adjacent decades list.
- `dd_session_teams`
- Team/table participants.
- `dd_team_scores`
- Team scoring per call (`selected_decade`, `exact_match`, `adjacent_match`, `awarded_points`, notes).
- `dd_session_events`
- Append-only host action/event log for traceability and replay-friendly debugging.

## API Route Skeleton Plan
- `GET /api/games/decade-dash/events`
- Event lookup for setup/history filters.
- `GET /api/games/decade-dash/sessions?eventId=`
- Session list with optional event filter.
- Returns `event_id`, `event_title`, and call-scoring summary counts.
- `POST /api/games/decade-dash/sessions`
- Creates session with `event_id`, teams, rounds/calls, pacing config, and scoring config.
- `GET /api/games/decade-dash/sessions/[id]`
- Session detail with `event_id`, expanded event metadata, and call totals.
- `PATCH /api/games/decade-dash/sessions/[id]`
- Lightweight runtime patching for title/event linkage/display/status fields.
- `GET /api/games/decade-dash/sessions/history?eventId=`
- Event-filterable history rows for admin retrospective use.

## Development Phases
1. MVP
- Setup page, event selector, session create/list, history filter, and basic host/assistant/jumbotron scaffolds.
- Core tables + indexes + session-code generation.
2. Runtime Controls
- Host round state controls (ask/lock/reveal/score/advance), scoreboard rollups, and correction path.
- Assistant score-entry workflow.
3. Polish
- Jumbotron reveal pacing states and standby timer visuals.
- Better dispute handling, audit notes, and session event timeline.
- Optional CSV import for call deck prep.

## Risks and Mitigations
- Vinyl reset pressure can stall rounds.
- Mitigation: enforce visible target-gap timer and require preflight checklist before session start.
- Solo host overload during scoring disputes.
- Mitigation: one-tap scoring presets (`all miss`, `all adjacent`) and minimal correction UI with notes.
- Ambiguous decade calls for boundary-year songs.
- Mitigation: canonical `decade_start` per call and optional adjacent-decade acceptance list.
- Brewery noise and distance reduce instruction clarity.
- Mitigation: high-contrast jumbotron states with short action prompts and fixed scoring legend.

## Event Linkage Status
- Implemented in schema and APIs:
- `event_id` present in session model with nullable FK to `public.events(id)` and `ON DELETE SET NULL`.
- Setup includes event selector.
- Setup list and history views support event-aware filtering.
- Create/list/get/history APIs include event-aware behavior.
