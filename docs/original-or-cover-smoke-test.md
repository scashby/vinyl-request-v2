# Original or Cover Smoke Test (Playlist-First)

## 1. DB setup
1. Run `sql/create-original-or-cover-core.sql`.
2. If API schema cache lags, reload PostgREST schema and retry.

Expected:
- `ooc_sessions`, `ooc_session_rounds`, `ooc_session_calls`, `ooc_session_teams`, `ooc_team_scores`, and `ooc_session_events` exist.
- `ooc_sessions` includes `event_id`, `playlist_id`, and countdown pause/resume fields.

## 2. Setup page
1. Open `/admin/games/original-or-cover`.
2. Select an event (optional) and playlist bank (required).
3. Enter at least 2 teams.
4. Paste at least 8 valid pair rows in parser format.
5. Complete all preflight checkboxes.
6. Click `Create Session`.

Expected:
- Session is created and routed to host.
- Session appears in `Recent Sessions`.
- Event filter works in setup list and history.

## 3. Host runtime flow
1. Open `/admin/games/original-or-cover/host?sessionId=<id>`.
2. Click `Advance Call`.
3. Confirm call status becomes `asked`.
4. Click `Reveal`.
5. Enter team scoring rows and click `Save Scores for Current Call`.
6. Click `Pause`, then `Resume`.
7. Click `Advance Call` repeatedly until completion.

Expected:
- No API errors.
- Call state transitions persist (`pending -> asked -> revealed -> scored/skip`).
- Leaderboard totals update after score save.
- Session status can move to `completed` when no calls remain.

## 4. Jumbotron + assistant
1. Open `/admin/games/original-or-cover/jumbotron?sessionId=<id>`.
2. Open `/admin/games/original-or-cover/assistant?sessionId=<id>`.
3. Trigger host actions (advance/reveal/score).

Expected:
- Jumbotron updates prompt and answer reveal state.
- Assistant view updates current call and leaderboard.
- Scoreboard visibility respects session toggles.

## 5. Pull list PDF
1. In setup `Recent Sessions`, click `Pull List PDF` for the session.

Expected:
- Pull list PDF downloads successfully.
- Rows include round/call order, spin track, and answer detail.

## 6. Idempotent score save
1. Re-score the same call with changed points.

Expected:
- `(session_id, team_id, call_id)` rows are updated, not duplicated.
- Leaderboard reflects latest saved values.
