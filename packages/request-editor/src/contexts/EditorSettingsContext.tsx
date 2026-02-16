import { createContext, useContext, useState, ReactNode } from 'react';

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

    const updateSettings = (updates: Partial<EditorSettings>) => {
        setSettings(prev => {
            const newSettings = { ...prev, ...updates };
            onSettingsChange?.(newSettings);
            return newSettings;
        });
    };

    const toggleInlineValues = () => {
        updateSettings({ inlineValues: !settings.inlineValues });
    };

    const toggleAlignAttributes = () => {
        updateSettings({ alignAttributes: !settings.alignAttributes });
    };

    const toggleHideCausality = () => {
        updateSettings({ hideCausality: !settings.hideCausality });
    };

    const toggleLineNumbers = () => {
        updateSettings({ showLineNumbers: !settings.showLineNumbers });
    };

    const toggleMinimap = () => {
        updateSettings({ showMinimap: !settings.showMinimap });
    };

    const togglePrettyPrint = () => {
        updateSettings({ prettyPrint: !settings.prettyPrint });
    };

    return (
        <EditorSettingsContext.Provider value={{
            settings,
            updateSettings,
            toggleInlineValues,
            toggleAlignAttributes,
            toggleHideCausality,
            toggleLineNumbers,
            toggleMinimap,
            togglePrettyPrint
        }}>
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
