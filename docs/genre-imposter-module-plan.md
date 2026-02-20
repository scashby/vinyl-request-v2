# Genre Imposter Module Plan

## Module summary
- Game: Genre Imposter
- Core loop: each round has 3 spins, 2 tracks fit category, 1 track is imposter.
- Scoring: 2 points for correct imposter, +1 for correct reason.
- Operating environment: single DJ, two turntables, brewery floor, limited technology.

## Data model proposal
- `gi_sessions`: session-level configuration, pacing controls, scoring settings, visibility flags, status lifecycle.
- `gi_session_teams`: active table teams.
- `gi_session_rounds`: one row per round with category card metadata and imposter slot (`imposter_call_index`).
- `gi_session_calls`: exactly 3 calls per round, playback order, track metadata, imposter marker.
- `gi_round_team_picks`: one pick per team per round including reason text, correctness flags, awarded points.
- `gi_team_scores`: cached aggregate score totals.
- `gi_session_events`: append-only event stream for host actions and audit.

SQL schema file: `sql/create-genre-imposter-core.sql`

## Event linkage requirements
- `gi_sessions.event_id` references `public.events(id)` with `ON DELETE SET NULL`.
- Session create/list/get APIs include `event_id`.
- Admin setup and history both include event filter controls.

## Implemented API skeleton (MVP base)
- `GET /api/games/genre-imposter/events`
- `GET /api/games/genre-imposter/sessions?eventId=`
- `POST /api/games/genre-imposter/sessions`
- `GET /api/games/genre-imposter/sessions/history?eventId=`
- `GET /api/games/genre-imposter/sessions/[id]`
- `PATCH /api/games/genre-imposter/sessions/[id]`

## Planned API expansion (host runtime)
1. Round/call control
- `POST /api/games/genre-imposter/sessions/[id]/start`
- `POST /api/games/genre-imposter/sessions/[id]/pause`
- `POST /api/games/genre-imposter/sessions/[id]/resume`
- `POST /api/games/genre-imposter/sessions/[id]/advance`
- `POST /api/games/genre-imposter/sessions/[id]/calls/[callId]/mark-played`

2. Picks and scoring
- `POST /api/games/genre-imposter/sessions/[id]/rounds/[roundId]/picks`
- `POST /api/games/genre-imposter/sessions/[id]/rounds/[roundId]/score`
- `GET /api/games/genre-imposter/sessions/[id]/leaderboard`

3. Audit and recovery
- `GET /api/games/genre-imposter/sessions/[id]/events`
- `POST /api/games/genre-imposter/sessions/[id]/events`

## Admin UI skeleton
- Setup: `src/app/admin/games/genre-imposter/page.tsx`
- History: `src/app/admin/games/genre-imposter/history/page.tsx`
- Host: `src/app/admin/games/genre-imposter/host/page.tsx`
- Assistant: `src/app/admin/games/genre-imposter/assistant/page.tsx`
- Jumbotron: `src/app/admin/games/genre-imposter/jumbotron/page.tsx`

## Development phases
1. MVP
- Session setup and deck ingestion.
- Event-linked session list/history.
- Host manual progression and simple scoring persistence.

2. Host runtime hardening
- Call state machine enforcement.
- Pick lock windows and anti-double-submit checks.
- Score recalculation job and drift checks.

3. Assistant and jumbotron UX
- High-speed assistant capture flow.
- Read-only jumbotron state feed.
- Better reveal transitions and visible pacing timers.

4. Polish
- Tie-break round insertion.
- CSV import/export for deck templates.
- Session replay and post-event analytics.

## Risks and mitigations
1. Risk: vinyl reset delays break cadence.
- Mitigation: keep `target_gap_seconds` visible, pre-pull trios, enforce host buffer default >= 10s.

2. Risk: solo host overload during scoring disputes.
- Mitigation: default to host-judged reason mode with one-tap override notes and delayed reason review option.

3. Risk: category ambiguity causes friction.
- Mitigation: require optional `reason_key` per round and expose it only at reveal.

4. Risk: manual pick capture errors.
- Mitigation: enforce one pick per team/round (`UNIQUE (round_id, team_id)`) and add assistant review checkpoint before score lock.

5. Risk: event reporting fragmentation across games.
- Mitigation: preserve consistent `event_id` semantics and event-filtered session history across all game modules.
