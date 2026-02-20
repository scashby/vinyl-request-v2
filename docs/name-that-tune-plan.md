# Name That Tune Module Plan

## Scope Recommendation
- Host: Required in MVP. Single-screen control flow for snippet start, lock answers, reveal answer, score, and advance.
- Assistant: Defer past MVP for solo-host operation. Keep as optional scorer-only aid in a later phase.
- Jumbotron: Include in MVP-lite form. Show round/call/timer/status only, with no answers until reveal.

## Data Model Proposal
- Sessions: `ntt_sessions` with `event_id` (`public.events(id)`, nullable, `ON DELETE SET NULL`), pacing fields, lock-in settings, and display toggles.
- Rounds/Calls: `ntt_session_calls` stores one cue per round (or more if expanded), answer key (`artist_answer`, `title_answer`), snippet metadata, status progression.
- Teams: `ntt_session_teams`.
- Scoring: `ntt_team_scores` with split correctness fields (`artist_correct`, `title_correct`) and capped `awarded_points` (0-2).
- Timeline/Audit: `ntt_session_events`.

## API Skeleton Plan
- `GET /api/games/name-that-tune/events` event picker source.
- `GET /api/games/name-that-tune/sessions?eventId=` list sessions with event-aware filtering.
- `POST /api/games/name-that-tune/sessions` create session with `event_id`, teams, and snippet deck.
- `GET /api/games/name-that-tune/sessions/[id]` session detail (`event`, countdown, call count).
- `PATCH /api/games/name-that-tune/sessions/[id]` host state updates.
- `GET /api/games/name-that-tune/sessions/history?eventId=` event-aware history.
- Future:
- `POST /api/games/name-that-tune/sessions/[id]/advance`
- `POST /api/games/name-that-tune/sessions/[id]/pause`
- `POST /api/games/name-that-tune/sessions/[id]/resume`
- `POST /api/games/name-that-tune/sessions/[id]/score`
- `PATCH /api/games/name-that-tune/calls/[id]`

## Development Phases
1. MVP
- Setup page, event selector, sessions list/history filter.
- Session create/list/get APIs with `event_id`.
- Basic host flow + simple jumbotron state.

2. Operational Hardening
- Score-entry UX with rapid keyboard-first inputs.
- Call status transitions, pause/resume, backup insertion.
- Validation and better error states for short staffing.

3. Polish
- Assistant companion screen (optional).
- Print pack/export for answer slips and run-sheet.
- Analytics and historical performance snapshots by event.

## Risks and Mitigations
- Risk: Solo host overloaded while cueing/scoring.
- Mitigation: One-tap host actions, fewer state transitions, defer assistant dependency.

- Risk: Vinyl pacing drift (resleeve/find/cue variance).
- Mitigation: Explicit timing budget per session, lock-in window controls, backup snippets staged.

- Risk: Snippet readiness mismatch at runtime.
- Mitigation: Setup preflight checklist and minimum snippet count enforcement.
