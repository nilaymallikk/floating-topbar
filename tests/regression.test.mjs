import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test('extension.js applies panel customization via St.Theme stylesheet (immune to Main.panel.style wipes)', () => {
    const src = readFileSync(join(ROOT, 'extension.js'), 'utf8');
    assert.match(src, /load_stylesheet/);
    assert.match(src, /unload_stylesheet/);
    assert.match(src, /add_style_class_name\(\s*'floating-topbar-styled'\s*\)/);
    assert.match(src, /remove_style_class_name\(\s*'floating-topbar-styled'\s*\)/);
    assert.doesNotMatch(
        src,
        /Main\.panel\.set_style\(/,
        'Inline Main.panel.set_style gets wiped by extensions like dash2dock-lite when dialogs/windows close',
    );
});

test('stylesheet preserves Space Bar workspace badge text color above panel text override', () => {
    const css = readFileSync(join(ROOT, 'stylesheet.css'), 'utf8');
    assert.match(
        css,
        /#panelBox\s+#panel\.floating-topbar-styled\s+\.panel-button\.space-bar\.workspace-label[\s\S]*?color:\s*#161820;/,
    );
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
