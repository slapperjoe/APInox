/**
 * HistorySidebar — shared History content (search, advanced filters, grouped
 * entry list with replay/star/delete rows).
 *
 * Content-only by design: it carries no sidebar chrome of its own (no
 * SidebarContainer / SidebarHeader). It is rendered by:
 *   - UnifiedHistoryPanel — the "History" sub-window inside the unified
 *     explorer sidebar (the primary surface, alongside Quick Requests /
 *     Scrapbook / Tests / Workflows).
 *
 * Request history used to be a top-level rail view (SidebarView.HISTORY); it
 * was folded into the unified explorer as a sub-section.
 */
import React, { useState, useMemo, useRef, useEffect } from "react";
import styled from "styled-components";
import {
    Star,
    Trash2,
    Clock,
    X,
    Menu,
    Copy
} from "lucide-react";
import { RequestHistoryEntry } from "@shared/models";
import { EmptyState } from "../common/EmptyState";
import { IconButton, GhostButton } from "../common/Button";
import { SidebarContextMenu, CtxMenuSection, CtxMenuItem } from "./shared/SidebarContextMenu";
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_LG } from "../../styles/spacing";

const Section = styled.div`
    margin-bottom: ${SPACING_LG};
`;

const SectionTitle = styled.div`
    font-size: var(--apinox-fs-sm);
    font-weight: var(--fw-semibold);
    text-transform: uppercase;
    opacity: 0.7;
    margin-bottom: ${SPACING_SM};
    letter-spacing: 0.5px;
`;

const HistoryList = styled.div`
    flex: 1;
    overflow-y: auto;
`;

const SearchBar = styled.input`
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    /* Normal-height input: compact vertical padding (the header row's
       default input used the taller SPACING_SM vertical padding). */
    padding: ${SPACING_XS} ${SPACING_SM};
    border-radius: 4px;
    font-size: var(--apinox-fs-md);
    &:focus {
        outline: 1px solid var(--apinox-focusBorder);
    }
`;

/**
 * The History sub-window header row: the search field (left, flexes to fill
 * the remaining width) and the filter menu trigger (right). Replaces the
 * former full-width search + inline "Advanced Filters" section.
 */
const HeaderRow = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    margin-bottom: ${SPACING_SM};
`;

const SearchWrap = styled.div`
    flex: 1;
    min-width: 0;
`;

const FilterSection = styled.div`
    background: var(--apinox-list-inactiveSelectionBackground);
    border: 1px solid var(--apinox-input-border);
    border-radius: 4px;
    padding: ${SPACING_SM};
    margin-bottom: ${SPACING_MD};
`;

const FilterRow = styled.div`
    display: flex;
    gap: ${SPACING_SM};
    margin-bottom: ${SPACING_SM};
    align-items: center;
    flex-wrap: wrap;
`;

const FilterLabel = styled.label`
    font-size: var(--apinox-fs-sm);
    font-weight: var(--fw-semibold);
    opacity: 0.7;
    text-transform: uppercase;
    margin-right: ${SPACING_XS};
    white-space: nowrap;
`;

const FilterInput = styled.input`
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    padding: ${SPACING_XS} ${SPACING_SM};
    border-radius: 4px;
    font-size: var(--apinox-fs-md);
    flex: 1;
    min-width: 80px;
    &:focus {
        outline: 1px solid var(--apinox-focusBorder);
    }
`;

const FilterSelect = styled.select`
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    padding: ${SPACING_XS} ${SPACING_SM};
    border-radius: 4px;
    font-size: var(--apinox-fs-md);
    &:focus {
        outline: 1px solid var(--apinox-focusBorder);
    }
`;

const FilterButton = styled(GhostButton)<{ $active?: boolean }>`
    background: ${props => props.$active ? 'var(--apinox-button-background)' : 'var(--apinox-button-secondaryBackground)'};
    color: ${props => props.$active ? 'var(--apinox-button-foreground)' : 'var(--apinox-button-secondaryForeground)'};
    border: 1px solid ${props => props.$active ? 'var(--apinox-button-background)' : 'var(--apinox-input-border)'};
    padding: 2px ${SPACING_SM};
    border-radius: 4px;
    font-size: var(--apinox-fs-sm);
    line-height: 1;
    height: 22px;
    min-height: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: ${SPACING_XS};
    
    &:hover {
        background: ${props => props.$active ? 'var(--apinox-button-hoverBackground)' : 'var(--apinox-button-secondaryHoverBackground)'};
        border-color: ${props => props.$active ? 'var(--apinox-button-hoverBackground)' : 'var(--apinox-input-border)'};
    }
`;

const ClearFiltersButton = styled(GhostButton)`
    margin-left: auto;
    background: transparent;
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    padding: 2px ${SPACING_SM};
    border-radius: 4px;
    font-size: var(--apinox-fs-sm);
    line-height: 1;
    height: 22px;
    min-height: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: ${SPACING_XS};
    opacity: 0.8;

    &:hover {
        background: var(--apinox-list-hoverBackground);
        opacity: 1;
    }
`;

/** Hamburger trigger for the filter menu (right side of the header row).
    Square, compact — matches the row height of the search input. */
const FilterMenuTrigger = styled(GhostButton)<{ $active: boolean }>`
    background: ${props => props.$active ? 'var(--apinox-button-background)' : 'transparent'};
    color: ${props => props.$active ? 'var(--apinox-button-foreground)' : 'var(--apinox-icon-foreground)'};
    border: 1px solid ${props => props.$active ? 'var(--apinox-button-background)' : 'var(--apinox-input-border)'};
    padding: ${SPACING_XS};
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flexShrink: 0;

    &:hover:not(:disabled) {
        background: ${props => props.$active
            ? 'var(--apinox-button-hoverBackground)'
            : 'var(--apinox-list-hoverBackground)'};
    }
`;

/** The popout panel itself (position: fixed, clamped to the viewport).
    The sidebar panel's overflow:hidden clips in-flow children, so the menu
    is positioned against the viewport — the same pattern as the dropdown
    menus behind the header action buttons. */
const FilterMenuPanel = styled.div`
    position: fixed;
    z-index: 1000;
    width: 260px;
    max-width: calc(100vw - 16px);
    background: var(--apinox-panel-background, var(--apinox-input-background));
    color: var(--apinox-foreground);
    border: 1px solid var(--apinox-input-border);
    border-radius: 4px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    padding: ${SPACING_SM};
    overflow-y: auto;

    /* No margin-bottom on the inner section: the panel padding is the
       outer bound, and the section's margin-bottom would double it. */
    ${FilterSection} {
        margin-bottom: 0;
    }
`;

const FilterMenuTitle = styled.div`
    font-size: var(--apinox-fs-sm);
    font-weight: var(--fw-semibold);
    text-transform: uppercase;
    opacity: 0.7;
    letter-spacing: 0.5px;
    padding: ${SPACING_XS} ${SPACING_XS} ${SPACING_SM};
`;

// Matches the other sidebar list rows (tree items, Quick Requests): a
// transparent background, inherited text colour and a hover highlight — no
// gray "card" and no coloured left border. The success/fail signal lives on
// the status-code text (see HistoryRow), not a border.
const HistoryItem = styled.div`
    display: flex;
    align-items: flex-start;
    gap: ${SPACING_SM};
    padding: 4px 8px;
    margin-bottom: 2px;
    background: transparent;
    cursor: pointer;
    color: inherit;

    &:hover {
        background: var(--apinox-list-hoverBackground);
    }
`;

const ItemContent = styled.div`
    flex: 1;
    min-width: 0;
`;

/** Title + details share the single row: the title takes the remaining space
    first and truncates, and the details line only shows as much as fits —
    a history entry is one row of text, not a three-line card. */
const ItemTitle = styled.div`
    font-weight: var(--fw-medium);
    font-size: var(--apinox-fs-base);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 0 1 auto;
    min-width: 0;
`;

const ItemDetails = styled.div`
    font-size: var(--apinox-fs-sm);
    opacity: 0.7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 0 1 auto;
    min-width: 0;
    margin-left: ${SPACING_XS};
`;

const ItemMeta = styled.div`
    font-size: var(--apinox-fs-xs);
    /* Standard foreground (the row's inherited colour) — full opacity: the
       meta (time · duration · status) is the same weight of information as
       the rest of the row, not a dimmed footnote. */
    margin-left: auto;
    flexShrink: 0;
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    white-space: nowrap;
`;

// ─── Shared history row ──────────────────────────────────────────────────────
// One history entry as a SINGLE compact row: a fixed-width star slot (starred
// entries show the glyph, others stay aligned), the title (one row, truncated
// with a tooltip carrying the full text), a details line (overridable — the
// Favorites section passes its own), and the meta (time · duration · status)
// right-aligned on the same row. NO inline star/trash buttons — those live on
// the per-row RIGHT-CLICK menu (owned by each host: HistorySidebar below and
// FavoritesPanel), which is what keeps the rows from eating vertical space
// (t_favorites).
export interface HistoryRowProps {
    entry: RequestHistoryEntry;
    onReplay?: (entry: RequestHistoryEntry) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    /** Optional details-line override (e.g. the Favorites panel). */
    detailsOverride?: React.ReactNode;
}

export const HistoryRow: React.FC<HistoryRowProps> = ({
    entry,
    onReplay,
    onContextMenu,
    detailsOverride,
}) => {
    // The generic "Request" placeholder (stored by unnamed quick requests)
    // carries no information, so fall back to the operation — but NOT the
    // HTTP method: "POST" on every row is noise. Named requests and project
    // requests keep their real names.
    const rawName = entry.requestName;
    const title =
        rawName && rawName !== 'Request' ? rawName : (entry.operationName || rawName || '');
    // Details line: join only the non-empty parts — a blank quick request has
    // no project/interface/operation, and joining empties rendered as stray
    // "› ›" separators at the start of every row.
    const detailsPath = [entry.projectName, entry.interfaceName, entry.operationName].filter(Boolean).join(" › ");
    const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // The Rust entry stores the code under `status` (the model's `statusCode`
    // is a legacy alias nothing writes), so read `status`.
    const code = entry.status ?? entry.statusCode;
    return (
        <HistoryItem onContextMenu={onContextMenu} data-testid="history-row">
            <ItemContent
                onClick={() => onReplay?.(entry)}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                <ItemTitle title={title}>{title}</ItemTitle>
                {detailsOverride ?? (
                    detailsPath && (
                        <ItemDetails title={detailsPath}>
                            {detailsPath}
                        </ItemDetails>
                    )
                )}
                <ItemMeta>
                    <span>{time}</span>
                    {entry.duration && <span>{entry.duration < 1000 ? `${entry.duration}ms` : `${(entry.duration / 1000).toFixed(2)}s`}</span>}
                    {code != null && <span>{code}</span>}
                </ItemMeta>
            </ItemContent>
            {/* Starred marker: right side, monochrome lucide (inherits the
                row's icon colour), fixed-width slot so rows line up whether
                or not starred. */}
            <StarSlot data-starred={entry.starred || undefined} title={entry.starred ? 'Starred' : undefined}>
                {entry.starred && <Star size={14} fill="currentColor" />}
            </StarSlot>
        </HistoryItem>
    );
};

/** Fixed-width right-hand star slot — keeps row alignment identical whether
    or not an entry is starred (no per-row width jitter). */
const StarSlot = styled.span`
    width: 16px;
    flexShrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--apinox-icon-foreground);
`;


interface HistorySidebarProps {
    history: RequestHistoryEntry[];
    onReplay?: (entry: RequestHistoryEntry) => void;
    onToggleStar?: (id: string) => void;
    onDelete?: (id: string) => void;
}
interface HistoryFilters {
    dateFrom?: string;
    dateTo?: string;
    statusCode?: string;
    successOnly?: boolean;
    failedOnly?: boolean;
    projectName?: string;
    durationMin?: number;
    durationMax?: number;
}

export default function HistorySidebar({
    history,
    onReplay,
    onToggleStar,
    onDelete
}: HistorySidebarProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMenuOpen, setFilterMenuOpen] = useState(false);
    const [filters, setFilters] = useState<HistoryFilters>({});
    // Viewport position for the filter popout (computed from the trigger's
    // rect at open time; the panel is position:fixed so the viewport is the
    // containing block — the sidebar panel's overflow:hidden can't clip it).
    const filterTriggerRef = useRef<HTMLButtonElement>(null);
    const [filterMenuPos, setFilterMenuPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
    // Per-entry right-click menu (star / copy XML / delete). The inline
    // star + trash buttons used to live on every row — they added vertical
    // space and clutter; the context menu keeps the same actions reachable
    // without widening the rows (t_favorites).
    const [rowCtxMenu, setRowCtxMenu] = useState<{ x: number; y: number; entry: RequestHistoryEntry } | null>(null);

    const openFilterMenu = () => {
        if (filterMenuOpen) {
            setFilterMenuOpen(false);
            setFilterMenuPos(null);
            return;
        }
        const rect = filterTriggerRef.current?.getBoundingClientRect();
        if (rect) {
            const MENU_WIDTH = 260;
            const MENU_ESTIMATED_HEIGHT = 340;
            let top = rect.bottom + 4;
            const maxHeight = Math.max(160, window.innerHeight - top - 8);
            if (top + Math.min(MENU_ESTIMATED_HEIGHT, maxHeight) > window.innerHeight) {
                // Not enough room below: open above the trigger instead.
                const height = Math.min(MENU_ESTIMATED_HEIGHT, Math.max(160, rect.top - 8));
                top = Math.max(8, rect.top - height - 4);
            }
            let left = rect.right - MENU_WIDTH;
            if (left < 8) left = Math.max(8, rect.left);
            setFilterMenuPos({ top, left, maxHeight });
        }
        setFilterMenuOpen(true);
    };

    const closeFilterMenu = () => {
        setFilterMenuOpen(false);
        setFilterMenuPos(null);
    };

    // Close on Escape (the panel is a fixed overlay, not a dialog — there is
    // no focus trap; Escape and outside clicks are the dismissal paths).
    useEffect(() => {
        if (!filterMenuOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeFilterMenu();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [filterMenuOpen]);

    // Get unique project names for filter dropdown
    const projectNames = useMemo(() => {
        const names = new Set(history.map(e => e.projectName));
        return Array.from(names).sort();
    }, [history]);

    // Filter history based on search and filters
    const filteredHistory = useMemo(() => {
        let filtered = history;

        // Text search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(entry =>
                entry.requestName.toLowerCase().includes(term) ||
                entry.operationName.toLowerCase().includes(term) ||
                entry.projectName.toLowerCase().includes(term) ||
                entry.endpoint.toLowerCase().includes(term)
            );
        }

        // Date range filter
        if (filters.dateFrom) {
            const fromTime = new Date(filters.dateFrom).getTime();
            filtered = filtered.filter(entry => entry.timestamp >= fromTime);
        }
        if (filters.dateTo) {
            const toTime = new Date(filters.dateTo).setHours(23, 59, 59, 999);
            filtered = filtered.filter(entry => entry.timestamp <= toTime);
        }

        // Status code filter
        if (filters.statusCode) {
            filtered = filtered.filter(entry => 
                entry.statusCode?.toString().startsWith(filters.statusCode!)
            );
        }

        // Success/Failed filter
        if (filters.successOnly) {
            filtered = filtered.filter(entry => entry.success === true);
        }
        if (filters.failedOnly) {
            filtered = filtered.filter(entry => entry.success === false);
        }

        // Project filter
        if (filters.projectName) {
            filtered = filtered.filter(entry => entry.projectName === filters.projectName);
        }

        // Duration filter
        if (filters.durationMin !== undefined) {
            filtered = filtered.filter(entry => 
                entry.duration !== undefined && entry.duration >= filters.durationMin!
            );
        }
        if (filters.durationMax !== undefined) {
            filtered = filtered.filter(entry => 
                entry.duration !== undefined && entry.duration <= filters.durationMax!
            );
        }

        return filtered;
    }, [history, searchTerm, filters]);

    // Group by time
    const groupedHistory = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();

        const yesterday = new Date(todayTime - 24 * 60 * 60 * 1000);
        const yesterdayTime = yesterday.getTime();

        const thisWeek = new Date(todayTime - 7 * 24 * 60 * 60 * 1000);
        const thisWeekTime = thisWeek.getTime();

        const groups: {
            starred: RequestHistoryEntry[];
            today: RequestHistoryEntry[];
            yesterday: RequestHistoryEntry[];
            thisWeek: RequestHistoryEntry[];
            older: RequestHistoryEntry[];
        } = {
            starred: [],
            today: [],
            yesterday: [],
            thisWeek: [],
            older: []
        };

        filteredHistory.forEach(entry => {
            // Starred entries now live in their own Favorites accordion
            // section of the unified sidebar (and still appear below in
            // their time bucket), so they are NOT collected into a separate
            // in-history ⭐ group — that would render them twice and waste
            // vertical space (t_favorites).
            if (entry.timestamp >= todayTime) {
                groups.today.push(entry);
            } else if (entry.timestamp >= yesterdayTime) {
                groups.yesterday.push(entry);
            } else if (entry.timestamp >= thisWeekTime) {
                groups.thisWeek.push(entry);
            } else {
                groups.older.push(entry);
            }
        });

        return groups;
    }, [filteredHistory]);

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (ms?: number) => {
        if (!ms) return '';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const hasActiveFilters = Object.keys(filters).length > 0;

    const clearFilters = () => {
        setFilters({});
    };

    // Per-entry right-click menu (star / copy XML / delete). Rendered via
    // SidebarContextMenu (fixed positioning survives the sidebar's
    // overflow:hidden).
    const rowSections = (entry: RequestHistoryEntry): CtxMenuSection[] => {
        const items: CtxMenuItem[] = [
            {
                icon: Star,
                label: entry.starred ? 'Remove from favorites' : 'Add to favorites',
                onClick: () => {
                    onToggleStar?.(entry.id);
                    setRowCtxMenu(null);
                },
            },
            { icon: Copy, label: 'Copy Request XML', copyText: entry.requestBody || '' },
            {
                icon: Trash2,
                label: 'Delete from history',
                danger: true,
                onClick: () => {
                    onDelete?.(entry.id);
                    setRowCtxMenu(null);
                },
            },
        ];
        return [{ title: 'Entry', items }];
    };

    const renderHistoryItem = (entry: RequestHistoryEntry) => (
        <HistoryRow
            key={entry.id}
            entry={entry}
            onReplay={(e) => onReplay?.(e)}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setRowCtxMenu({ x: e.clientX, y: e.clientY, entry });
            }}
        />
    );

    if (history.length === 0) {
        return (
            <EmptyState
                icon={Clock}
                title="No request history yet"
                description="Execute a manual request to see it appear here"
            />
        );
    }

    return (
        <>
            <HeaderRow>
                <SearchWrap>
                    <SearchBar
                        type="text"
                        placeholder="Search history..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </SearchWrap>
                <FilterMenuTrigger
                    ref={filterTriggerRef}
                    $active={filterMenuOpen || hasActiveFilters}
                    onClick={openFilterMenu}
                    title="Advanced Filters"
                    aria-label="Advanced Filters"
                    aria-expanded={filterMenuOpen}
                >
                    <Menu size={14} />
                </FilterMenuTrigger>
            </HeaderRow>

            {filterMenuOpen && filterMenuPos && (
                <>
                    {/* Outside-click dismissal layer (below the panel). */}
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                        onClick={closeFilterMenu}
                    />
                    <FilterMenuPanel
                        style={{
                            top: filterMenuPos.top,
                            left: filterMenuPos.left,
                            maxHeight: filterMenuPos.maxHeight,
                        }}
                    >
                        <FilterMenuTitle>Advanced Filters</FilterMenuTitle>
                        <FilterSection>
                            {/* Date Range */}
                            <FilterRow>
                                <FilterLabel>Date Range:</FilterLabel>
                                <FilterInput
                                    type="date"
                                    value={filters.dateFrom || ''}
                                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
                                    placeholder="From"
                                />
                                <span>to</span>
                                <FilterInput
                                    type="date"
                                    value={filters.dateTo || ''}
                                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
                                    placeholder="To"
                                />
                            </FilterRow>

                            {/* Status & Success/Fail */}
                            <FilterRow>
                                <FilterLabel>Status:</FilterLabel>
                                <FilterSelect
                                    value={filters.statusCode || ''}
                                    onChange={(e) => setFilters({ ...filters, statusCode: e.target.value || undefined })}
                                >
                                    <option value="">All</option>
                                    <option value="2">2xx (Success)</option>
                                    <option value="4">4xx (Client Error)</option>
                                    <option value="5">5xx (Server Error)</option>
                                </FilterSelect>

                                <FilterButton
                                    $active={filters.successOnly}
                                    onClick={() => setFilters({
                                        ...filters,
                                        successOnly: !filters.successOnly,
                                        failedOnly: false
                                    })}
                                >
                                    ✓ Success Only
                                </FilterButton>

                                <FilterButton
                                    $active={filters.failedOnly}
                                    onClick={() => setFilters({
                                        ...filters,
                                        failedOnly: !filters.failedOnly,
                                        successOnly: false
                                    })}
                                >
                                    ✗ Failed Only
                                </FilterButton>
                            </FilterRow>

                            {/* Project Filter */}
                            {projectNames.length > 1 && (
                                <FilterRow>
                                    <FilterLabel>Project:</FilterLabel>
                                    <FilterSelect
                                        value={filters.projectName || ''}
                                        onChange={(e) => setFilters({ ...filters, projectName: e.target.value || undefined })}
                                    >
                                        <option value="">All Projects</option>
                                        {projectNames.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </FilterSelect>
                                </FilterRow>
                            )}

                            {/* Duration Range */}
                            <FilterRow>
                                <FilterLabel>Duration (ms):</FilterLabel>
                                <FilterInput
                                    type="number"
                                    min="0"
                                    value={filters.durationMin ?? ''}
                                    onChange={(e) => setFilters({ ...filters, durationMin: e.target.value ? parseInt(e.target.value) : undefined })}
                                    placeholder="Min"
                                />
                                <span>to</span>
                                <FilterInput
                                    type="number"
                                    min="0"
                                    value={filters.durationMax ?? ''}
                                    onChange={(e) => setFilters({ ...filters, durationMax: e.target.value ? parseInt(e.target.value) : undefined })}
                                    placeholder="Max"
                                />
                            </FilterRow>

                            {/* Clear Filters */}
                            {hasActiveFilters && (
                                <FilterRow>
                                    <ClearFiltersButton onClick={clearFilters}>
                                        <X size={14} />
                                        Clear All Filters
                                    </ClearFiltersButton>
                                </FilterRow>
                            )}
                        </FilterSection>
                    </FilterMenuPanel>
                </>
            )}

                <HistoryList>
                    {groupedHistory.today.length > 0 && (
                        <Section>
                            <SectionTitle>Today</SectionTitle>
                            {groupedHistory.today.map(renderHistoryItem)}
                        </Section>
                    )}

                    {groupedHistory.yesterday.length > 0 && (
                        <Section>
                            <SectionTitle>Yesterday</SectionTitle>
                            {groupedHistory.yesterday.map(renderHistoryItem)}
                        </Section>
                    )}

                    {groupedHistory.thisWeek.length > 0 && (
                        <Section>
                            <SectionTitle>This Week</SectionTitle>
                            {groupedHistory.thisWeek.map(renderHistoryItem)}
                        </Section>
                    )}

                    {groupedHistory.older.length > 0 && (
                        <Section>
                            <SectionTitle>Older</SectionTitle>
                            {groupedHistory.older.map(renderHistoryItem)}
                        </Section>
                    )}

                {filteredHistory.length === 0 && (
                    <EmptyState
                        icon={Clock}
                        title="No matching history"
                        description="Try adjusting your filters"
                    />
                )}
            </HistoryList>

            {/* Per-row context menu (star / copy XML / delete) — the
                star + trash buttons used to sit inline on every row. */}
            {rowCtxMenu && (
                <SidebarContextMenu
                    x={rowCtxMenu.x}
                    y={rowCtxMenu.y}
                    sections={rowSections(rowCtxMenu.entry)}
                    onClose={() => setRowCtxMenu(null)}
                />
            )}
        </>
    );
}


