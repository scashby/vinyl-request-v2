# Needle Drop Roulette Plan

## Module fit
- Environment: single DJ, two turntables, brewery floor, low-tech scoring.
- Core loop: blind needle drop (5-10s), teams guess artist + title, fast reveal and score.
- Scoring: 2 points for both correct, 1 point for either correct, 0 otherwise.

## Data model proposal
- `ndr_sessions`: session config, pacing budget, event linkage (`event_id -> public.events(id)` nullable with `ON DELETE SET NULL`), jumbotron toggles, runtime state.
- `ndr_session_teams`: team roster for each session.
- `ndr_session_rounds`: round framing and status, one call expected per round in MVP.
- `ndr_session_calls`: answer key and call runtime status per round.
- `ndr_team_scores`: per-team scoring outcome per call (`artist_correct`, `title_correct`, `awarded_points`).
- `ndr_session_events`: event log for host actions and audit trail.

## API routes (implemented + planned)
- `GET /api/games/needle-drop-roulette/events`: event selector feed.
- `GET /api/games/needle-drop-roulette/sessions?eventId=`: event-aware setup/list view.
- `POST /api/games/needle-drop-roulette/sessions`: create session, teams, rounds, calls.
- `GET /api/games/needle-drop-roulette/sessions/[id]`: full session snapshot + linked event payload.
- `PATCH /api/games/needle-drop-roulette/sessions/[id]`: limited runtime field updates.
- `GET /api/games/needle-drop-roulette/sessions/history?eventId=`: event-filtered history metrics.
- `GET /api/games/needle-drop-roulette/sessions/[id]/calls`: ordered drop stack for host/jumbotron/PDF.
- `POST /api/games/needle-drop-roulette/sessions/[id]/advance`: move to next call and update session pointer.
- `PATCH /api/games/needle-drop-roulette/calls/[id]`: call lifecycle status changes (`asked`, `locked`, `answer_revealed`, `scored`, `skipped`).
- `POST /api/games/needle-drop-roulette/sessions/[id]/score`: upsert team score rows for one call.
- `GET /api/games/needle-drop-roulette/sessions/[id]/leaderboard`: aggregate standings from `ndr_team_scores`.
- `POST /api/games/needle-drop-roulette/sessions/[id]/pause`: pause active session.
- `POST /api/games/needle-drop-roulette/sessions/[id]/resume`: resume paused session.

## Admin scope recommendation
- Setup page: event selector, rounds (8-12), snippet seconds (5-10), answer mode (slips/whiteboard/mixed), pacing buffer controls, preflight checklist.
- Host page: single-column, keyboard-first progression and score lock flow.
- Assistant page: optional scorer-only companion; no playback controls.
- Jumbotron page: round/status/countdown and periodic scoreboard only.

## Development phases
1. MVP
- Setup + session create/list/history APIs.
- Host progression skeleton with score entry and round advance.
- Jumbotron read-only status scene.
- Event-aware filtering in setup list + history.

2. Beta hardening
- Score dispute handling and correction workflow.
- Session event log timeline.
- Autosave and reconnect-safe host state.
- Printable score slip/whiteboard templates.

3. Polish
- Keyboard shortcuts and reduced-motion display transitions.
- Lightweight analytics (average round duration, pacing drift).
- Optional assistant companion controls behind feature flag.

## Risks and mitigations
- Risk: solo host overload while handling vinyl + scoring.
  Mitigation: one-action host flow, default pacing timers, optional assistant scorer mode.
- Risk: pacing drift from crate search and resleeve variance.
  Mitigation: explicit target gap budget + preflight checks + emergency backup round insertion.
- Risk: answer disputes in noisy rooms.
  Mitigation: strict lock/reveal states, notes field for rulings, transparent 2/1/0 scoring rubric.
- Risk: visual readability at distance.
  Mitigation: high-contrast jumbotron typography and minimal on-screen states.
