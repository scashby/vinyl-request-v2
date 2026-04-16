# Standalone Product Plan — Music Games for Venue Operators

**Created:** 2026-04-16  
**Author:** Stephen Ashby / Dead Wax Dialogues  
**Status:** Future planning — finalize Music Bingo first

---

## Background

The vinyl-request-v2 app (deadwaxdialogues.com) is a personal venue-operator tool built around a Discogs-synced music collection stored in Supabase. It powers live games (Music Bingo, Name That Tune, Trivia, and others) for events like Vinyl Sundays.

The working app is the prototype. The plan is to port the games into standalone consumer products once each game is fully finalized — rather than trying to build for both personal use and consumers at the same time.

---

## Core Insight: Two Different Products

### Product 1 — The Game Infrastructure (Bingo, Name That Tune, etc.)
The value here is **the operator experience**: setup screens, timing, host controls, jumbotron display, round management. Customers bring their own music knowledge and their own playlists. The app does the rest.

- Low dependency on proprietary data
- Flat tool or one-time purchase model
- Customer imports their own collection (CSV, Discogs folder, manual entry) or playlist
- Works for DJs, bar trivia hosts, event planners, music venue operators

### Product 2 — Trivia (and any fact-bank-dependent games)
The value here is **the trivia bank itself**. A customer's playlist is only useful if there are facts behind those records. The gameplay is secondary — coverage is the product.

- High dependency on the Dead Wax trivia fact library
- SaaS / subscription model makes more sense
- "X thousand artists, Y thousand albums covered" is the marketing metric
- Coverage gaps = product roadmap (customer playlists reveal what needs to be enriched next)
- Risk to manage: customers with niche collections getting thin question counts

---

## Architecture Approach

**Personal app:** Single-tenant, tightly coupled to the Supabase collection. This stays as-is.

**Standalone products:** Separate repo(s), treated like merch — ported from the working personal versions. Likely a sub-site or separate domain.

**Multi-tenancy:** When porting, key tables (collection_playlists, game sessions, trivia decks, etc.) will need `account_id` scoping and RLS policies. Do not attempt to retrofit this into the personal app — build it clean in the standalone repo.

**Data import options to evaluate for standalone:**
- CSV import (simplest for customer, more support burden)
- Discogs OAuth (most powerful, moderate complexity)
- Manual playlist entry (lowest friction for small collections)
- Temporary session data vs. persistent account storage

---

## Suggested Rollout Order

1. **Finish and finalize Music Bingo** (current priority)
2. **Evaluate each completed game** for standalone readiness
3. **Build standalone infrastructure** (auth, multi-tenancy, billing)
4. **Port Game Infrastructure products** first (lower complexity)
5. **Port Trivia** as a subscription product once fact bank has meaningful coverage

---

## Business Model Notes

| Product | Model | Key Metric |
|---|---|---|
| Game Infrastructure | Flat fee or one-time | # of active venue operators |
| Trivia | Monthly subscription | Artist/album coverage %, churn vs. coverage |
| Bundle | Subscription tier | Both products together |

Consider a free tier with limited rounds/sessions to reduce onboarding friction for venue operators.

---

## AI Prompt — Reconstructing This Context

If you've lost access to the original chat and need to continue planning this with an AI assistant, use the following prompt:

---

> I run a music venue events business called Dead Wax Dialogues. I've built a personal web app (Next.js + Supabase) that runs live music games at my events — Music Bingo, Name That Tune, Trivia, and others. The app is tightly coupled to my own Discogs-synced vinyl collection stored in Supabase. I'm planning to turn these games into standalone consumer products for other venue operators, DJs, and bar trivia hosts.
>
> My approach: finish each game in my personal app first, then port it to a separate standalone repo rather than trying to build for both audiences at once.
>
> I've identified two distinct product types:
> 1. **Game Infrastructure games** (Bingo, Name That Tune, etc.) — the value is the operator UX (setup, screens, timing). Customers bring their own music. Low data dependency. Likely a flat fee or one-time purchase.
> 2. **Trivia** — the value is the trivia fact bank. A customer's playlist is useless without facts behind it. This is a SaaS/subscription model where coverage (artists and albums in the fact bank) is the key selling point.
>
> Current status: finalizing Music Bingo. The standalone product work hasn't started yet.
>
> The working plan is in `/docs/standalone-product-plan.md` in the project repo. Please read that file first, then help me continue planning.

---

*End of prompt.*
