# Lyric Gap Relay Module Plan

## Module summary
- Game: Lyric Gap Relay
- Core loop: play to a lyric stop-point, cut audio, teams write/say next line.
- Scoring: 2 exact, 1 close-enough, 0 miss.
- Operating environment: single DJ, two turntables, brewery floor, limited technology.

## Host/assistant/jumbotron scope recommendation
- Host: Required in MVP. One-column flow for ask -> lock -> reveal official line -> score -> advance.
- Assistant: Optional. Scoring helper only with no transport/round controls.
- Jumbotron: MVP-lite. Prompt state + cue lyric + scoreboard/rubric, with answer hidden until reveal.

## Data model proposal (sessions, rounds, calls, scoring)
- `lgr_sessions`: top-level session config, pacing budget, scoring policy, runtime status.
- `lgr_session_rounds`: one row per round (`round_number`, `status`) to support round lifecycle and recovery.
- `lgr_session_calls`: official answer key per round (`cue_lyric`, `answer_lyric`, `accepted_answers`), source notes, call status.
- `lgr_session_teams`: team roster.
- `lgr_team_scores`: per-team per-call scoring (`exact_match`, `close_match`, `awarded_points`).
- `lgr_session_events`: append-only audit timeline for host actions and score corrections.

SQL schema file: `sql/create-lyric-gap-relay-core.sql`

## Event linkage requirements
- `lgr_sessions.event_id` references `public.events(id)` with `ON DELETE SET NULL`.
- Session create/list/get APIs include `event_id`.
- Admin setup/list and history views include event filter controls.

## API route skeleton plan
- `GET /api/games/lyric-gap-relay/events`
- `GET /api/games/lyric-gap-relay/sessions?eventId=`
- `POST /api/games/lyric-gap-relay/sessions`
- `GET /api/games/lyric-gap-relay/sessions/[id]`
- `PATCH /api/games/lyric-gap-relay/sessions/[id]`
- `GET /api/games/lyric-gap-relay/sessions/history?eventId=`

Future host runtime endpoints
1. `POST /api/games/lyric-gap-relay/sessions/[id]/advance`
2. `POST /api/games/lyric-gap-relay/sessions/[id]/pause`
3. `POST /api/games/lyric-gap-relay/sessions/[id]/resume`
4. `POST /api/games/lyric-gap-relay/sessions/[id]/score`
5. `PATCH /api/games/lyric-gap-relay/calls/[id]`

## Admin UI skeleton
- Setup: `src/app/admin/games/lyric-gap-relay/page.tsx`
- History: `src/app/admin/games/lyric-gap-relay/history/page.tsx`
- Host: `src/app/admin/games/lyric-gap-relay/host/page.tsx`
- Assistant: `src/app/admin/games/lyric-gap-relay/assistant/page.tsx`
- Jumbotron: `src/app/admin/games/lyric-gap-relay/jumbotron/page.tsx`
- Help: `src/app/admin/games/lyric-gap-relay/help/page.tsx`
- Operator docs: `docs/lyric-gap-relay-instructions.md`
- Test checklist: `docs/lyric-gap-relay-smoke-test.md`

## Development phases
1. MVP
- Setup page and session create/list/get/history APIs.
- Event selector in setup and event filter in setup/history lists.
- Host recommendation shell and jumbotron recommendation shell.
- Official answer-key fields in data model and setup deck input.

2. Runtime hardening
- Host action endpoints (advance/pause/resume/score).
- Score correction workflow with audit trail.
- Recovery-safe status transitions and reconnect state.

3. Polish
- Keyboard-first host shortcuts for 2/1/0 scoring.
- Printable answer-key and score sheets.
- Session analytics: average call duration, dispute frequency, pacing drift.

## Risks and mitigations (vinyl pacing + solo host)
1. Risk: pacing drift from crate search and cue variance.
- Mitigation: explicit per-session pacing budget (`target_gap_seconds`), preflight checklist, and tie-break/backup gap pre-staging.

2. Risk: solo host overload while scoring disputes.
- Mitigation: default official-key mode, single-action host progression, optional assistant scorer that cannot alter transport flow.

3. Risk: lyric disputes in noisy brewery environment.
- Mitigation: accepted-answer list per call plus official answer key and notes field for rulings.

4. Risk: visibility/readability from distance.
- Mitigation: jumbotron limited to few states with high-contrast, oversized lyric lines and rubric.
