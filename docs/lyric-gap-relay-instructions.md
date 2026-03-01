# Lyric Gap Relay Instructions

## Module goal
- Play to a lyric stop-point.
- Teams supply the next line.
- Host scores responses using official key: `2 exact / 1 close / 0 miss`.

## Setup checklist
1. Run `sql/create-lyric-gap-relay-core.sql`.
2. Open `/admin/games/lyric-gap-relay`.
3. Optionally select an event (stored as `event_id` on session).
4. Enter at least two teams.
5. Enter 10-15 lyric gaps.
6. Complete preflight checklist and create session.

## Deck line format
Each line in setup should follow:

```text
Artist - Title | Cue lyric text >>> Official answer text ;; Optional alternate answer | Source note
```

Notes:
- The text before `>>>` is the cue lyric you stop on.
- The first phrase after `>>>` is the official answer line.
- Any additional `;;` phrases are accepted alternates.

## Host flow
1. Click `Advance Gap` to move to the next call.
2. Click `Mark Asked` once cue lyric has been played/stopped.
3. Click `Lock Answers` after team responses are in.
4. Click `Reveal` to show official line.
5. Score each team and click `Save Scores for Current Gap`.
6. Use `Pause`/`Resume` to absorb vinyl reset delays.

## Jumbotron behavior
- Shows cue lyric and round status.
- Keeps official answer hidden until reveal.
- Shows rubric and leaderboard based on session toggles.

## Event linkage behavior
- Sessions store optional `event_id -> public.events(id)` (`ON DELETE SET NULL`).
- Setup session list and history page accept event filters.
- Session detail APIs return linked event payload when present.

## Useful endpoints
- `GET /api/games/lyric-gap-relay/events`
- `GET /api/games/lyric-gap-relay/sessions?eventId=`
- `POST /api/games/lyric-gap-relay/sessions`
- `GET /api/games/lyric-gap-relay/sessions/[id]`
- `GET /api/games/lyric-gap-relay/sessions/[id]/calls`
- `GET /api/games/lyric-gap-relay/sessions/[id]/leaderboard`
- `POST /api/games/lyric-gap-relay/sessions/[id]/advance`
- `POST /api/games/lyric-gap-relay/sessions/[id]/pause`
- `POST /api/games/lyric-gap-relay/sessions/[id]/resume`
- `POST /api/games/lyric-gap-relay/sessions/[id]/score`
- `PATCH /api/games/lyric-gap-relay/calls/[id]`

## Operational tips (solo host)
- Keep one backup tie-break gap pre-cued.
- Keep a printed answer key and mark close-acceptable variants before game start.
- Keep host actions sequential: ask -> lock -> reveal -> score -> advance.
