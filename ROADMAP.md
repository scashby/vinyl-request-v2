# ROADMAP.md

## ✅ CURRENT FUNCTIONALITY (LIVE & STABLE)
- Landing Page loads with nav to Events, Browse Collection, and Now Playing
- Events page implemented and acts as visual/structural template for all internal pages
- Browse Collection page renders album cards with media badges and image support
- Album Detail page matches locked design, supports background blur
- CSS conflicts isolated; locked pages preserved

---

## 🔄 PLANNED CHANGES (APPROVED)

### 🧭 LANDING PAGE (MAIN ENTRY)
- [ ] Rename "Browse" to "Browse Collection"
- [ ] Rename "Now Playing" to "Dialogues" — this will feature blog-style posts
- [ ] Rename "Admin" link to "About" — includes info, socials, etc.
- [ ] Remove Admin from public navigation entirely (access via `/admin` manually)

---

### 📅 EVENTS PAGE (TEMPLATE BASELINE)
- [x] Color scheme, header, and footer are considered the default for all internal pages
- [ ] Add breadcrumb navigation (top-left under heading) to all internal pages except landing

---

### 📀 BROWSE COLLECTION (`/browse`)
- [ ] Support search/sort by artist, album, or format
- [ ] When accessed from Browse-Queue:
  - [ ] Auto-filter by event’s format rules (e.g., Vinyl & 45s only)
  - [ ] Add A/B side buttons on album cards for queue submission
- [ ] When accessed directly:
  - [ ] Display entire collection without event filtering
- [ ] Uses Events page layout (header/footer)
- [ ] Sends album data to Album Detail page

---

### 🧾 ALBUM DETAIL PAGE (`/album/:id`)
- [x] Standalone design, locked and complete
- [ ] Accepts data from Browse Collection
- [ ] Will remain visually distinct (no header/footer)
- [ ] Can be extended to pull track runtime metadata if needed

---

### 📋 BROWSE QUEUE (`/browse-queue`)
- [ ] Linked from Events page
- [ ] Redesign table layout to match `tracklist` from Album Detail page
- [ ] Optionally display running time per side if feasible

---

### 🔐 ADMIN SYSTEM
- [x] Fully gated behind `/admin`
- [ ] No appearance in public-facing nav
- [ ] Login as single-user admin only
