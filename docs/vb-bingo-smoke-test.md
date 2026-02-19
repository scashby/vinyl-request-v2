# Vinyl Bingo Smoke Test

1. In Supabase SQL Editor, run `sql/reset-all-games.sql`.
2. Run `sql/create-vb-bingo.sql`.
3. Run `sql/seed-vb-bingo-demo.sql`.
4. Open `/admin/games/bingo`.
5. In `Create Session`:
   - Playlist: `Demo Vinyl Bingo 100`
   - Game Mode: `Single Line`
   - Card Count: `40`
   - Rounds: `3`
   - Songs per Round: `15`
   - Seconds to Next Call: `45`
   - Clip Seconds: `80`
   - Prep Buffer Seconds: `45`
   - Check all preflight items
   - Click `Create Session`
6. Verify Host screen:
   - Playlist table columns show `Column | Track | Artist | Album`
   - Call Card panel updates when calling songs
   - `Paused` toggles and countdown behavior works
   - `Prep Started`, `Called + Next`, `Completed`, and `Skip` update state
7. Open Assistant view from host:
   - Current call visible
   - Up Next (2 songs) visible with album/side/position
   - Call Card list matches host
8. Open Jumbotron view from host:
   - Current call shows `B/I/N/G/O + Track`
   - Recent calls list shows 5 by default
   - Round/countdown visible
   - Paused state displays clearly
9. Back on setup page, verify exports:
   - `Cards 2-up` download
   - `Cards 4-up` download
   - `Call Sheet` download

Expected result: end-to-end Bingo flow is operable with seeded data and no player app/login path required.
