# Floating Top Bar Repo & Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the GNOME Shell 51 `Floating Top Bar` extension to a public GitHub repo (`nilaymallikk/floating-topbar`) and add live Extension Preferences (`prefs.js` + GSettings) for top-bar appearance, spacing, and inline percentage toggles.

**Architecture:** Extract pure CSS generation/color sanitization into `styleBuilder.js` (zero GI dependencies, unit-tested with Node), wire GSettings + overview/session-mode listeners in `extension.js` via `Main.panel.set_style(...)`, let `#panel` text color inherit in `stylesheet.css`, and build a native GTK4/Libadwaita Preferences UI in `prefs.js`.

**Tech Stack:** GNOME Shell 51 ESM JavaScript (GJS 1.90), GTK4 + Libadwaita (`Adw`), GSettings (`glib-compile-schemas`), Node 24 (`node --test`), `git` & `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-11-27-floating-topbar-prefs-design.md`

## Global Constraints

- Target GNOME Shell 51 (`"shell-version": ["51"]`), ESM extension/prefs imports.
- Repo lives at `/home/nilaymallik/Projects/floating-topbar`, symlinked from `/home/nilaymallik/.local/share/gnome-shell/extensions/floating-topbar@nilaymallik.local`, pushed to public GitHub repo `nilaymallikk/floating-topbar`.
- Preferences style **only** the floating top bar (`#panel`); Quick Settings, popovers, and Space Bar workspace badge keep their existing `stylesheet.css` styling.
- Defaults match v1.0.0 exactly: bg `rgb(29, 31, 42)`, bg opacity `97`, overview opacity `84`, border `rgba(108, 112, 138, 0.36)`, border thickness `1`, text `rgba(218, 222, 234, 0.96)`, radius `11`, height `38`, margins `4`/`8`, all 3 percentage toggles `true`.
- Keep `border: none` + `inset box-shadow` + locked `min-height`/`max-height` so maximized window struts never jump.

## Review Focus

1. **Corrupt or injected GSettings color strings** (e.g. `red; background: url(...)`, empty string, out-of-range numbers): `parseCssColor` and `buildPanelStyle` must validate and fall back to safe defaults without emitting raw user strings into CSS.
2. **Zero border thickness (`0px`)**: Must emit `box-shadow: none;` rather than `inset 0 0 0 0px ...`, while `1..6px` emits `inset 0 0 0 <N>px <rgba>` with `border: none;`.
3. **Overview & lock-screen state transitions**: Overview uses `overview-opacity` (and scales border alpha slightly or preserves valid RGBA); lock/login screen (`Main.sessionMode.isLocked`) clears inline style (`Main.panel.set_style(null)`) so `#panel.unlock-screen` CSS applies cleanly.
4. **Reset to Defaults sync in `prefs.js`**: Clicking Reset resets every schema key and updates all `Gtk.ColorDialogButton` and `Gtk.Scale` widgets live via `changed::<key>` listeners (not only `settings.bind` rows).
5. **Clean teardown on `disable()`**: `disable()` disconnects all GSettings, `Main.overview`, and `Main.sessionMode` signal handlers and calls `Main.panel.set_style(null)`.

---

## File Map

- `metadata.json` — Extension manifest (`settings-schema`, `url`, `version-name: "1.1.0"`).
- `schemas/org.gnome.shell.extensions.floating-topbar.gschema.xml` — GSettings schema definition (compiled to `schemas/gschemas.compiled`).
- `styleBuilder.js` — Pure color parser/validator and inline `#panel` CSS builder (`parseCssColor`, `formatRgba`, `buildPanelStyle`, `DEFAULTS`).
- `extension.js` — GNOME Shell extension lifecycle: GSettings wiring, live `Main.panel` style updates, overview/lock handling, and inline Volume/Wi-Fi/Bluetooth percentage indicators.
- `stylesheet.css` — Base styling for `#panel` fallback, Space Bar badge, Quick Settings, and popovers (drops hardcoded `color` on panel children so `#panel` text color inherits).
- `prefs.js` — Libadwaita `ExtensionPreferences` window with Colors & Transparency, Shape & Spacing, Inline Percentages, and Reset to Defaults.
- `tests/styleBuilder.test.mjs` — Unit tests for `styleBuilder.js`.
- `.gitignore`, `README.md` — Repo hygiene and install/customization docs.

---

### Task 1: Set up `~/Projects/floating-topbar`, symlink, and publish public GitHub repo (`v1.0.0`)

**Files:**
- Copy into `/home/nilaymallik/Projects/floating-topbar/`: `extension.js`, `metadata.json`, `stylesheet.css` from `/home/nilaymallik/.local/share/gnome-shell/extensions/floating-topbar@nilaymallik.local/`
- Create: `.gitignore`, `README.md`
- Replace directory `/home/nilaymallik/.local/share/gnome-shell/extensions/floating-topbar@nilaymallik.local` with symlink -> `/home/nilaymallik/Projects/floating-topbar`

**Interfaces:**
- Produces: Git repo on `main` synced with public GitHub repo `https://github.com/nilaymallikk/floating-topbar`, symlinked into GNOME Shell's user extensions directory.

- [ ] **Step 1: Copy current extension files into `~/Projects/floating-topbar` and add `.gitignore` + initial `README.md`**

Copy `extension.js`, `metadata.json`, `stylesheet.css` preserving content verbatim. Add `.gitignore` ignoring `*.zip`, `.DS_Store`, `*.swp`, and `schemas/gschemas.compiled`? **Important:** Keep `schemas/gschemas.compiled` tracked OR document compile step — wait: GNOME Shell loads `schemas/gschemas.compiled` directly when someone clones/symlinks, so DO NOT gitignore `schemas/gschemas.compiled` (check `smart-clipboard`: let's ignore only editor/archive junk like `*.zip`, `.DS_Store`, `node_modules/`).

- [ ] **Step 2: Replace extension directory with symlink**

Move `~/.local/share/gnome-shell/extensions/floating-topbar@nilaymallik.local` to a temporary backup path, create symlink `~/.local/share/gnome-shell/extensions/floating-topbar@nilaymallik.local -> /home/nilaymallik/Projects/floating-topbar`, verify `gnome-extensions info floating-topbar@nilaymallik.local` still resolves cleanly, then remove the backup.

- [ ] **Step 3: Initialize git repo, commit v1.0.0 snapshot, create public GitHub repo and push**

```bash
git -C /home/nilaymallik/Projects/floating-topbar init -b main
git -C /home/nilaymallik/Projects/floating-topbar add extension.js metadata.json stylesheet.css .gitignore README.md
git -C /home/nilaymallik/Projects/floating-topbar commit -m "chore: initial import of Floating Top Bar v1.0.0"
gh repo create nilaymallikk/floating-topbar --public --source=/home/nilaymallik/Projects/floating-topbar --remote=origin --push --description "Floating rounded translucent top bar extension for GNOME Shell 51"
```

Expected: `gh repo view nilaymallikk/floating-topbar` succeeds and `git status` is clean (aside from untracked `docs/` which gets committed next).

- [ ] **Step 4: Commit design spec and plan docs**

```bash
git -C /home/nilaymallik/Projects/floating-topbar add docs/
git -C /home/nilaymallik/Projects/floating-topbar commit -m "docs: add preferences design spec and implementation plan"
```

---

### Task 2: Pure style builder (`styleBuilder.js`) with TDD

**Files:**
- Create: `/home/nilaymallik/Projects/floating-topbar/tests/styleBuilder.test.mjs`
- Create: `/home/nilaymallik/Projects/floating-topbar/styleBuilder.js`

**Interfaces:**
- Produces:
  - `DEFAULTS`: frozen object with all 13 default setting values matching the spec.
  - `parseCssColor(input: string, fallback: {r: number, g: number, b: number, a: number}) -> {r: number, g: number, b: number, a: number}` (supports `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(...)`, `rgba(...)`; rejects anything else and returns `fallback`).
  - `formatRgba(rgba: {r: number, g: number, b: number, a: number}) -> string` (returns `rgba(r, g, b, a)` with 0..255 ints and alpha rounded to 2 decimal places).
  - `buildPanelStyle(config: Partial<typeof DEFAULTS>, inOverview?: boolean) -> string` (returns single-line inline CSS string for `Main.panel.set_style()`).

- [ ] **Step 1: Write failing unit tests in `tests/styleBuilder.test.mjs`**

Test cases (using `node:test` + `node:assert/strict`):
- `default config matches v1.0.0 panel values`: verifies `margin: 4px 8px;`, `border: none;`, `border-radius: 11px;`, `height: 38px; min-height: 38px; max-height: 38px;`, `background-color: rgba(29, 31, 42, 0.97);`, `box-shadow: inset 0 0 0 1px rgba(108, 112, 138, 0.36);`, `color: rgba(218, 222, 234, 0.96);`.
- `inOverview=true uses overviewOpacity`: verifies `background-color: rgba(29, 31, 42, 0.84);` and keeps border visible.
- `borderThickness=0 emits box-shadow: none`: verifies `box-shadow: none;` and no `inset 0 0 0 0px`.
- `borderThickness=4 emits inset 4px shadow with border: none`: verifies strut-safe inset border.
- `clamps out-of-range numeric values`: negative/huge opacity, thickness, radius, height, margins are clamped to schema bounds (`0..100`, `0..6`, `0..24`, `28..56`, `0..24`, `0..48`).
- `parses hex (#rgb, #rrggbb, #rrggbbaa) and rgb/rgba strings`: verifies valid color formats convert cleanly.
- `rejects corrupt or CSS-injection color strings`: passing `'red; position: fixed'` or `''` or `'rgb(999,0,0); } #x {'` falls back to default color and output never contains `position` or `}`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test /home/nilaymallik/Projects/floating-topbar/tests/styleBuilder.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND` for `../styleBuilder.js`).

- [ ] **Step 3: Implement `styleBuilder.js`**

Export `DEFAULTS`, `parseCssColor`, `formatRgba`, and `buildPanelStyle`.
- Clamp helper enforces exact spec bounds on every numeric input.
- `parseCssColor` strictly matches anchored regexes for hex (`3`, `6`, `8` hex digits) and `rgb`/`rgba` (integers `0..255`, optional alpha `0..1`), returning a copy of `fallback` on any mismatch.
- `buildPanelStyle` uses `height: ${h}px; min-height: ${h}px; max-height: ${h}px;`, `padding: 0;`, `border: none;`, `transition-duration: 0ms;`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test /home/nilaymallik/Projects/floating-topbar/tests/styleBuilder.test.mjs`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git -C /home/nilaymallik/Projects/floating-topbar add styleBuilder.js tests/styleBuilder.test.mjs
git -C /home/nilaymallik/Projects/floating-topbar commit -m "feat: add pure panel style builder with validation and tests"
```

---

### Task 3: GSettings schema, `metadata.json`, `stylesheet.css`, and `extension.js` live styling

**Files:**
- Create: `/home/nilaymallik/Projects/floating-topbar/schemas/org.gnome.shell.extensions.floating-topbar.gschema.xml`
- Modify: `/home/nilaymallik/Projects/floating-topbar/metadata.json`
- Modify: `/home/nilaymallik/Projects/floating-topbar/stylesheet.css`
- Modify: `/home/nilaymallik/Projects/floating-topbar/extension.js`

**Interfaces:**
- Consumes: `buildPanelStyle` from `./styleBuilder.js`.
- Produces: Compiled GSettings schema `org.gnome.shell.extensions.floating-topbar` at `/org/gnome/shell/extensions/floating-topbar/` and live-updating `FloatingTopBarExtension`.

- [ ] **Step 1: Create and compile `schemas/org.gnome.shell.extensions.floating-topbar.gschema.xml`**

Define all 13 keys with exact types, `<range>` bounds, and defaults from the spec.
Run: `glib-compile-schemas --strict /home/nilaymallik/Projects/floating-topbar/schemas/`
Expected: Exit code 0 and `schemas/gschemas.compiled` created with zero warnings.

- [ ] **Step 2: Update `metadata.json`**

Add `"settings-schema": "org.gnome.shell.extensions.floating-topbar"`, `"url": "https://github.com/nilaymallikk/floating-topbar"`, and bump `"version-name"` to `"1.1.0"`.

- [ ] **Step 3: Update `stylesheet.css` for `#panel` text color inheritance**

Remove the redundant hardcoded `color: rgba(218, 222, 234, 0.96);` lines from `#panel .panel-button`, `.floating-topbar-pct`, and `#panel .power-status StLabel` so they inherit `#panel`'s dynamic text color. Leave Space Bar badge (`#161820`), Quick Settings, and popover rules untouched.

- [ ] **Step 4: Wire GSettings, live `#panel` styling, overview/lock listeners, and indicator toggles into `extension.js`**

In `FloatingTopBarExtension`:
- `enable()`:
  - Call `this._settings = this.getSettings();`
  - Connect `this._settings.connect('changed', () => this._onSettingsChanged())`
  - Connect `Main.overview.connect('showing', ...)` and `Main.overview.connect('hiding', ...)` to update `this._inOverview` and re-apply panel style
  - Connect `Main.sessionMode.connect('updated', () => this._applyPanelStyle())`
  - Call `this._applyPanelStyle()`
  - Attach Quick Settings labels as before
- `_applyPanelStyle()`:
  - If `Main.sessionMode.isLocked`, call `Main.panel.set_style(null)` and return.
  - Read all style keys from `this._settings`, pass to `buildPanelStyle(config, this._inOverview)`, call `Main.panel.set_style(css)`.
- `_onSettingsChanged()`:
  - Call `this._applyPanelStyle()`, `this._syncVolume()`, `this._syncWifi()`, `this._syncBluetooth()`.
- `_syncVolume()`, `_syncWifi()`, `_syncBluetooth()`:
  - Return early with `label.visible = false` if the corresponding `show-*-percentage` setting is `false`.
- `disable()`:
  - Disconnect settings, overview, and sessionMode signals; set `this._settings = null`.
  - Call `Main.panel.set_style(null)` to restore stock top bar cleanly.
  - Detach volume, Wi-Fi, and Bluetooth labels as before.

- [ ] **Step 5: Verify syntax, schema, and unit tests**

Run:
```bash
glib-compile-schemas --strict /home/nilaymallik/Projects/floating-topbar/schemas/
node --check /home/nilaymallik/Projects/floating-topbar/extension.js
node --test /home/nilaymallik/Projects/floating-topbar/tests/styleBuilder.test.mjs
```
Expected: All commands exit 0 with all tests passing.

- [ ] **Step 6: Commit**

```bash
git -C /home/nilaymallik/Projects/floating-topbar add metadata.json schemas/ stylesheet.css extension.js
git -C /home/nilaymallik/Projects/floating-topbar commit -m "feat: add GSettings schema and live top bar styling in extension"
```

---

### Task 4: Build Preferences UI (`prefs.js`), update `README.md`, verify live, and push

**Files:**
- Create: `/home/nilaymallik/Projects/floating-topbar/prefs.js`
- Modify: `/home/nilaymallik/Projects/floating-topbar/README.md`

**Interfaces:**
- Consumes: GSettings schema `org.gnome.shell.extensions.floating-topbar` via `this.getSettings()`.
- Produces: Default-exported `FloatingTopBarPreferences extends ExtensionPreferences` implementing `fillPreferencesWindow(window)`.

- [ ] **Step 1: Implement `prefs.js`**

Structure one `Adw.PreferencesPage` (`Appearance`, icon `preferences-desktop-appearance-symbolic`) with 4 `Adw.PreferencesGroup`s:
1. **Colors &amp; Transparency**
   - Background color: `Adw.ActionRow` + `Gtk.ColorDialogButton` (`with_alpha: false`) bound bidirectionally to `background-color` (updates on `notify::rgba` AND `settings.connect('changed::background-color', ...)` so Reset updates the swatch).
   - Background opacity (%): `Adw.ActionRow` + `Gtk.Scale` (`0..100`, live value label) synced bidirectionally with `background-opacity`.
   - Overview opacity (%): `Adw.ActionRow` + `Gtk.Scale` (`0..100`, live value label) synced bidirectionally with `overview-opacity`.
   - Border color: `Adw.ActionRow` + `Gtk.ColorDialogButton` (`with_alpha: true`) synced bidirectionally with `border-color`.
   - Border thickness (px): `Adw.SpinRow` (`0..6`, step `1`) bound to `border-thickness`.
   - Text &amp; icon color: `Adw.ActionRow` + `Gtk.ColorDialogButton` (`with_alpha: true`) synced bidirectionally with `text-color`.
2. **Shape &amp; Spacing**
   - Corner radius (px): `Adw.SpinRow` (`0..24`, step `1`) bound to `border-radius`.
   - Bar height (px): `Adw.SpinRow` (`28..56`, step `1`) bound to `panel-height`.
   - Top &amp; bottom margin (px): `Adw.SpinRow` (`0..24`, step `1`) bound to `margin-vertical`.
   - Left &amp; right margin (px): `Adw.SpinRow` (`0..48`, step `1`) bound to `margin-horizontal`.
3. **Inline Percentages**
   - Show Volume %: `Adw.SwitchRow` bound to `show-volume-percentage`.
   - Show Wi-Fi signal %: `Adw.SwitchRow` bound to `show-wifi-percentage`.
   - Show Bluetooth battery %: `Adw.SwitchRow` bound to `show-bluetooth-percentage`.
4. **Reset**
   - `Adw.ActionRow` with destructive-action `Reset to Defaults` button calling `settings.reset(key)` for all 13 keys.
- Disconnect any manual `settings` signal handlers on `window.connect('close-request', ...)` so nothing leaks after closing Preferences.

- [ ] **Step 2: Verify `prefs.js` syntax and extension metadata**

Run:
```bash
node --check /home/nilaymallik/Projects/floating-topbar/prefs.js
gnome-extensions info floating-topbar@nilaymallik.local
```
Expected: `node --check` exits 0; `gnome-extensions info` shows `Version: 1.1.0` and `Path: /home/nilaymallik/.local/share/gnome-shell/extensions/floating-topbar@nilaymallik.local`.

- [ ] **Step 3: Update `README.md`**

Document features, installation (clone + `glib-compile-schemas schemas/` + symlink + `gnome-extensions enable`), opening preferences (`gnome-extensions prefs floating-topbar@nilaymallik.local` or via Extensions app), and running tests (`node --test`).

- [ ] **Step 4: Commit and push to GitHub**

```bash
git -C /home/nilaymallik/Projects/floating-topbar add prefs.js README.md
git -C /home/nilaymallik/Projects/floating-topbar commit -m "feat: add Adwaita preferences UI for top bar customization"
git -C /home/nilaymallik/Projects/floating-topbar push -u origin main
```

Expected: Clean working tree, all commits pushed to `https://github.com/nilaymallikk/floating-topbar`.
