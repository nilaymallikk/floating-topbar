export const DEFAULTS = Object.freeze({
    backgroundColor: 'rgb(29, 31, 42)',
    backgroundOpacity: 97,
    overviewOpacity: 84,
    borderColor: 'rgba(108, 112, 138, 0.36)',
    borderThickness: 1,
    textColor: 'rgba(218, 222, 234, 0.96)',
    borderRadius: 11,
    panelHeight: 38,
    marginVertical: 4,
    marginHorizontal: 8,
    showVolumePercentage: true,
    showWifiPercentage: true,
    showBluetoothPercentage: true,
});

const DEFAULT_BG = {r: 29, g: 31, b: 42, a: 1};
const DEFAULT_BORDER = {r: 108, g: 112, b: 138, a: 0.36};
const DEFAULT_TEXT = {r: 218, g: 222, b: 234, a: 0.96};

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?|\.\d+))?\s*\)$/i;

function clampInt(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num))
        return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
}

function roundAlpha(alpha) {
    const clamped = Math.min(1, Math.max(0, alpha));
    return Math.round(clamped * 100) / 100;
}

export function parseCssColor(input, fallback) {
    if (typeof input !== 'string')
        return {...fallback};
    const trimmed = input.trim();

    const hexMatch = HEX_RE.exec(trimmed);
    if (hexMatch) {
        const hex = hexMatch[1];
        if (hex.length === 3) {
            return {
                r: parseInt(hex[0] + hex[0], 16),
                g: parseInt(hex[1] + hex[1], 16),
                b: parseInt(hex[2] + hex[2], 16),
                a: 1,
            };
        }
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? roundAlpha(parseInt(hex.slice(6, 8), 16) / 255) : 1;
        return {r, g, b, a};
    }

    const rgbMatch = RGB_RE.exec(trimmed);
    if (rgbMatch) {
        const r = Number(rgbMatch[1]);
        const g = Number(rgbMatch[2]);
        const b = Number(rgbMatch[3]);
        if (r > 255 || g > 255 || b > 255)
            return {...fallback};
        const a = rgbMatch[4] !== undefined ? roundAlpha(Number(rgbMatch[4])) : 1;
        return {r, g, b, a};
    }

    return {...fallback};
}

export function formatRgba({r, g, b, a}) {
    const cr = clampInt(r, 0, 255, 0);
    const cg = clampInt(g, 0, 255, 0);
    const cb = clampInt(b, 0, 255, 0);
    const ca = roundAlpha(Number.isFinite(a) ? a : 1);
    return `rgba(${cr}, ${cg}, ${cb}, ${ca})`;
}

export function buildPanelStylesheet(config = {}) {
    const merged = {...DEFAULTS, ...config};

    const bg = parseCssColor(merged.backgroundColor, DEFAULT_BG);
    const bgOpacity = clampInt(merged.backgroundOpacity, 0, 100, DEFAULTS.backgroundOpacity);
    const overviewOpacity = clampInt(merged.overviewOpacity, 0, 100, DEFAULTS.overviewOpacity);
    const bgCss = formatRgba({...bg, a: bgOpacity / 100});
    const overviewBgCss = formatRgba({...bg, a: overviewOpacity / 100});

    const border = parseCssColor(merged.borderColor, DEFAULT_BORDER);
    const borderThickness = clampInt(merged.borderThickness, 0, 6, DEFAULTS.borderThickness);
    const boxShadowCss = borderThickness > 0
        ? `inset 0 0 0 ${borderThickness}px ${formatRgba(border)}`
        : 'none';

    const textCss = formatRgba(parseCssColor(merged.textColor, DEFAULT_TEXT));
    const radius = clampInt(merged.borderRadius, 0, 24, DEFAULTS.borderRadius);
    const height = clampInt(merged.panelHeight, 28, 56, DEFAULTS.panelHeight);
    const marginV = clampInt(merged.marginVertical, 0, 24, DEFAULTS.marginVertical);
    const marginH = clampInt(merged.marginHorizontal, 0, 48, DEFAULTS.marginHorizontal);

    return [
        `#panelBox #panel.floating-topbar-styled {`,
        `  margin: ${marginV}px ${marginH}px;`,
        '  padding: 0;',
        '  border: none;',
        `  border-radius: ${radius}px;`,
        `  height: ${height}px; min-height: ${height}px; max-height: ${height}px;`,
        `  background-color: ${bgCss};`,
        '  background-image: none;',
        `  box-shadow: ${boxShadowCss};`,
        `  color: ${textCss};`,
        '  transition-duration: 0ms;',
        '}',
        '',
        '#panelBox #panel.floating-topbar-styled:overview {',
        `  background-color: ${overviewBgCss};`,
        `  box-shadow: ${boxShadowCss};`,
        '}',
        '',
        '#panelBox #panel.floating-topbar-styled.unlock-screen,',
        '#panelBox #panel.floating-topbar-styled.login-screen {',
        '  margin: 0;',
        '  border-radius: 0;',
        '  border: none;',
        '  background-color: transparent;',
        '  box-shadow: none;',
        '}',
        '',
        '#panelBox #panel.floating-topbar-styled .panel-button,',
        '#panelBox #panel.floating-topbar-styled .panel-button *,',
        '#panelBox #panel.floating-topbar-styled .panel-button:hover,',
        '#panelBox #panel.floating-topbar-styled .panel-button:active,',
        '#panelBox #panel.floating-topbar-styled .panel-button:checked,',
        '#panelBox #panel.floating-topbar-styled .panel-button:overview {',
        `  color: ${textCss};`,
        '}',
    ].join('\n');
}
