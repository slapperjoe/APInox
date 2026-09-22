// import React from 'react'; // React 17+ JSX transform doesn't need React in scope
import { useState, useEffect } from 'react';
import { debugLog } from './utils/logger';
import { ThemeProvider, EditorSettingsProvider, ErrorBoundary } from '@apinox/request-editor/core'; // Use package providers
import type { EditorSettings } from '@apinox/request-editor/core';
import { applyUIFont, UIFontValue } from './utils/fontLoader';
import { ProjectProvider } from './contexts/ProjectContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { UIProvider } from './contexts/UIContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { UnifiedProjectProvider } from './contexts/UnifiedProjectContext';
import { TestRunnerProvider } from './contexts/TestRunnerContext';
import { PerformanceProvider } from './contexts/PerformanceContext';
import { SearchProvider } from './contexts/SearchContext';
import { ScrapbookProvider } from './contexts/ScrapbookContext';
import { TestSuiteProvider } from './contexts/TestSuiteContext';
import MainContent from './components/MainContent';
import { DebugIndicator } from './components/DebugIndicator';
import TitleBar from './components/TitleBar';
import { MacOSTitleBarSearch } from './components/MacOSTitleBarSearch';

// Editor settings persistence
const EDITOR_SETTINGS_KEY = 'apinox-editor-settings';

// Apply saved UI font on startup
const savedUIFont = localStorage.getItem('apinox-ui-font') as UIFontValue | null;
applyUIFont(savedUIFont ?? 'fira-code');

function loadEditorSettings(): EditorSettings | undefined {
    try {
        const stored = localStorage.getItem(EDITOR_SETTINGS_KEY);
        return stored ? JSON.parse(stored) : undefined;
    } catch (err) {
        console.error('Failed to load editor settings:', err);
        return undefined;
    }
}

function saveEditorSettings(settings: EditorSettings): void {
    try {
        localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
        console.error('Failed to save editor settings:', err);
    }
}

export default function App() {
    // TEMPORARY: Hardcode macOS detection since Tauri API isn't loading properly
    const [platformOS, setPlatformOS] = useState<'macos' | 'windows' | 'linux' | 'unknown'>('macos');

    // Keep body[data-platform] in sync so CSS can target platform-specific rules immediately.
    useEffect(() => {
        document.body.dataset.platform = platformOS;
    }, [platformOS]);
    
    useEffect(() => {
        async function detectPlatform() {
            try {
                debugLog('[App] Starting platform detection');
                
                // Try to import and invoke directly (Tauri v2 doesn't always set window.__TAURI__)
                const { invoke } = await import('@tauri-apps/api/core');
                const os = await invoke<string>('get_platform_os');
                debugLog('[App] Platform detected', os);
                setPlatformOS(os as any);

                // Apply platform attribute to body for platform-specific CSS targeting
                document.body.dataset.platform = os;

                // Close splashscreen and show main window once app is ready
                invoke('close_splashscreen').catch(() => {
                    // No splashscreen in dev/browser context, ignore
                });
            } catch (err) {
                console.log('⚠️ Tauri not detected (running in browser or invoke failed)');
                console.error('❌ Error:', err);
            }
        }
        detectPlatform();
    }, []);
    
    const showCustomTitleBar = platformOS !== 'macos';
    const showMacOSSearchBar = platformOS === 'macos';
    
    return (
        <ThemeProvider standalone={true}>
            <EditorSettingsProvider
                initialSettings={loadEditorSettings()}
                onSettingsChange={saveEditorSettings}
            >
                <ProjectProvider>
                <SelectionProvider>
                    <UIProvider>
                        <NavigationProvider>
                            <ScrapbookProvider>
                                <UnifiedProjectProvider>
                                <TestSuiteProvider>
                                    <TestRunnerProvider>
                                    <PerformanceProvider>
                                        <SearchProvider>
                                            {showCustomTitleBar && <TitleBar />}
                                            {showMacOSSearchBar && <MacOSTitleBarSearch />}
                                            <DebugIndicator />
                                            <ErrorBoundary
                                                onError={(error, errorInfo) => {
                                                    console.error('💥 Application Error:', error);
                                                    console.error('Component Stack:', errorInfo.componentStack);
                                                }}
                                            >
                                                <MainContent />
                                            </ErrorBoundary>
                                        </SearchProvider>
                                    </PerformanceProvider>
                                    </TestRunnerProvider>
                                </TestSuiteProvider>
                                </UnifiedProjectProvider>
                            </ScrapbookProvider>
                        </NavigationProvider>
                    </UIProvider>
                    </SelectionProvider>
                </ProjectProvider>
            </EditorSettingsProvider>
        </ThemeProvider>
    );
}
