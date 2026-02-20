# Music Trivia Instructions (Additive-Only)

Rules for this module:
- This is an additive rollout.
- Do not drop/reset game tables as part of Trivia setup.
- Do not run destructive SQL unless explicitly requested.

## 1. DB setup
1. Run `sql/create-trivia-core.sql`.
2. Keep existing Bingo tables/data untouched.

## 2. Setup page
1. Open `/admin/games/music-trivia`.
2. Confirm event dropdown loads (optional).
3. Enter at least 2 team names.
4. Complete preflight checklist.
5. Create a session.

Expected:
- Session is created and routed to host page.
- Session appears under Existing Sessions.

## 3. Host flow
1. Click `Advance Question`.
2. Verify current question renders.
3. Click `Mark Asked` and then `Reveal Answer`.
4. Score each team and click `Save Scores for Current Question`.
5. Click `Pause` and verify timer freezes.
6. Click `Resume` and verify timer continues.

Expected:
- No API errors.
- Call status transitions update correctly.
- Leaderboard totals update after score save.

## 4. Jumbotron
1. Open `/admin/games/music-trivia/jumbotron?sessionId=<id>`.
2. Confirm current question displays.
3. Reveal answer from host.

Expected:
- Jumbotron reflects round/question counters based on toggles.
- Answer appears only after reveal/scored status.
- Leaderboard panel appears when enabled.

## 5. Idempotent scoring
1. Re-submit score for the same question with changed points.

Expected:
- Existing `(session_id, team_id, call_id)` score rows are updated (not duplicated).
- Leaderboard reflects latest values.

## 6. History
1. Open `/admin/games/music-trivia/history`.
2. Confirm session row appears.

Expected:
- History shows teams, asked count, scored count, and status.
