// import React from 'react'; // React 17+ JSX transform doesn't need React in scope
import { useState, useEffect } from 'react';
import { ThemeProvider, EditorSettingsProvider, ErrorBoundary } from '@apinox/request-editor'; // Use package providers
import type { EditorSettings } from '@apinox/request-editor';
import { ProjectProvider } from './contexts/ProjectContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { UIProvider } from './contexts/UIContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { TestRunnerProvider } from './contexts/TestRunnerContext';
import { SearchProvider } from './contexts/SearchContext';
import { ScrapbookProvider } from './contexts/ScrapbookContext';
import MainContent from './components/MainContent';
import { DebugIndicator } from './components/DebugIndicator';
import TitleBar from './components/TitleBar';
import { MacOSTitleBarSearch } from './components/MacOSTitleBarSearch';

// Editor settings persistence
const EDITOR_SETTINGS_KEY = 'apinox-editor-settings';

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
    
    useEffect(() => {
        async function detectPlatform() {
            try {
                console.log('🔧 Starting platform detection...');
                
                // Try to import and invoke directly (Tauri v2 doesn't always set window.__TAURI__)
                const { invoke } = await import('@tauri-apps/api/core');
                console.log('🔧 Tauri API imported successfully');
                
                const os = await invoke<string>('get_platform_os');
                console.log('🔍 Platform detected:', os);
                setPlatformOS(os as any);
            } catch (err) {
                console.log('⚠️ Tauri not detected (running in browser or invoke failed)');
                console.error('❌ Error:', err);
            }
        }
        detectPlatform();
    }, []);
    
    // Hide custom titlebar on macOS (use native), but show search bar overlay
    const showCustomTitleBar = platformOS !== 'macos';
    const showMacOSSearchBar = platformOS === 'macos';
    
    console.log('📱 App render - platformOS:', platformOS, 'showCustomTitleBar:', showCustomTitleBar, 'showMacOSSearchBar:', showMacOSSearchBar);
    
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
                                <TestRunnerProvider>
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
                                </TestRunnerProvider>
                            </ScrapbookProvider>
                        </NavigationProvider>
                    </UIProvider>
                    </SelectionProvider>
                </ProjectProvider>
            </EditorSettingsProvider>
        </ThemeProvider>
    );
}
