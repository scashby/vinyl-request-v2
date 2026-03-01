# Wrong Lyric Challenge Host Instructions

## Roles
- Host: presents options, controls lock/reveal, final scoring authority.
- DJ: cues and spins track clips in round order.
- Assistant (optional): captures table picks and score input only.

## Round flow (recommended)
1. Host opens next call (`Advance Call` if needed).
2. Host reads options (or confirms jumbotron options are visible).
3. Teams lock choice.
4. Host marks `Lock Picks`.
5. DJ plays the prepared clip.
6. Host marks `Reveal` and confirms correct lyric.
7. Host/assistant records scoring and saves.
8. Host advances to next call.

## Scoring policy
- Base: `lyric_points` for correct lyric option.
- Bonus: `song_bonus_points` when enabled and awarded.
- Suggested default rubric: `2 + optional 1`.

## Pacing guardrails (vinyl-first)
- Use `target_gap_seconds` as hard pacing budget between calls.
- Keep one tie-break call and one backup call staged physically.
- Pre-mark crate order and cue hints before session start.
- If cueing slips, use `Pause` while resetting instead of silent dead air.

## Solo-host fallback
- Keep assistant screen optional; host screen can run full lifecycle.
- Prefer `host_reads` reveal mode when no dedicated jumbotron operator.
- Avoid extra dispute handling in-round; log a note and continue.

## Dispute handling
- Record disputes in score `notes` field.
- Apply one scoring interpretation per session for consistency.
- Use score overwrite (same team + same call) to correct mistakes cleanly.
