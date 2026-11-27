import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULTS,
    parseCssColor,
    formatRgba,
    buildPanelStylesheet,
} from '../styleBuilder.js';

test('default stylesheet matches v1.0.0 panel values and uses high-specificity selector', () => {
    const css = buildPanelStylesheet(DEFAULTS);
    assert.match(css, /#panelBox\s+#panel\.floating-topbar-styled\s*\{/);
    assert.match(css, /margin:\s*4px 8px;/);
    assert.match(css, /border:\s*none;/);
    assert.match(css, /border-radius:\s*11px;/);
    assert.match(css, /height:\s*38px;/);
    assert.match(css, /min-height:\s*38px;/);
    assert.match(css, /max-height:\s*38px;/);
    assert.match(css, /background-color:\s*rgba\(29, 31, 42, 0\.97\);/);
    assert.match(css, /box-shadow:\s*inset 0 0 0 1px rgba\(108, 112, 138, 0\.36\);/);
    assert.match(css, /#panelBox\s+#panel\.floating-topbar-styled\s+\.panel-button\s+\*/);
    assert.match(css, /color:\s*rgba\(218, 222, 234, 0\.96\);/);
});

test('stylesheet includes :overview rule using overviewOpacity and unlock-screen reset', () => {
    const css = buildPanelStylesheet(DEFAULTS);
    assert.match(
        css,
        /#panelBox\s+#panel\.floating-topbar-styled:overview\s*\{[^}]*background-color:\s*rgba\(29, 31, 42, 0\.84\);/,
    );
    assert.match(
        css,
        /#panelBox\s+#panel\.floating-topbar-styled\.unlock-screen[\s\S]*?background-color:\s*transparent;/,
    );
});

test('borderThickness=0 emits box-shadow: none', () => {
    const css = buildPanelStylesheet({...DEFAULTS, borderThickness: 0});
    assert.match(css, /box-shadow:\s*none;/);
    assert.doesNotMatch(css, /inset 0 0 0 0px/);
});

test('borderThickness=4 emits inset 4px shadow with border: none', () => {
    const css = buildPanelStylesheet({
        ...DEFAULTS,
        borderThickness: 4,
        borderColor: 'rgba(153, 193, 200, 0.8)',
    });
    assert.match(css, /border:\s*none;/);
    assert.match(css, /box-shadow:\s*inset 0 0 0 4px rgba\(153, 193, 200, 0\.8\);/);
});

test('clamps out-of-range numeric values to schema bounds', () => {
    const low = buildPanelStylesheet({
        backgroundOpacity: -20,
        overviewOpacity: -10,
        borderThickness: -5,
        borderRadius: -3,
        panelHeight: 10,
        marginVertical: -2,
        marginHorizontal: -4,
    });
    assert.match(low, /background-color:\s*rgba\(29, 31, 42, 0\);/);
    assert.match(low, /box-shadow:\s*none;/);
    assert.match(low, /border-radius:\s*0px;/);
    assert.match(low, /height:\s*28px;\s*min-height:\s*28px;\s*max-height:\s*28px;/);
    assert.match(low, /margin:\s*0px 0px;/);

    const high = buildPanelStylesheet({
        backgroundOpacity: 250,
        overviewOpacity: 250,
        borderThickness: 99,
        borderRadius: 99,
        panelHeight: 120,
        marginVertical: 99,
        marginHorizontal: 99,
    });
    assert.match(high, /background-color:\s*rgba\(29, 31, 42, 1\);/);
    assert.match(high, /box-shadow:\s*inset 0 0 0 6px /);
    assert.match(high, /border-radius:\s*24px;/);
    assert.match(high, /height:\s*56px;\s*min-height:\s*56px;\s*max-height:\s*56px;/);
    assert.match(high, /margin:\s*24px 48px;/);
});

test('parses hex (#rgb, #rrggbb, #rrggbbaa) and rgb/rgba strings', () => {
    const fb = {r: 0, g: 0, b: 0, a: 1};
    assert.deepEqual(parseCssColor('#0f8', fb), {r: 0, g: 255, b: 136, a: 1});
    assert.deepEqual(parseCssColor('#1d1f2a', fb), {r: 29, g: 31, b: 42, a: 1});
    assert.deepEqual(parseCssColor('#ffffff80', fb), {r: 255, g: 255, b: 255, a: 0.5});
    assert.deepEqual(parseCssColor('rgb(10, 20, 30)', fb), {r: 10, g: 20, b: 30, a: 1});
    assert.deepEqual(parseCssColor('rgba(10, 20, 30, 0.25)', fb), {r: 10, g: 20, b: 30, a: 0.25});
    assert.equal(formatRgba({r: 10, g: 20, b: 30, a: 0.25}), 'rgba(10, 20, 30, 0.25)');
});

test('rejects corrupt or CSS-injection color strings and falls back safely', () => {
    const css = buildPanelStylesheet({
        backgroundColor: 'red; position: fixed',
        borderColor: 'rgb(999, 0, 0); } #x {',
        textColor: '',
    });
    assert.doesNotMatch(css, /position|fixed|#x/);
    assert.match(css, /background-color:\s*rgba\(29, 31, 42, 0\.97\);/);
    assert.match(css, /box-shadow:\s*inset 0 0 0 1px rgba\(108, 112, 138, 0\.36\);/);
    assert.match(css, /color:\s*rgba\(218, 222, 234, 0\.96\);/);
});
