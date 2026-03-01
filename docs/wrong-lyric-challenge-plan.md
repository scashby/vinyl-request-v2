# Wrong Lyric Challenge Module Plan

## Module summary
- Game: Wrong Lyric Challenge (Co-host)
- Core loop: host presents lyric options while DJ cues/plays the track; teams pick the real lyric.
- Scoring: 2 points for correct lyric, optional +1 for naming song.
- Operating environment: single DJ, two turntables, brewery floor, limited technology.

## Host/assistant/jumbotron scope recommendation
- Host: Required in MVP. Controls call lifecycle and scoring lock.
- Assistant: Recommended but optional. Captures picks and bonus claims only.
- Jumbotron: Display options/state/scoreboard, never reveal answer before host reveal.

## Data model proposal (sessions, rounds, calls, scoring)
- `wlc_sessions`: top-level session config, scoring rules, pacing budget, runtime status.
- `wlc_session_rounds`: one row per round for lifecycle and recovery.
- `wlc_session_calls`: one call per round with one correct lyric + 2/3 decoy lyrics, answer slot, cue hints, status.
- `wlc_session_teams`: team roster.
- `wlc_team_scores`: per-team per-call scoring with lyric correctness and optional song bonus flag.
- `wlc_session_events`: append-only audit timeline for host actions and score corrections.

SQL schema file: `sql/create-wrong-lyric-challenge-core.sql`

## Event linkage requirements
- `wlc_sessions.event_id` references `public.events(id)` with `ON DELETE SET NULL`.
- Session create/list/get APIs include `event_id`.
- Admin setup/list and history views include event selector/filter controls.

## API route skeleton plan
- `GET /api/games/wrong-lyric-challenge/events`
- `GET /api/games/wrong-lyric-challenge/sessions?eventId=`
- `POST /api/games/wrong-lyric-challenge/sessions`
- `GET /api/games/wrong-lyric-challenge/sessions/[id]`
- `PATCH /api/games/wrong-lyric-challenge/sessions/[id]`
- `GET /api/games/wrong-lyric-challenge/sessions/history?eventId=`
- `GET /api/games/wrong-lyric-challenge/sessions/[id]/calls`
- `GET /api/games/wrong-lyric-challenge/sessions/[id]/leaderboard`
- `POST /api/games/wrong-lyric-challenge/sessions/[id]/advance`
- `POST /api/games/wrong-lyric-challenge/sessions/[id]/pause`
- `POST /api/games/wrong-lyric-challenge/sessions/[id]/resume`
- `POST /api/games/wrong-lyric-challenge/sessions/[id]/score`
- `PATCH /api/games/wrong-lyric-challenge/calls/[id]`

## Admin UI skeleton
- Setup: `src/app/admin/games/wrong-lyric-challenge/page.tsx`
- History: `src/app/admin/games/wrong-lyric-challenge/history/page.tsx`
- Host: `src/app/admin/games/wrong-lyric-challenge/host/page.tsx`
- Assistant: `src/app/admin/games/wrong-lyric-challenge/assistant/page.tsx`
- Jumbotron: `src/app/admin/games/wrong-lyric-challenge/jumbotron/page.tsx`
- Test docs: `docs/wrong-lyric-challenge-smoke-test.md`
- Runbook: `docs/wrong-lyric-challenge-host-instructions.md`

## Development phases
1. MVP
- SQL schema + typed DB helper.
- Setup page with event selector and session list.
- Session create/list/get/history APIs with event filtering.
- Host/assistant/jumbotron scope shells.

2. Runtime hardening
- Call-state endpoints (ask/lock/reveal/score/advance).
- Audit logging for all scoring changes and skips.
- Reconnect-safe host state and optimistic concurrency guards.

3. Polish
- Keyboard-first host controls and assistant speed entry.
- Deck randomization utilities with printable host sheet.
- Pacing diagnostics (actual vs target gap) and post-session report.

## Risks and mitigations (vinyl pacing + solo host)
1. Risk: pacing drift while DJ hunts/cues between rounds.
- Mitigation: per-session pacing budget fields and visible host gap timer.

2. Risk: co-host dependency causing failure on understaffed nights.
- Mitigation: host-first flow remains complete without assistant; assistant is additive.

3. Risk: lyric ambiguity/disputes in noisy brewery rooms.
- Mitigation: strict per-call answer key with host notes and dispute log.

4. Risk: audience confusion when options/reveal timing is unclear.
- Mitigation: simple jumbotron state machine with explicit choose/locked/reveal cues.
