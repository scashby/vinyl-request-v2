# Back-to-Back Connection Smoke Test

## 1. DB setup
1. Run `sql/create-back-to-back-connection-core.sql`.
2. If API schema cache lags, reload schema and retry.

Expected:
- `b2bc_*` tables exist.
- `b2bc_sessions` includes `event_id` and `playlist_id`.

## 2. Setup + create session
1. Open `/admin/games/back-to-back-connection`.
2. Select a playlist bank and (optionally) event.
3. Enter at least two teams.
4. Enter at least `round_count` pair lines.
5. Complete preflight and create session.

Expected:
- Session creates successfully.
- Browser routes to host page with `sessionId`.
- Session appears in setup recent sessions and history.

## 3. Host lifecycle
1. Click `Advance Pair`.
2. Click `Track A Played`, then `Track B Played`.
3. Click `Open Discussion`.
4. Click `Reveal Answer`.
5. Enter scores and click `Save Scores for Current Pair`.
6. Click `Pause`, then `Resume`.

Expected:
- No API errors.
- Current pair status transitions are reflected in host and jumbotron.
- Scores appear in leaderboard and persist across refresh.

## 4. Idempotent scoring
1. Re-score same team/call with changed points.

Expected:
- Existing `(session_id, team_id, call_id)` row is updated, not duplicated.

## 5. Jumbotron + assistant
1. Open `/admin/games/back-to-back-connection/jumbotron?sessionId=<id>`.
2. Open `/admin/games/back-to-back-connection/assistant?sessionId=<id>`.

Expected:
- Jumbotron hides answer until reveal.
- Scoreboard reflects latest totals when enabled.
- Assistant view shows current pair + leaderboard + upcoming pairs.

## 6. Event-aware history
1. Open `/admin/games/back-to-back-connection/history`.
2. Filter by event.

Expected:
- Only sessions for selected event appear.
- Event-linked and unlinked sessions both supported.
