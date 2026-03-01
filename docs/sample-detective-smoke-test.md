# Sample Detective Smoke Test

## 1. DB setup
1. Run `sql/create-sample-detective-core.sql`.
2. Re-run once to verify idempotent behavior.

Expected:
- `sd_*` tables exist.
- `sd_sessions.event_id` and `sd_sessions.playlist_id` are nullable FKs.

## 2. Setup page + create
1. Open `/admin/games/sample-detective`.
2. Confirm event and playlist dropdowns load.
3. Select playlist and verify minimum-track validation appears.
4. Enter 2+ teams and 6+ valid call rows.
5. Complete preflight checks and click `Create Session`.

Expected:
- Redirect to host page.
- Session appears in recent sessions.
- Event and playlist labels render in list.

## 3. Host flow
1. Click `Advance Call`.
2. Confirm current call card updates.
3. Click `Reveal Source`.
4. Score teams and click `Save Scores for Current Call`.
5. Click `Pause`, then `Resume`.
6. Click `Skip` on a later call.

Expected:
- No API errors.
- Call statuses transition (`pending -> asked -> revealed -> scored/skipped`).
- Leaderboard totals update after score save.

## 4. Assistant + jumbotron
1. Open `/admin/games/sample-detective/assistant?sessionId=<id>`.
2. Open `/admin/games/sample-detective/jumbotron?sessionId=<id>`.

Expected:
- Assistant shows current prompt and scoring-only controls.
- Jumbotron hides source until reveal/scored state.
- Jumbotron scoreboard updates after scoring.

## 5. Pull list PDF
1. From setup page recent sessions, click `Pull List PDF`.

Expected:
- PDF downloads with call index, round, sampled track, source detail, and notes.

## 6. History + event filter
1. Open `/admin/games/sample-detective/history`.
2. Filter by event.

Expected:
- Sessions filter correctly by event.
- Row metrics show teams, asked count, scored count, and status.

## 7. Idempotent scoring
1. Re-score the same call with updated points.

Expected:
- Score rows update in place (`session_id, team_id, call_id` upsert).
- Leaderboard reflects latest values without duplicate score rows.
