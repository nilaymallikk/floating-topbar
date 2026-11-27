# Floating Top Bar — GitHub Repo & Extension Preferences Design

**Date:** 2026-11-27
**Status:** Approved

## Intent & Why

Version-control and publish the active GNOME Shell 51 `Floating Top Bar` extension (`floating-topbar@nilaymallik.local`) as a public GitHub repository (`nilaymallikk/floating-topbar`), then add an **Open extension preferences** (`prefs.js`) window so the floating top bar's colors, transparency, borders, shape, spacing, and inline percentage labels can be customized live without hand-editing CSS.

## Goals

- Move the extension source to `~/Projects/floating-topbar`, symlink `~/.local/share/gnome-shell/extensions/floating-topbar@nilaymallik.local` to it, and publish as a public GitHub repo `nilaymallikk/floating-topbar`.
- Add a GSettings schema (`org.gnome.shell.extensions.floating-topbar`) and native GTK4/Libadwaita Preferences UI (`prefs.js`).
- Apply changes live to the floating top bar (`#panel`) with zero flicker and exact visual parity with v1.0.0 defaults.
- Preserve strut stability (`border: none` + `inset box-shadow` + locked `min-height`/`max-height`) so maximized windows never jump.
- Cleanly remove inline styles and disconnect all signals on `disable()` and on lock/login screens.

## Non-Goals & Anti-Goals

- **Non-goal:** Restyling Quick Settings, popup menus, or the Space Bar workspace badge from preferences — those remain styled by `stylesheet.css`.
- **Anti-goal:** Shifted window struts when changing border thickness; leftover inline styles after disabling the extension; shell theme reload stutter while dragging sliders.

## Constraints

- Target platform: GNOME Shell 51 (ESM `Extension` / `ExtensionPreferences`, GTK4 + Libadwaita, `glib-compile-schemas`).
- Defaults must match the v1.0.0 hardcoded values in `stylesheet.css` so upgrading does not change the user's existing look until they customize it.

## Approaches Considered

1. **Direct inline style on `Main.panel` (Chosen):** Read GSettings in `extension.js` and apply a sanitized inline CSS string via `Main.panel.set_style(...)`, tracking overview `showing`/`hiding` for overview opacity and clearing on lock screen / `disable()`. Instant live updates, zero temp files, minimal code.
2. **Generated dynamic stylesheet via `St.Theme.load_stylesheet()` (Rejected):** Writes a CSS file to `~/.cache/` and reloads the shell theme on changes; unnecessary disk I/O and reload stutter for top-bar-only styling.

## Decided Controls & Schema Keys

Schema ID: `org.gnome.shell.extensions.floating-topbar`

| Key | Type | Range | Default |
| --- | --- | --- | --- |
| `background-color` | `s` | CSS color | `rgb(29, 31, 42)` |
| `background-opacity` | `i` | `0..100` | `97` |
| `overview-opacity` | `i` | `0..100` | `84` |
| `border-color` | `s` | CSS RGBA color | `rgba(108, 112, 138, 0.36)` |
| `border-thickness` | `i` | `0..6` | `1` |
| `text-color` | `s` | CSS RGBA color | `rgba(218, 222, 234, 0.96)` |
| `border-radius` | `i` | `0..24` | `11` |
| `panel-height` | `i` | `28..56` | `38` |
| `margin-vertical` | `i` | `0..24` | `4` |
| `margin-horizontal` | `i` | `0..48` | `8` |
| `show-volume-percentage` | `b` | — | `true` |
| `show-wifi-percentage` | `b` | — | `true` |
| `show-bluetooth-percentage` | `b` | — | `true` |

Plus a **Reset to Defaults** action in Preferences that resets all keys and updates all controls immediately.
