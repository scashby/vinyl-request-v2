# Bingo Track Swap Runbook

Use this when you must replace a specific song in a single Bingo game session because of a sensitive incident, damaged media, or missing media.

## Script

- SQL utility: [sql/swap-bingo-session-track.sql](sql/swap-bingo-session-track.sql)

## What It Updates

- Session source playlists (master, sub, round playlists) in collection_playlist_items
- Session mirror Bingo playlists in collection_playlist_items
- Session round snapshots in bingo_session_round_tracks
- Session calls in bingo_session_calls
- Stored game playlist call_order JSON in bingo_session_game_playlists
- Legacy call_order JSON in bingo_session_crates (if table exists)
- Card grids in bingo_cards
- Bingo crate pull mirror rows in crate_items for crates matching session code

## How To Run

1. Open [sql/swap-bingo-session-track.sql](sql/swap-bingo-session-track.sql).
2. Edit the VALUES row in _swap_params:
   - session_id
   - from_artist
   - from_title
   - to_artist
   - to_title
3. Run the script in Supabase SQL editor.
4. Review final summary output and update counts.
5. If needed, refresh metadata from Admin using the session refresh metadata endpoint.

## Requested Replacement Example

Set values to:

- from_artist: Cutting Crew
- from_title: (I just) Died In your Arms
- to_artist: Devo
- to_title: Whip It

You only need to supply the correct session_id for the target game.

## Safety Notes

- The script aborts if it cannot resolve source or destination tracks.
- The script aborts if a key collision would violate unique constraints.
- The script runs in a single transaction.
