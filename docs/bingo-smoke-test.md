# Bingo Smoke Test (Playlist-First)

## 1. DB setup
1. Run `sql/create-bingo-core.sql` (safe to re-run; it will add any missing columns on existing installs).
2. If Supabase/PostgREST still reports a schema cache error, reload the API schema (or run `NOTIFY pgrst, 'reload schema';`) and retry.

## 2. Setup page
1. Open `/admin/games/bingo`.
2. Confirm playlist dropdown is populated from collection playlists.
3. Select a playlist with at least 75 tracks (100 for Blackout mode).
4. Create a session.

Expected:
- Session created and routed to host page.
- Session appears under Existing Sessions.

## 3. Host + call lifecycle
1. Click `Advance`.
2. Confirm current call shows `Column - Track`.
3. Click `Prep Started`, `Called`, `Completed`.
4. Click `Pause` and verify countdown is frozen.
5. Click `Resume` and verify countdown continues.
6. Click `Skip` and verify next call becomes active.
7. Click `Replace with Next` and verify behavior is equivalent to skip+next.

Expected:
- No API errors.
- Call card and full called order update.

## 4. Assistant + Jumbotron
1. Open `/admin/games/bingo/assistant?sessionId=<id>`.
2. Open `/admin/games/bingo/jumbotron?sessionId=<id>`.

Expected:
- Assistant shows current call + next two prep rows.
- Jumbotron shows `B/I/N/G/O + Track` current call.
- Recent calls list length equals `recent_calls_limit` (default 5).
- Paused state visibly shown on jumbotron when paused.

## 5. Print artifacts
1. From setup page Existing Sessions, click:
- `Cards 2-up`
- `Cards 4-up`
- `Call Sheet`

Expected:
- PDFs download.
- Card cells readable.
- Default labels are Track + Artist.

## 6. History
1. Open `/admin/games/bingo/history`.
2. Confirm created session is listed with `calls_played` and status.
