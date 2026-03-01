# Decade Dash Smoke Test

## 1. DB setup
1. Run `sql/create-decade-dash-core.sql`.
2. If schema cache lags, reload PostgREST/Supabase schema and retry.

## 2. Setup page
1. Open `/admin/games/decade-dash`.
2. Select event (optional) and playlist bank.
3. Add at least 2 teams.
4. Add call rows using `Artist - Title | year | source`.
5. Complete preflight checklist and create session.

Expected:
- Session is created.
- Redirect lands on host page.
- Session appears in recent sessions.

## 3. Host lifecycle
1. Open `/admin/games/decade-dash/host?sessionId=<id>`.
2. Click `Advance Call`.
3. Click `Lock Picks`.
4. Click `Reveal Decade`.
5. Enter team decades and save scores.
6. Click `Advance Call` until final call.

Expected:
- Call status moves through `asked -> locked -> revealed -> scored`.
- Leaderboard totals update after each score save.
- Session status changes to `completed` after last call.

## 4. Assistant + jumbotron
1. Open `/admin/games/decade-dash/assistant?sessionId=<id>`.
2. Open `/admin/games/decade-dash/jumbotron?sessionId=<id>`.
3. Score one call from assistant and refresh host.

Expected:
- Assistant score save succeeds and host leaderboard reflects updates.
- Jumbotron state follows host call status and shows revealed decade only after reveal/scored.

## 5. Event filtering
1. Open `/admin/games/decade-dash/history`.
2. Filter by event used in setup.

Expected:
- Session appears when filtered by its event.
- Session is hidden for non-matching event filters.

## 6. Pull list export
1. From Decade Dash setup recent sessions, click `Pull List PDF`.

Expected:
- PDF downloads with call index, track metadata, and decade detail rows.
