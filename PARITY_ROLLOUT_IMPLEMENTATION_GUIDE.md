# Bingo Parity Rollout - Implementation Guide

## Status Summary

**✅ COMPLETE (9 games, all validated):**
- Needle Drop Roulette, Genre Imposter, Original or Cover, Sample Detective, Name That Tune, Music Trivia, Artist Alias, Back-to-Back Connection, Bracket Battle

**🔄 IN PROGRESS (SQL migrations created, 5 remaining games):**
- Cover Art Clue Chase (CACC)
- Crate Categories (CC)  
- Decade Dash (DD)
- Lyric Gap Relay (LGR) - includes new lgr_session_events table creation
- Wrong Lyric Challenge (WLC)

## SQL Migrations - ALL CREATED ✅

Files created:
- `sql/add-crate-categories-bingo-parity-fields.sql`
- `sql/add-decade-dash-bingo-parity-fields.sql`
- `sql/add-lyric-gap-relay-bingo-parity-fields.sql` (creates lgr_session_events)
- `sql/add-wrong-lyric-challenge-bingo-parity-fields.sql`
- `sql/add-cover-art-clue-chase-bingo-parity-fields.sql` (previously created)

All add 8 parity columns: show_logo, welcome_heading_text, welcome_message_text, intermission_heading_text, intermission_message_text, thanks_heading_text, thanks_subheading_text, default_intermission_seconds

---

## Implementation Checklist for Remaining 5 Games

### Template Files (Copy these patterns):
- **Overlay route template:** `src/app/api/games/back-to-back-connection/sessions/[id]/overlay/route.ts`
- **Edit page template:** `src/app/admin/games/back-to-back-connection/edit/page.tsx`  
- **Host page template:** `src/app/admin/games/bracket-battle/host/page.tsx`
- **Jumbotron template:** `src/app/admin/games/bracket-battle/jumbotron/page.tsx`

### Game-Specific Values

| Game | Prefix | Flag | Accent Color | Defaults |
|------|--------|------|--------------|----------|
| CACC | cacc_ | show_stage_hint | teal-700 | Welcome/Study image/Thanks |
| CC | ccat_ | show_prompt | purple-700 | Welcome/Guess connection/Thanks |
| DD | dd_ | show_scoring_hint | pink-700 | Welcome/Identify era/Thanks |
| LGR | lgr_ | show_answer_mode | indigo-700 | Welcome/Fill lyrics/Thanks |
| WLC | wlc_ | show_options | violet-700 | Welcome/Spot incorrect/Thanks |

### Per-Game Files to Update/Create (9 per game)

1. **src/lib/{prefix}Db.ts** - Update CRUD types
   - Add parity fields to {sessions}.Row, Insert, Update types
   - Ensure events.Row has venue_logo_url: string | null

2. **src/app/api/games/{game}/sessions/route.ts** - POST handler
   - Add parity fields to CreateSessionBody type
   - Add defaults to insert() call with ?? fallbacks

3. **src/app/api/games/{game}/sessions/[id]/route.ts** - GET/PATCH handlers
   - Add parity + host_overlay fields to SessionRow type
   - Update event select: `from("events").select("id, title, date, time, location, venue_logo_url")`
   - Add overlay query (separate await after Promise.all): `db.from("{prefix}_session_events").select("payload").eq("session_id", sessionId).eq("event_type", "overlay_set").order("created_at", { ascending: false }).limit(1).maybeSingle()`
   - Compute host_overlay + host_overlay_remaining_seconds (see Bracket Battle example)
   - Expand PATCH allowedFields to include all 8 parity fields

4. **src/app/api/games/{game}/sessions/[id]/overlay/route.ts** - NEW FILE
   - Copy from Back-to-Back Connection overlay route
   - Change all `bb_` to `{prefix}_` and `bb_session_events` to `{prefix}_session_events`

5. **src/app/admin/games/{game}/page.tsx** - Session list
   - Verify Link import from next/link
   - Add Edit link before Host button: `<Link href={`/admin/games/{game}/edit?sessionId=${session.id}`} className="rounded border border-stone-600 px-2 py-1 text-xs">Edit</Link>`

6. **src/app/admin/games/{game}/edit/page.tsx** - NEW FILE
   - Copy from Back-to-Back Connection edit page
   - Update Session type with game-specific fields (round_count, etc.) + parity fields
   - Update form fields accordingly

7. **src/app/admin/games/{game}/host/page.tsx** - Host controls
   - Add parity fields + host_overlay + host_overlay_remaining_seconds to Session type
   - Add state: overlaySecondsInput, overlayBusy
   - Add setOverlay + toggleIntermission functions (copy from Bracket Battle)
   - Add overlay control panel JSX after game controls

8. **src/app/admin/games/{game}/jumbotron/page.tsx** - Jumbotron display
   - Add parity + overlay fields to Session type  
   - Add overlayRemaining state + useEffect ticker (1000ms interval)
   - Add computed: showOverlay, showThanksOverlay, logoUrl
   - Wrap main content in `{!showOverlay ? ...content... : null}`
   - Add 4 overlay panels (welcome/countdown/intermission/thanks) using accent color

### Accent Color Classes by Game
- CACC (teal): text-teal-300, bg-teal-700, border-teal-700
- CC (purple): text-purple-300, bg-purple-700, border-purple-700
- DD (pink): text-pink-300, bg-pink-700, border-pink-700
- LGR (indigo): text-indigo-300, bg-indigo-700, border-indigo-700
- WLC (violet): text-violet-300, bg-violet-700, border-violet-700

---

## Reference Code Patterns

### Overlay Computation (for sessions/[id]/route.ts GET)
```typescript
const overlayResult = await db
  .from("{PREFIX}_session_events")
  .select("payload")
  .eq("session_id", sessionId)
  .eq("event_type", "overlay_set")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

const overlayEvent = overlayResult.data as OverlayEventRow | null;
const overlayPayload = overlayEvent?.payload ?? null;
const overlayMode = overlayPayload?.mode ?? "none";
const overlayEndsAt = overlayPayload?.ends_at ? new Date(overlayPayload.ends_at) : null;
const now = new Date();
const hostOverlay = overlayMode !== "none" && (!overlayEndsAt || overlayEndsAt > now) ? overlayMode : "none";
const hostOverlayRemainingSeconds = hostOverlay !== "none" && overlayEndsAt ? Math.max(0, Math.round((overlayEndsAt.getTime() - now.getTime()) / 1000)) : 0;
```

### Host Overlay Panel (for host/page.tsx)
```typescript
<div className="border-t border-stone-700 pt-4 mt-4">
  <div className="text-sm font-semibold mb-2">Overlay Control</div>
  <div className="inline-flex gap-1 mb-2">
    {["Welcome", "Countdown", "Intermission", "Thanks", "Clear"].map((label, i) => {
      const modes = ["welcome", "countdown", "intermission", "thanks", "none"];
      return (
        <button key={label} onClick={() => setOverlay(modes[i])} disabled={overlayBusy} className="rounded border border-stone-600 px-2 py-1 text-xs hover:bg-stone-800">
          {label}
        </button>
      );
    })}
  </div>
  <div className="flex gap-2 items-center">
    <label className="text-xs">Duration (seconds):</label>
    <input type="number" value={overlaySecondsInput} onChange={(e) => setOverlaySecondsInput(parseInt(e.target.value))} className="w-16 rounded border border-stone-600 bg-stone-900 px-1 py-0.5" />
  </div>
</div>
```

### Jumbotron Overlay Panels Structure
Four fixed z-40 div overlays:
- `showOverlay` gate wraps main content
- `showThanksOverlay` computed as `(session?.host_overlay === "thanks" && !expired)`
- 4 panels: welcome (heading + message + logo), countdown (remaining seconds), intermission, thanks
- All panels use game's accent color for text/background

---

## Next Steps

1. Run SQL migrations on database
2. Update all 5 game lib files (add parity fields to CRUD types)
3. Update all 5 POST routes (add CreateSessionBody fields + insert defaults)
4. Update all 5 GET/PATCH routes (add SessionRow fields, overlay query, allowedFields)
5. Create 5 overlay routes (copy from B2BC template)
6. Add 5 Edit links to admin pages
7. Create 5 edit pages (copy from B2BC template)
8. Update 5 host pages (overlay state + panel)
9. Update 5 jumbotron pages (overlay rendering)
10. Validate all 5 games with `get_errors` tool

---

## Token-Efficient Tips

- Use multi_replace_string_in_file for multiple edits in same file
- Use sed for lib file updates (complex nested types)
- Copy templates wholesale and do find-replace for prefix/accent color
- Validate each game group before moving to next (to catch errors early)
