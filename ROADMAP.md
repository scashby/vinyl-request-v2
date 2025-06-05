# ROADMAP.md

## ✅ Completed
- Chunk 1: Supabase Auth (Email + Google)
- Chunk 2: Header + Layout + Theme wrapper
- Chunk 3: Browse page + Event side requests
- Chunk 4: Admin queue editing + now playing control
- Chunk 5: CSV import + validation
- Chunk 6: Discogs fallback metadata enrichment
- QueueSection rewritten for pixel-perfect layout

## 🛠 Planned

### Admin Features
- Allow uploading a promotional image for each event (replacing placeholder)
- Add event details: location, time, social links, and Google Maps directions
- Toggle visibility of the vinyl queue (for BYOV nights)
- Toggle visibility of the featured queue (for DJ-curated nights)

### Public Features
- Clicking an event card navigates to that event's browse queue page
- Automatically move events to "Past Events" after event date passes (implement last)
- Display only as many upcoming events as fit on screen, with "View More" toggle
- Prevent multiple upvotes per side (via local state or client IP/session tracking)
- App-level settings + side metadata refresh

### 📅 EVENTS PAGE
- [x] Visual template for all internal pages
- [x] Breadcrumb added below heading, styled correctly

---

### 🧭 LANDING PAGE
- [x] Rename “Browse” to “Browse Collection”
- [x] Rename “Now Playing” to “Dialogues”
- [x] Rename “Admin” to “About”
- [x] Remove Admin from public nav
