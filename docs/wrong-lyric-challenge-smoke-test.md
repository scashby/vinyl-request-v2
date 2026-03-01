# Wrong Lyric Challenge Smoke Test (Co-Host)

## 1. DB setup
1. Run `sql/create-wrong-lyric-challenge-core.sql`.
2. If PostgREST cache is stale, reload schema and retry.

Expected:
- `wlc_sessions`, `wlc_session_calls`, `wlc_session_teams`, `wlc_team_scores` exist.
- `wlc_sessions.event_id` and `wlc_sessions.playlist_id` are nullable FKs.

## 2. Setup page + event linkage
1. Open `/admin/games/wrong-lyric-challenge`.
2. Confirm event and playlist selectors load.
3. Select an event (optional), a playlist bank, and enter at least 2 teams.
4. Paste at least `round_count` valid call lines.
5. Click `Create Session`.

Expected:
- Session is created and routed to host page.
- Session appears in setup list with event label and call totals.

## 3. Host lifecycle
1. From host page, click `Advance Call`.
2. Click `Lock Picks` then `Reveal`.
3. Enter scores and click `Save Scores for Current Call`.
4. Click `Pause`, wait 3 seconds, click `Resume`.
5. Click `Advance Call` again.

Expected:
- Call status transitions: `pending -> asked -> locked -> revealed -> scored`.
- Leaderboard totals change after save.
- Remaining timer pauses/resumes correctly.

## 4. Assistant scoring helper
1. Open `/admin/games/wrong-lyric-challenge/assistant?sessionId=<id>`.
2. Enter score marks for current call and save.

Expected:
- Assistant can save scoring rows without host transport controls.
- Host page leaderboard reflects assistant-saved points.

## 5. Jumbotron behavior
1. Open `/admin/games/wrong-lyric-challenge/jumbotron?sessionId=<id>`.
2. Confirm prompt changes with host statuses.
3. Before reveal, verify no highlighted correct option.
4. After reveal/scored, verify correct option is highlighted.

Expected:
- Jumbotron respects `show_title`, `show_round`, `show_options`, `show_scoreboard` toggles.
- Prompt state changes track host transitions.

## 6. Pull list PDF
1. From setup `Recent Sessions`, click `Pull List PDF`.

Expected:
- PDF downloads with call rows in call order.
- Detail includes correct slot, correct lyric, and cue hints.

## 7. History + event filter
1. Open `/admin/games/wrong-lyric-challenge/history`.
2. Filter by the selected event.

Expected:
- Session appears with teams, calls asked, calls scored, and status.
- Event filter narrows rows correctly.
