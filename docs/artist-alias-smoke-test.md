# Artist Alias Smoke Test

## 1. DB setup
1. Run `sql/create-artist-alias-core.sql`.
2. If PostgREST cache is stale, reload schema and retry.

Expected:
- `aa_sessions`, `aa_session_teams`, `aa_session_rounds`, `aa_session_calls`, `aa_team_scores`, and `aa_session_events` exist.

## 2. Setup flow
1. Open `/admin/games/artist-alias`.
2. Select an event (optional, but recommended for history filtering).
3. Select a playlist bank with enough tracks for your round count.
4. Enter at least 2 teams.
5. Paste clue cards in format:
- `Artist | Era clue | Collaborator clue | Label/Region clue | aliases comma list optional | audio clue optional | source optional`
6. Complete preflight checklist.
7. Click `Create Session`.

Expected:
- Session is created and routed to host page.
- Session appears in setup list with event label and call totals.

## 3. Host lifecycle
1. Open `/admin/games/artist-alias/host?sessionId=<id>`.
2. Click `Advance Card` to open first call at `stage_1`.
3. Progress clues using `Stage 1`, `Stage 2`, `Stage 3`.
4. Enter sample scores for each team and click `Save Scores for Current Card`.
5. Click `Advance Card` again and repeat one more round.
6. Click `Pause`, then `Resume`.

Expected:
- Call statuses transition without API errors.
- Session `current_call_index` and round advance correctly.
- Leaderboard updates after score save.
- Session status changes to paused/running from controls.

## 4. Jumbotron + Assistant
1. Open `/admin/games/artist-alias/jumbotron?sessionId=<id>`.
2. Open `/admin/games/artist-alias/assistant?sessionId=<id>`.
3. Trigger stage changes from host.

Expected:
- Jumbotron clue visibility matches stage progression.
- Artist answer remains hidden until scored.
- Assistant screen reflects current card state and live scoreboard.

## 5. Pull list export
1. Return to setup list.
2. Click `Pull List PDF`.

Expected:
- PDF downloads with clue-card rows and cue details.

## 6. History + event filter
1. Open `/admin/games/artist-alias/history`.
2. Filter by event.

Expected:
- Session appears in all-events view and event-filtered view.
- Teams / asked / scored counts render.
