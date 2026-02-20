# Crate Categories Module Plan

## Scope Snapshot
- Status: `undeveloped -> in_development` once admin skeleton exists.
- Environment fit: single DJ, two turntables, brewery floor noise, limited tech.
- Core loop: one category + one prompt type per round, each round has 3-5 tracks.
- Event linkage: every session supports `event_id -> public.events(id)` with nullable `ON DELETE SET NULL`; setup/history support event-aware filtering.

## Data Model Proposal
- `ccat_sessions`: top-level config and runtime state.
- `ccat_session_teams`: table teams for a session.
- `ccat_session_rounds`: category/prompt contract per round (`prompt_type`, `tracks_in_round`, per-round points).
- `ccat_session_calls`: track stack slots inside each round.
- `ccat_round_scores`: team scoring at round level (aligned to prompt type).
- `ccat_session_events`: timeline/audit events.

### Prompt Types
- `identify-thread`
- `odd-one-out`
- `belongs-or-bust`
- `decade-lock`
- `mood-match`

## API Route Skeleton Plan
- `GET /api/games/crate-categories/events`
  - Return recent events for setup/history selectors.
- `GET /api/games/crate-categories/sessions?eventId=...`
  - Session list for setup screen, filtered by `event_id` when provided.
- `POST /api/games/crate-categories/sessions`
  - Create session + teams + rounds + calls.
  - Validate 2+ teams and enough calls for all configured round slots.
  - Persist `event_id` in session create payload.
- `GET /api/games/crate-categories/sessions/[id]`
  - Session details + event info + counts.
- `PATCH /api/games/crate-categories/sessions/[id]`
  - Runtime-safe updates (`event_id`, display toggles, status, progress indexes).
- `GET /api/games/crate-categories/sessions/history?eventId=...`
  - Session history list with event filter and simple team/scoring metrics.

## UI Skeleton Plan
- Setup page:
  - Event selector.
  - Session config for rounds, tracks-per-round, pacing timers, display toggles.
  - Draft inputs for teams/rounds/calls.
  - Preflight checklist focused on crate order and reset buffers.
- History page:
  - Event dropdown filter and refresh.
  - Session cards with status, teams, calls asked, rounds scored.
- Host/Assistant/Jumbotron pages:
  - Scope recommendations only (MVP-safe), no hard runtime dependencies.

## Development Phases
1. MVP
- Ship schema + route skeletons + setup/history pages.
- Enable session creation with event linking and history filtering.
- Keep host/assistant/jumbotron as guidance-only scaffolds.

2. Hostable Runtime
- Add round state transitions (`pending -> active -> closed`).
- Add call progression controls and per-round scoring forms.
- Add lightweight session event logging for recoverability.

3. Brewery Hardening
- Add offline-friendly retry and optimistic UI for score submits.
- Add guardrails for duplicate scoring and accidental double-advance.
- Add dispute notes and quick correction UX.

4. Polish
- Add richer jumbotron states (answer window open/closed, reveal cadence).
- Add analytics exports by event/category/prompt type.
- Add print-ready host sheets and round cards.

## Risks and Mitigations
- Risk: pacing collapse from vinyl handling overhead.
  - Mitigation: target gap timer computed from resleeve/find/cue/buffer values; preflight validation before create.
- Risk: host overload in solo mode.
  - Mitigation: single-action host lane and score presets by prompt type.
- Risk: ambiguity in round scoring rules.
  - Mitigation: store prompt type and points on each round; keep scoring UI prompt-aware.
- Risk: crate lookup delays mid-round.
  - Mitigation: prepare round crates in fixed order and expose source/crate tags in call list.
- Risk: noisy environment causes missed instructions.
  - Mitigation: jumbotron focuses on large state cues, track counter, and answer window status.
