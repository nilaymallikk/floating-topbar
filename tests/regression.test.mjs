import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test('stylesheet explicitly inherits #panel text color on .panel-button states', () => {
    const css = readFileSync(join(ROOT, 'stylesheet.css'), 'utf8');
    assert.match(
        css,
        /#panel\s+\.panel-button[\s\S]*?color:\s*inherit;/,
        'Expected #panel .panel-button to set color: inherit so GNOME base theme color does not override #panel inline color',
    );
    assert.match(css, /#panel\s+\.panel-button:overview/);
    assert.match(css, /#panel\s+\.panel-button\.space-bar\.workspace-label[\s\S]*?color:\s*#161820;/);
});

test('prefs.js Adw.PreferencesGroup titles escape ampersands for Pango markup', () => {
    const src = readFileSync(join(ROOT, 'prefs.js'), 'utf8');
    const groupBlocks = src.match(/new\s+Adw\.PreferencesGroup\(\{[\s\S]*?\}\)/g) ?? [];
    assert.ok(groupBlocks.length >= 3, 'Expected at least 3 Adw.PreferencesGroup blocks');
    for (const block of groupBlocks) {
        assert.doesNotMatch(
            block,
            /&(?!amp;)/,
            `Adw.PreferencesGroup parses Pango markup; escape & as &amp; in:\n${block}`,
        );
    }
});

test('extension.js tracks shown/hidden overview signals and syncs overview state on sessionMode update', () => {
    const src = readFileSync(join(ROOT, 'extension.js'), 'utf8');
    for (const sig of ['showing', 'shown', 'hiding', 'hidden']) {
        assert.match(
            src,
            new RegExp(`Main\\.overview\\.connect\\(\\s*'${sig}'`),
            `Expected Main.overview.connect('${sig}', ...) to handle cancelled touchpad gestures`,
        );
    }
    assert.match(
        src,
        /Main\.sessionMode\.connect\(\s*'updated'[\s\S]*?_inOverview\s*=\s*Boolean\(Main\.overview\?\.visible\)/,
        'Expected sessionMode updated handler to resync _inOverview',
    );
});
