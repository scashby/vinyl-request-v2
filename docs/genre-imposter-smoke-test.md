# Genre Imposter Smoke Test

## 1. DB setup
1. Run `sql/create-genre-imposter-core.sql`.
2. Verify `gi_sessions` exists with `event_id` and `playlist_id`.

Expected:
- Schema applies cleanly.
- Re-running SQL is safe.

## 2. Setup page and session creation
1. Open `/admin/games/genre-imposter`.
2. Confirm event dropdown loads.
3. Confirm playlist dropdown loads.
4. Create one session with manual rounds.
5. Create one session with empty rounds (auto-generate path).

Expected:
- Both sessions create successfully.
- Existing sessions list shows event and playlist labels.

## 3. Host runtime controls
1. Open `/admin/games/genre-imposter/host?sessionId=<id>`.
2. Click `Advance Spin` repeatedly for a round.
3. Use `Pause` then `Resume`.
4. Mark current call `Cued`, `Played`, and `Reveal`.

Expected:
- Session status transitions correctly.
- Call statuses update.
- Remaining gap timer changes and pauses/resumes.

## 4. Picks and scoring
1. In host (or assistant), assign picks for each team and click `Save Picks`.
2. Mark reason bonus checkboxes for a subset of teams.
3. Click `Score Round`.

Expected:
- Picks upsert without duplicates (`round_id,team_id` uniqueness).
- Correct imposter picks receive `+2`.
- Reason bonus applies only when imposter pick is correct.
- Leaderboard totals update immediately.

## 5. Jumbotron display
1. Open `/admin/games/genre-imposter/jumbotron?sessionId=<id>`.
2. Verify category + spin state before reveal.
3. Reveal/score from host and verify imposter display.

Expected:
- Hidden track labels before reveal state.
- Imposter answer visible after reveal/scored state.
- Leaderboard panel updates when enabled.

## 6. History and event filter
1. Open `/admin/games/genre-imposter/history`.
2. Filter by event.

Expected:
- Sessions appear in history.
- Event filter returns only linked sessions.
