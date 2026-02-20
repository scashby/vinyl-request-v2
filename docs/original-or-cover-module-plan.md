# Original or Cover Module Plan

## Summary
- Game: Original or Cover
- Core mechanic: spin track and teams call original vs cover.
- Environment: single DJ, two turntables, brewery floor, limited tech.
- Round shape: 8-12 rounds to keep pacing stable with analog resets.

## Host, Assistant, Jumbotron Scope
- Host console (required): round-state controls, binary answer lock, scoring presets, and pacing timer.
- Assistant console (optional): score-entry helper and answer-slip reconciliation only.
- Jumbotron (required): large original-vs-cover prompt, round state, scoring legend, and reset countdown.

## Data Model Proposal
- `ooc_sessions`
- Includes required event linkage: `event_id bigint REFERENCES public.events(id) ON DELETE SET NULL`.
- Stores session config: `round_count`, scoring knobs (`points_correct_call`, `bonus_original_artist_points`), pacing fields, display flags, and lifecycle status.
- `ooc_session_rounds`
- One row per round (`round_number`, optional `round_title`, round status).
- `ooc_session_calls`
- One call per round with answer key (`spin_artist`, `track_title`, `original_artist`, `is_cover`) and optional validation/support fields (`alt_accept_original_artist`, `source_label`, `host_notes`).
- `ooc_session_teams`
- Team/table roster rows.
- `ooc_team_scores`
- Per-team per-call scoring with called side (`called_original`), original-artist guess text, correctness flags, and awarded points.
- `ooc_session_events`
- Append-only event stream for host actions and audit timeline.

## API Route Skeleton Plan
- `GET /api/games/original-or-cover/events`
- Event list for setup selector and history filters.
- `GET /api/games/original-or-cover/sessions?eventId=`
- Event-aware setup list including `event_id`, `event_title`, call totals, and scoring progress.
- `POST /api/games/original-or-cover/sessions`
- Creates session with event linkage, teams, rounds, calls, scoring config, and pacing budget.
- `GET /api/games/original-or-cover/sessions/[id]`
- Returns session + linked event + call totals.
- `PATCH /api/games/original-or-cover/sessions/[id]`
- Runtime updates for title, event link, display flags, and status fields.
- `GET /api/games/original-or-cover/sessions/history?eventId=`
- Event-filtered session history with team/call progress metrics.

## Development Phases
1. MVP
- Core SQL schema and indexes.
- Setup page skeleton + session history page with event selector/filter.
- Session create/list/get/history APIs with `event_id` exposed.
- Host/assistant/jumbotron scope skeleton pages.
2. Runtime Controls
- Round action controls (start, reveal, score, advance).
- Team scoring UI with +2/+1 presets and dispute override lane.
- Live scoreboard aggregation and score locking.
3. Polish
- Fast import helper for pair decks (CSV/text parser + validation).
- Better host keyboard shortcuts and outage-safe local fallbacks.
- Session event timeline, analytics, and post-event export.

## Risks and Mitigations
- Risk: vinyl reset delay between rounds creates dead air.
- Mitigation: enforce pacing budget (`target_gap_seconds`) and keep a visible countdown on host/jumbotron.
- Risk: solo host context switching while scoring and cueing.
- Mitigation: single-path host controls, score presets, and optional assistant-only score entry.
- Risk: disputes over original artist attribution.
- Mitigation: pre-verified answer key plus optional alternate accepted artist field per call.
- Risk: run-time pair depletion due to damaged/missing records.
- Mitigation: require backup quick-swap pairs in preflight checklist.
- Risk: noisy brewery environment reduces prompt clarity.
- Mitigation: binary high-contrast jumbotron prompt and persistent scoring legend.

## Event Linkage Status
- Implemented in schema and APIs:
- `event_id` is included in session model with nullable FK to `public.events(id)` and `ON DELETE SET NULL`.
- Setup page includes event selector and event-filtered session list.
- History page includes event filter.
- Create/list/get/history APIs expose event-aware behavior.
