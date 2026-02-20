# Sample Detective Module Plan

## Summary
- Game: Sample Detective (Lower priority)
- Core mechanic: teams connect sampled song with source track.
- Environment: single DJ, two turntables, brewery floor, limited tech.
- Round shape: 6-10 rounds to keep pacing stable with cueing overhead.

## Host, Assistant, Jumbotron Scope Recommendation
- Host console (required): one-path controls for ask, lock, reveal, score, and advance.
- Host console (required): visible pacing timer using configured resleeve/find/cue/buffer budget.
- Assistant console (optional): score-entry helper and discrepancy check only.
- Jumbotron (required): current round/prompt state, scoring legend (2 + 1), reveal slide, and standby timer.

## Data Model Proposal
- `sd_sessions`
- Includes required event linkage: `event_id bigint REFERENCES public.events(id) ON DELETE SET NULL`.
- Stores round count, scoring config (2 + 1 defaults), pacing budget fields, display flags, and status lifecycle.
- `sd_session_rounds`
- One row per round (`round_number`, optional `round_title`, and round status).
- `sd_session_calls`
- One call per round with sampled/source answer key (`sampled_artist`, `sampled_title`, `source_artist`, `source_title`) plus optional `release_year`, `sample_timestamp`, and notes.
- `sd_session_teams`
- Team/table roster rows.
- `sd_team_scores`
- Per-team per-call scoring outcome with guessed fields, pair correctness, both-artist bonus marker, and awarded points.
- `sd_session_events`
- Append-only audit/event stream for host actions.

## API Route Skeleton Plan
- `GET /api/games/sample-detective/events`
- Event list for setup selector and history filter.
- `GET /api/games/sample-detective/sessions?eventId=`
- Event-aware setup list; returns `event_id`, `event_title`, and basic progress metrics.
- `POST /api/games/sample-detective/sessions`
- Creates session with `event_id`, teams, rounds, calls, scoring knobs, and pacing budget.
- `GET /api/games/sample-detective/sessions/[id]`
- Returns session + linked event payload + call totals.
- `PATCH /api/games/sample-detective/sessions/[id]`
- Runtime updates for title, event linkage, display flags, status, and counters.
- `GET /api/games/sample-detective/sessions/history?eventId=`
- Event-filtered history metrics for admin reporting.

## Development Phases
1. MVP
- Core schema and indexes.
- Setup page skeleton with event selector.
- Event-filtered session list/history.
- API create/list/get/history skeletons with `event_id`.
- Host/assistant/jumbotron scope pages.
2. Runtime Controls
- Host round-state actions and score lock flow.
- Team scoring UI with pair correctness + artist bonus toggles.
- Live scoreboard aggregation and round completion guards.
3. Polish
- Faster deck import tooling (CSV parser and validation feedback).
- Better reveal animations and readability tuning for brewery distance.
- Session event timeline and post-night analytics.

## Risks and Mitigations
- High prep burden for curated sample/source verification.
- Mitigation: enforce preflight checklist and parser validation before create.
- Solo-host overload during reveal and scoring transitions.
- Mitigation: keep one-screen host flow and make assistant strictly optional.
- Vinyl reset delays between rounds can flatten momentum.
- Mitigation: expose pacing budget, show standby timer, and cap rounds to 10.
- Disputes over partial matches or artist naming precision.
- Mitigation: explicit scoring policy in setup + quick dispute notes for later review.

## Event Linkage Status
- Implemented in schema and APIs:
- `event_id` included in `sd_sessions` with nullable FK to `public.events(id)` and `ON DELETE SET NULL`.
- Setup includes event selector and event-filtered session list.
- History includes event filter.
- Create/list/get/history endpoints expose event-aware behavior.
