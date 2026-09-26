# Smart Floor — Requirements

## 1. Vision

Smart Floor is an offline desktop app for designing homes floor by floor. You create a **project**, stack **floors**, draw **rooms**, place **doors, windows, stairs, gardens and furniture**, and see the result right away in 2D, in 3D, and by walking through it.

**It must be fun to use.** In practice, that means:
- snapping that you can feel
- live dimensions while you draw
- smooth camera transitions
- drag-and-drop furniture with a ghost preview
- unlimited undo
- zero-friction saving (autosave, no "Save" button needed)

**Stack:** Neutralinojs · Vue 3 + TypeScript + Nuxt UI · three.js · SQLite (sql.js/WASM).

**Units:** metric by default. All values are stored in **metres**. Angles are stored in **degrees**.

## 2. Glossary

| Term | Meaning |
|---|---|
| Project | A building design. It contains floors, a site and settings. |
| Floor (Level) | A horizontal slice of the building with an elevation and a height. Ground floor = level 0. |
| Room | A closed polygon on a floor. It has a name, a floor material and walls. |
| Wall | A segment of a room's outline, extruded to the floor height. Two rooms can share a wall. |
| Opening | A door or window placed on a wall at an offset along it. |
| Stair | A parametric object that connects floor N to floor N+1. |
| Zone | An outdoor polygon: grass, patio, path, pool or driveway. |
| Item | A furniture or object instance placed from the catalog. |
| Catalog | The extensible library of item definitions (manifests). |

## 3. Functional requirements

Each requirement has an ID. Every ID is referenced from `implementation.md`.

### Projects
- **FR-01 Create project.** Enter a name (required) and an optional description. The project opens with one floor, "Ground Floor", at elevation 0 and height 2.80 m.
- **FR-02 Open project.** The home screen lists projects as cards with a thumbnail, name and last-modified date, newest first. There is a text search.
- **FR-03 Rename / duplicate / delete.** Delete asks for confirmation. Duplicate makes a deep copy (floors, rooms, items and everything else).
- **FR-04 Thumbnail.** The thumbnail is regenerated from the 3D view when the project is closed, and at most once a minute while editing.

### Floors
- **FR-10 Add floor.**
  - "Add floor above" and "Add basement" are both available.
  - Elevation is calculated automatically from the neighbouring floors.
  - Height defaults to 2.80 m. Slab thickness defaults to 0.20 m.
- **FR-11 Edit floor.** Rename it, change its height, reorder floors (elevations are recalculated), and delete it (with confirmation, cascading to everything on it).
- **FR-12 Floor switcher.** The top bar shows the active floor. PageUp/PageDown change floors.
- **FR-13 Floor visibility.** Three modes:
  - *Active only*
  - *Active + ghost below*: the floor below at 25% opacity, not selectable
  - *All floors*: 3D only
- **FR-14 Copy floor layout.** "Duplicate floor" copies its walls and rooms to a new floor above. This is useful for apartment buildings.

### Rooms and walls
- **FR-20 Rectangle room tool.** Click and drag. Live width × depth and area are shown.
- **FR-21 Polygon room tool.**
  - Click to place each vertex.
  - Clicking the first vertex, or pressing Enter, closes the shape.
  - Backspace removes the last vertex. Esc cancels.
  - A self-intersecting polygon is rejected, with a message.
- **FR-22 Room templates.** Rectangle 4×3, L-shape, Bathroom 2.5×2 (with toilet and sink), Kitchen 4×3 (with counters), Bedroom 4×4 (with bed and wardrobe). A template is placed like a stamp that follows the cursor. R rotates it by 90°.
- **FR-23 Edit room shape.**
  - Drag a vertex.
  - Drag an edge, which moves the wall in parallel.
  - Double-click an edge to insert a vertex.
  - Delete removes the selected vertex, but a room keeps at least 3 vertices.
- **FR-24 Room properties.** Name, floor material (wood, tile, carpet, concrete, marble), wall colour, and a ceiling on/off toggle.
- **FR-25 Room auto-naming.** New rooms are called "Room N". Templates use their own type name.
- **FR-26 Shared walls.** When two room edges overlap along the same line, only one wall is rendered. It uses the thicker of the two thicknesses.
- **FR-27 Wall properties.**
  - Thickness defaults to 0.15 m interior and 0.25 m exterior.
  - An edge counts as *exterior* if it is not shared with another room.
- **FR-28 Free walls.** A standalone wall tool for partitions and garden walls. Each wall has its own height.

### Openings
- **FR-30 Door tool.**
  - Click a wall to place a door.
  - It snaps along the wall and cannot overlap other openings or wall ends.
  - Presets: single 0.90×2.10, double 1.60×2.10, sliding 2.00×2.10. The door opening itself is always included.
  - Properties: hinge side and swing direction, which F flips.
- **FR-31 Window tool.** Presets: standard 1.20×1.20 with sill height 0.90, tall 0.80×2.00 with sill 0.10, panoramic 2.40×1.50 with sill 0.60.
- **FR-32 Opening editing.** Drag the opening along its wall. The inspector shows its width, height, sill height and offset.
- **FR-33 2D symbols.** Doors show a swing arc. Windows show a triple-line symbol.

### Stairs
- **FR-40 Stair presets:** straight, L-shaped (landing), U-shaped (landing), and spiral.
- **FR-41 Parameters.** Width (default 1.00 m), total rise, and number of steps. Rise per step and going (step depth) are calculated automatically. Total rise = floor height + slab thickness.
- **FR-42 Comfort check.**
  - Show a warning badge when rise per step is outside 0.15–0.19 m, going is under 0.25 m, or 2×rise + going is outside 0.60–0.65 m.
  - The badge is a warning only and never blocks the user.
- **FR-43 Linking.**
  - A stair placed on floor N shows a matching stairwell opening (a void) on floor N+1.
  - Placing a stair on the top floor asks whether to create a floor above.
- **FR-44 Railings.** Optional railing on the left or right side. It is on by default for the open side.

### Garden and outdoor
- **FR-50 Zone tool.** Polygon zones of type grass, patio, path, pool (with depth, shown recessed with water), or driveway.
- **FR-51 Outdoor items.** Trees (3 sizes), bushes, flower beds, fences (drawn as a line, like walls), benches, parasols, lamps.
- **FR-52 Site boundary.** An optional plot outline. Its dimensions and area are shown in the summary.

### Furniture and catalog
- **FR-60 Catalog panel.**
  - Categories: Living, Bedroom, Kitchen, Bathroom, Office, Outdoor, Decor.
  - Search by name or tag.
  - Each entry has a thumbnail and its dimensions.
- **FR-61 Place item.** Drag from the catalog onto the canvas, or click the item and then click the canvas. A ghost preview is shown while placing. Snapping rules:
  - Items with a `wall` placement snap to the nearest wall and face into the room.
  - Other items snap to the grid.
- **FR-62 Transform items.**
  - Move by dragging.
  - Rotate with R (+15°), Shift+R (−15°), or a rotation handle.
  - Scale within the item's min/max limits.
  - Arrow keys nudge the item by 1 cm, or 10 cm with Shift.
- **FR-63 Item properties.** Name, material/colour variant (from the manifest), and elevation offset (for example, a shelf on a wall).
- **FR-64 Essential v1 library.** At least 30 items:
  - **Living:** sofa 2- and 3-seat, armchair, coffee table, TV unit, bookshelf, rug
  - **Bedroom:** single bed, double bed, nightstand, wardrobe, dresser
  - **Kitchen:** counter run, fridge, stove, sink unit, dining table 4 and 6, chair
  - **Bathroom:** toilet, sink, bathtub, shower
  - **Office:** desk, office chair
  - **Decor:** plant, lamp
  - **Outdoor:** tree S, M and L, bush, bench
- **FR-65 Extensibility.**
  - Adding an item means adding one manifest entry. It can be procedural or point to a GLB file.
  - No other code changes are needed.
  - The manifest format is documented in `design.md`.
- **FR-66 Favourites and recent items.** The catalog shows a "Recent" row with the last 8 items placed, and lets you mark favourites.

### Measurements
- **FR-70 Live dimensions.** While drawing or dragging, segment lengths and angles are shown next to the cursor.
- **FR-71 Room labels.** Each room shows its name and area in m² (2 decimals) at its centroid. They can be toggled.
- **FR-72 Wall dimensions.** An optional overlay shows the outside length of every wall.
- **FR-73 Measure tool.** Click, then click again to show the distance. Hold Shift to lock the angle to 15° steps.
- **FR-74 Summary panel.**
  - Per floor: gross area, net room area, and the list of rooms with their areas.
  - Per project: total area.
  - Counts of doors, windows and items.
- **FR-75 Numeric entry.** While drawing, typing a number and pressing Enter sets the exact length of the current segment (for example `3.5` or `350cm`).

### Views and navigation
- **FR-80 2D plan view.**
  - Top-down orthographic view with a metric grid: 1 m major lines, 0.1 m minor lines.
  - The grid density adapts to the zoom level.
  - Pan with the middle mouse button, Space+drag, or the arrow keys. Zoom with the wheel, centred on the cursor.
- **FR-81 3D view.** Orbit, pan and zoom. Presets: top, front, isometric. Moving between views uses a tweened transition (≤ 400 ms).
- **FR-82 Walk mode.**
  - First person, with eye height 1.65 m.
  - WASD to move, the mouse to look, Shift to run.
  - Collides with walls. Doors are passable.
  - Walking onto a stair moves you up or down to the other floor.
  - Esc exits walk mode.
  - It starts at the first exterior door, or at the centre of the active floor.
- **FR-83 View toggle.** Tab cycles 2D → 3D → Walk. The toolbar has buttons for each view.
- **FR-84 Editing in 3D.** Select, move and rotate items, and select rooms. Drawing tools are available only in 2D.

### Editing
- **FR-90 Selection.**
  - Click to select. Shift+click adds to the selection. Drag a box to select an area.
  - Esc clears the selection.
  - Hovering highlights objects.
- **FR-91 Undo/redo.** Ctrl+Z and Ctrl+Shift+Z / Ctrl+Y, with at least 200 steps. Undo and redo work within a project session.
- **FR-92 Clipboard.** Copy, cut, paste and duplicate (Ctrl+D) for rooms, items, zones and stairs. Pasting places the content at the cursor.
- **FR-93 Snapping.**
  - Snap targets: grid (0.1 m default, configurable), vertices, wall midpoints, perpendicular/parallel lines, and angle (15°).
  - Hold Alt to turn snapping off temporarily.
  - A snap shows a visual indicator (a pulse).
- **FR-94 Inspector.** The right panel shows the editable properties of the selection. Multi-select shows the common fields.
- **FR-95 Command palette.** Ctrl+K opens a searchable list of every action, with its shortcut.
- **FR-96 Keyboard shortcuts.**
  - Every tool has a single-key shortcut: V select, R room, W wall, D door, N window, S stair, G zone, M measure, F furniture.
  - The shortcuts are listed in a help overlay (press ?).

### Settings
- **FR-100 Units.** Metric (m/cm, the default) or imperial (ft-in), for display only. Storage is always in metres.
- **FR-101 Theme.** Light, dark, or follow the system.
- **FR-102 Defaults.** Floor height, wall thickness and grid size.

### Export
- **FR-110 PNG.** Export the current view at 1×, 2× or 4× resolution.
- **FR-111 GLB.** Export the whole project, or the active floor, as a binary glTF.
- **FR-112 PDF plan.** A printable 2D plan of the active floor or of all floors (one per page) with:
  - a title block (project name, floor, date, scale)
  - dimensions
  - room labels
  - A4 or A3, portrait or landscape
  - a scale of 1:50, 1:100 or fit to page
- **FR-113 Project file.** Export or import one project as a `.smartfloor` file. This is a standalone SQLite file for sharing.

### Persistence
- **FR-120 Autosave.**
  - Every change is saved automatically, at most 1 s after the last edit.
  - The status bar shows "Saving…" and then "Saved".
- **FR-121 One database file.** All projects live in `<appData>/smart-floor/smart-floor.sqlite`.
- **FR-122 Crash safety.**
  - Writes are atomic: write a temp file, then rename it.
  - The last 3 good copies are kept as `.bak1`–`.bak3`, rotated once per day.
  - If the database fails to open, offer to restore from a backup.
- **FR-123 Save on quit.** Closing the window flushes any pending save before exiting.

## 4. Non-functional requirements
- **NFR-01 Performance.** 60 fps in 3D with 200 items and 30 rooms on integrated graphics. Items that repeat use instancing.
- **NFR-02 Startup.** A cold start reaches the home screen in under 2 s.
- **NFR-03 Offline.** No network access is needed at runtime. All assets are bundled.
- **NFR-04 Platforms.** Linux x64, Windows x64, macOS (x64 and arm64) through `neu build`.
- **NFR-05 Data safety.** An edit is never lost unless it happened in the last 1 s before a crash. The database schema is versioned and migrated forward.
- **NFR-06 Size.** The release bundle is under 30 MB per platform.
- **NFR-07 Accessibility.** Every action can be reached from the keyboard or the command palette. UI text has at least AA contrast. Focus states are visible.
- **NFR-08 Maintainability.** TypeScript runs in strict mode. The editor core (geometry, commands, snapping) is plain TS that does not depend on Vue or three.js, and it has self-checks.

## 5. Out of scope for v1
- Real-time collaboration or cloud sync
- Pitched roofs (flat slab only)
- Lighting or daylight simulation, and photoreal rendering
- Importing DWG, DXF or IFC files
- Structural or MEP (plumbing, electrical) design
- Mobile or web builds

## 6. Future ideas backlog
- **Roof generator:** gable and hip roofs, created from the top floor outline.
- **Sun and time of day:** a sun position slider based on location and date, with shadows.
- **Cost estimator:** a price per m² for each material and a price per item, rolled up into a budget.
- **Trace a plan image:** import a JPG/PNG as a scaled background to trace over.
- **Import user GLB furniture:** a drag-and-drop dialog that creates a manifest entry.
- **Auto furnish / AI layout suggestions** for a room type.
- **Catalog packs:** themed furniture packs as zip files (for example "Scandinavian", "Office").
- **Measurement annotations** saved into the plan, and text notes.
- **Snapshots/versions:** named checkpoints of a project.
- **Screenshot tour:** an animated camera path, exported as a video.
- **Electrical layer:** sockets, switches and lights on walls.
- **Multi-language UI:** Arabic and English, with RTL support in Nuxt UI.
