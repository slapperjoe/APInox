import React, { createContext, useContext, useState, useEffect, startTransition, ReactNode } from 'react';
import { SidebarView } from '@shared/models';
import { BackendCommand } from '@shared/messages';

interface NavigationContextType {
    activeView: SidebarView;
    setActiveView: React.Dispatch<React.SetStateAction<SidebarView>>;
    sidebarExpanded: boolean;
    setSidebarExpanded: (expanded: boolean) => void;
    toggleSidebar: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error('useNavigation must be used within a NavigationProvider');
    }
    return context;
};

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
    const [activeView, _setActiveView] = useState<SidebarView>(SidebarView.UNIFIED_EXPLORER);
    const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(true);

    const toggleSidebar = () => setSidebarExpanded(prev => !prev);

    // Wrap setActiveView in startTransition to handle lazy-loaded views
    // This prevents "component suspended while responding to synchronous input" errors
    // when switching to views that contain React.lazy components (NotesEditor, ProxyPanel, etc.)
    const setActiveView = (view: React.SetStateAction<SidebarView>) => {
        startTransition(() => {
            _setActiveView(view);
        });
    };

    // Message Handling
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case BackendCommand.ToggleSidebar:
                    setSidebarExpanded(prev => !prev);
                    break;
                case BackendCommand.SwitchToView:
                    if (message.view) {
                        // Map string to SidebarView enum if necessary, or assume direct match
                        // The backend might send string 'explorer', 'tests', etc.
                        // Phase B (t_86c34d38): the legacy PROJECTS view is
                        // deleted. The 'projects' deep-link key is retained
                        // (backward compat) and now resolves to the unified
                        // explorer — the sole project surface.
                        const viewMap: Record<string, SidebarView> = {
                            'explorer': SidebarView.UNIFIED_EXPLORER,
                            'unified_explorer': SidebarView.UNIFIED_EXPLORER,
                            'projects': SidebarView.UNIFIED_EXPLORER,
                            'proxy': SidebarView.PROXY,
                            'mock': SidebarView.MOCK,
                            'watcher': SidebarView.WATCHER,
                            'tests': SidebarView.TESTS,
                            'performance': SidebarView.PERFORMANCE,
                            'history': SidebarView.HISTORY,
                            'settings': SidebarView.SETTINGS
                        };
                        const view = viewMap[message.view] || message.view as SidebarView;
                        setActiveView(view);
                        setSidebarExpanded(true); // Auto-expand when switching view
                    }
                    break;
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return (
        <NavigationContext.Provider value={{
            activeView,
            setActiveView,
            sidebarExpanded,
            setSidebarExpanded,
            toggleSidebar
        }}>
            {children}
        </NavigationContext.Provider>
    );
};
