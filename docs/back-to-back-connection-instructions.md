# Back-to-Back Connection Instructions

## Format overview
- Two tracks are played back-to-back each round.
- Teams submit one connection answer.
- Optional detail bonus is awarded for a specific supporting fact.

## Setup checklist
1. Open `/admin/games/back-to-back-connection`.
2. Select an event (optional but recommended for reporting).
3. Select a playlist bank that meets the minimum track guidance.
4. Set rounds, connection points, detail bonus points, and pacing budget.
5. Enter at least two teams.
6. Enter pairs as:
- `Track A Artist - Track A Title | Track B Artist - Track B Title | Accepted Connection | Optional Detail`
7. Complete preflight checklist and create session.

## Host round flow
1. Click `Advance Pair`.
2. Play track A, then click `Track A Played`.
3. Play track B, then click `Track B Played`.
4. Click `Open Discussion` and collect answers.
5. Click `Reveal Answer`.
6. Score each team and save.
7. Repeat until session is completed.

## Scoring reference
- Connection correct: `connection_points` (default `2`).
- Detail correct: `detail_bonus_points` (default `1`).
- Manual override is allowed for edge cases.

## Solo-host pacing tips
- Keep sleeves staged in exact call order.
- Use one-tap status controls as verbal cue anchors.
- Keep dispute notes short and resolve after scoring save.
- Use tie-break pair only if top teams remain tied after final round.

## Primary screens
- Setup: `/admin/games/back-to-back-connection`
- Host: `/admin/games/back-to-back-connection/host?sessionId=<id>`
- Assistant: `/admin/games/back-to-back-connection/assistant?sessionId=<id>`
- Jumbotron: `/admin/games/back-to-back-connection/jumbotron?sessionId=<id>`
- Help: `/admin/games/back-to-back-connection/help`
