# MiniLab Configurator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working pnpm-managed React Three Fiber rack configurator backed by explicit module metadata and a repeatable STEP-to-GLB pipeline.

**Architecture:** A Vite React client consumes a generated model catalog and delegates placement rules to pure TypeScript. Root Node scripts scan STEP source, merge reviewed metadata, optionally call FreeCAD for tessellation, optimize available GLBs, and publish build assets without modifying source CAD.

**Tech Stack:** pnpm workspace, React 19, TypeScript, Vite, Three.js, React Three Fiber, Drei, Vitest, Testing Library, glTF Transform, ESLint.

**Spec:** `docs/superpowers/specs/2026-08-30-minilab-configurator-design.md`

## Global Constraints

- Use pnpm exclusively.
- Preserve every original STEP source file.
- Treat 1U as exactly 44.45 mm and keep rack height configurable.
- Never infer unknown `heightU`; disable unreviewed modules.
- Only filenames containing `laser cut` case-insensitively receive `manufacturingMethod: "laser-cut"` automatically.
- Do not commit because this directory is not currently a Git repository.

---

### Task 1: Workspace and placement domain

**Files:** root workspace files; `configurator/src/domain/rack.ts`; `configurator/src/domain/rack.test.ts`

**Interfaces:** Produces `RackDefinition`, `ModuleDefinition`, `Placement`, `placeModule`, `movePlacement`, `removePlacement`, `getOccupancy`, and `findFirstAvailableSlot`.

- [ ] Create pnpm/Vite/TypeScript configuration and install dependencies with pnpm.
- [ ] Write failing unit tests for first-fit placement, multi-U occupancy, overlap rejection, and rack bounds.
- [ ] Run the focused test and confirm failure due to the missing domain implementation.
- [ ] Implement the minimal pure placement domain and rerun the focused test to green.
- [ ] Refactor names and immutable update behavior while keeping tests green.

### Task 2: Metadata and model pipeline

**Files:** `models/modules.json`; `scripts/models.mjs`; `scripts/freecad/step-to-glb.py`; pipeline tests; generated `configurator/public/models/catalog.json`

**Interfaces:** Consumes STEP filenames and explicit overrides; produces catalog records with stable IDs, role, height, manufacturing method, model URL, preview dimensions, mount transform, conversion status, and source filename.

- [ ] Write a failing pipeline test using temporary STEP fixtures for slugging, laser-cut detection, override merging, and unknown-height handling.
- [ ] Run the focused test and confirm the scanner is missing.
- [ ] Implement deterministic scanning/catalog generation and rerun to green.
- [ ] Add FreeCAD discovery/conversion and optional glTF optimization with clear skip and strict failure modes.
- [ ] Run `pnpm models` and verify all 13 STEP sources appear in the catalog without source-file changes.

### Task 3: Configurator state and interaction UI

**Files:** app state hook/components, app tests, styles

**Interfaces:** Consumes the catalog and rack domain; exposes add, select, move-to-slot, nudge, remove, reset, and status-message actions.

- [ ] Write failing interaction tests for add-first-fit, disabled unknown-height modules, movement, removal, and reset.
- [ ] Run the tests and confirm they fail because UI/state components do not exist.
- [ ] Implement the app shell, module library, rack map, selection inspector, and immutable state actions.
- [ ] Rerun interaction tests to green and verify keyboard-accessible controls.

### Task 4: Three-dimensional rack scene

**Files:** `ConfiguratorScene.tsx`, scene components, model loader/fallback, CSS

**Interfaces:** Consumes rack, catalog, placements, selection, and action callbacks; renders frame, U guides, module meshes, and OrbitControls.

- [ ] Implement a configurable procedural 2020-extrusion rack fallback and deterministic U-to-world transform.
- [ ] Load generated GLBs when present and fall back per asset without crashing.
- [ ] Add selection, hover, slot guides, shadows, camera controls, fit-view reset, and reduced-motion behavior.
- [ ] Verify scene interaction together with rack-map state in the browser.

### Task 5: Documentation and full verification

**Files:** `README.md`, `.gitignore`, final configuration files

**Interfaces:** Documents pnpm commands, dependencies, metadata editing, coordinate normalization, new-module workflow, and FreeCAD installation.

- [ ] Document the final project structure and every supported command using pnpm.
- [ ] Run `pnpm test`, `pnpm lint`, `pnpm models`, and `pnpm build` from the repository root.
- [ ] Start `pnpm dev`, exercise add/move/remove/reset on desktop and mobile, and capture screenshots.
- [ ] Compare the implementation screenshot with the visual concept for layout, typography, palette, hierarchy, controls, and responsive behavior; repair discrepancies.
- [ ] Inspect the final diff and source STEP checksums, then propose a Conventional Commit message without committing.
