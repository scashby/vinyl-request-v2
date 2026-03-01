# Lyric Gap Relay Smoke Test

## 1. DB setup
1. Run `sql/create-lyric-gap-relay-core.sql`.
2. If API schema cache lags, reload schema and retry.

## 2. Setup page
1. Open `/admin/games/lyric-gap-relay`.
2. Confirm optional event dropdown loads.
3. Enter at least 2 teams.
4. Enter at least 10 valid lyric gaps.
5. Complete preflight checklist.
6. Create session.

Expected:
- Session is created and routed to host page.
- Session appears under Existing Sessions.

## 3. Host lifecycle
1. Click `Advance Gap`.
2. Confirm current gap card updates with cue lyric.
3. Click `Mark Asked`, then `Lock Answers`, then `Reveal`.
4. Enter team scores and click `Save Scores for Current Gap`.
5. Click `Pause` and verify timer freezes.
6. Click `Resume` and verify timer continues.
7. Click `Advance Gap` until completion.

Expected:
- No API errors.
- Call status transitions persist.
- Session ends in `completed` when all gaps are consumed.

## 4. Jumbotron
1. Open `/admin/games/lyric-gap-relay/jumbotron?sessionId=<id>`.
2. Run host lifecycle actions again.

Expected:
- Cue lyric visible during asked/locked states.
- Official answer appears only after reveal/scored states.
- Leaderboard updates after score save.

## 5. Idempotent scoring
1. Re-submit scores for the same gap with changed points.

Expected:
- Existing `(session_id, team_id, call_id)` rows are updated, not duplicated.
- Leaderboard reflects latest values.

## 6. Event-aware history
1. Open `/admin/games/lyric-gap-relay/history`.
2. Filter by event and compare all-events view.

Expected:
- Event filter narrows results correctly.
- Row shows team count, asked count, scored count, and status.
