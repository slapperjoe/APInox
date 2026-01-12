import React, { createContext, useContext, useState, ReactNode } from 'react';
import { SidebarView } from '@shared/models';

interface NavigationContextValue {
    activeView: SidebarView;
    setActiveView: React.Dispatch<React.SetStateAction<SidebarView>>;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
    const [activeView, setActiveView] = useState<SidebarView>(SidebarView.PROJECTS);

    return (
        <NavigationContext.Provider value={{ activeView, setActiveView }}>
            {children}
        </NavigationContext.Provider>
    );
}

export function useNavigation() {
    const context = useContext(NavigationContext);
    if (!context) throw new Error('useNavigation must be used within NavigationProvider');
    return context;
}
