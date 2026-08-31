# MiniLab Configurator Design

## Goal

Build a polished browser-based MVP for assembling a configurable MiniLab rack from the repository's STEP source models. The application treats STEP as source-of-truth, GLB as generated web output, and explicit metadata as the authority for rack placement.

## Existing assets

The repository currently contains 13 Fusion 360 STEP exports in `models/`. `8U 20x20 Extrusion Frame.step` is the rack frame. Four filenames contain `LaserCut` and therefore receive `manufacturingMethod: "laser-cut"`: 1U Blank, Omada Switch, PatchPanel Plate, and TFT panel. Original STEP files remain byte-for-byte intact in `models/`.

## Architecture

The repository becomes a pnpm workspace with a root orchestration package, `configurator/` for the Vite application, `scripts/` for model processing, and `models/` for untouched CAD sources. The frontend loads a generated JSON catalog and generated GLBs from `configurator/public/models/`. When a GLB is missing or fails to load, the application renders a dimensionally representative procedural fallback so the configurator remains usable before CAD tooling is installed.

Rack placement is a pure TypeScript domain module. A placement has a module ID and a bottom-up zero-based start slot; occupied slots are derived from `heightU`. The domain rejects unknown heights, overlaps, negative positions, and placements above `rack.heightU`. This logic is independent of React and Three.js and is covered by unit tests.

## Model pipeline

`pnpm models` runs a Node orchestrator that scans every `.step` file, preserves filename-derived manufacturing information, validates hand-maintained overrides, and writes a deterministic manifest. If FreeCAD is installed, a bundled FreeCAD Python script imports each STEP file, tessellates it, and exports a web mesh. The Node pipeline then uses glTF Transform to optimize the GLB. Missing FreeCAD is not fatal by default: the catalog and procedural preview metadata are still regenerated, while the README prints exact installation and strict-mode instructions.

Generated models are normalized at build time, never by changing STEP geometry. Each catalog item has an explicit `mount` transform with translation, rotation, scale, and a mounting reference. The initial safe default is front-center and bottom-of-module. Bounds produced during conversion are recorded for review. Human overrides live in a checked-in metadata file, which is the only place to confirm `heightU` for filenames that do not state it clearly.

## Metadata defaults

The frame is infrastructure, not a selectable module. `1U Blank LaserCut.step` and `1U Test.step` are confirmed as 1U from their filenames. Other candidate modules remain visible with `heightU: null` and `status: "needs-review"` unless a safe explicit value is supplied. `Base Plate.step` is classified as a fixed rack part. No file without `LaserCut` in its filename receives a manufacturing method.

## Interface

The screen uses a precision workshop-instrument aesthetic. A quiet top bar frames a three-column tool: module library, dominant 3D canvas, and rack-map/selection inspector. The palette uses cool neutral white and pale gray, graphite text, anodized silver, and one safety-amber selection accent. Condensed headings, humanist body text, and monospaced U labels reinforce the physical hardware context.

The 3D scene includes an 8U procedural extrusion frame as a guaranteed fallback, bottom-up U guides, occupied-slot highlights, selection outlines, shadows, and orbit/zoom/pan controls. Clicking a valid module adds it to the first contiguous opening. Clicking a rack-map opening moves the selected module. Inspector controls move it up/down or remove it. Reset clears the layout. Invalid operations leave state unchanged and surface a concise status message.

On narrow screens the library, canvas, and rack map stack while the canvas remains touch-operable. Focus states, accessible labels, reduced-motion handling, and sufficient contrast are required.

## Testing and verification

Vitest covers placement, movement, overlap prevention, boundary validation, occupancy derivation, and first-fit behavior. React Testing Library covers add, select, move, remove, reset, and disabled unreviewed modules. The model pipeline is exercised against a temporary fixture directory. Verification runs `pnpm test`, `pnpm lint`, `pnpm models`, and `pnpm build`, followed by desktop and mobile browser interaction checks and screenshot comparison against the generated visual concept.

## Assumptions

- The initial rack is 8U and 1U is exactly 44.45 mm.
- U1 is the lowest rack position.
- Unknown module heights are never guessed; those modules are visible but disabled.
- The application works without generated GLBs by using procedural previews.
- FreeCAD is the external STEP tessellator because no compatible converter is installed in the current environment.
- The repository is not currently a Git worktree, so no commits are created.
