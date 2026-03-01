# Cover Art Clue Chase Host Runbook

## Round Loop
1. Confirm active call is loaded in host panel.
2. Reveal stage 1 image.
3. If needed, reveal stage 2 image.
4. Use final reveal (and optional audio clue) only when needed.
5. Score each team.
6. Advance to next call.

## Scoring Rules
- Stage 1 exact: `stage_one_points` (default 3)
- Stage 2 exact: `stage_two_points` (default 2)
- Final/audio exact: `final_reveal_points` (default 1)
- Miss: `0`

Notes:
- Use award override only for adjudication edge cases.
- Keep one scoring model for full session to avoid confusion.

## Solo-Host Stability
- Do not multitask reveal and crate search at once; use the built-in gap window.
- If pacing slips, pause session before discussing disputes.
- Keep audio clue as fallback, not primary clue path.

## Recommended Pacing Targets
- Remove + resleeve: 20s
- Find record: 12s
- Cue: 12s
- Host buffer: 10s
- Target gap total: 54s

## Preflight Checklist
- Every call has stage 1/2/3 reveal URLs.
- Stage order is hardest to easiest.
- Audio fallback clips are optional but ready.
- Teams and table labels are visible and legible.

## Recovery Playbook
- Broken image URL:
  - Move to next reveal stage, then log note in host notes.
- Crowd split dispute:
  - Save scores with explicit note and continue; avoid dead-air.
- Running behind:
  - Use stage 1 + stage 2 only for next rounds and skip audio fallback.
