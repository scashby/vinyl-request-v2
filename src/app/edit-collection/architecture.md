# ARCHITECTURE.md
# System Architecture - DWD Collection Management System

Technical architecture documentation for the vinyl collection management system.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Rendering:** React Server Components
- **Code Quality:** ESLint
- **Virtualization:** @tanstack/react-virtual
- **Drag & Drop:** @dnd-kit

---

## Key Principles

1. **Exact CLZ replication** - No approximations
2. **Systematic development** - Build with comprehensive documentation
3. **Surgical updates** - Preserve existing code/docs, make targeted changes
4. **Comprehensive testing** - Test thoroughly before progression

---

## Universal Picker System Architecture

All pickers (Genre, Format, Artist, Tags, Location, etc.) follow this consistent 4-modal pattern:

### 1. SELECT Modal (PickerModal.tsx)
**Purpose:** Choose items (single or multi-select)

**Features:**
- White header (not orange)
- Compact 500px width
- Search bar at top
- Radio buttons (single) OR Checkboxes (multi)
- Item counts displayed on right
- "New [Item]" button (top-right, blue)
- "Manage [Items]" button (top-right, gray)
- "Save" button (bottom-right)
- z-index: 30001

### 2. MANAGE Modal (ManageModal.tsx)
**Purpose:** Edit/delete/merge items

**Two Modes:**

**Normal Mode:**
- White header
- Search bar
- List with ✏️ edit + ❌ delete per row
- "Merge Mode" button (bottom-right)
- "Close" button (bottom-left)
- Width: 600px
- z-index: 30002

**Merge Mode:**
- Orange header
- Checkboxes for selection
- Yellow banner with instructions
- Right panel preview of merge target
- "Cancel Merge" button (red, bottom-left)
- "Merge to" button (bottom-right)
- Width: 900px

### 3. EDIT Modal (EditModal.tsx)
**Purpose:** Edit single item name

**Features:**
- 450px width
- Name input field with auto-focus and select-all
- Enter to save, Escape to cancel
- Empty name validation
- z-index: 30003

### 4. MERGE Modal (MergeModal.tsx)
**Purpose:** Final merge confirmation

**Features:**
- 550px width
- Radio selection for primary item to keep
- Yellow info banner explaining merge
- Preview section showing total counts
- Deletion warning for merged items
- Red "Merge" button (destructive action)
- z-index: 30004

---

## Ref Exposure Pattern

**Use Case:** When a parent component needs to trigger functionality in a child component.

**Example:** EditAlbumModal → MainTab → Location Picker

### Implementation:

**1. Child Component (MainTab.tsx):**
```typescript
export interface MainTabRef {
  openLocationPicker: () => void;
}

const MainTab = forwardRef<MainTabRef, MainTabProps>((props, ref) => {
  useImperativeHandle(ref, () => ({
    openLocationPicker: () => {
      setShowLocationPicker(true);
    }
  }));
  
  // ... component code
});
```

**2. Parent Component (EditAlbumModal.tsx):**
```typescript
const mainTabRef = useRef<MainTabRef>(null);

// Pass ref to child
<MainTab ref={mainTabRef} {...props} />

// Call child method from parent
const handleOpenLocationPicker = () => {
  mainTabRef.current?.openLocationPicker();
};
```

**3. Callback Chain:**
```
UniversalBottomBar (Location button click)
  ↓
EditAlbumModal (onOpenLocationPicker callback)
  ↓
MainTab (ref.current.openLocationPicker())
  ↓
PickerModal (shows location picker)
```

**This pattern can be reused for:**
- Any picker triggered from bottom bar
- Any tab-specific functionality needing external triggers
- Cross-component communication without prop drilling

---

## Database Schema

### Collection Table Fields

**Core:**
- id, artist, title, year, year_int, format, folder

**Media:**
- media_condition, image_url, sleeve_condition

**Sales:**

**Metadata:**

**Services:**
- spotify_total_tracks, apple_music_track_count

**Dates:**

**Enrichment:**

**External IDs:**
- discogs_master_id, discogs_release_id
- discogs_id (alias for discogs_release_id)

**Physical:**
- discs, sides, length_seconds

**Value:**
- current_value, purchase_price

---

## Performance Optimizations

### Data Loading
- **Batch loading:** 1000 albums per query to prevent timeout
- **Progressive loading:** Load in chunks, display progressively
- **Error handling:** Graceful degradation on failed batches

### Rendering
- **Virtual scrolling:** (@tanstack/react-virtual) handles large datasets
- **Memoized components:** Prevent unnecessary re-renders
- **Split columns:** Locked/unlocked columns for proper sticky positioning
- **Conditional rendering:** Only render visible components

### State Management
- **LocalStorage persistence:** Column preferences, sort settings, user preferences
- **Client-side filtering:** Fast for <10k albums
- **Debounced search:** Reduce filter recalculations
- **Optimistic updates:** Show changes immediately, sync in background

### Future Considerations
- Server-side filtering/sorting for 50k+ albums
- Infinite scroll for very large collections
- Web workers for heavy computations
- IndexedDB for offline support

---

## File Organization

### Main Application
```
src/app/edit-collection/
├── page.tsx                    # Main collection browser (~1200 lines)
├── columnDefinitions.ts        # 80+ column definitions, 14 groups
├── CollectionTable.tsx         # Virtualized table component
├── ColumnSelector.tsx          # Drag-drop column picker
└── project_status.md           # Project status (this gets updated)
```

### Edit Modal System
```
src/app/edit-collection/
├── EditAlbumModal.tsx          # Main modal orchestrator
├── tabs/                       # 8 tab components
├── pickers/                    # 4 universal picker modals
├── settings/                   # Settings system
├── enrichment/                 # API integrations (planned)
└── src/components/             # Shared components
```

### Component Hierarchy
```
EditAlbumModal
├── TabNavigation
├── ActiveTab (MainTab | DetailsTab | etc.)
│   └── PickerModal (when opened)
│       └── ManageModal (when opened)
│           ├── EditModal (when editing)
│           └── MergeModal (when merging)
└── UniversalBottomBar
```

---

## Type System

### Key Interfaces

**Album Type:**
- 80+ fields matching database schema
- Nullable fields handled with `| null`
- Arrays for multi-value fields (genres, tags)

**Column System:**
- `ColumnId` - Union type of all column IDs
- `ColumnDefinition` - Metadata (label, width, sortable, lockable)
- `ColumnGroup` - Organizing columns into categories

**Picker System:**
- Generic `PickerItem` interface
- Type-safe data fetch functions
- Proper TypeScript throughout picker modals

---

## Known Limitations

1. **Selection checkboxes:** Not yet functional (Phase 3.1)
2. **Table columns:** Some show placeholders (need calculated values)
3. **Collection tabs:** Not yet implemented (Phase 5)
4. **Detail panel:** Needs polish (Phase 2.4)
5. **Action buttons:** Some are placeholders

---

## Development Workflow

### Adding a New Picker

1. Add fetch function to `pickerDataUtils.ts`
2. Add update/delete/merge functions if needed
3. Import picker in tab component
4. Add state for picker visibility
5. Wire button to open picker
6. Handle save callback
7. Test CRUD operations

### Adding a New Tab

1. Create component in `tabs/` directory
2. Import in `EditAlbumModal.tsx`
3. Add to tab navigation array
4. Implement tab layout
5. Add pickers as needed
6. Wire up bottom bar callbacks
7. Test save/cancel functionality

### Making Surgical Updates

1. Read existing file first (use `view` tool)
2. Identify exact string to replace
3. Use `str_replace` for single changes
4. Use Canvas for multiple changes in one file
5. Never rewrite files from scratch
6. Always preserve existing documentation
7. Update project_status.md with changes

---

**END OF ARCHITECTURE DOCUMENT**
