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
    const [platformOS, setPlatformOS] = useState<'macos' | 'windows' | 'linux' | 'android' | 'ios' | 'unknown'>('macos');
    
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

                // Apply platform attribute to body for platform-specific CSS targeting
                document.body.dataset.platform = os;

                // iOS WKWebView: prevent the native UIScrollView from scrolling the
                // whole page. We prevent touchmove on the document unless the touch
                // is inside an element that actually has scrollable overflow.
                if (os === 'ios') {
                    const isScrollable = (el: Element): boolean => {
                        const style = window.getComputedStyle(el);
                        const overflow = style.overflow + style.overflowY + style.overflowX;
                        if (!/(auto|scroll)/.test(overflow)) return false;
                        return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
                    };
                    document.addEventListener('touchmove', (e) => {
                        let target = e.target as Element | null;
                        while (target && target !== document.documentElement) {
                            if (isScrollable(target)) return; // let the element handle it
                            target = target.parentElement;
                        }
                        e.preventDefault();
                    }, { passive: false });
                }

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
    
    // Mobile platforms don't need the custom desktop titlebar (no window controls, no drag region)
    const isMobilePlatform = platformOS === 'android' || platformOS === 'ios';
    const showCustomTitleBar = platformOS !== 'macos' && !isMobilePlatform;
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
