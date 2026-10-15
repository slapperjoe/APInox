/**
 * SidebarContext - Composite context for sidebar components
 *
 * Mirrors the SidebarProps interface so that Sidebar (and its sub-components)
 * can access all sidebar state directly from context instead of receiving
 * 120+ props through the component tree.
 *
 * @module SidebarContext
 */

import { createContext, useContext } from 'react';
import type { SidebarView } from '@shared/models';
import type {
    SidebarTestsProps,
    SidebarPerformanceProps,
    SidebarUnifiedProps,
} from '../types/props';

export interface SidebarContextValue {
    // ==================== PROP GROUPS (passed to sub-components) ====================
    // Phase B (t_86c34d38): SidebarProjectProps / SidebarSelectionProps (projectProps,
    // selectionProps) were deleted with the PROJECTS view (ProjectList). The WORKFLOWS
    // group went with the WORKFLOWS view (workflows were absorbed into test cases); the
    // remaining sidebar children (tests/performance/history/unified) use their own groups.
    testsProps: SidebarTestsProps;
    performanceProps?: SidebarPerformanceProps;
    unifiedProps?: SidebarUnifiedProps;

    // ==================== VIEW STATE ====================
    activeView: SidebarView;
    onChangeView: (view: SidebarView) => void;
    sidebarExpanded: boolean;

    // ==================== GLOBAL STATE ====================
    backendConnected: boolean;
    // Phase B (t_86c34d38): workspaceDirty was removed — its only sidebar
    // consumer (the deleted ProjectList view) is gone; MainContent still
    // manages the dirty flag for auto-save via ProjectContext.
    showBackendStatus?: boolean;
    onSaveUiState?: () => void;
    onOpenSettings?: () => void;
    onOpenHelp?: () => void;
    hasUpdate?: boolean;
    /** True while the proxy is actively capturing traffic — drives the live dot on the rail's traffic entry. */
    trafficCapturing?: boolean;
    /** True while the full-screen traffic→test-case wizard is open. Disables
        the whole sidebar (dimmed, pointer-events off, navigation ignored) so
        the only way out of the wizard is its own "Cancel". */
    sidebarLocked?: boolean;

    // ==================== ENVIRONMENT ====================
    activeEnvironment?: string;
    environments?: Record<string, any>;
    onChangeEnvironment?: (env: string) => void;

    // ==================== MOBILE ====================
    isMobileOpen?: boolean;
    onMobileClose?: () => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

/**
 * Custom hook for consuming SidebarContext.
 *
 * @returns SidebarContextValue with all sidebar state and actions
 * @throws Error if used outside a SidebarContext.Provider
 *
 * @example
 * ```typescript
 * function MySidebarComponent() {
 *     const { projectProps, activeView, onChangeView } = useSidebarContext();
 * }
 * ```
 */
export const useSidebarContext = (): SidebarContextValue => {
    const ctx = useContext(SidebarContext);
    if (!ctx) {
        throw new Error('useSidebarContext must be used within a SidebarContext.Provider');
    }
    return ctx;
};

export { SidebarContext };
