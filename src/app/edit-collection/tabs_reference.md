# TABS_REFERENCE.md
# Edit Album Modal - Complete Tab Inventory

Reference document for all tabs and fields in the Edit Album Modal. This replicates the CLZ Music Web interface exactly.

---

## Modal Features
- **Orange modal header** (#f97316) with album title
- **8 tabs:** Main, Details, Classical, People, Tracks, Personal, Cover, Links
- **Universal picker system** used consistently across all selectors
- **Universal bottom bar** (on all tabs): Collection Status | Index | Quantity | Location
- **Previous/Next navigation** buttons
- **Modal-based pickers** for all complex selections (Genre, Format, Artist, Tags, etc.)
- **Manage modals** with Edit/Delete/Merge functionality

---

## 🎵 Main Tab

**Status:** COMPLETE ✅

### Fields:
- **Title** (text input) ✅
- **Sort Title** (text input) ✅
- **Subtitle** (text input) ✅
- **Artist** (single-select picker with +/Manage buttons) ✅ **FULLY WIRED**
  - + button opens artist picker modal
  - × button clears artist
  - Full CRUD: Create, Read, Update, Merge
- **Release Date** (YYYY—MM—DD with connecting lines) ✅ **Calendar picker wired**
- **Original Release Date** (YYYY—MM—DD with connecting lines) ✅ **Calendar picker wired**
- **Label** (picker) ✅ **FULLY WIRED**
- **Recording Date** (YYYY—MM—DD with connecting lines) ✅ **Calendar picker wired**
- **Format** (picker - radio buttons) ✅ **FULLY WIRED**
- **Barcode** (text input) ✅
- **Cat No** (text input) ✅
- **Genre** (multi-select picker with tags + +/Manage buttons) ✅ **FULLY WIRED**

### Special Features:
- **Aa button** - Auto-capitalization (immediate action, reads settings)
- **Date pickers** - Calendar popup on calendar icon click
- **Unified selector styling** - Connected dropdown/button pairs
- **Location** (in bottom bar) ✅ **FULLY WIRED**

---

## ℹ️ Details Tab

**Status:** Placeholder (Phase 6)

### Fields:
- **Packaging** (picker)
- **Package/Sleeve Condition** (picker)
- **Media Condition** (picker)
- **Studio** (add/picker)
- **Country** (picker)
- **Sound** (add/picker)
- **Vinyl Color** (text input)
- **RPM** (33/45/78 buttons)
- **Vinyl Weight** (number)
- **Extra** (multi-line text)
- **SPARS** (picker)
- **Box Set** (picker)
- **Is Live** (Yes/No toggle)

---

## 🎻 Classical Tab

**Status:** Placeholder (Phase 6)

### Fields:
- **Composer** (add/picker)
- **Composition** (add/picker)
- **Conductor** (add/picker)
- **Orchestra** (add/picker)
- **Chorus** (add/picker)

---

## 👥 People Tab

**Status:** Placeholder (Phase 6)

### Credits Section:
- **Songwriter** (add/picker)
- **Producer** (add/picker)
- **Engineer** (add/picker)

### Musicians Section:
- **Musician** (add/picker)

---

## 🎼 Tracks Tab

**Status:** Built with import functionality (Phase 4 - HIGH PRIORITY)

### Features:
- **Disc tabs** (Disc #1, Disc #2, etc.) for multi-disc albums
- **Disc Title** (text input per disc)
- **Storage Device** (picker)
- **Matrix Nr Side A / Side B** (text inputs)

### Tracks Table:
- Checkbox column (for selection)
- Drag handle column (≡) for reordering
- Track # (auto-numbered)
- Title (text input)
- Artist (text input)
- Length (text input)

### Actions:
- **🎵 Import from Discogs** button (primary - pressing-specific)
- **🎵 Import from Spotify** button (fallback - generic CD version)
- **Add Header** button (for section headers)
- **Add Track** button (manual track addition)
- **Add Disc** button (for multi-disc albums)

---

## 👤 Personal Tab

**Status:** Placeholder (Phase 6)

### Fields:
- **Purchase Date** (MM/DD/YYYY)
- **Purchase Store** (picker)
- **Purchase Price** ($)
- **Current Value** ($)
- **Owner** (picker)
- **My Rating** (10 stars)
- **Tags** (multi-select picker with tags + +/Manage buttons)
- **Notes** (textarea)
- **Last Cleaned Date** (MM/DD/YYYY)
- **Signed By** (add/picker)
- **Played History** (add/picker with date+count)

---

## 📀 Cover Tab

**Status:** Placeholder with current cover display (Phase 6)

### Front Cover:
- **🔍 Find Online** button (ENRICHMENT FEATURE)
- **⬆️ Upload** button
- **🗑️ Remove** button
- **✂️ Crop / Rotate** button
- Image preview

### Back Cover:
- **🔍 Find Online** button (ENRICHMENT FEATURE)
- **⬆️ Upload** button
- **🗑️ Remove** button
- **✂️ Crop / Rotate** button
- Image preview

---

## 🔗 Links Tab

**Status:** Placeholder (Phase 6)

### Features:
- URL list (add/remove)
- Each link has:
  - URL (text input)
  - Description (text input)
  - Drag handle (≡) for reordering
- **➕ New Link** button
- **Auto-populate** from Spotify/Apple Music/Discogs/Genius (ENRICHMENT FEATURE)

---

## Universal Bottom Bar

Present on ALL tabs:

### Fields:
1. **Collection Status** (dropdown with optgroup sections)
   - Collection: In Collection, For Sale
   - Wish List: On Wish List, On Order
   - Not in Collection: Sold, Not in Collection
2. **Index** (text input)
3. **Qty** (number input)
4. **Location** (text input with picker button)

### Buttons:
- **Previous** - Navigate to previous album
- **Next** - Navigate to next album
- **Cancel** - Close modal without saving
- **Save** - Save changes and close

---

## File Structure

```
src/app/edit-collection/
├── EditAlbumModal.tsx          # Main modal component ✅
├── tabs/
│   ├── MainTab.tsx             # Basic info ✅ (All pickers wired)
│   ├── DetailsTab.tsx          # Extended metadata ✅ (placeholder)
│   ├── ClassicalTab.tsx        # Composer, conductor, etc. ✅ (placeholder)
│   ├── PeopleTab.tsx           # Credits & musicians ✅ (placeholder)
│   ├── TracksTab.tsx           # Tracklist management ✅ (built)
│   ├── PersonalTab.tsx         # Purchase, ratings, tags ✅ (placeholder)
│   ├── CoverTab.tsx            # Front/back cover ✅ (placeholder)
│   └── LinksTab.tsx            # URLs ✅ (placeholder)
├── pickers/
│   ├── PickerModal.tsx         # Universal picker base ✅ COMPLETE
│   ├── ManageModal.tsx         # Manage items (edit/delete/merge) ✅ COMPLETE
│   ├── EditModal.tsx           # Edit single item ✅ COMPLETE
│   ├── MergeModal.tsx          # Merge multiple items ✅ COMPLETE
│   └── pickerDataUtils.ts      # Supabase integration ✅ COMPLETE
├── settings/
│   ├── SettingsModal.tsx       # Global settings hub ✅
│   ├── AutoCapSettings.tsx     # Auto cap configuration ✅
│   └── AutoCapExceptions.tsx   # Exception management ✅
├── enrichment/
│   ├── SpotifyEnrich.tsx       # Spotify integration (planned)
│   ├── AppleEnrich.tsx         # Apple Music integration (planned)
│   ├── DiscogsEnrich.tsx       # Discogs integration (planned)
│   └── GeniusEnrich.tsx        # Genius lyrics integration (planned)
└── components/
    ├── DatePicker.tsx          # Calendar picker ✅
    └── UniversalBottomBar.tsx  # Status/Index/Qty/Location ✅
```