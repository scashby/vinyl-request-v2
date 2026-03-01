# Crate Categories Instructions

## Purpose
Crate Categories runs category-led rounds where each round keeps one prompt type and 3-5 prepared tracks.

## 1. Setup checklist
1. Run `sql/create-crate-categories-core.sql`.
2. Open `/admin/games/crate-categories`.
3. Select `Event (optional)` and a required `Playlist Bank`.
4. Configure rounds, default tracks/round, and pacing budget.
5. Enter team names (2+), round rows, and call rows.
6. Complete preflight checks, then create a session.

## 2. Round design rule
- Keep one `prompt_type` per round.
- Score each team once per round (not once per track).

## 3. Prompt type rubric guidance
- `identify-thread`: base points for correct category thread, bonus for precise artist/title support.
- `odd-one-out`: base points for correct odd track, bonus for accurate reason.
- `belongs-or-bust`: base points for all belongs calls, bonus for no false-positive picks.
- `decade-lock`: base points for correct era lock, bonus for naming exact year anchor.
- `mood-match`: base points for matching declared mood, bonus for strongest justification.

## 4. Host flow (live test)
1. Open `/admin/games/crate-categories/host?sessionId=<id>`.
2. Use `Advance Track` to start each prepared call.
3. Mark call status with `Mark Playing`, `Reveal`, `Mark Scored`, or `Skip`.
4. Enter round points in `Round Score Entry` and save.
5. Use `Pause`/`Resume` as needed for cue timing recovery.

## 5. Jumbotron flow
- Open `/admin/games/crate-categories/jumbotron?sessionId=<id>`.
- Screen shows category/prompt state, track counter, reset countdown, and optional leaderboard.
- Answer text is hidden until call status reaches `revealed`.

## 6. Data model summary
- Sessions: `ccat_sessions` (includes `event_id`, `playlist_id`, countdown state).
- Rounds: `ccat_session_rounds` (category + prompt + scoring rubric).
- Calls: `ccat_session_calls` (track slots within each round).
- Scores: `ccat_round_scores` (team round points).
- Audit lane: `ccat_session_events`.
