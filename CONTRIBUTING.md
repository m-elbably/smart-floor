# Contributing to Smart Floor

Thanks for helping. Bug reports, ideas, catalog items and code are all welcome.

## Reporting a bug

Open an issue and include:

- your OS and the platform binary you ran
- the steps that lead to the problem, and what you expected to happen
- a screenshot if the problem is visual
- the `.smartfloor` export of a small project that shows the problem, if you can share one

## Making a change

1. Fork the repository and create a branch.
2. Set up the project as described in [Development](README.md#development).
3. Keep the change focused. Match the style of the surrounding code: small modules, plain functions, few comments that explain *why*.
4. If you change logic in `src/editor`, `src/db` or `src/export`, add or extend the `*.check.ts` file next to it. These are plain `assert` scripts with no test framework. `npm run check` runs all of them.
5. Run `npm run check` and open a pull request that describes the change. Add a screenshot if the UI changed.

The specs in [`specs/`](specs/) describe the intended behaviour and give IDs (`FR-…`) to the requirements. The code refers to those IDs, so cite them when they apply.

## Adding a catalog item

Everything the catalog shows comes from one list, [`src/catalog/manifest.ts`](src/catalog/manifest.ts). Add an entry and the item appears in the panel, with a thumbnail, search, placement, the inspector and the exports. No other code changes are needed.

**A procedural item.** Reuse one of the builders in [`src/catalog/procedural.ts`](src/catalog/procedural.ts), such as `sofa`, `table`, `chair`, `bed`, `cabinet`, `shelf`, `appliance`, `lamp`, `plant` or `tree`. Grep `builder:` in the manifest to see all of them.

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

1. Drop a `.glb` file into `public/models/`. Only add models that you made yourself or whose license allows redistribution, and give the source and license in your pull request.
2. Point an entry at it with `model: { type: 'glb', url: './models/my-chair.glb' }`.

The model is scaled to `size` and stood on the floor. `planter` is the working example.

`npm run check` builds every entry and fails if one breaks. It checks that ids are unique, that every category has items, that each bounding box matches `size`, and that the GLB files exist.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
