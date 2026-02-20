# Bracket Battle Plan

## Module Goal
Bracket Battle is a seeded, head-to-head elimination game where teams submit bracket picks and live winners are decided by crowd vote (`hands` or `slips`). It is tuned for single-DJ operation on two turntables with explicit pacing buffers.

## Data Model Proposal
- `bb_sessions`: top-level session state, includes required `event_id -> public.events(id)` nullable with `ON DELETE SET NULL`.
- `bb_session_teams`: participating teams/tables.
- `bb_session_entries`: seeded contenders.
- `bb_session_rounds`: round metadata and state.
- `bb_session_matchups`: head-to-head pairs and resolved winner per matchup.
- `bb_matchup_vote_tallies`: vote counts captured per matchup contender.
- `bb_bracket_picks`: each team prediction per matchup + correctness + points.
- `bb_team_scores`: aggregate score per team.
- `bb_session_events`: append-only activity log.

## API Skeleton Plan
Implemented now:
- `GET /api/games/bracket-battle/events`
- `GET /api/games/bracket-battle/sessions?eventId=`
- `POST /api/games/bracket-battle/sessions`
- `GET /api/games/bracket-battle/sessions/:id`
- `PATCH /api/games/bracket-battle/sessions/:id`
- `GET /api/games/bracket-battle/sessions/history?eventId=`

Recommended next routes:
- `POST /api/games/bracket-battle/sessions/:id/matchups/:matchupId/open`
- `POST /api/games/bracket-battle/sessions/:id/matchups/:matchupId/lock`
- `POST /api/games/bracket-battle/sessions/:id/matchups/:matchupId/votes`
- `POST /api/games/bracket-battle/sessions/:id/matchups/:matchupId/resolve`
- `POST /api/games/bracket-battle/sessions/:id/picks/import`
- `GET /api/games/bracket-battle/sessions/:id/leaderboard`

## Admin Surfaces
- Setup: event selector, bracket config, pacing controls, seeded matchup deck input, team registration, event-filtered current sessions.
- History: event-filtered session history list with teams/matchups/picks summary.
- Host: matchup progression, vote lock, winner confirmation, bracket advancement.
- Assistant: rapid vote tally capture and dispute/override panel.
- Jumbotron: matchup spotlight, bracket tree, countdown, winner reveal.

## Development Phases
1. MVP
- Session create/list/get/history with event filtering.
- First-round matchup generation from seeded entry list.
- Manual winner selection and bracket advancement.
- Basic bracket pick scoring (`round_weighted`).

2. Operational Hardening
- Concurrency-safe vote lock and winner resolve APIs.
- Host-safe undo window and audit events.
- Assistant vote capture shortcuts and validation.
- Jumbotron reconnect-safe state hydration.

3. Polish
- Animated bracket transitions and reveal scenes.
- Printable bracket packet + pick-sheet export.
- Analytics dashboard (upset rate, pick accuracy by round).

## Solo Host + Vinyl Pacing Risks and Mitigations
- Risk: Turntable workflow collides with vote handling.
- Mitigation: enforce per-matchup pacing timer and one-tap lock/resolve states.

- Risk: Counting hands is noisy in crowded rooms.
- Mitigation: default to slips for larger crowds; keep assistant override logging.

- Risk: Bracket stalls on ties/disputes.
- Mitigation: explicit tie-break path with pre-staged tie-break matchup.

- Risk: Cognitive overload for one operator.
- Mitigation: keep host console minimal, keyboard-first, and strictly sequential.

- Risk: Event context lost in session management.
- Mitigation: always surface event title in setup/session/history API responses and UI cards.
