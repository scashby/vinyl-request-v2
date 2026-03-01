# Cover Art Clue Chase Smoke Test

## Goal
Verify the Cover Art Clue Chase module can complete a full session flow: create, start, reveal stages, score, advance, and complete.

## Prerequisites
- Run SQL: `sql/create-cover-art-clue-chase-core.sql`
- At least one `events` row exists (optional linkage)
- At least one `collection_playlists` row exists (required for setup)
- Dev server running: `npm run dev`

## Setup Test
1. Open `http://localhost:3000/admin/games/cover-art-clue-chase`.
2. Select an event (optional).
3. Select a playlist bank (required).
4. Keep default scoring `3/2/1` and round count `8-14`.
5. Paste at least `round_count` valid call lines.
6. Complete preflight checks.
7. Click `Create Session`.

Expected:
- Session appears in recent list.
- Host page opens with `sessionId` in URL.

## Host Flow Test
1. On host page, click `Start Session`.
2. Confirm call #1 is active and status is `stage_1`.
3. Click `Reveal 2`, then `Final/Audio`.
4. In scoring section, mark one team as exact at stage 1 and one as exact at stage 3.
5. Click `Save Scores`.
6. Confirm call status becomes `scored` and leaderboard updates.
7. Click `Advance Call`.
8. Repeat through all calls.

Expected:
- Session status moves to `completed` when no next call exists.
- History page shows asked/scored counts.

## API Spot Checks
- List sessions (event-aware):
  - `GET /api/games/cover-art-clue-chase/sessions?eventId=<id>`
- Session detail:
  - `GET /api/games/cover-art-clue-chase/sessions/<sessionId>`
- Calls + pull-list data:
  - `GET /api/games/cover-art-clue-chase/sessions/<sessionId>/calls`
- Leaderboard:
  - `GET /api/games/cover-art-clue-chase/sessions/<sessionId>/leaderboard`
- Runtime actions:
  - `POST /api/games/cover-art-clue-chase/sessions/<sessionId>/start`
  - `POST /api/games/cover-art-clue-chase/sessions/<sessionId>/pause`
  - `POST /api/games/cover-art-clue-chase/sessions/<sessionId>/resume`
  - `POST /api/games/cover-art-clue-chase/sessions/<sessionId>/advance`
  - `POST /api/games/cover-art-clue-chase/sessions/<sessionId>/reveal`
  - `POST /api/games/cover-art-clue-chase/sessions/<sessionId>/score`

## Failure Cases to Verify
- Session create without `playlist_id` returns `400`.
- Session create with <2 teams returns `400`.
- Session create with fewer than `round_count` valid calls returns `400`.
- Score submission with invalid team id returns `400`.
- Start on already started session returns `409`.
