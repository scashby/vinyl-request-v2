# Artist Alias (Hidden-clue) Module Plan

## Scope Snapshot
- Core mechanic: teams identify artist from staged clues in fixed order: era, collaborator, label/region.
- Event linkage: session model includes `event_id -> public.events(id)` with `ON DELETE SET NULL`, and setup/history support event-aware filtering.
- Hosting context: single DJ, two turntables, low-tech brewery floor, with explicit pacing budget controls.

## Data Model Proposal
- `aa_sessions`
  - Session-level rules and pacing config: round count, stage scoring (3/2/1 default), audio clue toggle, derived target gap, jumbotron flags.
  - Includes `event_id` (nullable) for event-aware setup/history and reporting.
- `aa_session_rounds`
  - Per-round lifecycle (`pending`, `active`, `closed`) and optional round title.
- `aa_session_calls`
  - One clue card per call:
  - `artist_name` (answer key), `accepted_aliases` (`text[]`), `clue_era`, `clue_collaborator`, `clue_label_region`.
  - Optional `audio_clue_source`, `source_label`, host notes.
  - Reveal state/lifecycle fields for stage progression and scoring.
- `aa_team_scores`
  - Team guess and score outcome per call, including guessed stage and awarded points.
- `aa_session_events`
  - Event log sink for operational telemetry/audit.

## API Route Skeleton
- Implemented baseline
  - `GET /api/games/artist-alias/events`
  - `GET /api/games/artist-alias/sessions?eventId=...`
  - `POST /api/games/artist-alias/sessions`
  - `GET /api/games/artist-alias/sessions/history?eventId=...`
  - `GET /api/games/artist-alias/sessions/:id`
  - `PATCH /api/games/artist-alias/sessions/:id`
- Planned next endpoints
  - `POST /api/games/artist-alias/sessions/:id/reveal` (advance stage)
  - `POST /api/games/artist-alias/sessions/:id/score` (submit per-team points for current call)
  - `POST /api/games/artist-alias/sessions/:id/advance` (move to next call/round)
  - `POST /api/games/artist-alias/sessions/:id/pause`
  - `POST /api/games/artist-alias/sessions/:id/resume`
  - `GET /api/games/artist-alias/sessions/:id/leaderboard`

## Admin/Host/Jumbotron Scope
- Setup page
  - Event selector, session config, pacing budget, team list, clue-card intake, preflight checklist.
  - Event-filtered recent session list.
- History page
  - Event filter + summary metrics (teams, asked/scored calls, status).
- Host page recommendation
  - Single action rail for clue-stage progression and scoring presets.
- Assistant page recommendation
  - Optional helper-only lane for guess entry and readiness checks.
- Jumbotron recommendation
  - Big stage cues, clear 3→2→1 scoring context, optional reset countdown.

## Development Phases
1. MVP
- Setup/history pages and baseline session APIs.
- Session creation with clue cards + event association.
- Static host/assistant/jumbotron scope pages.

2. Runtime Controls
- Implement reveal/score/advance/pause/resume endpoints.
- Add host controls and current-call state sync.
- Add basic scoreboard render for jumbotron.

3. Operations Hardening
- Add session event logging for reveal/score/advance actions.
- Add guardrails (idempotency, double-score protection, stale stage protection).
- Add alias matching helper and score dispute note flow.

4. Polish
- Jumbotron visual tuning for distance readability.
- Bulk clue-card import/export templates.
- Post-session recap and event-linked analytics.

## Risks And Mitigations
- Risk: solo DJ task overload during reveal + scoring + cueing.
  - Mitigation: host-first single action rail, one-tap score presets, non-blocking assistant role.
- Risk: pacing drift from vinyl handling (resleeve/find/cue).
  - Mitigation: explicit pacing budget fields with derived target gap and visible timers.
- Risk: ambiguous alias acceptance creates scoring disputes.
  - Mitigation: per-call `accepted_aliases`, optional notes, and event logging for adjudication.
- Risk: clue quality inconsistency across rounds.
  - Mitigation: setup preflight requiring all three clue stages and order verification.
- Risk: brewery noise makes late-stage clues hard to process.
  - Mitigation: short text clues with high-contrast jumbotron presentation and optional audio fallback.
