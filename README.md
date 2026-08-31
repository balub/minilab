# MiniLab 3D configurator

MiniLab is a modular server rack built from 2020 aluminium extrusion. This repository keeps the Fusion 360 STEP exports as source-of-truth and provides a pnpm-managed React/Three.js configurator for placing reviewed rack modules into U positions.

**Live configurator:** [minilab-configurator.pages.dev](https://minilab-configurator.pages.dev/)

The deployed configurator uses GLBs generated from the real STEP geometry. Dimensionally representative procedural models remain available as a fallback when generated assets are unavailable.

## Project structure

```text
minilab/
├── models/                         Original STEP sources and reviewed metadata
│   ├── *.step                      Never generated or modified by the pipeline
│   └── modules.json                Rack and module metadata overrides
├── configurator/
│   ├── public/models/
│   │   ├── catalog.json            Generated model catalog
│   │   └── *.glb                   Generated build assets (when FreeCAD exists)
│   └── src/                        React, rack rules, and Three.js scene
├── scripts/
│   ├── models.mjs                  Model catalog/conversion orchestrator
│   └── freecad/step-to-obj.py      FreeCAD tessellation script
├── docs/
│   ├── design/                     UI concept reference
│   └── superpowers/                Design and implementation records
├── package.json
└── pnpm-workspace.yaml
```

The existing folder is named `models/` on disk. On the default macOS case-insensitive filesystem, this is the same location previously referred to as `Models/`. The source directory has not been renamed or deleted.

## Requirements

- Node.js 20 or newer
- pnpm 10 or newer
- A browser with WebGL 2 support
- Optional: [FreeCAD](https://www.freecad.org/downloads) with `FreeCADCmd` for automatic STEP conversion

Only pnpm is used for JavaScript dependencies and project commands.

## Install and run

```bash
pnpm install
pnpm models
pnpm dev
```

Open the local URL printed by Vite. The configurator supports orbit, pan, zoom, click-to-add, drag-to-slot, click-to-move, move up/down, remove, fit view, and reset.

Production checks:

```bash
pnpm test
pnpm lint
pnpm build
```

Deploy the verified production build to the existing Cloudflare Pages project:

```bash
pnpm deploy
```

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the configurator development server |
| `pnpm build` | Type-check and create the production build |
| `pnpm lint` | Run ESLint with warnings treated as failures |
| `pnpm test` | Run placement, interaction, and pipeline tests |
| `pnpm models` | Scan STEP sources, convert when possible, optimize GLBs, and regenerate the catalog |
| `pnpm deploy` | Build and publish the configurator to Cloudflare Pages |

## STEP to GLB pipeline

Browsers do not load STEP directly. `pnpm models` runs this pipeline without changing a STEP file:

```text
models/*.step
  → FreeCADCmd + scripts/freecad/step-to-obj.py
  → tessellated OBJ in public/models/.work/
  → obj2gltf binary conversion
  → glTF Transform deduplication, welding, and pruning
  → configurator/public/models/<stable-id>.glb
  → configurator/public/models/catalog.json
```

FreeCAD is optional so a new checkout remains usable. If `FreeCADCmd` is unavailable, `pnpm models` prints a warning, regenerates the complete catalog, and leaves each missing model on its procedural preview. To require real conversion in CI or a release build:

```bash
MINILAB_MODELS_STRICT=1 pnpm models
```

FreeCAD normally installs a headless executable named `FreeCADCmd` or `freecadcmd`. The script checks both command names and the common macOS application paths. For another installation location:

```bash
FREECAD_CMD=/absolute/path/to/FreeCADCmd pnpm models
```

Confirm the executable before conversion:

```bash
/absolute/path/to/FreeCADCmd --version
```

On macOS, install the official Apple Silicon or Intel build from the FreeCAD download page, move it to `/Applications`, and run `pnpm models`. Linux package names and executable paths vary by distribution. FreeCAD documents the headless executable and script invocation in its [command-line documentation](https://reqrefusion.github.io/FreeCAD-Documentation-html/wiki/Start_up_and_Configuration.html).

### Generated assets

Generated `.glb`, intermediate `.obj`, and `.mtl` files are ignored by Git. `catalog.json` is checked in so the procedural application works without FreeCAD. STEP files are the only CAD source-of-truth.

## Module metadata

Reviewed metadata lives in `models/modules.json`. The generated catalog has records shaped like this:

```json
{
  "id": "1u-blank-lasercut",
  "name": "1U Blank",
  "source": "1U Blank LaserCut.step",
  "role": "module",
  "heightU": 1,
  "manufacturingMethod": "laser-cut",
  "model": "/models/1u-blank-lasercut.glb",
  "status": "ready",
  "mount": {
    "position": [0, 0, 0],
    "rotation": [0, 0, 0],
    "scale": [1, 1, 1],
    "reference": "front-center-bottom"
  }
}
```

Rules:

- `heightU` controls all placement; mesh bounds never decide occupancy.
- `heightU: null` means the value needs review. The module remains visible but cannot be placed.
- `role: "frame"` is rack infrastructure, `fixed-part` is non-selectable hardware, and `module` appears in the library.
- A filename containing `laser cut`, `laser-cut`, or `lasercut` case-insensitively automatically receives `manufacturingMethod: "laser-cut"`.
- Files without that phrase receive no manufacturing method. They are not assumed to be 3D printed.
- `preview` describes only the procedural fallback. It is not manufacturing or occupancy data.

The current source set has four laser-cut files. Nine modules have verified 1U envelopes from their filenames and converted bounds: 1U Blank, 1U Test Panel, Dot Matrix Panel, HP Mini Mount, Omada Switch Mount, Patch Panel, Patch Panel Plate, Raspberry Pi Mount, and TFT Panel. Raspberry Pi Duo + OLED and Equipment Tray remain `heightU: null` because their required rack height is not unambiguous.

## Coordinate system and mounting reference

STEP origins are preserved. The conversion script tessellates geometry but never rewrites source CAD. In the viewer, each explicit metadata rotation is applied first; transformed world bounds are then centered horizontally and aligned by their lowest Y and frontmost Z edges, establishing a `front-center-bottom` mounting reference. A module in U1 is placed at the bottom of the first 44.45 mm slot; higher U positions are exact multiples of 44.45 mm.

If an export has an unusual axis or origin, add an explicit `mount` override for that source in `models/modules.json`:

```json
"Example.step": {
  "name": "Example",
  "role": "module",
  "heightU": 2,
  "mount": {
    "position": [0, 0, 0],
    "rotation": [0, 1.5707963268, 0],
    "scale": [1, 1, 1],
    "reference": "front-center-bottom"
  }
}
```

Rotation values are radians. Position values are viewer units after the standard millimetre-to-scene scale. Keep normalization in metadata; do not modify the STEP file to correct the viewer.

## Add or update a rack module

1. Export the source from Fusion 360 as STEP into `models/`. Keep `LaserCut` in the filename when that manufacturing method applies.
2. Add an entry with the exact filename under `models.modules` in `models/modules.json`.
3. Set `role` and a verified integer `heightU`. Use `null` until the height is confirmed.
4. Add a `preview` color, width, and depth for the procedural fallback if useful.
5. Run:

   ```bash
   pnpm models
   pnpm test
   pnpm dev
   ```

6. Check the model in several U positions. If it is rotated or offset, adjust only its `mount` metadata and repeat the checks.

Updating a STEP file and rerunning `pnpm models` rebuilds its GLB when the STEP modification time is newer than the generated asset.

## Rack sizes

Rack dimensions live in the `rack` object in `models/modules.json`. The placement domain, occupancy rail, U guides, and procedural frame all read `heightU`; none is fixed to 8U. `unitMm` is currently `44.45` and should remain unchanged for standard rack units.
