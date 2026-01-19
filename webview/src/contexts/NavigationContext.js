import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect } from 'react';
import { SidebarView } from '@shared/models';
import { BackendCommand } from '@shared/messages';
const NavigationContext = createContext(undefined);
export const useNavigation = () => {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error('useNavigation must be used within a NavigationProvider');
    }
    return context;
};
export const NavigationProvider = ({ children }) => {
    const [activeView, setActiveView] = useState(SidebarView.EXPLORER);
    const [sidebarExpanded, setSidebarExpanded] = useState(true);
    const toggleSidebar = () => setSidebarExpanded(prev => !prev);
    // Message Handling
    useEffect(() => {
        const handleMessage = (event) => {
            const message = event.data;
            switch (message.command) {
                case BackendCommand.ToggleSidebar:
                    setSidebarExpanded(prev => !prev);
                    break;
                case BackendCommand.SwitchToView:
                    if (message.view) {
                        // Map string to SidebarView enum if necessary, or assume direct match
                        // The backend might send string 'explorer', 'tests', etc.
                        const viewMap = {
                            'explorer': SidebarView.EXPLORER,
                            'home': SidebarView.HOME,
                            'projects': SidebarView.PROJECTS,
                            'mock': SidebarView.SERVER, // Mapped to Server
                            'proxy': SidebarView.SERVER, // Mapped to Server
                            'debug': SidebarView.WATCHER, // Mapped to Watcher
                            'tests': SidebarView.TESTS,
                            'performance': SidebarView.PERFORMANCE,
                            'history': SidebarView.HISTORY
                        };
                        const view = viewMap[message.view] || message.view;
                        setActiveView(view);
                        setSidebarExpanded(true); // Auto-expand when switching view
                    }
                    break;
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);
    return (_jsx(NavigationContext.Provider, { value: {
            activeView,
            setActiveView,
            sidebarExpanded,
            setSidebarExpanded,
            toggleSidebar
        }, children: children }));
};
