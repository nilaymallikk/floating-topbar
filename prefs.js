import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const ALL_KEYS = [
    'background-color',
    'background-opacity',
    'overview-opacity',
    'border-color',
    'border-thickness',
    'text-color',
    'border-radius',
    'panel-height',
    'margin-vertical',
    'margin-horizontal',
    'show-volume-percentage',
    'show-wifi-percentage',
    'show-bluetooth-percentage',
];

function serializeRgba(rgba, withAlpha) {
    const r = Math.round(rgba.red * 255);
    const g = Math.round(rgba.green * 255);
    const b = Math.round(rgba.blue * 255);
    if (!withAlpha)
        return `rgb(${r}, ${g}, ${b})`;
    const a = Math.round(rgba.alpha * 100) / 100;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function parseGdkRgba(colorStr, fallbackStr) {
    const rgba = new Gdk.RGBA();
    if (rgba.parse(colorStr))
        return rgba;
    rgba.parse(fallbackStr);
    return rgba;
}

export default class FloatingTopBarPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const signalIds = [];

        window.set_default_size(560, 720);

        const page = new Adw.PreferencesPage({
            title: 'Top Bar',
            icon_name: 'preferences-desktop-appearance-symbolic',
        });
        window.add(page);

        const addColorRow = (group, {key, title, subtitle, withAlpha, fallback}) => {
            const row = new Adw.ActionRow({title, subtitle, use_markup: false});
            const dialog = new Gtk.ColorDialog({
                title,
                with_alpha: withAlpha,
            });
            const button = new Gtk.ColorDialogButton({
                dialog,
                valign: Gtk.Align.CENTER,
            });

            let syncing = false;
            const loadFromSettings = () => {
                syncing = true;
                button.set_rgba(parseGdkRgba(settings.get_string(key), fallback));
                syncing = false;
            };
            loadFromSettings();

            button.connect('notify::rgba', () => {
                if (syncing)
                    return;
                const serialized = serializeRgba(button.get_rgba(), withAlpha);
                if (settings.get_string(key) !== serialized)
                    settings.set_string(key, serialized);
            });

            signalIds.push(settings.connect(`changed::${key}`, loadFromSettings));

            row.add_suffix(button);
            row.activatable_widget = button;
            group.add(row);
        };

        const addOpacityRow = (group, {key, title, subtitle}) => {
            const row = new Adw.ActionRow({title, subtitle});
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 10,
                valign: Gtk.Align.CENTER,
            });
            const scale = new Gtk.Scale({
                orientation: Gtk.Orientation.HORIZONTAL,
                adjustment: new Gtk.Adjustment({
                    lower: 0,
                    upper: 100,
                    step_increment: 1,
                    page_increment: 10,
                }),
                digits: 0,
                draw_value: false,
                width_request: 170,
                valign: Gtk.Align.CENTER,
            });
            const valueLabel = new Gtk.Label({
                width_chars: 4,
                xalign: 1,
                css_classes: ['dim-label', 'numeric'],
            });

            let syncing = false;
            const loadFromSettings = () => {
                syncing = true;
                const val = settings.get_int(key);
                scale.set_value(val);
                valueLabel.set_label(`${val}%`);
                syncing = false;
            };
            loadFromSettings();

            scale.connect('value-changed', () => {
                const val = Math.round(scale.get_value());
                valueLabel.set_label(`${val}%`);
                if (!syncing && settings.get_int(key) !== val)
                    settings.set_int(key, val);
            });

            signalIds.push(settings.connect(`changed::${key}`, loadFromSettings));

            box.append(scale);
            box.append(valueLabel);
            row.add_suffix(box);
            group.add(row);
        };

        const addSpinRow = (group, {key, title, subtitle, lower, upper, step = 1, pageStep = 4}) => {
            const row = new Adw.SpinRow({
                title,
                subtitle,
                use_markup: false,
                adjustment: new Gtk.Adjustment({
                    lower,
                    upper,
                    step_increment: step,
                    page_increment: pageStep,
                }),
            });
            settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        };

        const addSwitchRow = (group, {key, title, subtitle}) => {
            const row = new Adw.SwitchRow({title, subtitle});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        };

        // ── Colors & Transparency ─────────────────────────────────────────────
        const colorsGroup = new Adw.PreferencesGroup({
            title: 'Colors &amp; Transparency',
            description: 'Changes apply live to the floating top bar.',
        });
        page.add(colorsGroup);

        addColorRow(colorsGroup, {
            key: 'background-color',
            title: 'Background color',
            subtitle: 'Base fill color of the top bar pill',
            withAlpha: false,
            fallback: 'rgb(29, 31, 42)',
        });
        addOpacityRow(colorsGroup, {
            key: 'background-opacity',
            title: 'Background opacity',
            subtitle: 'Desktop transparency (0% fully transparent, 100% solid)',
        });
        addOpacityRow(colorsGroup, {
            key: 'overview-opacity',
            title: 'Overview opacity',
            subtitle: 'Top bar transparency while Overview is open',
        });
        addColorRow(colorsGroup, {
            key: 'border-color',
            title: 'Border color',
            subtitle: 'Color and transparency of the inset border',
            withAlpha: true,
            fallback: 'rgba(108, 112, 138, 0.36)',
        });
        addSpinRow(colorsGroup, {
            key: 'border-thickness',
            title: 'Border thickness (px)',
            subtitle: 'Set to 0 to disable the border (uses inset shadow so windows never jump)',
            lower: 0,
            upper: 6,
            step: 1,
            pageStep: 2,
        });
        addColorRow(colorsGroup, {
            key: 'text-color',
            title: 'Text & icon color',
            subtitle: 'Foreground color for panel labels and status icons',
            withAlpha: true,
            fallback: 'rgba(218, 222, 234, 0.96)',
        });

        // ── Shape & Spacing ───────────────────────────────────────────────────
        const layoutGroup = new Adw.PreferencesGroup({
            title: 'Shape &amp; Spacing',
        });
        page.add(layoutGroup);

        addSpinRow(layoutGroup, {
            key: 'border-radius',
            title: 'Corner radius (px)',
            subtitle: 'Roundness of the floating pill corners',
            lower: 0,
            upper: 24,
        });
        addSpinRow(layoutGroup, {
            key: 'panel-height',
            title: 'Bar height (px)',
            subtitle: 'Locked top bar height',
            lower: 28,
            upper: 56,
        });
        addSpinRow(layoutGroup, {
            key: 'margin-vertical',
            title: 'Top & bottom margin (px)',
            subtitle: 'Vertical floating gap around the bar',
            lower: 0,
            upper: 24,
        });
        addSpinRow(layoutGroup, {
            key: 'margin-horizontal',
            title: 'Left & right margin (px)',
            subtitle: 'Horizontal floating gap from screen edges',
            lower: 0,
            upper: 48,
        });

        // ── Inline Percentages ────────────────────────────────────────────────
        const indicatorsGroup = new Adw.PreferencesGroup({
            title: 'Inline Percentages',
            description: 'Show compact numeric readouts beside Quick Settings icons.',
        });
        page.add(indicatorsGroup);

        addSwitchRow(indicatorsGroup, {
            key: 'show-volume-percentage',
            title: 'Volume percentage',
            subtitle: 'Show output volume next to the speaker icon',
        });
        addSwitchRow(indicatorsGroup, {
            key: 'show-wifi-percentage',
            title: 'Wi-Fi signal percentage',
            subtitle: 'Show signal strength next to the Wi-Fi icon',
        });
        addSwitchRow(indicatorsGroup, {
            key: 'show-bluetooth-percentage',
            title: 'Bluetooth battery percentage',
            subtitle: 'Show connected Bluetooth peripheral battery level',
        });

        // ── Reset ─────────────────────────────────────────────────────────────
        const resetGroup = new Adw.PreferencesGroup({
            title: 'Reset',
        });
        page.add(resetGroup);

        const resetRow = new Adw.ActionRow({
            title: 'Reset to defaults',
            subtitle: 'Restore all Floating Top Bar settings to their default values',
        });
        const resetButton = new Gtk.Button({
            label: 'Reset',
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });
        resetButton.connect('clicked', () => {
            for (const key of ALL_KEYS)
                settings.reset(key);
        });
        resetRow.add_suffix(resetButton);
        resetRow.activatable_widget = resetButton;
        resetGroup.add(resetRow);

        window.connect('destroy', () => {
            for (const id of signalIds)
                settings.disconnect(id);
            signalIds.length = 0;
        });
    }
}
