# TABS_REFERENCE.md
# Edit Album Modal - V3 Tab Inventory

Reference for the V3-aligned Edit Album Modal. All fields map to V3 tables.

**Last Updated:** 2026-02-04

---

## Modal Features
- **Orange modal header** with album title
- **Tabs:** Main, Details, Tracks, Personal, Cover, Links, Enrichment
- **Universal picker system** for selectors (label, format, genre, location, tags, etc.)
- **Bottom bar:** Status | Location | Previous/Next | Save

---

## 🎵 Main Tab

**Fields:**
- **Title** (text)
- **Artist** (picker)
- **Release Year** (text)
- **Label** (picker)
- **Format** (picker; maps to `media_type` + `format_details` + `qty`)
- **Barcode** (text)
- **Catalog #** (text; `catalog_number`)
- **Genre** (multi-select)

---

## ℹ️ Details Tab

**Fields:**
- **Media Condition**
- **Sleeve Condition**
- **Country**

---

## 🎵 Tracks Tab

**Fields:**
- **Tracklist editor** (positions + sides, `recordings` + `release_tracks`)

---

## 👤 Personal Tab

**Fields:**
- **Purchase Date**
- **Purchase Price**
- **Current Value**
- **Owner**
- **Tags** (master tags)
- **Personal Notes**

---

## 📷 Cover Tab

**Fields:**
- **Front Cover** (`masters.cover_image_url`)
- **Search/replace** via Discogs or MusicBrainz

---

## 🔗 Links Tab

**Fields:**
- **Discogs IDs**
- **Spotify Album ID**
- **MusicBrainz Release Group ID**

---

## ⚡ Enrichment Tab

**Actions:**
- Pull Discogs metadata (master + release)
- Pull Discogs tracklist
- Pull cover art (Discogs/MusicBrainz)
