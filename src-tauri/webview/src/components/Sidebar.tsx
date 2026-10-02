import React from 'react';
import styled from 'styled-components';
import { SidebarView } from '@shared/models';

// Components
import { TestsUi } from './sidebar/TestsUi';
import { WorkflowsUi } from './sidebar/WorkflowsUi';
import { PerformanceUi } from './sidebar/PerformanceUi';
import { ScrapbookPanel } from './sidebar/ScrapbookPanel';
import { NotesList } from './sidebar/NotesList';
import { SidebarRail } from './sidebar/SidebarRail';
import { UnifiedExplorerSidebar } from './explorer/UnifiedExplorerSidebar';
import { useSidebarContext } from '../contexts/SidebarContext';

// Sidebar resize bounds (percent of the window width). The width is stored as
// a fraction so it tracks window resizes and stays inside the band.
const SIDEBAR_MIN_PCT = 5;
const SIDEBAR_MAX_PCT = 25;
const SIDEBAR_DEFAULT_PCT = 15;
const SIDEBAR_WIDTH_KEY = 'apinox_sidebar_width_pct';

const clampSidebarPct = (pct: number): number =>
    Math.max(SIDEBAR_MIN_PCT, Math.min(SIDEBAR_MAX_PCT, pct));

const loadSidebarPct = (): number => {
    try {
        const raw = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
        if (raw !== null) {
            const parsed = parseFloat(raw);
            if (!Number.isNaN(parsed)) return clampSidebarPct(parsed);
        }
    } catch {
        /* localStorage unavailable — fall through to the default. */
    }
    return SIDEBAR_DEFAULT_PCT;
};

const saveSidebarPct = (pct: number): void => {
    try {
        window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clampSidebarPct(pct)));
    } catch {
        /* Non-fatal: the width simply won't persist across restarts. */
    }
};

const SidebarContainer = styled.div<{ $collapsed: boolean; $width?: number }>`
    display: flex;
    height: 100%;
    flex-direction: row;
    /* When expanded the width is fully owned by the drag clamp (5–25% of the
       window); min-width 0 so it never fights the clamp down to the floor.
       Collapsed = rail-only (50px). */
    min-width: ${props => (props.$collapsed ? '50px' : '0')};
    width: ${props => (props.$collapsed ? '50px' : (props.$width ?? 15) + '%')};
    flex-shrink: 0;
    border-right: 1px solid var(--apinox-sideBarSectionHeader-border);
    background: var(--apinox-sideBar-background);
`;

/** The vertical divider you drag to resize the sidebar. It keeps a
    full-height hit area (grab anywhere along the edge) and adds a small
    visible grip centred vertically so the affordance is discoverable. The
    grip + hover use the real sidebar-border / focus tokens — the old
    `--color-primary` hover colour is a dead var that resolved to nothing,
    which is why the handle read as "not resizable". */
const ResizeHandle = styled.div`
    position: relative;
    width: 5px;
    height: 100%;
    flex-shrink: 0;
    cursor: col-resize;
    background: transparent;
    transition: background 0.15s ease;

    &:hover {
        background: var(--apinox-sideBarSectionHeader-border, rgba(128, 128, 128, 0.35));
    }

    /* Tiny drag grip centred half-way down. */
    &::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 2px;
        height: 28px;
        border-radius: 2px;
        background: var(--apinox-sideBarSectionHeader-border, rgba(128, 128, 128, 0.5));
        opacity: 0.7;
        pointer-events: none;
        transition: background 0.15s ease, opacity 0.15s ease;
    }

    &:hover::after {
        background: var(--apinox-focusBorder, rgba(128, 128, 128, 0.9));
        opacity: 1;
    }
`;

const SidebarContent = styled.div<{ $hidden: boolean }>`
    flex: ${props => props.$hidden ? 0 : 1};
    display: ${props => props.$hidden ? 'none' : 'flex'};
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    background-color: var(--apinox-sideBar-background);
`;

export const Sidebar: React.FC = () => {
    // Percentage of the window width, seeded from localStorage so the last
    // chosen width is restored on startup.
    const [sidebarWidth, setSidebarWidth] = React.useState<number>(() => loadSidebarPct());
    const isResizing = React.useRef(false);
    // Mirrors the live dragged width so handleResizeEnd can persist the final
    // value (the closure only captures startWidth, not the latest).
    const liveWidthRef = React.useRef(sidebarWidth);
    liveWidthRef.current = sidebarWidth;

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        const startX = e.clientX;
        const startWidth = sidebarWidth;
        const startViewport = window.innerWidth || 1;

        const handleResizeMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const delta = e.clientX - startX;
            const viewport = window.innerWidth || startViewport;
            // Convert the starting percentage to px, apply the pointer delta,
            // convert back and clamp to the 5–25% band.
            const startPx = (startWidth / 100) * startViewport;
            const next = clampSidebarPct(((startPx + delta) / viewport) * 100);
            liveWidthRef.current = next;
            setSidebarWidth(next);
        };

        const handleResizeEnd = () => {
            isResizing.current = false;
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
            saveSidebarPct(liveWidthRef.current);
        };

        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
    };
    const {
        testsProps,
        workflowsProps,
        performanceProps,
        unifiedProps,
        onOpenSettings,
        onOpenHelp,
        activeView,
        onChangeView,
        sidebarExpanded,
        activeEnvironment,
        environments,
        onChangeEnvironment,
        isMobileOpen,
        onMobileClose,
        hasUpdate,
    } = useSidebarContext();

    // Phase B (t_86c34d38): the PROJECTS view (ProjectList) was deleted —
    // projectProps / the selectionProps destructures it consumed are gone with
    // it. Request history followed the same path: its top-level rail view
    // (SidebarView.HISTORY) was folded into the unified explorer as the
    // History sub-window, so no HistorySidebar branch remains here. The
    // remaining sidebar children (Tests/Workflows/Performance/Unified) use
    // their own prop groups below.

    const fullPanelView = activeView === SidebarView.PROXY || activeView === SidebarView.MOCK || activeView === SidebarView.WATCHER || activeView === SidebarView.SETTINGS;
    const hideContent = !sidebarExpanded || fullPanelView;

    return (
        <SidebarContainer
            $collapsed={hideContent}
            $width={sidebarWidth}
            className={`sidebar-drawer${isMobileOpen ? ' sidebar-open' : ''}`}
        >
            <SidebarRail
                activeView={activeView}
                onChangeView={onChangeView}
                onOpenSettings={onOpenSettings}
                onOpenHelp={onOpenHelp}
                activeEnvironment={activeEnvironment}
                environments={environments}
                onChangeEnvironment={onChangeEnvironment}
                onMobileClose={onMobileClose}
                hasUpdate={hasUpdate}
            />

            {/* Content Area */}
            <SidebarContent $hidden={hideContent}>

                {activeView === SidebarView.TESTS && (
                    <TestsUi
                        projects={testsProps.projects}
                        testSuites={testsProps.testSuites}
                        selectedTestSuite={testsProps.selectedTestSuite}
                        selectedTestCase={testsProps.selectedTestCase}
                        onAddSuite={testsProps.onAddSuite}
                        onDeleteSuite={testsProps.onDeleteSuite}
                        onRunSuite={testsProps.onRunSuite}
                        onAddTestCase={testsProps.onAddTestCase}
                        onDeleteTestCase={testsProps.onDeleteTestCase}
                        onRenameTestCase={testsProps.onRenameTestCase}
                        onRenameSuite={testsProps.onRenameSuite}
                        onRunCase={testsProps.onRunCase}
                        onSelectSuite={testsProps.onSelectSuite}
                        onSelectTestCase={testsProps.onSelectTestCase}
                        onToggleSuiteExpand={testsProps.onToggleSuiteExpand}
                        onToggleCaseExpand={testsProps.onToggleCaseExpand}
                        onSelectTestStep={testsProps.onSelectTestStep}
                        onRenameTestStep={testsProps.onRenameTestStep}
                        deleteConfirm={testsProps.deleteConfirm}
                    />
                )}

                {activeView === SidebarView.WORKFLOWS && workflowsProps && (
                    <WorkflowsUi
                        {...workflowsProps}
                    />
                )}

                {activeView === SidebarView.PERFORMANCE && performanceProps && (
                    <PerformanceUi
                        {...performanceProps}
                    />
                )}

                {activeView === SidebarView.NOTES && (
                    <NotesList />
                )}

                {unifiedProps && (
                    <div style={{ display: activeView === SidebarView.UNIFIED_EXPLORER ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
                        <UnifiedExplorerSidebar
                            projects={unifiedProps.projects}
                            selectedNode={unifiedProps.selectedNode}
                            onSelectNode={unifiedProps.onSelectNode}
                            onRefreshProject={unifiedProps.onRefreshProject}
                            onDeleteProject={unifiedProps.onDeleteProject}
                            onDeleteOperation={unifiedProps.onDeleteOperation}
                            onDeleteRequest={unifiedProps.onDeleteRequest}
                            onNewRequest={unifiedProps.onNewRequest}
                            onRenameProject={unifiedProps.onRenameProject}
                            onRenameOperation={unifiedProps.onRenameOperation}
                            onRenameRequest={unifiedProps.onRenameRequest}
                            onExportProject={unifiedProps.onExportProject}
                            onExportWorkspace={unifiedProps.onExportWorkspace}
                            onBulkImport={unifiedProps.onBulkImport}
                            onImportSoapUI={unifiedProps.onImportSoapUI}
                            onImportWorkspace={unifiedProps.onImportWorkspace}
                            onGenerateTestSuite={unifiedProps.onGenerateTestSuite}
                            onAddRequestToTestCase={unifiedProps.onAddRequestToTestCase}
                            onReorderOperation={unifiedProps.onReorderOperation}
                            onReorderRequest={unifiedProps.onReorderRequest}
                            scrapbook={unifiedProps.scrapbook}
                            history={unifiedProps.history}
                        />
                    </div>
                )}

            </SidebarContent>
            <ResizeHandle onMouseDown={handleResizeStart} data-testid="sidebar-resize-handle" />
        </SidebarContainer>
    );
};
