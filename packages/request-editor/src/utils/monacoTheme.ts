import type { Monaco } from '@monaco-editor/react';

export function getMonacoThemeId(theme: string): string {
    return `apinox-${theme}`;
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
            'editor.background': getVar('--apinox-editor-background', isLight ? '#ffffff' : '#1e1e1e'),
            'editor.foreground': getVar('--apinox-editor-foreground', isLight ? '#000000' : '#d4d4d4'),
            'editor.selectionBackground': getVar('--apinox-editor-selectionBackground', isLight ? '#add6ff' : '#264f78'),
            'editor.lineHighlightBackground': getVar('--apinox-editor-lineHighlightBackground', 'transparent'),
            'editorCursor.foreground': getVar('--apinox-editorCursor-foreground', isLight ? '#000000' : '#ffffff'),
            'editorLineNumber.foreground': getVar('--apinox-editorLineNumber-foreground', isLight ? '#999999' : '#858585'),
            'editorLineNumber.activeForeground': getVar('--apinox-editorLineNumber-activeForeground', isLight ? '#000000' : '#c6c6c6'),
            'editorWhitespace.foreground': getVar('--apinox-editorWhitespace-foreground', isLight ? '#d3d3d3' : '#404040')
        }
    });

    monacoInstance.editor.setTheme(themeId);
    return themeId;
}
