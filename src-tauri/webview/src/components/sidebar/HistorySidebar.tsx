import { useState, useMemo } from 'react';
import styled from 'styled-components';
import {
    Star,
    Trash2,
    Clock,
    Filter,
    X
} from 'lucide-react';
import { RequestHistoryEntry } from '@shared/models';
import { EmptyState } from '../common/EmptyState';
import { SidebarContainer, SidebarContent, SidebarHeader, SidebarHeaderTitle } from './shared/SidebarStyles';
import { IconButton } from '../common/Button';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_LG } from '../../styles/spacing';

const Container = styled(SidebarContainer)`
    padding: 0;
`;

const Content = styled(SidebarContent)`
    display: flex;
    flex-direction: column;
`;

const Section = styled.div`
    margin-bottom: ${SPACING_LG};
`;

const SectionTitle = styled.div`
    font-size: 11px;
    font-weight: 600;
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
    padding: ${SPACING_SM};
    border-radius: 4px;
    margin-bottom: ${SPACING_SM};
    &:focus {
        outline: 1px solid var(--apinox-focusBorder);
    }
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
    font-size: 11px;
    font-weight: 600;
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
    font-size: 12px;
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
    font-size: 12px;
    &:focus {
        outline: 1px solid var(--apinox-focusBorder);
    }
`;

const FilterButton = styled.button<{ $active?: boolean }>`
    background: ${props => props.$active ? 'var(--apinox-button-background)' : 'transparent'};
    color: var(--apinox-button-foreground);
    border: 1px solid var(--apinox-input-border);
    padding: ${SPACING_XS} ${SPACING_SM};
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: ${SPACING_XS};
    
    &:hover {
        background: var(--apinox-button-hoverBackground);
    }
`;

const ClearFiltersButton = styled(FilterButton)`
    margin-left: auto;
`;

const FilterToggle = styled.button<{ $expanded: boolean }>`
    background: transparent;
    border: none;
    color: var(--apinox-button-foreground);
    padding: ${SPACING_XS} ${SPACING_SM};
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: ${SPACING_XS};
    font-size: 12px;
    margin-bottom: ${SPACING_SM};
    width: 100%;
    justify-content: space-between;
    border-radius: 4px;
    
    &:hover {
        background: var(--apinox-list-hoverBackground);
    }
`;

const HistoryItem = styled.div<{ $success?: boolean }>`
    display: flex;
    align-items: flex-start;
    gap: ${SPACING_SM};
    padding: ${SPACING_SM};
    margin-bottom: ${SPACING_XS};
    background: var(--apinox-list-inactiveSelectionBackground);
    border-radius: 4px;
    cursor: pointer;
    border-left: 3px solid ${props =>
        props.$success === false
            ? 'var(--apinox-testing-iconFailed)'
            : props.$success === true
                ? 'var(--apinox-testing-iconPassed)'
                : 'var(--apinox-input-border)'
    };

    &:hover {
        background: var(--apinox-list-hoverBackground);
    }
`;

const ItemContent = styled.div`
    flex: 1;
    min-width: 0;
`;

const ItemTitle = styled.div`
    font-weight: 500;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const ItemDetails = styled.div`
    font-size: 11px;
    opacity: 0.7;
    margin-top: 2px;
`;

const ItemMeta = styled.div`
    font-size: 10px;
    opacity: 0.5;
    margin-top: 2px;
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
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
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<HistoryFilters>({});

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
            if (entry.starred) {
                groups.starred.push(entry);
            }

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

    const renderHistoryItem = (entry: RequestHistoryEntry) => (
        <HistoryItem key={entry.id} $success={entry.success}>
            <ItemContent onClick={() => onReplay?.(entry)}>
                <ItemTitle>{entry.requestName || entry.operationName}</ItemTitle>
                <ItemDetails>
                    {entry.projectName} › {entry.interfaceName} › {entry.operationName}
                </ItemDetails>
                <ItemMeta>
                    <span>{formatTime(entry.timestamp)}</span>
                    {entry.duration && <span>{formatDuration(entry.duration)}</span>}
                    {entry.statusCode && <span>{entry.statusCode}</span>}
                </ItemMeta>
            </ItemContent>

            <IconButton
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleStar?.(entry.id);
                }}
                title={entry.starred ? 'Remove from favorites' : 'Add to favorites'}
                style={{ 
                    opacity: entry.starred ? 1 : 0.6,
                    color: entry.starred ? 'var(--apinox-editorWarning-foreground)' : undefined
                }}
            >
                <Star size={14} fill={entry.starred ? 'currentColor' : 'none'} />
            </IconButton>

            <IconButton
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(entry.id);
                }}
                title="Delete from history"
            >
                <Trash2 size={14} />
            </IconButton>
        </HistoryItem>
    );

    if (history.length === 0) {
        return (
            <Container>
                <SidebarHeader>
                    <SidebarHeaderTitle>
                        History
                    </SidebarHeaderTitle>
                </SidebarHeader>
                <Content>
                    <EmptyState
                        icon={Clock}
                        title="No request history yet"
                        description="Execute a manual request to see it appear here"
                    />
                </Content>
            </Container>
        );
    }

    return (
        <Container>
            <SidebarHeader>
                <SidebarHeaderTitle>
                    History ({filteredHistory.length}/{history.length})
                </SidebarHeaderTitle>
            </SidebarHeader>

            <Content>
                <SearchBar
                    type="text"
                    placeholder="Search history..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />

                <FilterToggle $expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Filter size={14} />
                        Advanced Filters
                        {hasActiveFilters && <span style={{ opacity: 0.7 }}>({Object.keys(filters).length} active)</span>}
                    </span>
                    {showFilters ? '▼' : '▶'}
                </FilterToggle>

                {showFilters && (
                    <FilterSection>
                        {/* Date Range */}
                        <FilterRow>
                            <FilterLabel>Date Range:</FilterLabel>
                            <FilterInput
                                type="date"
                                value={filters.dateFrom || ''}
                                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                placeholder="From"
                            />
                            <span>to</span>
                            <FilterInput
                                type="date"
                                value={filters.dateTo || ''}
                                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
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
                                value={filters.durationMin || ''}
                                onChange={(e) => setFilters({ 
                                    ...filters, 
                                    durationMin: e.target.value ? parseInt(e.target.value) : undefined 
                                })}
                                placeholder="Min"
                            />
                            <span>to</span>
                            <FilterInput
                                type="number"
                                min="0"
                                value={filters.durationMax || ''}
                                onChange={(e) => setFilters({ 
                                    ...filters, 
                                    durationMax: e.target.value ? parseInt(e.target.value) : undefined 
                                })}
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
                )}

                <HistoryList>
                    {groupedHistory.starred.length > 0 && (
                        <Section>
                            <SectionTitle>⭐ Favorites</SectionTitle>
                            {groupedHistory.starred.map(renderHistoryItem)}
                        </Section>
                    )}

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
            </Content>
        </Container>
    );
}


