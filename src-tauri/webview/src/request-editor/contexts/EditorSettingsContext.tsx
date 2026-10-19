import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

export interface EditorSettings {
    /** Format elements with simple text content inline (e.g., <Name>John</Name>) */
    inlineValues: boolean;
    /** Align multi-attribute elements vertically */
    alignAttributes: boolean;
    /** Strip VsDebuggerCausalityData from XML */
    hideCausality: boolean;
    /** Show line numbers in editor */
    showLineNumbers: boolean;
    /** Show minimap in editor */
    showMinimap: boolean;
    /** Font size for editor */
    fontSize: number;
    /** Font family for editor */
    fontFamily: string;
    /** Pretty print mode (false = minified) */
    prettyPrint: boolean;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
    inlineValues: true,
    alignAttributes: false,
    hideCausality: false,
    showLineNumbers: true,
    showMinimap: false,
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    prettyPrint: true
};

interface EditorSettingsContextValue {
    settings: EditorSettings;
    updateSettings: (updates: Partial<EditorSettings>) => void;
    toggleInlineValues: () => void;
    toggleAlignAttributes: () => void;
    toggleHideCausality: () => void;
    toggleLineNumbers: () => void;
    toggleMinimap: () => void;
    togglePrettyPrint: () => void;
}

const EditorSettingsContext = createContext<EditorSettingsContextValue | undefined>(undefined);

interface EditorSettingsProviderProps {
    children: ReactNode;
    initialSettings?: Partial<EditorSettings>;
    onSettingsChange?: (settings: EditorSettings) => void;
}

export function EditorSettingsProvider({ 
    children, 
    initialSettings = {},
    onSettingsChange 
}: EditorSettingsProviderProps) {
    const [settings, setSettings] = useState<EditorSettings>({
        ...DEFAULT_EDITOR_SETTINGS,
        ...initialSettings
    });

    const updateSettings = useCallback((updates: Partial<EditorSettings>) => {
        setSettings(prev => {
            const newSettings = { ...prev, ...updates };
            onSettingsChange?.(newSettings);
            return newSettings;
        });
    }, [onSettingsChange]);

    // Toggle callbacks are memoized so the context value below stays stable
    // across renders; consumers only re-render when `settings` actually changes.
    const toggleInlineValues = useCallback(() => updateSettings({ inlineValues: !settings.inlineValues }), [updateSettings, settings]);
    const toggleAlignAttributes = useCallback(() => updateSettings({ alignAttributes: !settings.alignAttributes }), [updateSettings, settings]);
    const toggleHideCausality = useCallback(() => updateSettings({ hideCausality: !settings.hideCausality }), [updateSettings, settings]);
    const toggleLineNumbers = useCallback(() => updateSettings({ showLineNumbers: !settings.showLineNumbers }), [updateSettings, settings]);
    const toggleMinimap = useCallback(() => updateSettings({ showMinimap: !settings.showMinimap }), [updateSettings, settings]);
    const togglePrettyPrint = useCallback(() => updateSettings({ prettyPrint: !settings.prettyPrint }), [updateSettings, settings]);

    // Perf: memoize the context value. Previously a fresh object literal was
    // created on every render, so every consumer (both editors, the panels,
    // the status bar) re-rendered whenever any setting changed. With a stable
    // value, consumers only re-render when `settings` actually changes.
    const contextValue = useMemo<EditorSettingsContextValue>(() => ({
        settings,
        updateSettings,
        toggleInlineValues,
        toggleAlignAttributes,
        toggleHideCausality,
        toggleLineNumbers,
        toggleMinimap,
        togglePrettyPrint
    }), [
        settings,
        updateSettings,
        toggleInlineValues,
        toggleAlignAttributes,
        toggleHideCausality,
        toggleLineNumbers,
        toggleMinimap,
        togglePrettyPrint
    ]);

    return (
        <EditorSettingsContext.Provider value={contextValue}>
            {children}
        </EditorSettingsContext.Provider>
    );
}

export function useEditorSettings() {
    const context = useContext(EditorSettingsContext);
    if (!context) {
        throw new Error('useEditorSettings must be used within EditorSettingsProvider');
    }
    return context;
}
