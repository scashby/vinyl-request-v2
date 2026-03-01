# Decade Dash Instructions (Testing Build)

## Core Rules
- Teams listen to each spin and hold up one decade card.
- Default scoring is `2` points for exact decade.
- Optional adjacent scoring is `1` point for one decade away (`+10` or `-10` years).
- Standard session length is `12-20` rounds.

## Setup Checklist
1. Open `/admin/games/decade-dash`.
2. Select an event (optional, recommended for reporting/history).
3. Select a playlist bank with enough tracks for rounds + backups.
4. Enter at least 2 team names.
5. Populate the call list format: `Artist - Title | year | optional source`.
6. Confirm pacing budget values for solo DJ buffer.
7. Complete preflight checklist:
- decade cards staged on tables
- tie-break record staged
- decade cheat sheet printed
8. Create session.

## Host Flow
1. Open `/admin/games/decade-dash/host?sessionId=<id>`.
2. Click `Advance Call` to load the next prompt and mark it asked.
3. Use `Lock Picks` when teams have committed cards.
4. Use `Reveal Decade` to display the answer window.
5. Enter team scores (selected decade and points) and click `Save Scores`.
6. Repeat until complete; session auto-completes when calls are exhausted.

## Assistant Flow
1. Open `/admin/games/decade-dash/assistant?sessionId=<id>`.
2. Enter decade picks and points per team.
3. Save via assistant if host delegates scoring.
4. Do not run transport controls from assistant; host owns round progression.

## Jumbotron Flow
1. Open `/admin/games/decade-dash/jumbotron?sessionId=<id>`.
2. Keep this screen visible for crowd state:
- listen state
- locked state
- revealed decade
- scoreboard (if enabled)

## Data Expectations
- `event_id` is stored on `dd_sessions` and supports event filtering in setup/history.
- Each call must have a valid decade anchor (`decade_start`) derived from year.
- Score records are upserted by `(session_id, team_id, call_id)` to avoid duplicates.

## Solo-Host Tips
- Keep one tie-break record cued before final rounds.
- Use `Preset: All Miss` in host view for fast recovery on dead rounds.
- Keep adjacent scoring policy announced once at round one and do not change mid-session.
