/**
 * ThemeContext.tsx
 * 
 * Context for managing themes in standalone mode.
 * Parent app can control whether to apply themes via standalone prop.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { themes, ThemeName } from '../styles/themes';
import { getMonacoThemeId } from '../utils/monacoTheme';

interface ThemeContextType {
    theme: ThemeName;
    setTheme: (theme: ThemeName) => void;
    isStandalone: boolean;
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
    /** Whether running as standalone app (true) vs embedded in another app (false). Default: true */
    standalone?: boolean;
}

export const ThemeProvider = ({ children, standalone = true }: ThemeProviderProps) => {
    // Use standalone mode to determine if we should apply themes
    const isStandalone = standalone;

    // Default to dark theme
    const [theme, setThemeState] = useState<ThemeName>('dark');
    const [monacoTheme, setMonacoTheme] = useState<string>('vs-dark');

    // Load saved theme preference on mount (standalone only)
    useEffect(() => {
        if (!isStandalone) return;

        // Try to load from localStorage
        const saved = localStorage.getItem('apinox-theme');
        if (saved && saved in themes) {
            setThemeState(saved as ThemeName);
        }
    }, [isStandalone]);

    // Apply theme CSS variables when theme changes (standalone only)
    useEffect(() => {
        if (!isStandalone) return;

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
            // Only run in Tauri environment
            if (typeof window === 'undefined' || !(window as any).__TAURI__) {
                return;
            }
            
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

        setMonacoTheme(getMonacoThemeId(theme));
    }, [theme, isStandalone]);

    // Wrapper to save theme preference
    const setTheme = (newTheme: ThemeName) => {
        if (!isStandalone) {
            console.warn('[ThemeContext] Theme switching disabled in embedded mode');
            return;
        }

        setThemeState(newTheme);
        localStorage.setItem('apinox-theme', newTheme);
        console.log(`[ThemeContext] Theme changed to: ${newTheme}`);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, isStandalone, monacoTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
