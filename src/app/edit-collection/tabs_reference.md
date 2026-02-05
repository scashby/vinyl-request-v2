# TABS_REFERENCE.md
# Edit Album Modal - Complete Tab Inventory

Reference document for all tabs and fields in the Edit Album Modal. This replicates the CLZ Music Web interface exactly.

**Last Updated:** 2025-12-17 - 8 tabs functional, 1 external library needed

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

**Status:** ✅ 100% FUNCTIONAL

### Fields:
- **Title** (text input) ✅
- **Sort Title** (text input) ✅
- **Subtitle** (text input) ✅
- **Artist** (single-select picker with +/Manage buttons) ✅ **FULLY WIRED**
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

**Status:** ✅ 100% FUNCTIONAL

### Fields:
- **Packaging** (picker) ✅
- **Package/Sleeve Condition** (picker) ✅
- **Media Condition** (picker) ✅
- **Studio** (add/picker) ✅
- **Country** (picker with standard list) ✅
- **Sound** (add/picker) ✅
- **Vinyl Color** (multi-select picker with chips) ✅
- **RPM** (33/45/78 buttons) ✅
- **Vinyl Weight** (dropdown with standard weights) ✅
- **Extra** (multi-line text) ✅
- **SPARS** (picker) ✅
- **Box Set** (picker) ✅
- **Is Live** (Yes/No toggle) ✅

---

## 🎻 Classical Tab

**Status:** ✅ 100% FUNCTIONAL - All pickers wired to PickerModal

### Fields:
- **Composer** (picker) ✅ **WIRED**
- **Composition** (picker) ✅ **WIRED**
- **Conductor** (picker) ✅ **WIRED**
- **Orchestra** (picker) ✅ **WIRED**
- **Chorus** (picker) ✅ **WIRED**

**Implementation:** 
- All fields use PickerModal with `type` prop
- Opens modal on button click
- Selects from database using pickerDataUtils
- Clear buttons functional
- Database fields: composer, conductor, chorus, composition, orchestra

---

## 👥 People Tab

**Status:** ✅ 100% FUNCTIONAL - All pickers wired to PickerModal

### Credits Section:
- **Songwriter** (multi-value picker) ✅ **WIRED**
- **Producer** (multi-value picker) ✅ **WIRED**
- **Engineer** (multi-value picker) ✅ **WIRED**

### Musicians Section:
- **Musician** (multi-value picker) ✅ **WIRED**

**Implementation:**
- All fields use PickerModal for adding
- Display as lists with remove buttons
- Opens modal on "Select..." button click
- Prevents duplicates
- Database fields: songwriters[], producers[], engineers[], musicians[]

---

## 🎼 Tracks Tab

**Status:** ✅ 100% FUNCTIONAL

### Features:
- **Disc tabs** (Disc #1, Disc #2, etc.) for multi-disc albums ✅
- **Disc Title** (text input per disc) ✅
- **Storage Device** (picker) ✅
- **Slot** (text input) ✅
- **Matrix Nr Side A / Side B** (text inputs) ✅

### Tracks Table:
- Checkbox column (for selection) ✅
- Drag handle column (≡) for reordering ✅
- Track # (auto-numbered) ✅
- Title (text input) ✅
- Artist (text input) ✅
- Length (text input) ✅

### Actions:
- **🎵 Import from Discogs** button ✅ **WORKING**
- **🎵 Import from Spotify** button ✅ **WORKING**
- **Add Header** button (for section headers) ✅
- **Add Track** button (manual track addition) ✅
- **Add Disc** button (for multi-disc albums) ✅

---

## 👤 Personal Tab

**Status:** ✅ 100% FUNCTIONAL

### Fields:
- **Purchase Date** (MM/DD/YYYY with DatePicker) ✅
- **Purchase Store** (picker) ✅
- **Purchase Price** ($) ✅
- **Current Value** ($) ✅
- **Owner** (picker) ✅
- **My Rating** (10 stars) ✅
- **Tags** (multi-select picker with tags) ✅
- **Notes** (textarea) ✅
- **Last Cleaned Date** (MM/DD/YYYY with DatePicker) ✅
- **Signed By** (multi-value list with + button) ✅
- **Played History** (multi-value list with + button) ✅

---

## 📀 Cover Tab

**Status:** ✅ 90% FUNCTIONAL - Crop/Rotate needs external library

### Front Cover:
- **🔍 Find Online** button ✅ **Opens Google Images search**
- **⬆️ Upload** button ✅ **Uploads to Supabase Storage**
- **🗑️ Remove** button ✅ **Deletes from storage**
- **✂️ Crop / Rotate** button 🔴 **Needs react-easy-crop library**
- Image preview ✅

### Back Cover:
- **🔍 Find Online** button ✅ **Opens Google Images search**
- **⬆️ Upload** button ✅ **Uploads to Supabase Storage**
- **🗑️ Remove** button ✅ **Deletes from storage**
- **✂️ Crop / Rotate** button 🔴 **Needs react-easy-crop library**
- Image preview ✅

### What Actually Works:
- ✅ Upload: Saves image to Supabase Storage bucket `album-images`, updates album.image_url or album.back_image_url
- ✅ Remove: Deletes file from storage, clears URL from database
- ✅ Find Online: Opens Google Images search with album info (artist + title + year)
- 🔴 Crop/Rotate: Shows alert with implementation instructions

### Crop/Rotate Implementation:
To implement crop/rotate, install library:
```bash
npm install react-easy-crop
```
Then follow guide in `/CROP_ROTATE_IMPLEMENTATION.md`

**Note:** page.tsx already displays both front (image_url) and back (back_image_url) covers with carousel

---

## 🔗 Links Tab

**Status:** ✅ 100% FUNCTIONAL

### Features:
- URL list (add/remove) ✅ **Working**
- Each link has:
  - URL (text input) ✅
  - Description (text input) ✅
  - Drag handle (≡) for reordering ✅ **Working**
- **➕ New Link** button ✅ **Working**
- Drag-drop reordering ✅ **Working**
- Stores in album.extra as JSON string ✅ **Working**

**Implementation:**
- Links stored as JSON array in album.extra field
- Drag-drop reordering functional
- Add/remove working
- No ESLint errors, properly typed

---

## Universal Bottom Bar

Present on ALL tabs:

### Fields:
1. **Collection Status** (dropdown with optgroup sections) ✅
   - Collection: In Collection, For Sale
   - Wish List: On Wish List, On Order
   - Not in Collection: Sold, Not in Collection
2. **Index** (text input) ✅
3. **Qty** (number input) ✅
4. **Location** (text input with picker button) ✅ **FULLY WIRED**

### Buttons:
- **Previous** - Navigate to previous album ✅
- **Next** - Navigate to next album ✅
- **Cancel** - Close modal without saving ✅
- **Save** - Save changes and close ✅

---

## File Structure

```
src/app/edit-collection/
├── EditAlbumModal.tsx          # Main modal component ✅
├── tabs/
│   ├── MainTab.tsx             # Basic info ✅ 100%
│   ├── DetailsTab.tsx          # Extended metadata ✅ 100%
│   ├── ClassicalTab.tsx        # Composer, conductor, etc. ✅ 100%
│   ├── PeopleTab.tsx           # Credits & musicians ✅ 100%
│   ├── TracksTab.tsx           # Tracklist management ✅ 100%
│   ├── PersonalTab.tsx         # Purchase, ratings, tags ✅ 100%
│   ├── CoverTab.tsx            # Front/back cover ✅ 90% (needs crop library)
│   └── LinksTab.tsx            # URLs ✅ 100%
├── pickers/
│   ├── PickerModal.tsx         # Universal picker base ✅
│   ├── ManageModal.tsx         # Manage items ✅
│   ├── EditModal.tsx           # Edit single item ✅
│   ├── MergeModal.tsx          # Merge multiple items ✅
│   └── pickerDataUtils.ts      # Supabase integration ✅
├── settings/
│   ├── SettingsModal.tsx       # Global settings hub ✅
│   ├── AutoCapSettings.tsx     # Auto cap configuration ✅
│   └── AutoCapExceptions.tsx   # Exception management ✅
└── components/
    ├── DatePicker.tsx          # Calendar picker ✅
    └── UniversalBottomBar.tsx  # Status/Index/Qty/Location ✅
```

---

## Summary

**7 of 8 tabs are 100% functional** ✅
**1 tab is 90% functional** - needs external library for one feature

### What Works Right Now:
- ✅ All pickers in Classical/People tabs wired to PickerModal
- ✅ Upload/Remove cover images to Supabase Storage
- ✅ Find cover images online (Google Images)
- ✅ Add/remove/reorder links with drag-drop
- ✅ All 8 tabs save data properly

### What Needs Optional Enhancement:
- 🔴 Crop/Rotate: Install `react-easy-crop` and follow `/CROP_ROTATE_IMPLEMENTATION.md`

### External Dependencies Needed:
- **Supabase Storage Bucket:** Create bucket named `album-images` (public)
- **Optional for Crop/Rotate:** `npm install react-easy-crop`

---

**END OF TABS REFERENCE DOCUMENT**