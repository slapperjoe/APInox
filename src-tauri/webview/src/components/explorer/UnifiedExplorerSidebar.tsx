import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import {
    ArrowRight,
    ChevronRight,
    ChevronDown,
    ChevronLeft,
    FolderOpen,
    FolderInput,
    FileCode,
    File,
    Server,
    FlaskConical as FlaskConicalIcon,
    X,
} from 'lucide-react';
import { UnifiedProject, ApiOperation, ApiRequest, ScrapbookRequest, RequestHistoryEntry } from '@shared/models';
import { SidebarContextMenu, CtxMenuSection, CtxMenuItem } from '../sidebar/shared/SidebarContextMenu';
import { HeaderButton } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { InlineFormInput } from '../common/Form';
import {
    Copy,
    Link,
    Plus as PlusIcon,
    Download as DownloadIcon,
    Trash2 as Trash2Icon,
    RefreshCw as RefreshCwIcon,
    Pencil as PencilIcon,
} from '../sidebar/shared/SidebarContextMenu';
import { ScrapbookPanel } from '../sidebar/ScrapbookPanel';
import { UnifiedHistoryPanel } from './UnifiedHistoryPanel';
import { RenameModal } from '../modals/RenameModal';
import { Spinner } from '../common/Spinner';
import { SectionLabel } from '../common/SectionLabel';
import { useUnifiedProjectsSafe } from '../../contexts/UnifiedProjectContext';
import { useReorderDrag, ReorderGapRow } from '../../hooks/useReorderDrag';

// Find the closest TreeItem row from a drop event that landed between rows.
// Walks up from elementFromPoint to find an element with data-drop-index.
const findClosestDropRow = (x: number, y: number): HTMLElement | null => {
    const elements = document.elementsFromPoint(x, y);
    for (const el of elements) {
        if (el instanceof HTMLElement && el.dataset.dropIndex !== undefined) {
            return el;
        }
    }
    for (const offset of [-6, 6, -12, 12, -18, 18]) {
        const nearby = document.elementsFromPoint(x, y + offset);
        for (const el of nearby) {
            if (el instanceof HTMLElement && el.dataset.dropIndex !== undefined) {
                return el;
            }
        }
    }
    return null;
};

// ── Quick Requests subwindow resize constants ───────────────────────────────
// The Quick Requests section is the bottom subwindow of the unified explorer
// sidebar. The handle between the project tree and the subwindow lets the user
// drag its height; the value is clamped to the min/max below while dragging.
// Default = current visible height: section header (~36px incl. border) +
// four request rows (~24px each) ≈ 132px — preserves the legacy "4 rows" view.
export const QUICK_REQUESTS_DEFAULT_HEIGHT = 132;
// Section header (36px) + at least one request row (~24px) so the subwindow
// always shows its header and a full row.
export const QUICK_REQUESTS_MIN_HEIGHT = 64;
export const clampQuickRequestsHeight = (h: number): number => {
    if (!Number.isFinite(h)) return QUICK_REQUESTS_DEFAULT_HEIGHT;
    return Math.min(600, Math.max(QUICK_REQUESTS_MIN_HEIGHT, Math.round(h)));
};

// ── Quick Requests subwindow height persistence (t_c0116422) ────────────────
// The height the user last dragged is stored in localStorage so it survives
// an app restart. Reads are clamped with clampQuickRequestsHeight, so a
// corrupt or out-of-range saved value can never break the layout (it falls
// back to the default or clamps to the UI min/max). Writes are guarded:
// storage can be unavailable (private mode, quota) and persistence is a
// best-effort nicety — the UI keeps working if a write is skipped.
export const QUICK_REQUESTS_HEIGHT_STORAGE_KEY = 'apinox_quick_requests_height';

export const loadQuickRequestsHeight = (): number => {
    try {
        const raw = window.localStorage.getItem(QUICK_REQUESTS_HEIGHT_STORAGE_KEY);
        if (raw === null || raw.trim() === '') return QUICK_REQUESTS_DEFAULT_HEIGHT;
        return clampQuickRequestsHeight(Number(raw));
    } catch {
        return QUICK_REQUESTS_DEFAULT_HEIGHT;
    }
};

export const saveQuickRequestsHeight = (height: number): void => {
    try {
        window.localStorage.setItem(QUICK_REQUESTS_HEIGHT_STORAGE_KEY, String(clampQuickRequestsHeight(height)));
    } catch {
        // Storage unavailable: skip persistence, the UI is unaffected.
    }
};

// ── History subwindow resize constants ──────────────────────────────────────
// The History section is the second bottom subwindow of the unified explorer
// sidebar, stacked ABOVE Quick Requests (Quick Requests stays bottom-most so
// its pinned drag math — distance from pointer to container bottom — is
// unchanged). Dragging the handle between the project tree and the History
// subwindow resizes History; the project tree and the Quick Requests window
// keep their heights.
// Default = header (~28px) + search bar (~30px) + three entry rows (~38px
// each) ≈ 174px — a useful "at a glance" view of recent executions.
export const HISTORY_DEFAULT_HEIGHT = 174;
// Header (~28px) + at least one entry row (~38px) so the subwindow always
// shows its header and a full row.
export const HISTORY_MIN_HEIGHT = 64;
export const clampHistoryHeight = (h: number): number => {
    if (!Number.isFinite(h)) return HISTORY_DEFAULT_HEIGHT;
    return Math.min(600, Math.max(HISTORY_MIN_HEIGHT, Math.round(h)));
};
// Minimum visible height reserved for the project tree while the History
// subwindow is present (it keeps the tree usable as History + Quick Requests
// share the bottom of the sidebar).
const HISTORY_TREE_MIN = 64;

// ── History subwindow height persistence ────────────────────────────────────
// Same contract as the Quick Requests persistence above: the last dragged
// height survives an app restart; corrupt/out-of-range saved values fall back
// to the default or clamp to the UI min/max; storage writes are best-effort.
export const HISTORY_HEIGHT_STORAGE_KEY = 'apinox_history_height';

export const loadHistoryHeight = (): number => {
    try {
        const raw = window.localStorage.getItem(HISTORY_HEIGHT_STORAGE_KEY);
        if (raw === null || raw.trim() === '') return HISTORY_DEFAULT_HEIGHT;
        return clampHistoryHeight(Number(raw));
    } catch {
        return HISTORY_DEFAULT_HEIGHT;
    }
};

export const saveHistoryHeight = (height: number): void => {
    try {
        window.localStorage.setItem(HISTORY_HEIGHT_STORAGE_KEY, String(clampHistoryHeight(height)));
    } catch {
        // Storage unavailable: skip persistence, the UI is unaffected.
    }
};

// ── Section collapse (accordion) persistence ────────────────────────────────
// Each of the three sections — the project tree ("Projects"), History and
// Quick Requests — is an accordion section: its header carries a chevron that
// collapses the body down to the header row. The per-section collapsed flags
// survive an app restart, so a layout the user tuned sticks across sessions.
// Malformed stored JSON falls back to everything expanded (the default the
// app has always shown).
export const SECTION_COLLAPSED_STORAGE_KEY = 'apinox_unified_section_collapsed';

export interface SectionCollapsedState {
    tree: boolean;
    history: boolean;
    quickRequests: boolean;
}

export const DEFAULT_SECTION_COLLAPSED: SectionCollapsedState = {
    tree: false,
    history: false,
    quickRequests: false,
};

export const loadSectionCollapsed = (): SectionCollapsedState => {
    try {
        const raw = window.localStorage.getItem(SECTION_COLLAPSED_STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SECTION_COLLAPSED };
        const parsed = JSON.parse(raw);
        return {
            tree: parsed?.tree === true,
            history: parsed?.history === true,
            quickRequests: parsed?.quickRequests === true,
        };
    } catch {
        return { ...DEFAULT_SECTION_COLLAPSED };
    }
};

export const saveSectionCollapsed = (state: SectionCollapsedState): void => {
    try {
        window.localStorage.setItem(SECTION_COLLAPSED_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage unavailable: skip persistence, the UI is unaffected.
    }
};

export interface TreeItemProps {
    label: string;
    type: 'project' | 'operation' | 'request';
    id?: string;
    expanded?: boolean;
    selected?: boolean;
    children?: React.ReactNode;
    onToggle?: () => void;
    onClick?: () => void;
    // Indentation level for tree nesting (0=project, 1=operation, 2=request)
    indentLevel?: number;
    // Drag-and-drop: set draggable for operations and requests
    draggable?: boolean;
    onDragStart?: (e: React.DragEvent<HTMLElement>) => void;
    onDragOver?: (e: React.DragEvent<HTMLElement>) => void;
    onDrop?: (e: React.DragEvent<HTMLElement>) => void;
    onDragEnd?: (e: React.DragEvent<HTMLElement>) => void;
    // Context menu
    onContextMenu?: (e: React.MouseEvent) => void;
    // Data attributes for drop-target identification
    dataDropType?: string;
    dataDropIndex?: number;
    dataDropParent?: string;
    // When set, this overrides the `hasChildren` heuristic for the
    // expand/collapse chevron. `TreeItem` normally derives "has children"
    // from `React.Children.count(children)`, but that counts child SLOTS —
    // a project/operation row always carries a trailing drag-drop gap row
    // (a `false`/array sibling) alongside its real children, so the count is
    // never 0 and the chevron would render even for an EMPTY project (nothing
    // to expand). Callers that know the true visible-child count pass it here
    // so an empty node omits its chevron.
    hasChildren?: boolean;
}

export const TreeItem: React.FC<TreeItemProps> = ({
    label,
    type,
    expanded = false,
    selected = false,
    children,
    onToggle,
    onClick,
    onContextMenu,
    indentLevel = 0,
    draggable = false,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    dataDropType,
    dataDropIndex,
    dataDropParent,
    hasChildren: hasChildrenOverride,
}) => {
    // Explicit override wins (a project/operation node passes its true
    // visible-child count, because the trailing drag-drop gap row makes the
    // raw `React.Children.count` non-zero even when nothing is expandable).
    // Otherwise fall back to the children heuristic — a leaf request row has
    // no children at all, and an empty node's gap row is the only sibling.
    const hasChildren =
        hasChildrenOverride !== undefined
            ? hasChildrenOverride
            : React.Children.count(children) > 0;

    const handleContextMenuInternal = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onContextMenu) onContextMenu(e);
    };

    const iconStyle = { width: 16, height: 16, flexShrink: 0 };

    let icon: React.ReactNode;
    let color: string;
    switch (type) {
        case 'project':
            icon = <Server size={18} style={iconStyle} />;
            color = 'var(--apinox-icon-foreground)';
            break;
        case 'operation':
            icon = <FolderOpen size={16} style={iconStyle} />;
            color = 'var(--apinox-descriptionForeground)';
            break;
        case 'request':
            icon = <FileCode size={16} style={iconStyle} />;
            color = 'var(--apinox-descriptionForeground)';
            break;
        default:
            icon = <File size={16} style={iconStyle} />;
            color = 'var(--apinox-descriptionForeground)';
    }

    // Indentation: 0px for project, 24px for operation, 48px for request
    const paddingLeft = indentLevel * 24;

    return (
        <>
            <div
                draggable={draggable}
                onClick={onClick}
                onContextMenu={handleContextMenuInternal}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                data-drop-type={dataDropType}
                data-drop-index={dataDropIndex}
                data-drop-parent={dataDropParent}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: `4px 8px 4px ${paddingLeft + 8}px`,
                    cursor: 'pointer',
                    backgroundColor: selected ? 'var(--apinox-list-activeSelectionBackground)' : 'transparent',
                    color: selected ? 'var(--apinox-list-activeSelectionForeground)' : 'inherit',
                    fontSize:
                        type === 'project'
                            ? 'var(--apinox-fs-md)'
                            : 'var(--apinox-fs-sm)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}
            >
                {/* Expand/collapse chevron slot — ALWAYS rendered at a fixed
                    14px width so the icon + text line up across every row,
                    regardless of whether a chevron is shown. The chevron itself
                    is only present when the node has visible children (an empty
                    project/operation has nothing to expand); otherwise the slot
                    is an empty spacer of the same width so alignment is kept. */}
                <div
                    data-testid="tree-chevron-slot"
                    data-has-chevron={hasChildren || undefined}
                    onClick={hasChildren ? onToggle : undefined}
                    style={{
                        width: 14,
                        flexShrink: 0,
                        cursor: hasChildren ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    {hasChildren && (
                        expanded ? (
                            <ChevronDown size={14} />
                        ) : (
                            <ChevronRight size={14} />
                        )
                    )}
                </div>
                <span style={{ color, flexShrink: 0 }}>{icon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            </div>


            {expanded && hasChildren && <div>{children}</div>}
        </>
    );
};

interface CtxMenuState {
    x: number;
    y: number;
    type: 'project' | 'operation' | 'request';
    data: UnifiedProject | ApiOperation | ApiRequest | null;
    projectName?: string;
    operationName?: string;
}

// The "+" add flow: pick a project, then complete the second step — name the
// new request (kind 'request') or enter the definition source URL (kind
// 'load'). Completed steps collapse into the header breadcrumb; the active
// step's input row renders directly below the header.
type AddFlow =
    | { kind: 'request'; step: 'project' | 'name'; project: UnifiedProject | null }
    | { kind: 'load'; step: 'project' | 'source'; project: UnifiedProject | null };

export interface UnifiedExplorerSidebarProps {
    projects: UnifiedProject[];
    selectedNode: { type: string; id: string } | null;
    onSelectNode: (type: string, id: string) => void;
    onRefreshProject: (projectName: string) => void;
    onDeleteProject: (projectName: string) => void;
    onDeleteOperation: (projectName: string, operationName: string) => void;
    onDeleteRequest: (projectName: string, operationName: string, requestName: string) => void;
    onNewRequest: (projectName: string, operationName: string) => void;
    /** R-10 (F-17): context-menu rename (display-only `displayName` override). */
    onRenameProject?: (projectName: string, displayName: string) => Promise<void>;
    onRenameOperation?: (projectName: string, operationName: string, displayName: string) => Promise<void>;
    onRenameRequest?: (projectName: string, operationName: string, requestName: string, displayName: string) => Promise<void>;
    onExportProject: (projectName: string) => void;
    /**
     * Phase B (t_86c34d38): relocated from the deleted PROJECTS view
     * (ProjectList header). These import/export flows still WRITE the legacy
     * nested model (a follow-up card converts them to the flat unified model),
     * which keeps working on migrated dirs (non-destructive migration).
     */
    onExportWorkspace?: () => void;
    onBulkImport?: () => void;
    onImportSoapUI?: () => void;
    /**
     * "Import Workspace" — open the native file dialog for an APInox
     * workspace/project export (.apinox / .json / .xml) and import it.
     * Lives in the sidebar-level context menu (right-click anywhere in
     * the sidebar) so it is reachable with zero projects — the
     * empty-tree import path. The prop is undefined in non-Tauri
     * (browser) dev, so the menu item is omitted there.
     */
    onImportWorkspace?: () => void;
    /** Phase B (t_86c34d38): relocated "Generate Test Suite" (was PROJECTS-view context menu). */
    onGenerateTestSuite?: (target: ApiOperation) => void;
    /**
     * Phase B (t_86c34d38): relocated "Add to Test Case" (was the legacy shared
     * context menu on PROJECTS-view request nodes, which is deleted with the
     * view). Opens the AddToTestCaseModal for a unified request.
     */
    onAddRequestToTestCase?: (request: ApiRequest) => void;
    onReorderOperation: (projectName: string, fromIndex: number, toIndex: number) => void;
    onReorderRequest: (projectName: string, operationName: string, fromIndex: number, toIndex: number) => void;
    /**
     * F-01 / R-05 — Quick Requests (scrapbook) section rendered as the bottom
     * section of the unified sidebar (decision doc Q1(a): least surface area,
     * matches the legacy placement in `ApiExplorerSidebar`).
     */
    scrapbook?: {
        requests: ScrapbookRequest[];
        selectedRequest: ScrapbookRequest | null;
        loading: boolean;
        onCreateRequest: () => void;
        onSelectRequest: (request: ScrapbookRequest) => void;
        onDeleteRequest: (id: string) => void;
        onExecuteRequest: (request: ScrapbookRequest) => void;
    };
    /**
     * History sub-window — the second bottom section of the unified sidebar,
     * stacked above Quick Requests. Request history was a top-level rail view
     * (SidebarView.HISTORY); it was folded into the unified explorer as a
     * sub-section so the rail no longer carries a second request surface.
     * The entry content (search/filters/replay/star/delete) is the shared
     * HistorySidebar component, wrapped in UnifiedHistoryPanel.
     */
    history?: {
        entries: RequestHistoryEntry[];
        onReplay?: (entry: RequestHistoryEntry) => void;
        onToggleStar?: (id: string) => void;
        onDelete?: (id: string) => void;
    };
    /**
     * Load a WSDL / OpenAPI / GraphQL definition from a source URL (the
     * sidebar "+" → Load flow). Mirrors the main-area top bar's load path:
     * the caller routes by format (`detectLoadFormat`) and publishes the
     * resulting project. Undefined in non-Tauri dev, so the Load action is
     * omitted from the "+" menu there.
     */
    onLoadWsdl?: (url: string) => void;
}

export const UnifiedExplorerSidebar: React.FC<UnifiedExplorerSidebarProps> = ({
    projects,
    selectedNode,
    onSelectNode,
    onRefreshProject,
    onDeleteProject,
    onDeleteOperation,
    onDeleteRequest,
    onNewRequest,
    onRenameProject,
    onRenameOperation,
    onRenameRequest,
    onExportProject,
    // Phase B (t_86c34d38): relocated import/export + generate-test-suite.
    onExportWorkspace,
    onBulkImport,
    onImportSoapUI,
    onImportWorkspace,
    onGenerateTestSuite,
    onAddRequestToTestCase,
    onReorderOperation,
    onReorderRequest,
    scrapbook,
    history: historyPanel,
    onLoadWsdl,
}) => {
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
    // Sidebar-level context menu (right-click anywhere in the sidebar).
    // Distinct from the per-row `ctxMenu`: it is what makes the import
    // actions reachable with zero projects — with no rows to right-click,
    // the row-level menu would have no surface. Per-row and Scrapbook
    // handlers stop propagation, so a row's own menu still wins when both
    // would match; only unclaimed right-clicks (empty space, container
    // padding) fall through to the container handler.
    const [sidebarCtxMenu, setSidebarCtxMenu] = useState<{ x: number; y: number } | null>(null);
    const closeCtxMenu = () => setCtxMenu(null);
    const closeSidebarCtxMenu = () => setSidebarCtxMenu(null);

    // ── Section collapse (accordions) ───────────────────────────────────────
    // The three sections — the project tree ("Projects"), History and Quick
    // Requests — are accordions: each header's chevron collapses the body down
    // to the header row. The per-section flags are seeded from localStorage
    // (lazy initializer, so the saved layout is applied before first paint)
    // and persisted on every toggle. Collapsing a section is independent of the
    // others (all may be open at once) — the resize handles still work when a
    // section is expanded.
    const [sectionCollapsed, setSectionCollapsed] =
        useState<SectionCollapsedState>(() => loadSectionCollapsed());
    const toggleSection = useCallback((name: keyof SectionCollapsedState) => {
        setSectionCollapsed(prev => {
            const next = { ...prev, [name]: !prev[name] };
            saveSectionCollapsed(next);
            return next;
        });
    }, []);

    // ── Sidebar "+" add flow ────────────────────────────────────────────────
    // The header "+" opens a small menu (New Request / Load Definition). Each
    // action drives a two-step flow rendered as a breadcrumb in the header
    // plus an input row under it (mirrors the TestsUi "add suite" workflow,
    // but with more depth: pick project → name request / source URL).
    const [addFlow, setAddFlow] = useState<AddFlow | null>(null);
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [addRequestName, setAddRequestName] = useState('');
    const [addSourceUrl, setAddSourceUrl] = useState('');
    // The menu renders into the header (position:relative), so a plain
    // absolute position would be clipped by the panel's overflow — use the
    // trigger button's rect in viewport (fixed) coordinates instead, same
    // pattern as TestsUi's AddSuiteMenu.
    const addMenuBtnRef = useRef<HTMLButtonElement>(null);
    const addMenuRef = useRef<HTMLDivElement>(null);
    const [addMenuPos, setAddMenuPos] = useState<{ top: number; left: number } | null>(null);

    const resetAddFlow = () => {
        setAddFlow(null);
        setAddRequestName('');
        setAddSourceUrl('');
        setAddMenuOpen(false);
        setAddMenuPos(null);
    };

    const startAddFlow = (kind: 'request' | 'load') => {
        const single = projects.length === 1 ? projects[0] : null;
        if (kind === 'request') {
            setAddFlow(single ? { kind: 'request', step: 'name', project: single } : { kind: 'request', step: 'project', project: null });
        } else {
            // Load: the project step is only a source-URL pre-fill convenience.
            // One project → use it directly; several → pick one to pre-fill;
            // none → straight to the source input.
            setAddFlow(
                single
                    ? { kind: 'load', step: 'source', project: single }
                    : projects.length > 0
                        ? { kind: 'load', step: 'project', project: null }
                        : { kind: 'load', step: 'source', project: null },
            );
        }
        // Pre-fill: one project means the choice step is done; one operation
        // in it names the request, and the project source URL seeds a load.
        if (kind === 'request' && projects.length === 1) {
            const ops = projects[0].operations || [];
            if (ops.length === 1) setAddRequestName(ops[0].displayName || ops[0].name);
        }
        if (kind === 'load' && projects.length === 1 && projects[0].sourceUrl) {
            setAddSourceUrl(projects[0].sourceUrl);
        }
        setAddMenuOpen(false);
        setAddMenuPos(null);
    };

    const openAddMenu = () => {
        if (!addMenuOpen) {
            const rect = addMenuBtnRef.current?.getBoundingClientRect();
            if (rect) {
                // Align the menu's right edge with the trigger button and
                // clamp the left edge to the viewport (mirrors TestsUi).
                const estimatedWidth = 190;
                setAddMenuPos({
                    top: rect.bottom + 4,
                    left: Math.max(8, rect.right - estimatedWidth),
                });
            }
        }
        setAddMenuOpen(v => !v);
    };

    // Close the add menu on outside click / Escape (capture-phase mousedown
    // beats child handlers, same as SidebarContextMenu).
    useEffect(() => {
        if (!addMenuOpen) return;
        const handleMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (addMenuRef.current?.contains(target)) return;
            if (addMenuBtnRef.current?.contains(target)) return;
            setAddMenuOpen(false);
            setAddMenuPos(null);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setAddMenuOpen(false);
                setAddMenuPos(null);
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [addMenuOpen]);

    const pickAddProject = (project: UnifiedProject) => {
        if (!addFlow) return;
        if (addFlow.kind === 'request') {
            setAddFlow({ kind: 'request', step: 'name', project });
        } else {
            // Load: pick a project to refresh → seed the source URL from it so
            // the user can edit or submit directly.
            setAddSourceUrl(project.sourceUrl || '');
            setAddFlow({ kind: 'load', step: 'source', project });
        }
    };

    const submitAddRequest = () => {
        if (addFlow?.kind !== 'request' || !addFlow.project) return;
        const project = addFlow.project;
        const op = (project.operations || []).find(op => op.name === addRequestName.trim()) || (project.operations || [])[0];
        if (op) {
            onNewRequest(project.name, op.name);
        }
        resetAddFlow();
    };

    const submitAddLoad = () => {
        if (addFlow?.kind !== 'load') return;
        const url = addSourceUrl.trim();
        if (!url || !onLoadWsdl) {
            resetAddFlow();
            return;
        }
        onLoadWsdl(url);
        resetAddFlow();
    };

    // Contract §4: loading-state indicator — reads the single source of truth
    // from the context (idle | loading(loaded,total,current) | ready(loaded,
    // total,errors[]) | error(message)). The UI must not couple to the
    // worker/IPC implementation.
    const { load, refresh } = useUnifiedProjectsSafe();

    // R-10 (F-17): rename state — the modal edits a display-only `displayName`
    // override; the stable `name` (directory / WSDL binding / selection
    // identity) never changes, so selection survives a rename.
    const [renameTarget, setRenameTarget] = useState<{
        type: 'project' | 'operation' | 'request';
        projectName: string;
        operationName?: string;
        requestName?: string;
        initial: string;
    } | null>(null);

    const handleRenameSave = useCallback(async (displayName: string) => {
        if (!renameTarget) return;
        const { type, projectName, operationName, requestName } = renameTarget;
        const trimmed = displayName.trim();
        setRenameTarget(null);
        try {
            if (type === 'project' && onRenameProject) {
                await onRenameProject(projectName, trimmed);
            } else if (type === 'operation' && onRenameOperation) {
                await onRenameOperation(projectName, operationName || '', trimmed);
            } else if (type === 'request' && onRenameRequest) {
                await onRenameRequest(projectName, operationName || '', requestName || '', trimmed);
            }
        } catch (e) {
            console.error('[UnifiedExplorerSidebar] Rename failed:', e);
        }
    }, [renameTarget, onRenameProject, onRenameOperation, onRenameRequest]);

    // Drop gap indicator + drag handlers (visual gap row only; the actual
    // drop index is computed from the native event inside the handlers).
    const { dropGap, clearDropGap, rowHandlers, gapRowHandlers } = useReorderDrag();

    // Projects render in alphabetical order (by display name, falling back to
    // the stored name, case-insensitive). The backend returns them in
    // filesystem order; sorting at render time keeps the tree A→Z without any
    // persistence change. Stable sort, so equal names keep their backend order.
    const sortedProjects = useMemo(
        () =>
            [...projects].sort((a, b) =>
                (a.displayName || a.name).localeCompare(b.displayName || b.name, undefined, {
                    sensitivity: 'base',
                }),
            ),
        [projects],
    );

    // Quick Requests subwindow height (vertical resize via the handle above
    // the section). Seeded synchronously from localStorage during the first
    // render (lazy initializer), so the saved height is applied before first
    // paint — no default→saved flicker. The clamp keeps any saved value
    // inside the UI min/max; without a saved value the default is used.
    const [quickRequestsHeight, setQuickRequestsHeight] = useState<number>(() => loadQuickRequestsHeight());
    // The drag listeners are created once at mousedown, so they read the
    // latest height from this ref (kept in sync where the state is written)
    // to persist it on resize end without a stale closure.
    const quickRequestsHeightRef = useRef(quickRequestsHeight);
    const [handleHovered, setHandleHovered] = useState(false);
    const isResizingQuickRequests = useRef(false);

    // The drag handler reads the container's current height on each move, so
    // an ancestor window resize mid-drag cannot break the clamp.
    const quickRequestsContainerRef = useRef<HTMLDivElement | null>(null);

    // History subwindow height (vertical resize via the handle between the
    // project tree and the History window, which sits above Quick Requests).
    // Same seeding/persistence contract as Quick Requests above.
    const [historyHeight, setHistoryHeight] = useState<number>(() => loadHistoryHeight());
    const historyHeightRef = useRef(historyHeight);
    // The History handle's top edge (px from container top) at mousedown.
    // History is NOT bottom-pinned (Quick Requests sits below it), so its
    // height is the pointer's travel below the handle's start position — a
    // stable measure independent of the variable tree height above.
    const historyHandleRef = useRef<HTMLDivElement | null>(null);
    const isResizingHistory = useRef(false);
    // Kept in a ref so the (once-created) Quick Requests drag closure can read
    // the current presence of the History subwindow without a stale capture.
    const historyPanelPresentRef = useRef(!!historyPanel);
    useEffect(() => {
        historyPanelPresentRef.current = !!historyPanel;
    }, [historyPanel]);

    const handleQuickRequestsResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const container = quickRequestsContainerRef.current;
        if (!container) return;
        isResizingQuickRequests.current = true;
        const containerTop = container.getBoundingClientRect().top;

        const handleMove = (ev: MouseEvent) => {
            if (!isResizingQuickRequests.current) return;
            const containerHeight = container.getBoundingClientRect().height;
            // The subwindow is pinned to the container's bottom edge, so its
            // height is the distance from the pointer down to the container's
            // bottom: dragging the handle up grows it, dragging it down
            // shrinks it (the drag direction matches the pointer). Clamped to
            // [min, max]; the max also keeps the project tree visible (it
            // needs at least the min height) — and when the History subwindow
            // is present, reserves room for it plus the tree minimum, so the
            // History window can never be squeezed out of the sidebar.
            const reservedBelowTree = (historyPanelPresentRef.current
                ? historyHeightRef.current + HISTORY_TREE_MIN
                : 0);
            const max = Math.max(
                QUICK_REQUESTS_MIN_HEIGHT,
                Math.floor(containerHeight - QUICK_REQUESTS_MIN_HEIGHT - reservedBelowTree),
            );
            const next = containerHeight - (ev.clientY - containerTop);
            const clamped = Math.min(max, Math.max(QUICK_REQUESTS_MIN_HEIGHT, Math.round(next)));
            quickRequestsHeightRef.current = clamped;
            setQuickRequestsHeight(clamped);
        };
        const handleEnd = () => {
            isResizingQuickRequests.current = false;
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleEnd);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            // Persist once per gesture, at resize end — the final clamped
            // value. A single write needs no debounce.
            saveQuickRequestsHeight(quickRequestsHeightRef.current);
        };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'row-resize';
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
    }, []);

    // Release the pointer-drag affordance if the mouseup happens off-window.
    // If the blur ends a drag that never got its mouseup, persist the
    // reached height — otherwise that last resize would be lost. (Covers
    // both the Quick Requests and History handles, which share the same
    // body-style affordance.)
    useEffect(() => {
        const reset = () => {
            if (isResizingQuickRequests.current) {
                saveQuickRequestsHeight(quickRequestsHeightRef.current);
            }
            if (isResizingHistory.current) {
                saveHistoryHeight(historyHeightRef.current);
            }
            isResizingQuickRequests.current = false;
            isResizingHistory.current = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
        window.addEventListener('blur', reset);
        return () => window.removeEventListener('blur', reset);
    }, []);

    // History resize: the handle sits between the project tree and the
    // History window (which is above Quick Requests). Because History is not
    // bottom-pinned, its height is measured from the handle's top edge at
    // mousedown — the pointer's travel below that edge, clamped to
    // [HISTORY_MIN_HEIGHT, container - tree minimum]. The Quick Requests
    // window height is held constant while History is dragged.
    const handleHistoryResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const container = quickRequestsContainerRef.current;
        const handle = historyHandleRef.current;
        if (!container || !handle) return;
        isResizingHistory.current = true;
        const handleTop = handle.getBoundingClientRect().top;

        const handleMove = (ev: MouseEvent) => {
            if (!isResizingHistory.current) return;
            const containerHeight = container.getBoundingClientRect().height;
            const next = ev.clientY - handleTop;
            const max = Math.max(HISTORY_MIN_HEIGHT, Math.floor(containerHeight - HISTORY_TREE_MIN));
            const clamped = Math.min(max, Math.max(HISTORY_MIN_HEIGHT, Math.round(next)));
            historyHeightRef.current = clamped;
            setHistoryHeight(clamped);
        };
        const handleEnd = () => {
            isResizingHistory.current = false;
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleEnd);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            saveHistoryHeight(historyHeightRef.current);
        };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'row-resize';
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
    }, []);

    // On startup the saved Quick Requests height is clamped against the live
    // container once layout is known: a value saved while the window was large
    // must not overflow a smaller one (which would push the subwindow out of
    // the sidebar). useLayoutEffect so the correction lands before paint; in
    // non-layout environments (jsdom) the rect height is 0 and this is a
    // no-op. The stored value is deliberately NOT rewritten — only the
    // displayed height is clamped, so a later, larger window restores the
    // original saved height.
    useLayoutEffect(() => {
        const container = quickRequestsContainerRef.current;
        if (!container) return;
        const containerHeight = container.getBoundingClientRect().height;
        if (containerHeight <= 0) return;
        const max = Math.max(QUICK_REQUESTS_MIN_HEIGHT, Math.floor(containerHeight - QUICK_REQUESTS_MIN_HEIGHT));
        if (quickRequestsHeightRef.current > max) {
            quickRequestsHeightRef.current = max;
            setQuickRequestsHeight(max);
        }
    }, []);

    // On startup the saved History height is clamped against the live container
    // once layout is known (same reasoning as the Quick Requests clamp above):
    // a value saved while the window was large must not overflow a smaller one.
    // In non-layout environments (jsdom) the rect height is 0 and this is a
    // no-op. The stored value is deliberately NOT rewritten.
    useLayoutEffect(() => {
        if (!historyPanel) return;
        const container = quickRequestsContainerRef.current;
        if (!container) return;
        const containerHeight = container.getBoundingClientRect().height;
        if (containerHeight <= 0) return;
        const max = Math.max(HISTORY_MIN_HEIGHT, Math.floor(containerHeight - HISTORY_TREE_MIN));
        if (historyHeightRef.current > max) {
            historyHeightRef.current = max;
            setHistoryHeight(max);
        }
    }, [historyPanel]);

    const buildSidebarSections = (): CtxMenuSection[] => {
        const items: CtxMenuItem[] = [];
        if (onImportWorkspace) {
            items.push({
                icon: FolderInput,
                label: 'Import Workspace',
                sub: 'APInox .apinox / JSON / XML',
                tooltip: 'Import an APInox workspace or project export file',
                onClick: () => { onImportWorkspace(); closeSidebarCtxMenu(); },
            });
        }
        if (onImportSoapUI) {
            items.push({
                icon: DownloadIcon,
                label: 'Import SoapUI Workspace',
                sub: 'SoapUI .xml',
                tooltip: 'Import a SoapUI workspace or project XML',
                onClick: () => { onImportSoapUI(); closeSidebarCtxMenu(); },
            });
        }
        if (onBulkImport) {
            items.push({
                icon: DownloadIcon,
                label: 'Bulk Import WSDLs',
                tooltip: 'Import multiple WSDL files at once',
                onClick: () => { onBulkImport(); closeSidebarCtxMenu(); },
            });
        }
        return [{ title: 'Import', items }];
    };

    // Sidebar-level context menu: right-click anywhere in the sidebar
    // (container padding, empty space, the tree area). TreeItem rows and the
    // ScrapbookPanel stopPropagation on their own right-clicks, so this only
    // fires for unclaimed surfaces. Guarded on at least one enabled import so
    // an empty menu never opens (e.g. non-Tauri dev, where the props are
    // undefined).
    const handleSidebarContextMenu = (e: React.MouseEvent) => {
        if (!onImportWorkspace && !onImportSoapUI && !onBulkImport) return;
        e.preventDefault();
        setSidebarCtxMenu({ x: e.clientX, y: e.clientY });
    };

    const buildSections = (state: CtxMenuState): CtxMenuSection[] => {
        const items: CtxMenuItem[] = [];

        // R-10 (F-17): display-only rename — available on every node type.
        items.push({ icon: PencilIcon, label: 'Rename', onClick: () => {
            if (state.type === 'project') {
                const project = state.data as UnifiedProject;
                setRenameTarget({ type: 'project', projectName: project.name, initial: project.displayName || project.name });
            } else if (state.type === 'operation') {
                const op = state.data as ApiOperation;
                setRenameTarget({ type: 'operation', projectName: state.projectName || '', operationName: op.name, initial: op.displayName || op.name });
            } else {
                const req = state.data as ApiRequest;
                setRenameTarget({ type: 'request', projectName: state.projectName || '', operationName: state.operationName, requestName: req.name, initial: req.displayName || req.name });
            }
            closeCtxMenu();
        }});

        if (state.type === 'project') {
            const project = state.data as UnifiedProject;
            items.push({ icon: RefreshCwIcon, label: 'Refresh WSDL', sub: project.sourceUrl || 'Reload operations', onClick: () => { onRefreshProject(project.name); closeCtxMenu(); } });
            items.push({
                icon: DownloadIcon,
                label: 'Export Project',
                sub: 'Project files & configuration',
                tooltip: 'Export this project\'s files and configuration to a single .apinox file',
                onClick: () => { onExportProject(project.name); closeCtxMenu(); },
            });
            // Phase B (t_86c34d38): relocated from the deleted PROJECTS view
            // (ProjectList "Import & Export" header menu).
            if (onExportWorkspace) {
                items.push({
                    icon: DownloadIcon,
                    label: 'Export Workspace',
                    sub: 'Workspace layout & state',
                    tooltip: 'Export the workspace layout and state (pick which projects to include)',
                    onClick: () => { onExportWorkspace(); closeCtxMenu(); },
                });
            }
            if (onBulkImport) {
                items.push({ icon: DownloadIcon, label: 'Bulk Import', onClick: () => { onBulkImport(); closeCtxMenu(); } });
            }
            if (onImportSoapUI) {
                items.push({ icon: DownloadIcon, label: 'Import SoapUI Workspace', onClick: () => { onImportSoapUI(); closeCtxMenu(); } });
            }
        } else if (state.type === 'operation') {
            const op = state.data as ApiOperation;
            items.push({ icon: PlusIcon, label: 'New Request', onClick: () => { onNewRequest(state.projectName || '', op.name); closeCtxMenu(); } });
            // Phase B (t_86c34d38): relocated from the PROJECTS-view context menu.
            if (onGenerateTestSuite) {
                items.push({ icon: FlaskConicalIcon, label: 'Generate Test Suite', onClick: () => { onGenerateTestSuite(op); closeCtxMenu(); } });
            }
        } else if (state.type === 'request') {
            const req = state.data as ApiRequest;
            if (req.endpoint) {
                items.push({ icon: Link, label: 'Copy URL', copyText: req.endpoint });
            }
            items.push({ icon: Copy, label: 'Copy Request XML', copyText: req.request || '' });
            // Phase B (t_86c34d38): relocated from the deleted legacy context
            // menu — the TESTS "Add Request to Test Case" flow stays reachable.
            if (onAddRequestToTestCase) {
                items.push({ icon: FlaskConicalIcon, label: 'Add to Test Case', onClick: () => { onAddRequestToTestCase(req); closeCtxMenu(); } });
            }
        }

        items.push({ icon: Trash2Icon, label: 'Delete', danger: true, onClick: () => {
            if (state.type === 'project') onDeleteProject((state.data as UnifiedProject).name);
            else if (state.type === 'operation') {
                const op = state.data as ApiOperation;
                onDeleteOperation(state.projectName || '', op.name);
            } else {
                const req = state.data as ApiRequest;
                onDeleteRequest(state.projectName || '', state.operationName || '', req.name);
            }
            closeCtxMenu();
        }});

        return [{ title: 'Actions', items }];
    };

    // Auto-expand operations that have requests (e.g., after adding a new request)
    useEffect(() => {
        const toExpand = new Set<string>(expandedNodes);
        for (const project of projects) {
            for (const op of project.operations || []) {
                if ((op.requests || []).length > 0 && !expandedNodes.has(op.id || op.name)) {
                    toExpand.add(op.id || op.name);
                }
            }
        }
        if (toExpand.size !== expandedNodes.size) {
            setExpandedNodes(toExpand);
        }
    }, [projects]);

    const toggleNode = useCallback((nodeId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    }, []);

    const isSelected = (type: string, id: string) =>
        (selectedNode && selectedNode.type === type && selectedNode.id === id) || false;

    // Shared accordion section header: a full-width row with a leading chevron
    // (clicking it toggles the section body) and, optionally, trailing actions
    // on the right (e.g. Quick Requests' "+"). Collapsed sections show the
    // chevron rotated to point right and drop the bottom border, so a stack of
    // collapsed sections reads as a compact list of headers.
    const renderSectionHeader = (
        name: keyof SectionCollapsedState,
        label: string,
        testId: string,
        actions?: React.ReactNode,
    ) => {
        const collapsed = sectionCollapsed[name];
        return (
            <div
                data-testid={testId}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '4px 12px',
                    background: 'transparent',
                    borderBottom: collapsed
                        ? 'none'
                        : '1px solid var(--apinox-sideBarSectionHeader-border)',
                    userSelect: 'none',
                    color: 'var(--apinox-foreground)',
                    fontSize: 'var(--apinox-fs-sm)',
                    // Section label — semibold, not bold (a bold uppercase
                    // label reads as too heavy over the regular tree rows).
                    fontWeight: 'var(--fw-semibold)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    flexShrink: 0,
                }}
            >
                <button
                    type="button"
                    aria-expanded={!collapsed}
                    title={collapsed ? `Expand ${label}` : `Collapse ${label}`}
                    onClick={() => toggleSection(name)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flex: 1,
                        minWidth: 0,
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        cursor: 'pointer',
                        color: 'inherit',
                        fontSize: 'inherit',
                        fontWeight: 'inherit',
                        fontFamily: 'inherit',
                        textTransform: 'inherit',
                        letterSpacing: 'inherit',
                        textAlign: 'left',
                    }}
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {label}
                    </span>
                </button>
                {actions}
            </div>
        );
    };

    return (
        <div
            ref={quickRequestsContainerRef}
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
            }}
        >
        {/* Sidebar header — matches the other sidebar panels (TestsUi etc.):
            an uppercase title with a "+" action button on the right. The "+"
            opens a small menu (New Request / Load Definition) that drives the
            add flow below the header (pick project → name request / source).
            It is intentionally deeper than the main-area top bar: loading a
            definition from the sidebar doesn't require switching to the
            work area. */}
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 12px',
                height: 44,
                borderBottom: '1px solid var(--apinox-sideBarSectionHeader-border)',
                flexShrink: 0,
                userSelect: 'none',
            }}
        >
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                {addFlow ? (
                    /* Add flow in progress: back-to-projects breadcrumb + the
                        action label, replacing the plain title. */
                    <>
                        <span
                            title="Back to the project list"
                            onClick={resetAddFlow}
                            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--apinox-icon-foreground, var(--apinox-foreground))', opacity: 0.8, flexShrink: 0 }}
                        >
                            <ChevronLeft size={14} />
                        </span>
                        {addFlow.kind === 'request' ? (
                            <SectionLabel as="div" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                New Request{addFlow.project ? ` — ${addFlow.project.displayName || addFlow.project.name}` : ''}
                            </SectionLabel>
                        ) : (
                            <SectionLabel as="div" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Load Definition{addFlow.project ? ` — ${addFlow.project.displayName || addFlow.project.name}` : ''}
                            </SectionLabel>
                        )}
                    </>
                ) : (
                    <SectionLabel as="div">
                        Unified Explorer
                    </SectionLabel>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--apinox-icon-foreground, var(--apinox-foreground))', flexShrink: 0, position: 'relative' }}>
                {addFlow && (
                    <Tooltip content="Cancel add flow">
                      <HeaderButton onClick={resetAddFlow}>
                        <X size={16} />
                      </HeaderButton>
                    </Tooltip>
                )}
                <Tooltip content="Add">
                  <HeaderButton ref={addMenuBtnRef} onClick={openAddMenu}>
                    <PlusIcon size={16} />
                  </HeaderButton>
                </Tooltip>
                {addMenuOpen && (
                    <div
                        ref={addMenuRef}
                        onMouseDown={e => e.stopPropagation()}
                        style={{
                            position: 'fixed',
                            top: addMenuPos?.top,
                            left: addMenuPos?.left,
                            zIndex: 1001,
                            background: 'var(--apinox-dropdown-background, #3c3c3c)',
                            border: '1px solid var(--apinox-dropdown-border, #3c3c3c)',
                            borderRadius: 4,
                            minWidth: 180,
                            boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                            padding: '4px 0',
                        }}
                    >
                        <div style={{ padding: '4px 12px', fontSize: '0.8em', opacity: 0.7, borderBottom: '1px solid var(--apinox-panel-border, #80808059)' }}>
                            Add
                        </div>
                        <button
                            type="button"
                            onClick={() => startAddFlow('request')}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 12px',
                                background: 'transparent',
                                border: 'none',
                                color: 'inherit',
                                font: 'inherit',
                                textAlign: 'left',
                                cursor: 'pointer',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--apinox-list-hoverBackground)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <FileCode size={14} />
                            New Request
                        </button>
                        {onLoadWsdl && (
                            <button
                                type="button"
                                onClick={() => startAddFlow('load')}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '8px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'inherit',
                                    font: 'inherit',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--apinox-list-hoverBackground)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <ArrowRight size={14} />
                                Load Definition
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Add-flow step rows — render directly below the header (sticky at
            the top of the sidebar, above the scrollable tree). The step is
            determined by addFlow.step: pick a project, then complete the
            action-specific input. */}
        {addFlow && addFlow.step === 'project' && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--apinox-sideBarSectionHeader-border)', flexShrink: 0, background: 'var(--apinox-sideBar-background)' }}>
                <div style={{ fontSize: 'var(--apinox-fs-sm)', opacity: 0.7, marginBottom: 4, color: 'var(--apinox-foreground)' }}>
                    {addFlow.kind === 'request' ? 'Which project?' : 'Which project to refresh?'}
                </div>
                {projects.length === 0 ? (
                    <div style={{ fontSize: 'var(--apinox-fs-md)', opacity: 0.6, color: 'var(--apinox-foreground)' }}>No projects yet — load a definition first.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {projects.map(p => (
                            <button
                                key={p.name}
                                type="button"
                                onClick={() => pickAddProject(p)}
                                disabled={p.readOnly && addFlow.kind === 'request'}
                                title={p.readOnly && addFlow.kind === 'request' ? 'Project is read-only' : undefined}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '4px 8px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'inherit',
                                    font: 'inherit',
                                    fontSize: 'var(--apinox-fs-md)',
                                    textAlign: 'left',
                                    cursor: p.readOnly && addFlow.kind === 'request' ? 'not-allowed' : 'pointer',
                                    opacity: p.readOnly && addFlow.kind === 'request' ? 0.5 : 1,
                                    borderRadius: 3,
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--apinox-list-hoverBackground)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <Server size={14} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName || p.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )}
        {addFlow?.kind === 'request' && addFlow.step === 'name' && addFlow.project && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--apinox-sideBarSectionHeader-border)', flexShrink: 0, background: 'var(--apinox-sideBar-background)' }}>
                <div style={{ fontSize: 'var(--apinox-fs-sm)', opacity: 0.7, marginBottom: 4, color: 'var(--apinox-foreground)' }}>
                    Add request to operation:
                </div>
                {(addFlow.project.operations || []).length === 0 ? (
                    <div style={{ fontSize: 'var(--apinox-fs-md)', opacity: 0.6, color: 'var(--apinox-foreground)' }}>This project has no operations.</div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                            autoFocus
                            value={addRequestName}
                            onChange={e => setAddRequestName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') submitAddRequest(); if (e.key === 'Escape') resetAddFlow(); }}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '4px 8px',
                                backgroundColor: 'var(--apinox-input-background, #3c3c3c)',
                                color: 'var(--apinox-input-foreground, var(--apinox-foreground))',
                                border: '1px solid var(--apinox-input-border)',
                                borderRadius: 3,
                                fontSize: 'var(--apinox-fs-md)',
                                outline: 'none',
                            }}
                        >
                            {(addFlow.project.operations || []).map(op => (
                                <option key={op.name} value={op.name}>{op.displayName || op.name}</option>
                            ))}
                        </select>
                        <Tooltip content="Create request">
                          <HeaderButton onClick={submitAddRequest}>
                            <PlusIcon size={14} />
                          </HeaderButton>
                        </Tooltip>
                    </div>
                )}
            </div>
        )}
        {addFlow?.kind === 'load' && addFlow.step === 'source' && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--apinox-sideBarSectionHeader-border)', flexShrink: 0, background: 'var(--apinox-sideBar-background)' }}>
                <div style={{ fontSize: 'var(--apinox-fs-sm)', opacity: 0.7, marginBottom: 4, color: 'var(--apinox-foreground)' }}>
                    WSDL / OpenAPI / GraphQL URL
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <InlineFormInput
                        autoFocus
                        placeholder="https://…/Service?WSDL"
                        value={addSourceUrl}
                        onChange={e => setAddSourceUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submitAddLoad(); if (e.key === 'Escape') resetAddFlow(); }}
                        style={{ flex: 1, minWidth: 0 }}
                    />
                    <Tooltip content="Load definition">
                      <HeaderButton onClick={submitAddLoad}>
                        <ArrowRight size={14} />
                      </HeaderButton>
                    </Tooltip>
                </div>
            </div>
        )}
        {/* ── "Projects" accordion section — the project tree body. Its
            header carries a chevron that collapses the whole tree down to the
            header row (accordion). Collapsed, the section occupies only the
            header; the freed space goes to whatever else is open. */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: sectionCollapsed.tree ? '0 0 auto' : '1 1 0', minHeight: 0 }}>
            {renderSectionHeader('tree', `Projects${projects.length > 0 ? ` (${projects.length})` : ''}`, 'unified-tree-section-header')}

            {!sectionCollapsed.tree && (
        <div
            style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '4px 0',
            }}
            // Sidebar-level context menu: fires for right-clicks that no row
            // or the ScrapbookPanel claimed (they stopPropagation). This is
            // what makes the import actions reachable with zero projects.
            onContextMenu={handleSidebarContextMenu}
            onDragOver={(e) => {
                // Always allow drops — getData() is restricted during dragover in most browsers
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
                // Fallback: drop landed between rows on the container
                e.preventDefault();
                clearDropGap();
                const dragData = e.dataTransfer.getData('application/x-tree-drag');
                if (!dragData) return;
                const parsed = JSON.parse(dragData);
                // Try to find a nearby row to determine drop index
                const row = findClosestDropRow(e.clientX, e.clientY);
                if (!row) return;
                const dropIndex = parseInt(row.dataset.dropIndex || '', 10);
                if (isNaN(dropIndex)) return;
                const rect = row.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                const targetIndex = e.clientY < midY ? dropIndex : dropIndex + 1;

                if (parsed.type === 'operation' && row.dataset.dropType === 'operation' && row.dataset.dropParent === parsed.projectName) {
                    onReorderOperation(parsed.projectName, parsed.fromIndex, targetIndex);
                } else if (parsed.type === 'request' && row.dataset.dropType === 'request' && row.dataset.dropParent === `${parsed.projectName}::${parsed.operationName}`) {
                    onReorderRequest(parsed.projectName, parsed.operationName, parsed.fromIndex, targetIndex);
                }
            }}
        >
            {/* Contract §4: loading-state rendering.
                - phase === 'loading': fixed-height indicator row (≈24 px,
                  matching a TreeItem row) with spinner + progress counter.
                  Reserved height when absent → no layout shift.
                - phase === 'ready' with errors: single muted warning row
                  that does not hide the tree.
                - phase === 'error': replace the tree area with message +
                  Retry button (calls context refresh(); no full app reload).
                - phase === 'ready' with total === 0: existing "No projects
                  yet" empty-state markup renders as-is.
                - Partial rendering: projects already in state render
                  normally beneath the indicator; the UI is fully interactive
                  during the load. */}
            {load.phase === 'loading' && (
                <>
                    <div
                        style={{
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '0 8px 0 16px',
                            color: 'var(--apinox-foreground)',
                            opacity: 0.7,
                            flexShrink: 0,
                        }}
                    >
                        <Spinner size={14} />
                        <span style={{ fontSize: 'var(--apinox-fs-sm)' }}>
                            Loading interfaces…
                            {load.total > 0 ? ` (${load.loaded}/${load.total})` : ''}
                        </span>
                    </div>
                </>
            )}

            {load.phase === 'error' && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--apinox-foreground)' }}>
                    <p style={{ margin: 0 }}>{load.message}</p>
                    <button
                        onClick={() => refresh()}
                        style={{
                            marginTop: 8,
                            padding: '4px 12px',
                            background: 'var(--apinox-focusBorder)',
                            color: 'var(--apinox-button-foreground)',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                        }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {load.phase === 'ready' && load.errors.length > 0 && (
                <div
                    style={{
                        padding: '4px 8px',
                        fontSize: 'var(--apinox-fs-sm)',
                        color: 'var(--apinox-foreground)',
                        opacity: 0.6,
                        flexShrink: 0,
                    }}
                >
                    {load.errors.length} project{load.errors.length > 1 ? 's' : ''} failed to load — right-click the project to retry
                </div>
            )}

            {projects.length === 0 && load.phase !== 'error' && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--apinox-foreground)', opacity: 0.7 }}>
                    <p style={{ margin: 0 }}>No projects yet</p>
                    <p style={{ fontSize: 'var(--apinox-fs-md)', marginTop: 4 }}>Right-click here to import a workspace</p>
                </div>
            )}

            {sortedProjects.map((project) => {
                const projectId = project.id || project.name;
                const isExpanded = expandedNodes.has(projectId);
                const projectOps = project.operations || [];

                return (
                    <TreeItem
                        key={projectId}
                        label={project.displayName || project.name}
                        type="project"
                        expanded={isExpanded}
                        selected={isSelected('project', projectId)}
                        // Explicit child count: an empty project (no operations)
                        // must show no chevron — there is nothing to expand. The
                        // trailing drag-drop gap row would otherwise inflate the
                        // default `hasChildren` heuristic to non-zero.
                        hasChildren={projectOps.length > 0}
                        onClick={() => onSelectNode('project', projectId)}
                        onToggle={projectOps.length > 0 ? () => toggleNode(projectId) : undefined}
                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'project', data: project }); }}
                    >
                        {(project.operations || []).map((op: ApiOperation, opIndex: number) => {
                            const opId = op.id || op.name;
                            const isOpExpanded = expandedNodes.has(opId);
                            const showOpGapBefore = dropGap?.type === 'operation' && dropGap?.projectName === project.name && dropGap?.index === opIndex;
                            // Visible requests exclude the hidden `sample_` placeholders —
                            // an op with only sample requests has nothing to expand.
                            const visibleOpRequests = (op.requests || []).filter(req => !req.name.startsWith('sample_'));

                            return (
                                <React.Fragment key={opId}>
                                    {showOpGapBefore && (
                                        <ReorderGapRow
                                            paddingLeft={24}
                                            {...gapRowHandlers(
                                                { type: 'operation', projectName: project.name },
                                                opIndex,
                                                (fromIndex) => onReorderOperation(project.name, fromIndex, opIndex),
                                            )}
                                        />
                                    )}
                                <TreeItem
                                    key={opId}
                                    label={op.displayName || op.name}
                                    type="operation"
                                    id={opId}
                                    indentLevel={1}
                                    expanded={isOpExpanded}
                                    selected={isSelected('operation', opId)}
                                    draggable
                                    dataDropType="operation"
                                    dataDropIndex={opIndex}
                                    dataDropParent={project.name}
                                    // Explicit count: the trailing drag-drop gap row would
                                    // otherwise make an operation with no visible requests
                                    // look expandable.
                                    hasChildren={visibleOpRequests.length > 0}
                                    onClick={() => onSelectNode('operation', opId)}
                                    onToggle={visibleOpRequests.length > 0 ? () => toggleNode(opId) : undefined}
                                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'operation', data: op, projectName: project.name }); }}
                                    {...rowHandlers(
                                        { type: 'operation', projectName: project.name },
                                        opIndex,
                                        (fromIndex, targetIndex) => onReorderOperation(project.name, fromIndex, targetIndex),
                                    )}
                                >
                                    {(op.requests || []).filter(req => !req.name.startsWith('sample_')).map((req: ApiRequest) => {
                                        const reqId = req.id || req.name;
                                        // Find the real index in the full (unfiltered) requests array
                                        const fullReqIndex = (op.requests || []).findIndex(r => (r.id || r.name) === reqId);
                                        const showReqGapBefore = dropGap?.type === 'request' && dropGap?.projectName === project.name && dropGap?.operationName === op.name && dropGap?.index === fullReqIndex;
                                        return (
                                            <React.Fragment key={reqId}>
                                                {showReqGapBefore && (
                                                    <ReorderGapRow
                                                        paddingLeft={48}
                                                        {...gapRowHandlers(
                                                            { type: 'request', projectName: project.name, operationName: op.name },
                                                            fullReqIndex,
                                                            (fromIndex) => onReorderRequest(project.name, op.name, fromIndex, fullReqIndex),
                                                        )}
                                                    />
                                                )}
                                            <TreeItem
                                                key={reqId}
                                                label={req.displayName || req.name}
                                                type="request"
                                                id={reqId}
                                                indentLevel={2}
                                                draggable
                                                dataDropType="request"
                                                dataDropIndex={fullReqIndex}
                                                dataDropParent={`${project.name}::${op.name}`}
                                                selected={isSelected('request', reqId)}
                                                onClick={() => onSelectNode('request', reqId)}
                                                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'request', data: req, projectName: project.name, operationName: op.name }); }}
                                                {...rowHandlers(
                                                    { type: 'request', projectName: project.name, operationName: op.name },
                                                    fullReqIndex,
                                                    (fromIndex, targetIndex) => onReorderRequest(project.name, op.name, fromIndex, targetIndex),
                                                )}
                                            />
                                            </React.Fragment>
                                        );
                                    })}
                                    {/* Gap after last request */}
                                    {dropGap?.type === 'request' && dropGap?.projectName === project.name && dropGap?.operationName === op.name && dropGap?.index === (op.requests || []).length && (
                                        <ReorderGapRow key="gap-after-last-req"
                                            paddingLeft={48}
                                            {...gapRowHandlers(
                                                { type: 'request', projectName: project.name, operationName: op.name },
                                                (op.requests || []).length,
                                                (fromIndex) => onReorderRequest(project.name, op.name, fromIndex, (op.requests || []).length),
                                            )}
                                        />
                                    )}
                                </TreeItem>
                                </React.Fragment>
                            );
                        })}
                        {/* Gap after last operation */}
                        {dropGap?.type === 'operation' && dropGap?.projectName === project.name && dropGap?.index === (project.operations || []).length && (
                            <ReorderGapRow key="gap-after-last-op"
                                paddingLeft={24}
                                {...gapRowHandlers(
                                    { type: 'operation', projectName: project.name },
                                    (project.operations || []).length,
                                    (fromIndex) => onReorderOperation(project.name, fromIndex, (project.operations || []).length),
                                )}
                            />
                        )}
                    </TreeItem>
                );
            })}

            {ctxMenu && (
                <SidebarContextMenu
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    sections={buildSections(ctxMenu)}
                    onClose={closeCtxMenu}
                />
            )}

            {/* Sidebar-level context menu — Import actions, shown for
                right-clicks on unclaimed sidebar surfaces (incl. the empty
                state, which has no rows). */}
            {sidebarCtxMenu && (
                <SidebarContextMenu
                    x={sidebarCtxMenu.x}
                    y={sidebarCtxMenu.y}
                    sections={buildSidebarSections()}
                    onClose={closeSidebarCtxMenu}
                />
            )}

            {/* R-10 (F-17): display-only rename modal. Saving an empty name
                clears the override (falls back to the stable name). */}
            <RenameModal
                isOpen={!!renameTarget}
                title={renameTarget ? `Rename ${renameTarget.type}` : 'Rename'}
                initialValue={renameTarget?.initial || ''}
                onSave={handleRenameSave}
                onCancel={() => setRenameTarget(null)}
            />
        </div>
            )}
        </div>

        {/* History sub-window — second bottom section, stacked above Quick
            Requests (Quick Requests stays bottom-most). Accordion section:
            the header's chevron collapses the body to the header row; while
            expanded the handle above the window resizes it. Request history
            was a top-level rail view (SidebarView.HISTORY); it is now a
            sub-section of the unified explorer, like Quick Requests. */}
        {historyPanel && (
            <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                {renderSectionHeader(
                    'history',
                    `History${historyPanel.entries.length > 0 ? ` (${historyPanel.entries.length})` : ''}`,
                    'unified-history-section-header',
                )}

                {!sectionCollapsed.history && (
                    <>
                        <div
                            ref={historyHandleRef}
                            data-testid="unified-history-resize-handle"
                            title="Drag to resize History"
                            onMouseDown={handleHistoryResizeStart}
                            onMouseEnter={() => setHandleHovered(true)}
                            onMouseLeave={() => setHandleHovered(false)}
                            style={{
                                flexShrink: 0,
                                height: 4,
                                cursor: 'row-resize',
                                background: handleHovered
                                    ? 'var(--apinox-focusBorder)'
                                    : 'var(--apinox-panel-border)',
                                transition: 'background 0.2s',
                            }}
                        />

                        <div
                            data-testid="unified-history"
                            style={{
                                flexShrink: 0,
                                height: historyHeight,
                                minHeight: HISTORY_MIN_HEIGHT,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                            }}
                        >
                            <UnifiedHistoryPanel
                                fill
                                chromeless
                                history={historyPanel.entries}
                                onReplay={historyPanel.onReplay}
                                onToggleStar={historyPanel.onToggleStar}
                                onDelete={historyPanel.onDelete}
                            />
                        </div>
                    </>
                )}
            </div>
        )}

        {/* F-01 / R-05 — Quick Requests (scrapbook) bottom section.
            Q1(a): rendered below the project tree, mirroring the legacy
            placement in ApiExplorerSidebar. Accordion section: the header's
            chevron collapses the body to the header row (the "+" create
            action stays available while collapsed); while expanded the handle
            above the window resizes it and the request list scrolls inside. */}
        {scrapbook && (
            <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                {renderSectionHeader(
                    'quickRequests',
                    `Quick Requests${scrapbook.requests.length > 0 ? ` (${scrapbook.requests.length})` : ''}`,
                    'unified-quick-requests-section-header',
                    <Tooltip content="Create New Request">
                      <HeaderButton onClick={scrapbook.onCreateRequest}>
                        <PlusIcon size={16} />
                      </HeaderButton>
                    </Tooltip>
                )}

                {!sectionCollapsed.quickRequests && (
                    <>
                        {/* Vertical resize handle between the project tree
                            and the Quick Requests subwindow. Always visible
                            as a thin line (not only on hover) so the grip is
                            easy to find; it brightens to the accent color
                            while hovered. It doubles as the section
                            separator, so the subwindow below has no border
                            of its own. */}
                        <div
                            data-testid="unified-quick-requests-resize-handle"
                            title="Drag to resize Quick Requests"
                            onMouseDown={handleQuickRequestsResizeStart}
                            onMouseEnter={() => setHandleHovered(true)}
                            onMouseLeave={() => setHandleHovered(false)}
                            style={{
                                flexShrink: 0,
                                height: 4,
                                cursor: 'row-resize',
                                background: handleHovered
                                    ? 'var(--apinox-focusBorder)'
                                    : 'var(--apinox-panel-border)',
                                transition: 'background 0.2s',
                            }}
                        />

                        <div
                            data-testid="unified-quick-requests"
                            style={{
                                flexShrink: 0,
                                height: quickRequestsHeight,
                                minHeight: QUICK_REQUESTS_MIN_HEIGHT,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                            }}
                        >
                            <ScrapbookPanel
                                fill
                                chromeless
                                requests={scrapbook.requests}
                                selectedRequest={scrapbook.selectedRequest}
                                loading={scrapbook.loading}
                                onCreateRequest={scrapbook.onCreateRequest}
                                onSelectRequest={scrapbook.onSelectRequest}
                                onDeleteRequest={scrapbook.onDeleteRequest}
                                onExecuteRequest={scrapbook.onExecuteRequest}
                            />
                        </div>
                    </>
                )}
            </div>
        )}
    </div>
    );
};
