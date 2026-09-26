# Smart Floor

A desktop app for sketching houses: floors, rooms, doors and windows, stairs, gardens and furniture, in a 2D plan, an orbiting 3D view and a first-person walk-through. It is metric by default, works fully offline, and saves everything to one local SQLite file.

Built with [Neutralinojs](https://neutralino.js.org), Vue 3 + [Nuxt UI](https://ui.nuxt.com), [three.js](https://threejs.org) and [sql.js](https://sql.js.org). The specs are in [`specs/`](specs/).

## Develop

```bash
npm install          # also copies sql-wasm.wasm into public/
npx neu update       # once: downloads the Neutralino binaries into bin/
npm run dev          # Vite on :5188 + the Neutralino window, with hot reload
npm run check        # type check + every src/**/*.check.ts self-check
```

- `npm run dev` temporarily rewrites the globals `<script>` in `index.html` to point at Neutralino's dev server. The rewrite is undone when you close the app window.
  - Stop dev by closing the window. If you press Ctrl+C instead, the rewrite stays; revert `index.html` before committing.
  - `npm run build` refuses to run while the rewrite is still in place.
- `npm run vite` runs the UI alone in a browser tab. In that mode the database is in memory only, which is handy for UI work and for headless tests.
- In dev, the data lives in `~/.local/share/smart-floor/smart-floor.sqlite`, next to its daily `.bak1..3` backups. The path is the same on every OS, via `os.getPath('data')`.

## Build

```bash
npm run build        # vite build + neu build --release
```

The output is `release/smart-floor-release.zip`: one ~9 MB archive with the Linux (x64, arm64, armhf), Windows x64 and macOS (x64, arm64, universal) binaries next to `resources.neu`.

To install, unzip it and ship the platform binary together with `resources.neu`. A single platform is about 7 MB.

## Using it

| | |
|---|---|
| **R / P / T** | rectangle room, polygon room, room template (furnished) |
| **W / D / N / S** | free wall or fence, door, window, stair |
| **G / B** | garden zone (grass, patio, path, driveway, pool), site boundary |
| **F / M** | furniture catalog, measure |
| **Tab** | cycle 2D → 3D → Walk |
| **Ctrl+Z / Ctrl+Shift+Z** | undo / redo; every edit is undoable |
| **Ctrl+K / ?** | command palette / all shortcuts |

- While drawing, type a length and press Enter: `3.5`, `350cm`, or `4x3` for a rectangle.
- Alt turns snapping off.
- Export (top bar) produces a PNG, a GLB 3D model, a PDF plan at 1:50, 1:100 or fit-to-page, or a `.smartfloor` project file. Import `.smartfloor` files from the home screen.

## Adding a catalog item

Everything the catalog shows comes from one list: [`src/catalog/manifest.ts`](src/catalog/manifest.ts). Add an entry and it appears in the panel, with a thumbnail, search, placement, the inspector and exports. No other code changes are needed.

**Procedural item.** Reuse one of the builders in [`src/catalog/procedural.ts`](src/catalog/procedural.ts): `sofa`, `table`, `chair`, `bed`, `cabinet`, `shelf`, `appliance`, `toilet`, `basin`, `bathtub`, `shower`, `plant`, `lamp`, `tree`, `bush`, `flowerBed`, `bench`, `parasol`.

```ts
{
  id: 'sofa-corner', name: 'Corner sofa', category: 'living', tags: ['couch'],
  size: [2.6, 1.6, 0.85],              // width × depth × height in metres; the front faces −y in the plan
  placement: 'floor',                  // 'wall' snaps its back to a wall; 'ceiling' hangs it
  variants: [{ id: 'grey', name: 'Grey', colors: { fabric: '#8e9196', legs: '#3f3f46' } }],
  model: { type: 'procedural', builder: 'sofa' }
}
```

**A 3D model.**
1. Drop a `.glb` file into `public/models/`.
2. Point an entry at it with `model: { type: 'glb', url: './models/my-chair.glb' }`.

The model is scaled to `size` and stood on the floor. `planter` is the working example.

`npm run check` builds every entry and fails if one breaks. The check covers unique ids, all categories present, a bounding box that matches `size`, and that GLB files exist.
