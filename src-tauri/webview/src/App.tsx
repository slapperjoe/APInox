import { useState, useEffect, type ReactNode } from 'react';
import { debugLog } from './utils/logger';
import { bridge } from './utils/bridge';
import {
    ThemeProvider,
    EditorSettingsProvider,
    ErrorBoundary,
    editorSettingsFromConfig,
    editorSettingsToUiConfig,
} from './request-editor/core'; // Use package providers
import { applyUIFont, UIFontValue } from './utils/fontLoader';
import { ProjectProvider } from './contexts/ProjectContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { UIProvider, useUI } from './contexts/UIContext';
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

// Apply saved UI font on startup
const savedUIFont = localStorage.getItem('apinox-ui-font') as UIFontValue | null;
applyUIFont(savedUIFont ?? 'fira-code');

/**
 * Editor settings live in `config.ui` — the same store every other UI setting uses.
 *
 * They used to live in `localStorage`, which meant the same setting had two sources
 * of truth: the notes gear and the proxy editor read the app-level provider
 * (localStorage), while the request editor read and wrote `config.ui`. They agreed
 * only when both started from defaults. One store now, and the mapping is the shared
 * one in `EditorSettingsContext`.
 */
function EditorSettingsStore({ children }: { children: ReactNode }) {
    const { config } = useUI();

    return (
        <EditorSettingsProvider
            initialSettings={editorSettingsFromConfig(config?.ui)}
            onSettingsChange={(settings) => {
                bridge.sendMessage({
                    command: 'saveUiState',
                    ui: { ...config?.ui, ...editorSettingsToUiConfig(settings) },
                });
            }}
        >
            {children}
        </EditorSettingsProvider>
    );
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
            <ProjectProvider>
            <SelectionProvider>
                <UIProvider>
                    {/* Inside UIProvider: the settings store reads `config`. */}
                    <EditorSettingsStore>
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
                    </EditorSettingsStore>
                </UIProvider>
                </SelectionProvider>
            </ProjectProvider>
        </ThemeProvider>
    );
}
