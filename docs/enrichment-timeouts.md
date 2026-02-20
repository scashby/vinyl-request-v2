# Enrichment Source Timeouts: Why Env Vars

## Short answer
Timeouts are env vars so you can tune reliability without redeploying code.

## Why this is useful
- Different providers have different response times.
- Provider performance changes over time (or by time of day).
- You may want stricter limits in preview, looser limits in production.
- If a source starts timing out, you can adjust one value fast instead of shipping a code change.

## Practical advantages
- Faster incident response:
  You can increase a timeout in Vercel immediately and re-run scans.
- Per-source control:
  Slow providers (like Wikidata) can have longer limits while fast providers stay strict.
- Cost/performance balance:
  You can keep overall scan speed high by only extending the sources that need it.
- Environment-specific tuning:
  Different values for Development / Preview / Production if needed.

## Current behavior in code
- Default timeout for all sources: `25s`
- Wikidata default timeout: `30s`
- If env vars are missing, those defaults are used automatically.

## Supported env vars
- `ENRICH_SOURCE_TIMEOUT_MS` (default for all sources)
- `ENRICH_SOURCE_TIMEOUT_WIKIDATA_MS`
- `ENRICH_SOURCE_TIMEOUT_WIKIPEDIA_MS`
- `ENRICH_SOURCE_TIMEOUT_MUSICBRAINZ_MS`
- `ENRICH_SOURCE_TIMEOUT_DISCOGS_MS`
- `ENRICH_SOURCE_TIMEOUT_SPOTIFY_MS`
- `ENRICH_SOURCE_TIMEOUT_APPLEMUSIC_MS`
- `ENRICH_SOURCE_TIMEOUT_LASTFM_MS`
- `ENRICH_SOURCE_TIMEOUT_GENIUS_MS`
- `ENRICH_SOURCE_TIMEOUT_SECONDHANDSONGS_MS`
- `ENRICH_SOURCE_TIMEOUT_THEAUDIODB_MS`
- `ENRICH_SOURCE_TIMEOUT_SETLISTFM_MS`
- `ENRICH_SOURCE_TIMEOUT_RATEYOURMUSIC_MS`
- `ENRICH_SOURCE_TIMEOUT_FANARTTV_MS`
- `ENRICH_SOURCE_TIMEOUT_DEEZER_MS`
- `ENRICH_SOURCE_TIMEOUT_MUSIXMATCH_MS`
- `ENRICH_SOURCE_TIMEOUT_POPSIKE_MS`
- `ENRICH_SOURCE_TIMEOUT_PITCHFORK_MS`
- `ENRICH_SOURCE_TIMEOUT_COVERART_MS`

## Recommended baseline (paste into Vercel)
```env
ENRICH_SOURCE_TIMEOUT_MS=25000
ENRICH_SOURCE_TIMEOUT_WIKIDATA_MS=35000
ENRICH_SOURCE_TIMEOUT_WIKIPEDIA_MS=30000
```

## When NOT to use env vars
If you are certain timeouts should never vary across environments/providers, hardcoding is simpler.
For this enrichment system, provider variability is high enough that env tuning is usually worth it.
