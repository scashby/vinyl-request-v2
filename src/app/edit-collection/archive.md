# ARCHIVE.md
# Historical Changes - DWD Collection Management System

This file contains detailed change history for work completed prior to the current week.

---

## 2025-12-12 Changes

### Artist Picker + Date Pickers + Autocap ✅
**Artist Picker**: Added full artist picker integration
- Created fetchArtists(), updateArtist(), mergeArtists() in pickerDataUtils.ts
- Wired + button to open artist picker modal (single-select)
- Wired × button to clear artist
- Full CRUD operations (delete not supported for core data)

**Date Pickers**: Created DatePicker component (src/components/DatePicker.tsx)
- Wired all 3 calendar icons (Release Date, Original Release Date, Recording Date)
- Clean calendar UI matching CLZ style
- Month navigation with «/» buttons
- "Today" button for quick selection

**Autocap Toggle**: Implemented Aa indicator functionality
- Blue when enabled, gray when disabled
- Click to toggle auto-capitalization
- Capitalizes first letter of each word in Title field

**Bug Fixes**: Fixed ESLint errors
- Removed unused useEffect import from DatePicker.tsx
- Fixed unused parameter in deleteArtist function
- Fixed import path for DatePicker (src/components/DatePicker)

**Files Modified**: MainTab.tsx, pickerDataUtils.ts, DatePicker.tsx (new)
**Main Tab now 90% complete** - All pickers functional, all interactive elements wired

---

### Location Picker Fully Wired ✅
- MainTab now uses forwardRef + useImperativeHandle
- Exports MainTabRef interface with openLocationPicker() method
- EditAlbumModal creates mainTabRef using useRef<MainTabRef>
- Passes ref to MainTab component
- UniversalBottomBar's onOpenLocationPicker callback now calls mainTabRef.current?.openLocationPicker()
- **Full callback chain working**: Location button → Modal → MainTab → PickerModal opens
- Location picker now functional with real Supabase data (fetch/create/update/delete/merge)
- **Files Modified**: MainTab.tsx (added forwardRef), EditAlbumModal.tsx (added ref handling)

---

### UniversalBottomBar Architecture - ARCHITECTURAL DECISION
- **DECISION**: UniversalBottomBar used by EditAlbumModal, NOT by individual tabs
- Removed UniversalBottomBar from MainTab.tsx
- UniversalBottomBar.tsx ready for modal integration:
  - Sectioned Collection Status dropdown (Collection, Wish List, Not in Collection)
  - Location picker button ready for modal→tab callback chain
  - All fields: Collection Status, Index, Qty, Location
  - Bottom buttons: Previous, Next, Cancel, Save
- Architecture: Modal will pass onOpenLocationPicker callback to active tab's handleOpenPicker

---

### UniversalBottomBar Improvements
- Added sectioned dropdown for Collection Status using `<optgroup>`:
  - Collection: In Collection, For Sale
  - Wish List: On Wish List, On Order
  - Not in Collection: Sold, Not in Collection
- Added optional `onOpenLocationPicker` callback prop for location picker integration
- Wired Location button onClick to trigger picker modal
- Removed unused COLLECTION_STATUS_OPTIONS constant

---

### Bug Fixes - PICKER INTEGRATION ERRORS RESOLVED
- Fixed import path in `pickerDataUtils.ts` from '@/utils/supabase/client' to 'lib/supabaseClient'
- Removed unused 'supabase' variable declarations in merge functions (mergeLabels, mergeFormats, mergeLocations)
- Removed unused 'items' variable in MainTab.tsx handleEditSave function
- All ESLint errors cleared
- Pickers now fully operational with real Supabase integration

---

## 2025-12-11 Changes

### Afternoon - Update 4: ARTIST + SIMPLIFIED + GENRE BUTTON HEIGHT ADJUSTED
- Artist +: Changed from button to plain text indicator (matching Aa style)
- Artist +: Now just a `<span>` with color and cursor styling (no border, no background)
- Genre button: Reduced from `minHeight: 48px` to `minHeight: 40px` for better proportions
- Genre button: Still slightly taller than single-row to accommodate tag wrapping

---

### Afternoon - Update 3: HEIGHT MATCHING FIX + ARTIST + BUTTON REPOSITIONED
- Genre button: Changed from fixed `height: 36px` to `minHeight: 48px` to match expanded field height
- Genre field: Added `boxSizing: 'border-box'` for accurate height calculation
- Location button: Changed to `height: 'auto'` with `alignItems: 'stretch'` to match input exactly
- Location input: Added `boxSizing: 'border-box'` for consistent sizing
- Artist + button: Moved to label row (matching Title's Aa indicator pattern)
- Artist field: Expanded to full width, now only contains artist name + × button
- Artist + button: Sized at 28×28px to match other label-line elements

---

### Afternoon - Update 2: BULLET LIST ICON + GENRE ALIGNMENT FIX
- Changed from hamburger icon (☰) to proper bullet list icon (SVG with bullets + lines)
- Matches Font Awesome's fa-list icon style
- Applied to all selectors: Label, Format, Genre, and Location
- Genre field: Changed button alignment from 'stretch' to 'flex-start'
- Genre button now stays aligned with first row of tags as field expands vertically
- Location field: Added unified selector styling to UniversalBottomBar
- Created UniversalBottomBar.tsx output file with Location updates

---

### Afternoon - Update 1: UNIFIED SELECTOR STYLING - CLZ EXACT MATCH
- Removed gap between dropdowns and buttons (0px)
- Made all buttons exactly 36px height to match dropdowns
- Connected elements with border-radius (rounded left/rounded right pattern)
- Removed shared border between dropdown and button (borderRight: 'none')
- Applied consistent styling to Label, Format, and Genre selectors
- Removed unused listButtonStyle constant (now using inline styles for precision)
- Date field connector lines set to fixed 10px width with space-between layout

---

### Morning - Update 4: CRITICAL TEXT COLOR FIX + WIDTH BALANCE
- **FIXED WHITE TEXT ISSUE:** Added explicit `color: '#111827'` to all input styles (inputStyle, selectStyle, dateInputStyle)
- **Why it defaults to white:** Input fields without explicit color inherit from parent container, which has white text on dark/purple background
- **Solution:** Always explicitly set text color in input field styles to prevent inheritance
- Adjusted date field widths for better balance: YYYY: 70px→88px (+25%), MM/DD: 50px→52px (+5%)
- This reduces connector line width proportionally while improving input field usability
- Applied to all inputs: Title, Sort Title, Subtitle, all date fields, Label, Format, Barcode, Cat No

---

### Morning - Update 3: DATE FIELD ALIGNMENT FIX - FINAL
- Reverted YYYY back to fixed width (70px) with MM/DD at 50px
- Expanded horizontal connecting lines to flex: 1 (with minWidth: 8px) to span full width
- Now date fields properly span from label to calendar icon via expanded connectors
- Release Date YYYY placeholder displays correctly
- Applied to Release Date, Original Release Date, and Recording Date

---

### Morning - Update 2: DATE FIELD IMPROVEMENTS COMPLETE
- Moved calendar icons from input row to label line for all date fields
- Changed calendar buttons to clickable icons (matching CLZ design)
- Connected date input boxes with horizontal lines (YYYY—MM—DD pattern)
- Changed to consistent 4px rounded corners on all date inputs
- Applied consistent pattern to Release Date, Original Release Date, and Recording Date
- Updated project status: Phase 3 now at 75% complete

---

### Morning: PHASE 2.3 PROGRESS UPDATE
- Moved "Aa" indicator from inside Title input to label line (matching CLZ design exactly)
- Updated project status to reflect Edit Modal completion:
  - Phase 1 (Core Infrastructure): 100% ✅
  - Phase 3 (Main Tab UI): 70% 🔄
  - All 8 tab components exist with proper structure
  - MainTab has complete two-column layout with all fields
  - Ready for Phase 2: Universal Picker System implementation

---

## 2025-12-09 Changes

### Evening - Rollback Point Created: PHASE 2.2 COMPLETE
- All sorting functionality working perfectly (24 options, categorized)
- Column selector fully implemented with drag-drop reordering
- 14 column groups with 80+ available columns
- Column visibility persistence via localStorage
- Column locking/sticky positioning working
- Table rendering optimized with virtual scrolling
- This is a SAFE ROLLBACK POINT - core table functionality complete

---

### Evening - Update 4: PHASE 2.3 PLANNING COMPLETE - EDIT ALBUM MODAL ROADMAP
- Analyzed CLZ Music Web screenshots (15 screenshots covering all tabs and pickers)
- Cataloged complete tab inventory: 8 tabs with detailed field lists
- Documented universal picker system architecture (Select/Manage/Edit/Merge modals)
- Mapped 40+ picker instances across all tabs
- Designed 6-phase development approach starting with core infrastructure
- Decision made: Build new modal from scratch vs. modifying existing edit-entry page
- File structure planned for tabs/, pickers/, enrichment/, and components/
- Ready to begin Phase 1: Core Infrastructure (modal shell + tabs + bottom bar)

---

## 2025-12-05 Changes

### Evening - Update 3: COLUMN FIXES COMPLETE
- Fixed "Release Date" column to show year field instead of date_added
- Removed duplicate "Added Date" column from table
- Added new "Master Release Date" column with formatted master_release_date
- Table now has 14 properly mapped columns

---

### Evening - Update 2: PHASE 2.2 EXPANDED
- Moved Column Selector from Phase 4.1 to Phase 2.2
- Added three critical column mapping fixes to Phase 2.2
- Sorting implementation marked complete (24 options working)

---

### Evening - Update 1: SORTING COMPLETE
- Implemented all 24 sort options with category organization
- Column header click sorting working (Artist, Title, Year, Format)
- Visual sort indicators (▲/▼) displaying correctly
- localStorage persistence for sort preference
- Sort dropdown UI with 4 categories (Basic, Time, Physical, Metadata, Sales)

---

### Evening: DATA CONNECTION COMPLETE
- Connected to Supabase `collection` table
- Real albums loading with batch queries
- Letter, format, and search filters working
- Album detail panel showing real data
- Format counts displaying from live data
- Album covers loading from image_url
- Proper data type handling for arrays and nulls

---

### Morning: Framework customization complete
- Changed color scheme to purple/yellow
- Updated branding to DWD
- Added comprehensive tooltips
- Framework locked and ready for data

---

## 2025-12-04 Changes

### Late: Visual framework locked
- Complete CLZ-inspired layout
- Three-panel structure perfected
- All UI elements in correct positions