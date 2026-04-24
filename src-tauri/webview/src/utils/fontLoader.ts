/**
 * fontLoader.ts
 *
 * Dynamically loads a UI font from Google Fonts on demand.
 * Fonts are only fetched when first selected, then cached by the browser.
 */

export const UI_FONTS = [
    { value: 'fira-code', label: 'Fira Code (Default)', family: "'Fira Code', monospace", googleFamily: null },
    { value: 'source-code-pro', label: 'Source Code Pro', family: "'Source Code Pro', monospace", googleFamily: 'Source+Code+Pro:wght@400;500;600' },
    { value: 'jetbrains-mono', label: 'JetBrains Mono', family: "'JetBrains Mono', monospace", googleFamily: 'JetBrains+Mono:wght@400;500;600' },
    { value: 'system', label: 'System Default', family: null, googleFamily: null },
] as const;

export type UIFontValue = typeof UI_FONTS[number]['value'];

const loadedFonts = new Set<string>();

export function loadUIFont(fontValue: UIFontValue): void {
    const font = UI_FONTS.find(f => f.value === fontValue);
    if (!font || !font.googleFamily || loadedFonts.has(fontValue)) return;

    loadedFonts.add(fontValue);

    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect1);

    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect2);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${font.googleFamily}&display=swap`;
    document.head.appendChild(link);
}

export function applyUIFont(fontValue: UIFontValue | undefined): void {
    const font = UI_FONTS.find(f => f.value === (fontValue ?? 'system'));
    const family = font?.family ?? null;

    if (family) {
        loadUIFont(fontValue as UIFontValue);
        document.documentElement.style.setProperty('--apinox-ui-font-family', family);
    } else {
        document.documentElement.style.removeProperty('--apinox-ui-font-family');
    }
}
