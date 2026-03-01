# Crate Categories Smoke Test

## 1. DB setup
1. Run `sql/create-crate-categories-core.sql`.
2. If schema cache lags, reload PostgREST schema and retry.

Expected:
- `ccat_*` tables exist.
- `ccat_sessions` includes `event_id`, `playlist_id`, and countdown fields.

## 2. Setup page + create
1. Open `/admin/games/crate-categories`.
2. Pick a playlist with enough tracks for your configured rounds.
3. Enter at least 2 team names.
4. Add valid rounds + calls and complete preflight.
5. Create session.

Expected:
- Session is created and routed to host page.
- Session appears in Recent Sessions list with event and playlist info.

## 3. Host lifecycle
1. Click `Advance Track`.
2. Verify current call is marked playing.
3. Click `Reveal`.
4. Enter round scores and click `Save Scores For Round`.
5. Click `Pause` then `Resume`.
6. Repeat until all calls are exhausted.

Expected:
- No API errors.
- Call statuses update correctly.
- Round closes after score save.
- Session completes after final progression.

## 4. Jumbotron behavior
1. Open `/admin/games/crate-categories/jumbotron?sessionId=<id>`.
2. Observe round/category/prompt and track counter.
3. Trigger reveal from host.

Expected:
- Answer text stays hidden before reveal.
- Countdown and paused state reflect host actions.
- Leaderboard updates after scoring.

## 5. Pull-list PDF
1. From setup page, click `Pull List PDF` on the created session.

Expected:
- PDF downloads.
- Rows include round/call ordering and detail metadata.

## 6. History filter
1. Open `/admin/games/crate-categories/history`.
2. Filter by event and refresh.

Expected:
- Only sessions for selected event are shown.
