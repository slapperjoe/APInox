import type { Monaco } from '@monaco-editor/react';

export function getMonacoThemeId(theme: string): string {
    return `apinox-${theme}`;
}

/**
 * Convert a CSS color string to a hex value Monaco can accept.
 * Monaco rejects rgba() / rgb() strings, so we convert them to #RRGGBBAA hex.
 * Already-valid hex values are passed through unchanged.
 */
export function toMonacoColor(color: string): string {
    const trimmed = color.trim();

    // rgba(r, g, b, a)
    const rgbaMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
    if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1], 10);
        const g = parseInt(rgbaMatch[2], 10);
        const b = parseInt(rgbaMatch[3], 10);
        const a = rgbaMatch[4] !== undefined ? Math.round(parseFloat(rgbaMatch[4]) * 255) : 255;
        return (
            "#" +
            r.toString(16).padStart(2, "0") +
            g.toString(16).padStart(2, "0") +
            b.toString(16).padStart(2, "0") +
            a.toString(16).padStart(2, "0")
        );
    }

    return trimmed;
}

export function applyMonacoTheme(monacoInstance: Monaco, theme: string): string {
    const root = document.documentElement;
    const getVar = (name: string, fallback: string) => {
        const value = getComputedStyle(root).getPropertyValue(name).trim();
        return value || fallback;
    };

    const isLight = theme.includes('light');
    const themeId = getMonacoThemeId(theme);

    monacoInstance.editor.defineTheme(themeId, {
        base: isLight ? 'vs' : 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': toMonacoColor(getVar('--apinox-editor-background', isLight ? '#ffffff' : '#1e1e1e')),
            'editor.foreground': toMonacoColor(getVar('--apinox-editor-foreground', isLight ? '#000000' : '#d4d4d4')),
            'editor.selectionBackground': toMonacoColor(getVar('--apinox-editor-selectionBackground', isLight ? '#add6ff' : '#264f78')),
            'editor.lineHighlightBackground': toMonacoColor(getVar('--apinox-editor-lineHighlightBackground', isLight ? '#f5f5f5' : '#2a2d2e')),
            'editorCursor.foreground': toMonacoColor(getVar('--apinox-editorCursor-foreground', isLight ? '#000000' : '#ffffff')),
            'editorLineNumber.foreground': toMonacoColor(getVar('--apinox-editorLineNumber-foreground', isLight ? '#999999' : '#858585')),
            'editorLineNumber.activeForeground': toMonacoColor(getVar('--apinox-editorLineNumber-activeForeground', isLight ? '#000000' : '#c6c6c6')),
            'editorWhitespace.foreground': toMonacoColor(getVar('--apinox-editorWhitespace-foreground', isLight ? '#d3d3d3' : '#404040'))
        }
    });

    monacoInstance.editor.setTheme(themeId);
    return themeId;
}
