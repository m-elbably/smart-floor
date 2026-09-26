# Smart Floor — Design

## 1. Architecture

```
┌──────────────────────── Neutralino window (native webview) ────────────────────────┐
│                                                                                    │
│  Vue 3 app (Nuxt UI components)                                                    │
│   ├─ ui/        panels, dialogs, toolbar, inspector, catalog, command palette       │
│   │              │ reads reactive store, dispatches commands                       │
│   ▼              ▼                                                                 │
│  editor/  (plain TS: store, commands, tools, geometry, snapping)                   │
│   │   │                                                                            │
│   │   └──► scene/  (three.js: builds meshes from store, cameras, controls, picking)│
│   ▼                                                                                │
│  db/  (sql.js in-memory SQLite + repositories + migrations)                        │
│   │                                                                                │
└───┼────────────────────────────────────────────────────────────────────────────────┘
    ▼  Neutralino.filesystem.readBinaryFile / writeBinaryFile / move
  <appData>/smart-floor/smart-floor.sqlite  (+ .bak1..3)
```

**How data moves:** user input → tool → `Command` → store mutation → (a) the scene rebuilds only the entities that changed, (b) the command is written to the DB and an autosave is scheduled.

**Dependency rules:**
- `editor/geometry` and `editor/commands` must not import Vue or three.js.
- `scene/` reads from the store but never writes to it.
- `ui/` never touches three.js directly.

## 2. Tech choices

| Concern | Choice | Why |
|---|---|---|
| Shell | Neutralinojs v6 | Tiny binaries. Uses the system webview. |
| UI | Vue 3 + `@nuxt/ui` (v4) using its **Vite plugin** in a plain Vue SPA | Gives us Nuxt UI components without a Nuxt server, which suits Neutralino's static files. |
| Language | TypeScript strict | |
| 3D | three.js + addons: `OrbitControls`, `PointerLockControls`, `TransformControls`, `CSS2DRenderer`, `GLTFLoader`, `GLTFExporter` | All in one package. |
| DB | `sql.js` (SQLite WASM) | Real SQLite, no sidecar process, the same code on every OS. |
| PDF | `jspdf` | We draw vector lines ourselves. |
| Tweening | a small hand-written lerp in the render loop | Not worth adding a dependency. |
| State | Vue `reactive()` store, no Pinia | There is only one store. |

## 3. Folder layout

```
smart-floor/
├─ neutralino.config.json
├─ package.json  vite.config.ts  tsconfig.json  index.html
├─ public/
│  ├─ sql-wasm.wasm
│  └─ models/                 # optional GLB assets (extension point)
├─ src/
│  ├─ main.ts                 # Neutralino.init, db load, mount Vue
│  ├─ App.vue                 # <UApp>, routes: Home | Editor
│  ├─ app.css                 # @import "tailwindcss"; @import "@nuxt/ui";
│  ├─ neu.ts                  # thin wrappers over Neutralino APIs (fs, os, app, window events)
│  ├─ db/
│  │  ├─ sqlite.ts            # load/create DB, export, atomic save, backups
│  │  ├─ migrations.ts        # ordered array of SQL strings
│  │  └─ repo.ts              # CRUD per table, JSON (de)serialisation
│  ├─ editor/
│  │  ├─ store.ts             # reactive state + selectors
│  │  ├─ commands.ts          # Command type, history stack, core commands
│  │  ├─ geometry.ts          # polygon math, area, intersections, wall graph
│  │  ├─ snapping.ts          # snap candidates + resolver
│  │  ├─ stairs.ts            # stair param solver + comfort check
│  │  ├─ units.ts             # format/parse lengths (metric/imperial)
│  │  ├─ shortcuts.ts
│  │  └─ tools/               # select, room, polygon, wall, door, window, stair, zone, item, measure
│  ├─ scene/
│  │  ├─ viewport.ts          # renderer, cameras, loop, resize, view switching/tween
│  │  ├─ grid.ts
│  │  ├─ builders/            # room.ts wall.ts opening.ts stair.ts zone.ts item.ts
│  │  ├─ picking.ts           # raycast + 2D hit testing
│  │  ├─ labels.ts            # CSS2D labels
│  │  └─ walk.ts              # pointer-lock walk + collisions
│  ├─ catalog/
│  │  ├─ manifest.ts          # the item list (data)
│  │  ├─ procedural.ts        # builder functions (box/cylinder compositions)
│  │  └─ index.ts             # registry: getItem(id), byCategory, search, thumbnails
│  ├─ export/                 # png.ts glb.ts pdf.ts projectFile.ts
│  └─ ui/                     # HomeView, EditorView, TopBar, ToolBar, CatalogPanel,
│                             # Inspector, StatusBar, SummaryPanel, dialogs, HelpOverlay
└─ specs/
```

## 4. Data model (SQLite)

All lengths are in metres. **As built:** column names are camelCase (`projectId`, `floorId`, `createdAt`…) so rows map 1:1 to `src/types.ts` without a mapping layer. The schema version is `PRAGMA user_version` (there is no `schema_version` table). `openings.offset` is named `along`, because OFFSET is an SQL keyword. `projects.site_json` is named `site`. `catalog_user` is named `catalogUser`. The authoritative schema is `src/db/migrations.ts`. Points are `[x, y]` in plan space: x runs east and y runs north. three.js maps them to `(x, elevation, -y)`.

```sql
CREATE TABLE schema_version (version INTEGER NOT NULL);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);   -- JSON values

CREATE TABLE projects (
  id TEXT PRIMARY KEY,            -- crypto.randomUUID()
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  thumbnail BLOB,                 -- PNG bytes
  site_json TEXT,                 -- plot boundary polygon or NULL
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE floors (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,         -- 0 = ground, negative = basement
  elevation REAL NOT NULL,        -- derived, stored for convenience
  height REAL NOT NULL DEFAULT 2.8,
  slab REAL NOT NULL DEFAULT 0.2
);

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT DEFAULT 'generic',    -- bathroom, kitchen, ...
  polygon TEXT NOT NULL,          -- JSON [[x,y],...] CCW
  floor_material TEXT DEFAULT 'wood',
  wall_color TEXT DEFAULT '#f2efe9',
  ceiling INTEGER DEFAULT 1
);

CREATE TABLE walls (              -- free-standing walls & fences only; room walls are derived
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  a TEXT NOT NULL, b TEXT NOT NULL,   -- JSON [x,y]
  thickness REAL NOT NULL, height REAL NOT NULL,
  kind TEXT DEFAULT 'wall'        -- wall | fence
);

CREATE TABLE openings (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  host TEXT NOT NULL,             -- JSON {roomId, edge} or {wallId}
  offset REAL NOT NULL,           -- centre distance from edge start
  kind TEXT NOT NULL,             -- door | window
  preset TEXT, width REAL, height REAL, sill REAL,
  props TEXT DEFAULT '{}'         -- hinge, swing, style
);

CREATE TABLE stairs (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,             -- straight | L | U | spiral
  x REAL, y REAL, rotation REAL,
  params TEXT NOT NULL            -- JSON {width, steps, railingL, railingR, ...}
);

CREATE TABLE zones (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,             -- grass | patio | path | pool | driveway
  polygon TEXT NOT NULL, props TEXT DEFAULT '{}'
);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  catalog_id TEXT NOT NULL,
  x REAL, y REAL, z REAL DEFAULT 0, rotation REAL DEFAULT 0,
  scale TEXT DEFAULT '[1,1,1]',
  variant TEXT, name TEXT
);

CREATE TABLE catalog_user (       -- future: user-imported items; built-ins live in code
  id TEXT PRIMARY KEY, manifest TEXT NOT NULL, glb BLOB
);

CREATE INDEX idx_floor_project ON floors(project_id);
CREATE INDEX idx_rooms_floor ON rooms(floor_id);
CREATE INDEX idx_items_floor ON items(floor_id);
-- (same pattern for walls/openings/stairs/zones)
```

**Why only room polygons are stored, not room walls:** walls are derived from the polygons, so shared walls and exterior/interior thickness are always consistent. Only free-standing walls get their own rows.

**Migrations:** `migrations.ts` exports `string[]`. On startup, every entry after `PRAGMA user_version` runs inside its own transaction. Run `PRAGMA foreign_keys = ON` every time the database is opened.

## 5. Persistence (sql.js + Neutralino)

```
start:
  path = await Neutralino.os.getPath('data') + '/smart-floor/smart-floor.sqlite'
  bytes = readBinaryFile(path)  ── missing → new SQL.Database()
                                 └ corrupt → dialog: restore .bak1..3 or start fresh
  db = new SQL.Database(new Uint8Array(bytes)); migrate(db)

on command:  repo write (in-memory, instant) → scheduleSave()
scheduleSave: debounce 1000 ms → save()
save():
  data = db.export()
  writeBinaryFile(path + '.tmp', data.buffer)
  filesystem.move(path + '.tmp', path)       # atomic replace
  once per day: rotate path → .bak1 → .bak2 → .bak3 before writing
on 'windowClose' event: await save(); Neutralino.app.exit()
```

`db.export()` copies the whole database. That is fine for home-plan sized data, which is typically under 5 MB.
> ponytail: full-file export per save; switch to a Neutralino extension with native SQLite if DBs grow past ~50 MB.

**Loading the wasm file:** `initSqlJs({ locateFile: () => '/sql-wasm.wasm' })`. The file is copied from `node_modules/sql.js/dist` into `public/`.

## 6. Editor core

### 6.1 Store (`editor/store.ts`)

```ts
interface EditorState {
  project: Project | null
  floors: Floor[]; activeFloorId: string
  rooms: Map<string, Room>; walls; openings; stairs; zones; items   // for the whole project
  selection: Set<string>; hoverId: string | null
  tool: ToolId; view: '2d' | '3d' | 'walk'
  floorVisibility: 'active' | 'ghost' | 'all'
  settings: { units: 'metric'|'imperial'; grid: number; theme; floorHeight; wallThickness }
  saveState: 'saved' | 'saving' | 'dirty' | 'error'
}
```

When a project opens, the store loads everything for that project with one query per table. Home plans are small.

### 6.2 Commands (`editor/commands.ts`)

```ts
interface Command { label: string; do(): void; undo(): void }
execute(cmd)  → cmd.do(); undoStack.push(cmd); redoStack = []; markDirty()
undo()/redo() → pop/push between stacks
```

- The core commands are generic, so we don't need one class per entity:
  - `AddEntity(table, entity)`
  - `RemoveEntity(table, id)` — it captures the entity and its dependants, so undo restores all of them
  - `UpdateEntity(table, id, patch)` — it captures the previous values of the patched fields
  - `Batch(cmds[])`
- Each command's `do` and `undo` write to both the store and the repository.
- **Drag merging:** while a drag is in progress, the store is updated directly for preview. On pointer-up, one `UpdateEntity` command is added with the original values.
- The history holds at most 200 commands. It is cleared when a project is closed.

### 6.3 Tools (`editor/tools/*`)

```ts
interface Tool {
  id: ToolId; cursor: string
  onPointerDown?(e: PlanEvent); onPointerMove?(e: PlanEvent); onPointerUp?(e: PlanEvent)
  onKey?(e: KeyboardEvent): boolean
  preview(): PreviewShape[]      // ghost geometry drawn by scene/
  cancel(): void
}
// PlanEvent = { p: Vec2 (snapped), raw: Vec2, snap: SnapHit|null, shift, alt, ctrl, button, hitId }
```

The viewport converts mouse events into plan coordinates (by raycasting onto the plane at the active floor's elevation), runs snapping, and then calls the active tool.

### 6.4 Geometry (`editor/geometry.ts`)

All functions are pure. `Vec2 = [number, number]`.

| Function | Notes |
|---|---|
| `area(poly)` | Shoelace formula, returns the absolute value. |
| `centroid(poly)` | Used to position labels. |
| `ensureCCW(poly)` | Normalises the vertex order. |
| `isSimple(poly)` | O(n²) check for segment intersections. Rooms have fewer than 50 vertices. |
| `pointInPolygon` | Ray casting. |
| `segDistance`, `projectOnSegment` | Used by snapping and opening placement. |
| `deriveWalls(rooms)` | Collects all room edges and merges collinear edges that overlap. The result is a wall list `{a, b, thickness, exterior, hosts:[{roomId,edge}]}`. The overlap is split so a partial overlap produces a shared piece plus exterior pieces. Tolerance is 1 mm. |
| `wallSegments(wall, openings)` | Splits a wall along its length into solid parts and opening parts. Each opening part becomes a lintel above plus, for windows, a sill part below. |

### 6.5 Snapping (`editor/snapping.ts`)

For a raw point, the candidates in priority order are:
1. vertex (within 12 px)
2. wall midpoint
3. wall edge (projected onto the edge)
4. alignment with a vertex's x/y
5. angle lock (15°) from the previous point
6. grid

Radii are in **screen pixels** and are converted to metres using the current zoom. The first candidate wins. The result includes `{kind, point, guide?}` so the scene can draw a guide line and play a pulse. Holding Alt skips snapping.

### 6.6 Stairs (`editor/stairs.ts`)

- `solve({totalRise, steps?, targetRise=0.175, going=0.27, width, kind})` → `{steps, rise, going, runLength, footprint: Vec2[], comfortWarnings[]}`.
  - If `steps` is not given, it is calculated as `steps = round(totalRise / targetRise)`.
- Comfort rules: 0.15 ≤ rise ≤ 0.19, going ≥ 0.25, and 0.60 ≤ 2·rise + going ≤ 0.65.
- The footprint polygon is used for hit-testing and for the stairwell void cut into floor N+1's slab.

### 6.7 Units (`editor/units.ts`)

- `format(m, units)`:
  - Metric: `3.45 m`, or `45 cm` below 1 m.
  - Imperial: `11' 3¾"`.
- `parse(str)` accepts `3.5`, `3.5m`, `350cm`, `3500mm`, `11'3"`, and returns metres or null.

## 7. Rendering (`scene/`)

- **Scene graph:**
  - `root`
    - `floorGroup[floorId]` (y = elevation)
      - `rooms`, `walls`, `openings`, `stairs`, `zones`, `items`, `labels`
    - `overlay` (previews, snap guides, selection outlines)
    - `grid`
- **Cameras:**
  - `OrthographicCamera` for 2D. It looks straight down and has no rotation.
  - `PerspectiveCamera` (fov 50) for 3D and walk mode.
  - Switching views tweens the position and target over 350 ms with ease-in-out.
- **Controls:**
  - 2D: custom pan and zoom around the cursor.
  - 3D: `OrbitControls` (damping on).
  - Walk: `PointerLockControls`.
  - Items: `TransformControls`, used for translate and rotate-Y only.
- **Builders:** each builder is a pure function `(entity, ctx) → Object3D`. The scene keeps a `Map<id, Object3D>`. When an entity changes, only its object is rebuilt, found through a store watcher that diffs by id. Walls are rebuilt for the whole floor whenever any room on that floor changes, because walls are derived.
  - **Floors:** `ShapeGeometry` from the polygon, with the material texture tiled at 1 m.
  - **Walls:** a `BoxGeometry` for each segment from `wallSegments`, oriented along the wall.
  - **Openings:** a simple door leaf or window pane (glass `MeshPhysicalMaterial` with transmission off, opacity 0.3).
  - **2D symbols:** `Line` objects on the overlay, visible only in 2D. Doors have a swing arc and windows have triple lines.
  - **Stairs:** a box for each step, generated from `solve()`. Spiral stairs use rotated wedge boxes around a centre cylinder.
  - **Zones:** a flat shape slightly above the floor. A pool is a recessed shape with a water material.
- **2D look:**
  - Walls are drawn as filled dark polygons (the top faces of the wall boxes, seen by the ortho camera).
  - Floors are light.
  - Items use flat colours.
  - There is one scene for all views; only the camera and a few material flags change.
- **Picking:** a `Raycaster` against the pickable objects of the active floor. Each object stores `userData = { id, kind }`. Hover runs on `pointermove`, throttled to animation frames.
- **Labels:** `CSS2DRenderer` for room names and areas, live dimensions, and measure results. They are hidden in walk mode.
- **Performance:**
  - Items that share a catalog id and variant use one `InstancedMesh` for each part.
  - Walls use one merged geometry per floor.
  - Rendering happens on demand: the app renders only after a change, input, or tween, and never in an idle loop, except in walk mode.
- **Lighting:** a `HemisphereLight` and one `DirectionalLight` with soft shadows. Shadows are on in 3D and walk mode and off in 2D.

### Walk mode (`scene/walk.ts`)

- The camera sits at the active floor's elevation + 1.65 m. Walking speed is 1.4 m/s, and 3 m/s when running.
- **Collision:** a 2D circle (r = 0.25 m) is tested against the wall segments of the current floor. Door openings are gaps in those segments, so they are passable. The player slides along walls.
- **Stairs:** inside a stair footprint, height is interpolated along the run. Leaving the far end switches `activeFloorId` to N+1, and walking back switches to N.

## 8. Furniture catalog

### Manifest format (`catalog/manifest.ts`)

```ts
interface CatalogItem {
  id: string                       // 'sofa-3'
  name: string                     // 'Sofa (3-seat)'
  category: 'living'|'bedroom'|'kitchen'|'bathroom'|'office'|'outdoor'|'decor'
  tags: string[]
  size: [w: number, d: number, h: number]   // metres, bounding box
  placement: 'floor' | 'wall' | 'ceiling'
  scale?: { min: number; max: number }       // uniform, default 0.5..2
  variants?: { id: string; name: string; colors: Record<string, string> }[]
  model:
    | { type: 'procedural'; builder: string; params?: Record<string, unknown> }
    | { type: 'glb'; url: string }           // e.g. '/models/sofa.glb', scaled to size
}
```

- **Procedural builders** (`catalog/procedural.ts`) are small functions such as `sofa`, `bed`, `table`, `chair`, `cabinet`, `tree`, `toilet` and so on. They compose boxes, cylinders and spheres, and they are parametrised by `size` and colour slots. One builder covers several items (for example, `table` covers the coffee table, dining tables and the desk).
- **Thumbnails** are rendered once at startup into an offscreen renderer, using an iso camera, 128 px. They are cached in memory.
- **Extending the catalog:** to add an item, append one entry to `manifest.ts` and optionally drop a GLB into `public/models/`. Later, `catalog_user` rows are merged in at load time for user imports; the backlog lists this.

## 9. UI (Nuxt UI)

Screens:
- **Home:** a grid of project cards (`UCard`), a "New project" button (`UModal` with a form), and search (`UInput`).
- **Editor:**
```
┌ TopBar: ◀ Home | Project name (editable) | Floor: [Ground ▾] [+] | 2D·3D·Walk | Undo Redo | Export ▾ | ⚙ ┐
├──────┬───────────────────────────────────────────────────────────────┬──────────────┤
│Tools │                                                               │ Inspector    │
│ V R W│                    Viewport (canvas + CSS2D layer)            │ (selection   │
│ D N S│                                                               │  properties) │
│ G M F│                                                               │──────────────│
│──────│                                                               │ Summary      │
│Catalog (UTabs by category, search, draggable thumbnails)             │ (areas)      │
├──────┴───────────────────────────────────────────────────────────────┴──────────────┤
│ StatusBar: x 3.45 m  y 1.20 m | snap: vertex | grid 0.10 m | Saved ✓                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- **Components used:** `UApp`, `UButton`, `UButtonGroup`, `USelectMenu` (floor), `UTabs`, `UInput`, `UInputNumber`, `UColorPicker`, `USlider`, `UModal`, `UDropdownMenu`, `UCommandPalette`, `UKbd`, `UTooltip` (with the shortcut in each tooltip), `UToast` (feedback such as "Stair comfort warning").
- **Theme:** Nuxt UI colour mode. The three.js clear colour and grid colours follow the theme.
- **Onboarding:** on the first run, three dismissible tips: "Press R and drag to draw a room", "Drag furniture from the catalog", "Press Tab to walk inside".

## 10. Export

| Format | How |
|---|---|
| PNG | Render once at `pixelRatio × scale` into the current canvas size, then `toBlob`, then `os.showSaveDialog`, then `writeBinaryFile`. |
| GLB | `GLTFExporter.parseAsync(root or floorGroup, {binary:true})`. Overlay and labels are excluded. |
| PDF | Build a 2D vector drawing directly from the store (not from the canvas) with `jspdf`: <br>• wall polygons filled, openings as symbols <br>• room names and areas <br>• dimension lines for exterior walls <br>• a scale bar and a title block <br>The page scale is 1:50, 1:100 or fit. |
| `.smartfloor` | Create a new `SQL.Database`, run the migrations, copy that project's rows, `export()`, and write the file. Importing does the reverse and gives the project new ids. |

## 11. Neutralino config highlights

```json
{
  "applicationId": "com.greenpvl.smartfloor",
  "defaultMode": "window",
  "documentRoot": "/dist/",
  "url": "/",
  "enableServer": true,
  "nativeAllowList": ["app.*", "os.*", "filesystem.*", "window.*", "events.*"],
  "modes": { "window": { "title": "Smart Floor", "width": 1400, "height": 900, "minWidth": 1024, "minHeight": 640, "exitProcessOnClose": false } },
  "cli": { "binaryName": "smart-floor", "resourcesPath": "/dist/", "clientLibrary": "/public/neutralino.js" }
}
```

- `exitProcessOnClose: false` lets the app handle `windowClose` itself: flush the save, then exit.
- **Dev mode:** `neu run` (neu v11 starts the dev server itself) with Vite on :5188, using `cli.frontendLibrary` (`patchFile`, `devUrl`, `devCommand`, `projectPath`). neu patches the `__neutralino_globals.js` script tag in `index.html` so the Neutralino globals are injected.

## 12. Testing approach

- **Pure modules** (`geometry`, `snapping`, `stairs`, `units`, `commands`, `repo` with an in-memory sql.js) each have a `*.check.ts` self-check using `node:assert`. They run with `npm run check`, which calls `tsx` on each file.
- **Everything else** gets a manual verify step for each milestone in `implementation.md`.
- **Type check:** `vue-tsc --noEmit` in `npm run check`.
