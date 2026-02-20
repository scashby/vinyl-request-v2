# Back-to-Back Connection Module Plan

## Scope summary
- Game: Back-to-Back Connection
- Environment: single DJ, two turntables, brewery floor, limited tech
- Core round flow: spin track A, spin track B, teams identify connection, optional detail bonus
- Session scoring target: `2` for connection + `1` for detail
- Event linkage: required on session model via `event_id -> public.events(id)` with `ON DELETE SET NULL`

## Data model proposal
- `b2bc_sessions`
  - session-level config and runtime state
  - includes `event_id` (nullable), pacing budget fields, display toggles, score values, status
- `b2bc_session_teams`
  - teams/table labels per session
- `b2bc_session_rounds`
  - round lifecycle (`pending`, `active`, `closed`)
- `b2bc_session_calls`
  - one pair per round
  - track A metadata, track B metadata, one accepted connection, optional accepted detail, host notes
  - call lifecycle status for two-track pacing
- `b2bc_team_scores`
  - one score row per team per call
  - stores guessed connection/detail and correctness booleans
- `b2bc_session_events`
  - event log stream for host actions

## API route skeleton plan
- `GET /api/games/back-to-back-connection/events`
  - event selector source
- `GET /api/games/back-to-back-connection/sessions`
  - list sessions; supports `?eventId=...`
  - returns event title, call totals, calls scored
- `POST /api/games/back-to-back-connection/sessions`
  - create session, teams, rounds, and pair deck
  - accepts `event_id` and session-level pacing/scoring config
- `GET /api/games/back-to-back-connection/sessions/[id]`
  - session detail with linked event object and `calls_total`
- `PATCH /api/games/back-to-back-connection/sessions/[id]`
  - patch allowed runtime/session fields including `event_id`
- `GET /api/games/back-to-back-connection/sessions/history`
  - history list; supports `?eventId=...`

## Admin surfaces
- Setup page: `src/app/admin/games/back-to-back-connection/page.tsx`
  - event selector in setup flow
  - team list and pair deck input
  - pacing budget controls
  - scope recommendation blocks for host/assistant/jumbotron
- History page: `src/app/admin/games/back-to-back-connection/history/page.tsx`
  - event filter in session history/list view

## Host/assistant/jumbotron recommendation
- Host
  - own transport lifecycle and scoring decisions
  - keep reveal + score + advance in one operator lane
- Assistant
  - optional only; score-entry and dispute notes
  - avoid transport controls to preserve solo-host fallback
- Jumbotron
  - prompt, timer, round, and scoreboard focus
  - hide answer until host reveal action

## Development phases
1. MVP
- DB migration + route skeleton + setup/history pages
- create/list/get APIs with event linkage and event filtering
- host/assistant/jumbotron scope placeholders

2. Runtime controls
- Add round advancement, reveal actions, score submission endpoints
- Add event logs and basic action audit trail
- Introduce safety rails for accidental double-advance

3. Operator polish
- fast score-entry UX, tie-break support, and dispute workflow
- jumbotron state transitions and larger countdown cues
- optional printable host sheet and pair order export

4. Analytics and resilience
- post-session summary, per-team trend export
- restart recovery and paused-session continuity helpers

## Risks and mitigations (vinyl pacing + solo host)
- Risk: resleeve/find/cue overruns derail rhythm
  - Mitigation: enforce pacing budget fields + visible countdown in host/jumbotron
- Risk: solo host overload during scoring
  - Mitigation: one-tap score presets and optional assistant score entry only
- Risk: disputes on accepted connection wording
  - Mitigation: one accepted connection per pair and optional accepted detail preloaded
- Risk: wrong sleeve/order during fast resets
  - Mitigation: preflight checklist, printed running order, tie-break pair staged
- Risk: tech interruptions in low-tech venue
  - Mitigation: preserve paper answer key workflow and keep host actions minimal
