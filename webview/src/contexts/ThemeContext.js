import { jsx as _jsx } from "react/jsx-runtime";
/**
 * ThemeContext.tsx
 *
 * Context for managing themes in Tauri mode.
 * Automatically detects runtime environment and only applies themes when NOT in VSCode.
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { isVsCode } from '../utils/bridge';
import { themes } from '../styles/themes';
const ThemeContext = createContext(undefined);
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
export const ThemeProvider = ({ children }) => {
    // Detect if we're in Tauri mode (NOT VSCode)
    const isTauriMode = !isVsCode();
    // Default to dark theme
    const [theme, setThemeState] = useState('dark');
    // Load saved theme preference on mount (Tauri only)
    useEffect(() => {
        if (!isTauriMode)
            return;
        // Try to load from localStorage
        const saved = localStorage.getItem('apinox-theme');
        if (saved && saved in themes) {
            setThemeState(saved);
        }
    }, [isTauriMode]);
    // Apply theme CSS variables when theme changes (Tauri only)
    useEffect(() => {
        if (!isTauriMode)
            return;
        const selectedTheme = themes[theme];
        const root = document.documentElement;
        // Apply all theme variables to root element
        Object.entries(selectedTheme.variables).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
        console.log(`[ThemeContext] Applied ${theme} theme (${Object.keys(selectedTheme.variables).length} variables)`);
    }, [theme, isTauriMode]);
    // Wrapper to save theme preference
    const setTheme = (newTheme) => {
        if (!isTauriMode) {
            console.warn('[ThemeContext] Theme switching disabled in VSCode mode');
            return;
        }
        setThemeState(newTheme);
        localStorage.setItem('apinox-theme', newTheme);
        console.log(`[ThemeContext] Theme changed to: ${newTheme}`);
    };
    return (_jsx(ThemeContext.Provider, { value: { theme, setTheme, isTauriMode }, children: children }));
};
