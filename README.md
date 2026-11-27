# Floating Top Bar

Floating rounded translucent top bar extension for GNOME Shell 51 with live customization preferences and inline Volume, Wi-Fi signal, and Bluetooth battery percentage labels.

## Features

- **Floating pill top bar** with strut-safe inset border (`border: none` + `inset box-shadow`) so maximized windows never jump.
- **Extension Preferences (`Open extension preferences`)** with live updates:
  - Background color, desktop opacity, and Overview opacity
  - Border color (RGBA) and border thickness (`0–6 px`)
  - Text & icon color
  - Corner radius, bar height, and vertical/horizontal floating margins
  - Toggles for inline Volume %, Wi-Fi signal %, and Bluetooth battery % labels
  - One-click **Reset to defaults**
- **Glassy Quick Settings & popovers** styled in `stylesheet.css`.

## Install

```bash
git clone https://github.com/nilaymallikk/floating-topbar.git ~/Projects/floating-topbar
cd ~/Projects/floating-topbar
glib-compile-schemas schemas/
ln -s ~/Projects/floating-topbar ~/.local/share/gnome-shell/extensions/floating-topbar@nilaymallik.local
gnome-extensions enable floating-topbar@nilaymallik.local
```

Then log out and log back in on Wayland (or restart GNOME Shell on X11) so GNOME Shell loads the updated extension and schema.

## Open Preferences

Open **Extensions** (or Extension Manager) and click **Settings / Open extension preferences** on **Floating Top Bar**, or run:

```bash
gnome-extensions prefs floating-topbar@nilaymallik.local
```

## Development & Tests

```bash
glib-compile-schemas --strict schemas/
node --test tests/styleBuilder.test.mjs
```
