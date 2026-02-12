// import React from 'react'; // React 17+ JSX transform doesn't need React in scope
import { useState, useEffect } from 'react';
import { ThemeProvider } from '@apinox/request-editor'; // Use package ThemeProvider so editors get theme
import { ProjectProvider } from './contexts/ProjectContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { UIProvider } from './contexts/UIContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { TestRunnerProvider } from './contexts/TestRunnerContext';
import { PerformanceProvider } from './contexts/PerformanceContext';
import { SearchProvider } from './contexts/SearchContext';
import { ScrapbookProvider } from './contexts/ScrapbookContext';
import MainContent from './components/MainContent';
import { DebugIndicator } from './components/DebugIndicator';
import TitleBar from './components/TitleBar';
import { MacOSTitleBarSearch } from './components/MacOSTitleBarSearch';

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
        <ThemeProvider>
            <ProjectProvider>
                <SelectionProvider>
                    <UIProvider>
                        <NavigationProvider>
                            <ScrapbookProvider>
                                <TestRunnerProvider>
                                    <PerformanceProvider>
                                        <SearchProvider>
                                            {showCustomTitleBar && <TitleBar />}
                                            {showMacOSSearchBar && <MacOSTitleBarSearch />}
                                            <DebugIndicator />
                                            <MainContent />
                                        </SearchProvider>
                                    </PerformanceProvider>
                                </TestRunnerProvider>
                            </ScrapbookProvider>
                        </NavigationProvider>
                    </UIProvider>
                </SelectionProvider>
            </ProjectProvider>
        </ThemeProvider>
    );
}
