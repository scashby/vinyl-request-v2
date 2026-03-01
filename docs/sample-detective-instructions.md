# Sample Detective Instructions (Testing Build)

## Purpose
- Format: teams connect sampled track to source track.
- Baseline scoring: `2` points for correct pair + `1` bonus for naming both artists.
- Runtime goal: solo-host-safe flow in brewery conditions with visible pacing buffer.

## Setup Checklist
1. Run `sql/create-sample-detective-core.sql`.
2. Open `/admin/games/sample-detective`.
3. Select event (optional but recommended) and playlist bank (required).
4. Confirm playlist minimum warning is green.
5. Enter at least 2 teams.
6. Paste call rows in format:
- `sampled artist - sampled title | source artist - source title | year | sample timestamp | source label`
7. Complete preflight checks:
- Source pairs verified
- Cue points marked
- Crate order prepared
8. Create session.

## Host Workflow
1. Open `/admin/games/sample-detective/host?sessionId=<id>`.
2. Click `Advance Call` to start next round.
3. Use `Mark Asked` when call is live.
4. Use `Reveal Source` only after answer lock.
5. Score each team (`Pair` and optional `+Both Artists`), then `Save Scores for Current Call`.
6. Use `Pause` / `Resume` as needed for floor conditions.
7. Use `Skip` for unusable call rows.

## Assistant Workflow
- Open `/admin/games/sample-detective/assistant?sessionId=<id>`.
- Use scoring-only panel to enter team results.
- Do not control transport from assistant view.

## Jumbotron Workflow
- Open `/admin/games/sample-detective/jumbotron?sessionId=<id>`.
- Prompt shows sampled track first.
- Source track appears after host reveal/scored state.
- Leaderboard display respects setup toggles.

## Operational Notes
- Keep one backup round ready for damaged media or cue misses.
- Prefer conservative pacing and visible reset windows over rushed transitions.
- Keep artist naming policy consistent for the full session.
