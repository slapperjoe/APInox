import { jsx as _jsx } from "react/jsx-runtime";
/**
 * UIContext.tsx
 *
 * Centralizes UI configuration and layout state for the APInox application.
 * This context manages:
 * - Active sidebar view (projects, explorer, watcher, proxy)
 * - Layout preferences (vertical/horizontal, line numbers, etc.)
 * - Modal visibility states
 * - Settings and configuration
 *
 * Usage:
 *   1. Wrap your app with <UIProvider>
 *   2. Access state and actions via useUI() hook
 *
 * Example:
 *   const { activeView, setActiveView, layoutMode, toggleLayout } = useUI();
 */
import { createContext, useContext, useState, useCallback } from 'react';
import { bridge } from '../utils/bridge';
// =============================================================================
// CONTEXT CREATION
// =============================================================================
const UIContext = createContext(undefined);
/**
 * Provider component that manages UI state.
 * Wrap your application (or relevant portion) with this provider.
 */
export function UIProvider({ children }) {
    // -------------------------------------------------------------------------
    // VIEW STATE - Moved to NavigationContext
    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // LAYOUT STATE
    // -------------------------------------------------------------------------
    const [layoutMode, setLayoutMode] = useState('vertical');
    const [showLineNumbers, setShowLineNumbers] = useState(true);
    const [inlineElementValues, setInlineElementValues] = useState(false);
    const [hideCausalityData, setHideCausalityData] = useState(false);
    const [splitRatio, setSplitRatio] = useState(0.5);
    const [isResizing, setIsResizing] = useState(false);
    // -------------------------------------------------------------------------
    // MODAL STATE
    // -------------------------------------------------------------------------
    const [showSettings, setShowSettings] = useState(false);
    const [initialSettingsTab, setInitialSettingsTab] = useState(null);
    const [showHelp, setShowHelp] = useState(false);
    const [helpSection, setHelpSection] = useState(null);
    const [showDevOpsModal, setShowDevOpsModal] = useState(false);
    // -------------------------------------------------------------------------
    // CONFIGURATION STATE
    // -------------------------------------------------------------------------
    const [config, setConfig] = useState(null);
    const [rawConfig, setRawConfig] = useState('');
    const [configPath, setConfigPath] = useState(null);
    // -------------------------------------------------------------------------
    // ACTIONS
    // -------------------------------------------------------------------------
    /**
     * Toggle between vertical and horizontal layout modes.
     * Saves preference to backend for persistence.
     */
    const toggleLayout = useCallback(() => {
        setLayoutMode(prev => {
            const next = prev === 'vertical' ? 'horizontal' : 'vertical';
            bridge.sendMessage({ command: 'saveUiState', ui: { layoutMode: next } });
            return next;
        });
    }, []);
    /**
     * Toggle line numbers visibility in editors.
     */
    const toggleLineNumbers = useCallback(() => {
        setShowLineNumbers(prev => {
            const next = !prev;
            bridge.sendMessage({ command: 'saveUiState', ui: { showLineNumbers: next } });
            return next;
        });
    }, []);
    /**
     * Open settings modal, optionally on a specific tab.
     */
    const openSettings = useCallback((tab) => {
        setInitialSettingsTab(tab || null);
        setShowSettings(true);
    }, []);
    /**
     * Open help modal, optionally to a specific section.
     */
    const openHelp = useCallback((sectionId) => {
        setHelpSection(sectionId || null);
        setShowHelp(true);
    }, []);
    // -------------------------------------------------------------------------
    // CONTEXT VALUE
    // -------------------------------------------------------------------------
    const value = {
        // View State - Moved to NavigationContext
        // Layout State
        layoutMode,
        setLayoutMode,
        toggleLayout,
        showLineNumbers,
        setShowLineNumbers,
        toggleLineNumbers,
        inlineElementValues,
        setInlineElementValues,
        hideCausalityData,
        setHideCausalityData,
        splitRatio,
        setSplitRatio,
        isResizing,
        setIsResizing,
        // Modal State
        showSettings,
        setShowSettings,
        initialSettingsTab,
        setInitialSettingsTab,
        openSettings,
        showHelp,
        setShowHelp,
        helpSection,
        setHelpSection,
        openHelp,
        showDevOpsModal,
        setShowDevOpsModal,
        // Configuration State
        config,
        setConfig,
        rawConfig,
        setRawConfig,
        configPath,
        setConfigPath
    };
    return (_jsx(UIContext.Provider, { value: value, children: children }));
}
// =============================================================================
// HOOK
// =============================================================================
/**
 * Hook to access UI context.
 * Must be used within a UIProvider.
 *
 * @throws Error if used outside of UIProvider
 *
 * @example
 * function Toolbar() {
 *     const { layoutMode, toggleLayout } = useUI();
 *     return <button onClick={toggleLayout}>{layoutMode}</button>;
 * }
 */
export function useUI() {
    const context = useContext(UIContext);
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
}
