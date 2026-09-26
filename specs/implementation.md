# Smart Floor — Implementation checklist

Work top to bottom. The milestones build on each other.

Each task has these tags:
- the requirement IDs it covers, in `[FR-xx]` form
- the file(s) it mainly touches

A milestone is done only when its **Verify** box is checked.

---

## M0 — Scaffold ✅
- [x] Vite + Vue + TS written by hand (no template demo). Nuxt UI via `ui({ router: false })` in `vite.config.ts`; `src/app.css` imports `tailwindcss` + `@nuxt/ui`; app wrapped in `<UApp>`.
- [x] Installed: `three`, `sql.js`, `jspdf`, `@neutralinojs/lib` (ES module client), dev: `typescript@6` (vue-tsc doesn't support TS 7 yet), `vue-tsc`, `tsx`, `@neutralinojs/neu`, types.
- [x] `neutralino.config.json` per design §11 + `cli.frontendLibrary` (dev server on **:5188**, since another project of yours already uses :5173) and `distributionPath: /release` (keeps release output out of Vite's `dist/`). `neu update` fetched binaries 6.9.0.
- [x] `index.html` has a `<script src="/__neutralino_globals.js">` placeholder that `neu run` patches in dev. Stop dev by closing the window, not with Ctrl+C, otherwise the patch isn't reverted.
- [x] `sql-wasm.wasm` is copied into `public/` by `postinstall`. npm's allow-scripts can skip it; if so, run `npm run postinstall`.
- [x] Scripts: `dev` = `neu run`, `vite`, `build` = `vite build && neu build --release`, `check` = `vue-tsc --noEmit && node scripts/check.mjs` (runs every `*.check.ts` with tsx).
- [x] `src/neu.ts`: `initNeutralino`, `isNeutralino`, `dataDir`, `exists`, `readBin`, `writeBin`, `move`, `remove`, `saveDialog`, `openDialog`, `onWindowClose`.
- [x] TS strict, `@/` alias.
- [x] **Verify:** `npm run dev` opens the window showing "Running in Neutralino" and a Nuxt UI button; `npm run build` produces `release/smart-floor-release.zip` (8.3 MB, all OSes), and the Linux binary runs.

## M1 — Persistence `[FR-120..123, NFR-05]` ✅
- [x] `db/migrations.ts`: migration 1 = full schema (design §4). Version tracked with `PRAGMA user_version`. `[FR-121]`
- [x] `db/sqlite.ts`:
  - `openDb()`: load the file, or create a new DB when it is missing.
  - `PRAGMA integrity_check` on open.
  - `migrate()`.
  - In a plain browser tab (no Neutralino) the DB is in-memory only.
- [x] `db/sqlite.ts`:
  - `scheduleSave()` (1 s debounce).
  - `save()`: serialised writes; write `.tmp`, then move it over the real file.
  - Daily rotation of `.bak1..3`.
  - `onSaveState()` listener.
- [x] Corrupt file → `DbOpenError` with the backups that exist → recovery modal in `App.vue`. `recover()` renames the bad file to `.corrupt-<ts>` (it is never deleted), then restores the chosen backup or starts fresh. `[FR-122]`
- [x] Flush the save on `windowClose`, then `app.exit()` (`main.ts`). `[FR-123]`
- [x] `db/repo.ts`:
  - `insert`, `update`, `remove`, `get`, `listBy`, `listProjects`, `loadProject`, `getSetting`, `setSetting`, `exportDb`.
  - JSON and boolean columns are converted automatically.
  - Identifiers are validated.
- [x] `exportDb()` re-enables `PRAGMA foreign_keys` after `db.export()`, because sql.js resets it. Without this, cascades silently stop working after the first save.
- [x] `db/repo.check.ts`: round trips, update, settings upsert, identifier rejection, cascade delete after export, idempotent migration.
- [x] Dev console hook: `sf.db`, `sf.repo`, `sf.scheduleSave` (dev builds only).
- [x] **Verify (done by Claude):**
  - The file is created under `~/.local/share/smart-floor/` and survives restarts.
  - `.bak1` is created on the first save of the day and not rotated again that day.
  - A truncated file shows the recovery modal.
- [ ] **Verify (you):** truncate the file, click "Restore backup 1", and confirm the app loads with the backup's data.

## M2 — Projects, floors & settings UI `[FR-01..04, FR-10..12, FR-100..102]` ✅
- [x] Simple view switching in `App.vue` (Home when `store.data` is null, otherwise Editor). No router.
- [x] `ui/HomeView.vue`: project cards, search, sorted by `updatedAt`, empty state (`UEmpty`), relative "Edited …" time. `[FR-02]`
- [x] New project modal (name required, description). It creates the project and a "Ground Floor" and opens it. `[FR-01]`
- [x] Card menu: open, rename, duplicate (`repo.duplicateProject`: deep copy through `remapIds`, which rewrites every reference, including opening hosts), delete (confirm modal). `[FR-03]`
- [x] `editor/store.ts`: reactive store + actions: `openProject`, `closeProject`, project CRUD, `addFloor`, `updateFloor`, `moveFloor`, `removeFloor`, `saveSettings`, `touch`.
- [x] `editor/floors.ts`: pure floor-stack logic. `elev(n) = elev(n-1) + height(n-1) + slab(n)`, with the ground floor at 0 and the number of basements kept when reordering. `floors.check.ts`.
- [x] `ui/TopBar.vue`: back button, editable project name, floor `USelect` (top floor first), ▲▼ buttons, PageUp/PageDown, add floor above/basement menu. `[FR-10, FR-12]`
- [x] `ui/FloorsModal.vue`: rename, height, slab, live elevation, move up/down, two-step delete. `[FR-11]`
- [x] `ui/SettingsModal.vue`: units, theme (drives the `@vueuse` color mode), grid, default floor height, slab and wall thicknesses. Stored as one JSON `settings` row. `[FR-100, FR-101, FR-102]`
- [x] `editor/units.ts`: `format`, `formatArea`, `parse` (only ft+in may be combined, so "2.80 m300cm" is rejected). `units.check.ts`. `[FR-100]`
- [x] `ui/LengthInput.vue`: length field that shows the user's units and accepts "350cm", `11'3"` and so on. Invalid input is highlighted and not applied.
- [x] Icons are bundled offline (`@iconify-json/lucide`, added via `addCollection`); Nuxt UI would otherwise fetch icons from the network. `[NFR-03]`
- [x] Floor and project edits write directly for now. M4 moves entity edits onto the undo stack.
- [x] **Verify (done by Claude, headless Chrome against the dev server):**
  - Create a project, add a floor above and a basement: elevations are −3.00 / 0.00 / 3.00 m.
  - Edit heights and slabs: elevations recalculate.
  - Invalid input is rejected.
  - Two-step floor delete works.
  - PageUp changes floor.
  - Duplicating a project copies all 3 floors.
  - Imperial and dark mode render correctly.
- [ ] **Verify (you):** in the real app, create a project with 3 floors, restart the app, and confirm everything is still there.

## M3 — Scene core `[FR-80, FR-81, FR-83, NFR-01]` ✅
- [x] `scene/viewport.ts`:
  - `WebGLRenderer` (antialias) and `CSS2DRenderer` over it.
  - `ResizeObserver`.
  - `requestRender()` on-demand loop.
- [x] Orthographic 2D camera with pan (middle mouse, Space+drag, arrow keys) and zoom toward the cursor. `[FR-80]`
- [x] `scene/grid.ts`: adaptive metric grid (major 1 m, minor 0.1 m, fades by zoom), themed colours.
  - As built: a shader grid on one 200 m plane (0.1/1/10 m, each fades by on-screen spacing via `fwidth`). Long GL line segments vanished in 3D under SwiftShader.
- [x] Perspective camera with `OrbitControls` (damping). View presets: top, front, iso. `[FR-81]`
- [x] Tweened switching between 2D and 3D (350 ms). Tab and toolbar buttons cycle views. `[FR-83]`
- [x] Floor groups at their elevations. Floor visibility modes: active, ghost, all. `[FR-13]`
- [x] Mouse → plan coordinates (raycast onto the plane at the floor's elevation). The status bar shows x/y.
- [x] Lights: hemisphere + directional. Shadows only in 3D.
- [ ] **Verify (user, in the real app on a GPU):** smooth pan and zoom in 2D, orbit in 3D, and the Tab transition animates. The window resizes cleanly. The ghost floor below is visible.
  - Headless Chrome (SwiftShader) check done: 2D ghost, zoom keeps the point under the cursor (4.00, 1.20 m before and after), Tab tween, orbit, all-floors mode, back to 2D, resize, dark theme, Front preset.
  - Notes: plan (x, y) maps to world (x, elevation, −y). The ghost floor is drawn in a first pass with `scene.overrideMaterial`. Floors above the active one are never shown in 2D. Shaders are warmed up with `compileAsync` so the first on-demand frame isn't missing the grid. Keyboard shortcuts act unless focus is in a text field, dialog or menu.

## M4 — Editor core `[FR-90..96, FR-93]` ✅
- [x] `editor/commands.ts`:
  - `execute`, `undo`, `redo`, capped at 200. `[FR-91]`
  - `AddEntity`, `RemoveEntity` (captures dependants), `UpdateEntity`, `Batch`.
- [x] `commands.check.ts`: add → update → remove → undo ×3 restores the original state (store and repo).
- [x] Connect commands to `scheduleSave`. The status bar shows the save state. `[FR-120]`
- [x] `scene/` store watcher: rebuild changed ids through the builders registry.
- [x] `editor/geometry.ts`: `area`, `centroid`, `ensureCCW`, `isSimple`, `pointInPolygon`, `projectOnSegment`, `segDistance`. `geometry.check.ts`.
- [x] `editor/snapping.ts`:
  - Candidates in priority order, per design §6.5.
  - Radii in pixels.
  - Alt bypasses snapping.
  - `snapping.check.ts`.
- [x] Snap guide lines and a pulse ring in the overlay. `[FR-93]`
- [x] Tool interface and tool manager. `scene/picking.ts` handles hover highlight. `[FR-90]`
- [x] Select tool: click, Shift+click, box select, Esc, Delete. `[FR-90]`
- [x] Clipboard: copy, cut, paste at the cursor, Ctrl+D duplicate. `[FR-92]`
- [x] `editor/shortcuts.ts`: one keymap table that feeds the tool keys, the help overlay (`?`) and the command palette (Ctrl+K). `[FR-95, FR-96]`
- [x] `ui/Inspector.vue`: generic property form driven by per-kind field definitions. Multi-select edits the common fields. `[FR-94]`
- [x] **Verify:** `npm run check` passes. Place a test box entity, move it, undo and redo it. The palette lists the actions.
  - Done in headless Chrome with rooms (items arrive in M9): add, move, undo, redo, box select, duplicate, palette and help render. `commands.check.ts`, `geometry.check.ts`, `snapping.check.ts` and `model.check.ts` pass.
  - As built: picking is `viewport.pick()` (no separate `picking.ts`), and the hover highlight is an overlay outline. Tools live in `editor/tools/` (index = manager, select, room [rect/polygon/template], wall, opening [door/window]). The keymap table is `editor/shortcuts.ts`. The viewport forwards pointer events in capture phase, so a tool that claims a drag pauses OrbitControls in 3D.

## M5 — Rooms & walls `[FR-20..28, FR-70, FR-71, FR-75]` ✅
- [x] Rectangle room tool with live width × depth and area labels. `[FR-20, FR-70]`
- [x] Polygon room tool:
  - Click to add vertices. Close on the first vertex or Enter.
  - Backspace and Esc work.
  - Reject shapes that fail `isSimple`.
  - `[FR-21]`
- [x] Numeric length entry while drawing (`parse()` from units). `[FR-75]`
- [x] `geometry.deriveWalls(rooms)`:
  - merge shared or overlapping edges
  - interior/exterior thickness
  - hosts
- [x] `geometry.check.ts` cases for `deriveWalls`: 2 adjacent rooms, a partial overlap, and an L-shape. `[FR-26, FR-27]`
- [x] Builders:
  - Floor `ShapeGeometry` with a material.
  - Walls as boxes, merged per floor.
  - Ceiling toggle.
  - `[FR-24]`
- [x] Room editing:
  - Vertex handles.
  - Edge drag (parallel move).
  - Double-click an edge to insert a vertex.
  - Delete a vertex (keep at least 3).
  - Each gesture is one merged command.
  - `[FR-23]`
- [x] Room labels (name + m²) through CSS2D, toggleable. `[FR-71]`
- [x] Auto-naming ("Room N"). `[FR-25]`
- [x] Inspector fields: name, kind, floor material, wall colour, ceiling. `[FR-24]`
- [x] Room templates with a stamp preview and R to rotate:
  - rect 4×3
  - L-shape
  - bathroom, kitchen, bedroom (their items are added in M9)
  - `[FR-22]`
- [x] Free wall tool (chain of segments, per-wall height and thickness). `[FR-28]`
- [ ] **Verify (user, real app):** draw two rooms that touch: one shared wall renders. Area labels are correct against a hand calculation. Vertex drag updates the walls live. Undo works for each gesture.
  - Headless check done: a shared wall renders once. A trapezoid 0,0/4,0/4,3/0,4 shows 14.00 m² (hand: (3+4)/2·4 = 14). Vertex and edge drags, insert/delete corner by double-click, polygon with a typed length, template with R rotate, and a typed rect `2x1.5` all work.
  - As built:
    - Exterior walls are offset outward, so the room polygon is the inner face. Areas are clear floor area.
    - Shared (collinear, overlapping) edges become one interior wall, centred.
    - Exterior walls extend by their thickness at convex corners only.
    - Walls are one box per wall part, not merged per floor. Merge if wall counts ever hurt frame rate.
    - Floor materials are flat colours, no textures yet.
    - Ceilings are built on a walk-only layer.
    - The grid sits 5 mm under the floor, so rooms hide it.

## M6 — Doors & windows `[FR-30..33]` ✅
- [x] `geometry.wallSegments(wall, openings)`, plus a check (openings at the ends, adjacent openings).
- [x] Door tool:
  - hover a wall to see a ghost
  - snap along the wall
  - block overlaps and wall ends
  - presets
  - hinge/swing flip with F
  - `[FR-30]`
- [x] Window tool with presets and sill height. `[FR-31]`
- [x] Drag an opening along its wall. Inspector fields for width, height, sill and offset. `[FR-32]`
- [x] Wall builder uses the segments: lintel above an opening and a sill part below a window. Door leaf and glass pane meshes.
- [x] 2D symbols: door swing arc, window triple line. `[FR-33]`
- [x] Openings follow their host when a room is edited. An opening is removed, as part of the same command, when its edge becomes shorter than the opening.
- [ ] **Verify (user, real app):** place a door and a window, see the holes in 3D, and drag them along the wall. Resize the room smaller: the command removes the opening and undo restores it.
  - Headless check done:
    - The door and window holes show in 3D, with an open door leaf and glass.
    - The door drags along its wall.
    - Width 1.2 m set from the inspector.
    - Shrinking the room so its top edge is 0.9 m removed the 1.2 m window in the same command (with a toast), and undo restored it.
  - As built:
    - Lintels, sills, the door leaf and glass are 3D-only (layer `model`), so the plan shows a clean gap with the arc or triple-line symbol (layer `plan`).
    - Invisible pick boxes (layer `pick`) cover the opening and the door's swing area.
    - An opening's hinge is relative to its host edge direction; "in" swings into the host room.
    - While dragging, an opening stays on its own wall.

## M7 — Stairs `[FR-40..44]`
- [ ] `editor/stairs.ts` `solve()` for straight, L, U and spiral, with comfort warnings. `stairs.check.ts`. `[FR-41, FR-42]`
- [ ] Stair tool: preset picker, ghost footprint, click to place, R to rotate. `[FR-40]`
- [ ] Stair builder: step boxes, landings, optional railings. `[FR-44]`
- [ ] Inspector fields: width, steps, railings. Warnings appear as a `UBadge` plus a toast. `[FR-42]`
- [ ] Stairwell void cut into the floor above's slab from the footprint. On the top floor, ask whether to create a floor above. `[FR-43]`
- [ ] **Verify:** place a straight stair from ground to floor 1. It reaches floor 1 exactly, the void is visible on floor 1, and 12 steps over 3.0 m shows a warning.

## M8 — Garden & outdoor `[FR-50..52]`
- [ ] Zone tool: polygon, reusing the polygon tool logic. Kinds: grass, patio, path, driveway, pool. `[FR-50]`
- [ ] Zone builders. Pool: recessed with a water material and a depth property.
- [ ] Fence type for the free wall tool (thin posts plus rails). `[FR-51]`
- [ ] Optional site boundary polygon stored in `projects.site_json`, with its area shown in the summary. `[FR-52]`
- [ ] **Verify:** draw a garden with grass, a patio, a pool and a fence around it. It renders in 2D and 3D.

## M9 — Furniture & catalog `[FR-60..66, FR-51]`
- [ ] `catalog/manifest.ts`: `CatalogItem` type (design §8).
- [ ] `catalog/procedural.ts` builders:
  - `sofa`, `chair`, `table`, `bed`, `cabinet`, `shelf`, `rug`
  - `appliance` (fridge/stove), `sink`, `toilet`, `bathtub`, `shower`
  - `plant`, `lamp`, `tree`, `bush`, `bench`, `parasol`
- [ ] At least 30 manifest entries across all categories, per FR-64, including the outdoor items from FR-51. `[FR-64]`
- [ ] `catalog/index.ts`: registry, category/tag search, offscreen thumbnail renderer with an in-memory cache.
- [ ] `ui/CatalogPanel.vue`: category tabs, search, draggable thumbnail cards showing their dimensions. `[FR-60]`
- [ ] Item placement:
  - Drag from the catalog, or click then click on the canvas.
  - Ghost preview.
  - Grid snap, or wall snap for `placement: 'wall'`, facing into the room.
  - `[FR-61]`
- [ ] Transforms:
  - Drag to move.
  - R / Shift+R to rotate by 15°.
  - Arrow nudge (1 cm, or 10 cm with Shift).
  - `TransformControls` in 3D.
  - Scale limited to the manifest's limits.
  - `[FR-62, FR-84]`
- [ ] Inspector fields: name, variant, elevation offset. `[FR-63]`
- [ ] Instancing: group items by `catalog_id + variant` into an `InstancedMesh` per part. Picking uses the instance ids. `[NFR-01]`
- [ ] Recent (last 8) and favourites, stored in `settings`. `[FR-66]`
- [ ] Room templates from M5 now include their default items. `[FR-22]`
- [ ] GLB manifest path: `GLTFLoader`, scaled to `size`. Test it with one sample file in `public/models/`. `[FR-65]`
- [ ] **Verify:** furnish a living room and a bedroom. 200 items still run at about 60 fps in 3D (devtools FPS meter). Adding a new manifest entry makes it appear without any other code changes.

## M10 — Walk mode `[FR-82]`
- [ ] `scene/walk.ts`:
  - `PointerLockControls`, eye height 1.65 m
  - WASD, Shift to run
  - Esc exits
  - continuous render loop only while walking
- [ ] Circle-vs-segment collision with sliding. Door gaps are passable.
- [ ] Stairs: interpolate height inside the footprint, and switch the active floor at the ends.
- [ ] Start at the first exterior door, or at the floor centre.
- [ ] A small overlay shows the controls hint and the current floor name.
- [ ] **Verify:** walk from the front door into every room, climb the stairs to floor 1 and walk back down. You never pass through a wall.

## M11 — Measurements & summary `[FR-72..74]`
- [ ] Wall dimension overlay (outer lengths), toggled in the view menu. `[FR-72]`
- [ ] Measure tool: click-click with a live label, Shift for 15° lock. `[FR-73]`
- [ ] `ui/SummaryPanel.vue`:
  - per floor: gross area (union outline), net room area, room list
  - project total
  - counts of doors, windows and items
  - `[FR-74]`
- [ ] **Verify:** the summary numbers match a hand calculation for a two-floor sample project.

## M12 — Export `[FR-110..113]`
- [ ] `export/png.ts`: resolutions 1×, 2× and 4×, save dialog. `[FR-110]`
- [ ] `export/glb.ts`: whole project or the active floor, excluding the overlay and labels. `[FR-111]`
- [ ] `export/pdf.ts`:
  - vector plan from the store
  - title block
  - scale 1:50, 1:100 or fit
  - A4/A3 in either orientation
  - one page per floor
  - `[FR-112]`
- [ ] `export/projectFile.ts`: `.smartfloor` export and import, with new ids on import. `[FR-113]`
- [ ] Export dropdown in the TopBar with an options modal.
- [ ] **Verify:**
  - The GLB opens in https://gltf-viewer.donmccurdy.com.
  - The printed PDF at 1:100 measures correctly with a ruler.
  - A project round-trips through a `.smartfloor` file.

## M13 — Polish `[FR-04, FR-14, FR-101, NFR-07]`
- [ ] Thumbnail on close, and at most once a minute while editing. `[FR-04]`
- [ ] Duplicate floor layout to a new floor above. `[FR-14]`
- [ ] Dark and light theme applied to the three.js clear colour, grid and label colours. `[FR-101]`
- [ ] First-run onboarding tips (3 dismissible toasts).
- [ ] Hover and selection outline polish. Snap pulse animation. Camera tween easing.
- [ ] A11y pass: visible focus, tooltips with shortcuts, contrast check. `[NFR-07]`
- [ ] **Verify:** a new user can draw a furnished 2-room house and walk it in under 5 minutes, without reading any docs.

## M14 — Packaging `[NFR-02..06]`
- [ ] App icon, window title, and `applicationId`.
- [ ] `npm run build` → `neu build --release` produces zips for linux_x64, win_x64, mac_x64 and mac_arm64.
- [ ] Check the bundle size (under 30 MB) and the cold start time (under 2 s). `[NFR-02, NFR-06]`
- [ ] Smoke test on each OS: create, save, restart, export. Confirm that no network access is needed (offline). `[NFR-03, NFR-04]`
- [ ] README: dev setup, build, and how to add a catalog item.
- [ ] **Verify:** release zips run on a clean machine for every target.

---

## Requirement coverage

| FR | Milestone |
|---|---|
| 01–04 | M2, M13 |
| 10–14 | M2, M3, M13 |
| 20–28 | M5 |
| 30–33 | M6 |
| 40–44 | M7 |
| 50–52 | M8, M9 |
| 60–66 | M9 |
| 70–75 | M5, M11 |
| 80–84 | M3, M9, M10 |
| 90–96 | M4 |
| 100–102 | M2, M13 |
| 110–113 | M12 |
| 120–123 | M1, M4 |
