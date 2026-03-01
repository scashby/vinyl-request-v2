# Artist Alias Host Instructions (Solo DJ)

## Goal
Run a full Artist Alias round loop while preserving vinyl pacing and clear score logic.

## Pre-show checklist
1. Confirm all clue cards have all 3 stages:
- Stage 1: era
- Stage 2: collaborator
- Stage 3: label/region
2. Confirm accepted aliases are listed for ambiguous artists.
3. Confirm optional audio clue source is ready only for fallback.
4. Verify pull order and sleeve order to reduce crate-hunting delay.
5. Keep one tie-break card ready outside normal round count.

## Live round sequence
1. `Advance Card` (opens next card at stage 1).
2. Read stage 1 clue; allow quick team lock-ins.
3. If needed, trigger `Stage 2`, then `Stage 3`.
4. Collect team answers (slips/assistant).
5. Score each team in host panel:
- Mark `Exact match` on accepted artist/alias
- Set `guessed_at_stage`
- Override points only when needed (default is stage-based)
6. Click `Save Scores for Current Card`.
7. Repeat.

## Scoring model
- Exact + stage 1: `stage_one_points` (default 3)
- Exact + stage 2: `stage_two_points` (default 2)
- Exact + stage 3: `final_reveal_points` (default 1)
- Non-exact: 0 by default unless host overrides.

## Alias handling rule
1. Exact match includes canonical artist name or any listed alias.
2. If alias is contested and not prelisted, record note and apply floor ruling consistently.
3. Keep disputes brief; avoid interrupting cue flow.

## Pacing guardrails
1. Keep stage progression strict: do not skip back/forth between stages.
2. Use `Pause` only for true floor interruptions.
3. Keep host notes short and actionable; avoid long ad-hoc adjudication.
4. If pace slips, reduce banter and rely on stage hints + scoreboard clarity.

## Failure recovery
1. Bad cue or damaged record:
- `Skip` current card and continue.
2. Missed score entry:
- Re-submit score for same card/team (upsert behavior updates existing row).
3. Session end:
- Advancing after final card marks session `completed`.
