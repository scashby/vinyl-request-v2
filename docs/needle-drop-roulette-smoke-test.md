# Needle Drop Roulette Smoke Test (Host + Score Flow)

## 1. DB setup
1. Run `sql/create-needle-drop-roulette-core.sql`.
2. Confirm `ndr_sessions`, `ndr_session_calls`, and `ndr_team_scores` exist.

## 2. Setup page
1. Open `/admin/games/needle-drop-roulette`.
2. Select event (optional) and playlist bank.
3. Enter at least 2 teams.
4. Provide at least `round_count` call rows.
5. Complete preflight checklist.
6. Create session.

Expected:
- Session is created and routed to host page.
- Session appears in Existing Sessions with event label.

## 3. Host round lifecycle
1. Click `Advance Drop`.
2. Confirm current drop status becomes `asked`.
3. Click `Lock Answers`.
4. Click `Reveal`.
5. Enter score grid values and click `Save Scores for Current Drop`.
6. Confirm leaderboard updates.

Expected:
- No API errors.
- Call status transitions persist.
- Team totals update after score save.

## 4. Pause/resume
1. Click `Pause`.
2. Confirm session status changes to `paused`.
3. Click `Resume`.
4. Confirm session status changes back to `running`.

Expected:
- Host controls continue operating after resume.

## 5. Jumbotron + assistant sync
1. Open `/admin/games/needle-drop-roulette/jumbotron?sessionId=<id>`.
2. Open `/admin/games/needle-drop-roulette/assistant?sessionId=<id>`.
3. Advance/reveal/score from host.

Expected:
- Jumbotron hides answer until reveal/scored state.
- Assistant reflects active call and scoreboard updates.

## 6. History + event filter
1. Open `/admin/games/needle-drop-roulette/history`.
2. Filter by selected event.

Expected:
- Session appears with asked/scored counts and event title.
