# Genre Imposter Operator Guide

## Quick rules
- Each round has 3 spins.
- Exactly 1 spin is the imposter.
- Team scoring:
  - `+2` correct imposter.
  - `+1` correct reason (only when imposter pick is correct).

## Solo-host workflow (recommended)
1. Setup
- Open `/admin/games/genre-imposter`.
- Select event and playlist bank.
- Either paste manual round deck, or leave it blank for auto-generated rounds.
- Complete preflight and create session.

2. Host runtime
- Open `/admin/games/genre-imposter/host?sessionId=<id>`.
- Use `Advance Spin` to run slots 1, 2, 3.
- Use call status buttons when needed (`Cued`, `Played`, `Reveal`, `Scored`, `Skip`).
- Capture picks in the host grid if running solo.
- Click `Save Picks`, then `Score Round`.
- Repeat for next round.

3. Assistant runtime (optional)
- Open `/admin/games/genre-imposter/assistant?sessionId=<id>`.
- Enter team picks and reasons while host manages playback.
- Save picks after spin 3.
- Score round from assistant only if host delegates that responsibility.

4. Jumbotron
- Open `/admin/games/genre-imposter/jumbotron?sessionId=<id>`.
- Keep this view read-only for audience display.
- Category and scoreboard obey session display toggles.

## Pacing defaults
- `remove_resleeve_seconds`: 20
- `find_record_seconds`: 12
- `cue_seconds`: 12
- `host_buffer_seconds`: 10
- Typical target gap: `54s`

## Reason scoring policy
- `host_judged`: host/assistant checks the reason bonus manually.
- `strict_key`: reason bonus can be checked against round `reason_key` (with optional override).

## Operational tips
- Keep one tie-break round staged in the crate.
- If table discussion runs long, lock picks verbally before reveal.
- Use short reason notes to reduce scoring ambiguity.
- Keep host controls keyboard/mouse simple during record handling.
