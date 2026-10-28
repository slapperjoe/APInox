import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { ApinoxConfig } from '@shared/models';

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

type UiConfigSlice = NonNullable<ApinoxConfig['ui']>;

/**
 * `config.ui` ⇄ `EditorSettings`.
 *
 * These live here because this module owns the settings shape. The app-level provider
 * and the backend message handler must map identically, otherwise the same setting
 * reads differently depending on which path wrote it — which is exactly what happened
 * when the provider persisted to localStorage while `config.ui` persisted to the
 * config file.
 */
export function editorSettingsFromConfig(ui?: UiConfigSlice): EditorSettings {
    return {
        inlineValues: ui?.inlineElementValues ?? DEFAULT_EDITOR_SETTINGS.inlineValues,
        alignAttributes: ui?.alignAttributes ?? DEFAULT_EDITOR_SETTINGS.alignAttributes,
        hideCausality: ui?.hideCausalityData ?? DEFAULT_EDITOR_SETTINGS.hideCausality,
        showLineNumbers: ui?.showLineNumbers ?? DEFAULT_EDITOR_SETTINGS.showLineNumbers,
        showMinimap: ui?.showMinimap ?? DEFAULT_EDITOR_SETTINGS.showMinimap,
        fontSize: ui?.editorFontSize ?? DEFAULT_EDITOR_SETTINGS.fontSize,
        fontFamily: ui?.editorFontFamily ?? DEFAULT_EDITOR_SETTINGS.fontFamily,
        prettyPrint: ui?.prettyPrint ?? DEFAULT_EDITOR_SETTINGS.prettyPrint,
    };
}

export function editorSettingsToUiConfig(settings: EditorSettings): UiConfigSlice {
    return {
        showLineNumbers: settings.showLineNumbers,
        alignAttributes: settings.alignAttributes,
        inlineElementValues: settings.inlineValues,
        showMinimap: settings.showMinimap,
        prettyPrint: settings.prettyPrint,
        hideCausalityData: settings.hideCausality,
        editorFontSize: settings.fontSize,
        editorFontFamily: settings.fontFamily,
    };
}

interface EditorSettingsContextValue {
    settings: EditorSettings;
    updateSettings: (updates: Partial<EditorSettings>) => void;
    /**
     * Replace the whole settings object from an external source — the config store.
     *
     * The provider is seeded once, so without this a change made elsewhere (the
     * Settings → JSON editor, or the General panel's line-numbers toggle) would leave
     * the editors showing a stale value. It is called from the backend message
     * handler, which is an external-system callback rather than an effect.
     */
    applySettings: (settings: EditorSettings) => void;
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

    const applySettings = useCallback((next: EditorSettings) => {
        setSettings(next);
    }, []);

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
        applySettings,
        toggleInlineValues,
        toggleAlignAttributes,
        toggleHideCausality,
        toggleLineNumbers,
        toggleMinimap,
        togglePrettyPrint
    }), [
        settings,
        updateSettings,
        applySettings,
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
