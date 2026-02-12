/**
 * ThemeContext.tsx
 * 
 * Context for managing themes in Tauri mode.
 * Automatically detects runtime environment and only applies themes when NOT in VSCode.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isVsCode } from '../utils/bridge';
import { themes, ThemeName } from '../styles/themes';

interface ThemeContextType {
    theme: ThemeName;
    setTheme: (theme: ThemeName) => void;
    isTauriMode: boolean;
    monacoTheme: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
    // Detect if we're in Tauri mode (NOT VSCode)
    const isTauriMode = !isVsCode();

    // Default to dark theme
    const [theme, setThemeState] = useState<ThemeName>('dark');
    const [monacoTheme, setMonacoTheme] = useState<string>('vs-dark');

    // Load saved theme preference on mount (Tauri only)
    useEffect(() => {
        if (!isTauriMode) return;

        // Try to load from localStorage
        const saved = localStorage.getItem('apinox-theme');
        if (saved && saved in themes) {
            setThemeState(saved as ThemeName);
        }
    }, [isTauriMode]);

    // Apply theme CSS variables when theme changes (Tauri only)
    useEffect(() => {
        if (!isTauriMode) return;

        const selectedTheme = themes[theme];
        const root = document.documentElement;

        // Apply all theme variables to root element
        Object.entries(selectedTheme.variables).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

        // Add data-theme attribute to body for CSS selectors
        document.body.setAttribute('data-theme', theme);

        console.log(`[ThemeContext] Applied ${theme} theme (${Object.keys(selectedTheme.variables).length} variables)`);

        // Update window border color to match theme
        const updateBorderColor = async () => {
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                // getCurrentWindow import removed - not needed for invoke
                
                // Get the editor background color
                const editorBg = selectedTheme.variables['--apinox-editor-background'];
                
                await invoke('set_border_color', { 
                    color: editorBg 
                });
                
                console.log(`[ThemeContext] Updated border color to: ${editorBg}`);
            } catch (e) {
                console.warn('[ThemeContext] Failed to update border color:', e);
            }
        };

        updateBorderColor();

        // Apply Monaco theme globally
        const applyMonacoTheme = async () => {
            try {
                const monaco = await import('monaco-editor');
                const getVar = (name: string, fallback: string) => {
                    const value = getComputedStyle(root).getPropertyValue(name).trim();
                    return value || fallback;
                };

                const isLight = theme.includes('light');
                const themeId = `apinox-${theme}`;

                monaco.editor.defineTheme(themeId, {
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

                monaco.editor.setTheme(themeId);
                setMonacoTheme(themeId);
            } catch (e) {
                console.warn('[ThemeContext] Failed to apply Monaco theme:', e);
            }
        };

        applyMonacoTheme();
    }, [theme, isTauriMode]);

    // Wrapper to save theme preference
    const setTheme = (newTheme: ThemeName) => {
        if (!isTauriMode) {
            console.warn('[ThemeContext] Theme switching disabled in VSCode mode');
            return;
        }

        setThemeState(newTheme);
        localStorage.setItem('apinox-theme', newTheme);
        console.log(`[ThemeContext] Theme changed to: ${newTheme}`);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, isTauriMode, monacoTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
