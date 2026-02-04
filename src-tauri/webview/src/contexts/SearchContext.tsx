/**
 * SearchContext.tsx
 * 
 * Manages workspace search state and operations.
 * Provides search functionality across Projects, Explorer, Tests, and other views.
 * 
 * Features:
 * - Debounced search input (300ms)
 * - Results grouped by view
 * - Keyboard navigation support
 * - Integration with navigation/selection contexts
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useProject } from './ProjectContext';
import { useSelection } from './SelectionContext';
import { useNavigation } from './NavigationContext';
import { SidebarView } from '@shared/models';
import {
    SearchResult,
    SearchOptions,
    searchWorkspace,
    ExploredInterface,
} from '../utils/workspaceSearch';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface SearchContextValue {
    // State
    searchQuery: string;
    searchResults: SearchResult[];
    isSearching: boolean;
    selectedIndex: number;
    isSearchVisible: boolean;
    lastSelectedResult: SearchResult | null;

    // Actions
    setSearchQuery: (query: string) => void;
    performSearch: (query: string, options?: SearchOptions) => void;
    clearSearch: () => void;
    selectResult: (result: SearchResult) => void;
    setSelectedIndex: (index: number) => void;
    showSearch: () => void;
    hideSearch: () => void;
    toggleSearch: () => void;
    navigateToLastResult: () => void;

    // Computed
    groupedResults: Map<string, SearchResult[]>;
}

// =============================================================================
// CONTEXT CREATION
// =============================================================================

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

interface SearchProviderProps {
    children: React.ReactNode;
    exploredInterfaces?: ExploredInterface[];
}

export const SearchProvider: React.FC<SearchProviderProps> = ({ 
    children,
    exploredInterfaces = []
}) => {
    // -------------------------------------------------------------------------
    // STATE
    // -------------------------------------------------------------------------

    const [searchQuery, setSearchQueryState] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [lastSelectedResult, setLastSelectedResult] = useState<SearchResult | null>(null);

    // -------------------------------------------------------------------------
    // CONTEXT DEPENDENCIES
    // -------------------------------------------------------------------------

    const { 
        projects, 
        ensureProjectExpanded,
        ensureInterfaceExpanded,
        ensureOperationExpanded,
        setSelectedProjectName 
    } = useProject();
    
    const {
        setSelectedInterface,
        setSelectedOperation,
        setSelectedRequest,
        setSelectedTestSuite,
        setSelectedTestCase,
    } = useSelection();
    
    const { setActiveView } = useNavigation();

    // -------------------------------------------------------------------------
    // REFS
    // -------------------------------------------------------------------------

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // -------------------------------------------------------------------------
    // SEARCH LOGIC
    // -------------------------------------------------------------------------

    /**
     * Execute search with current query
     */
    const performSearch = useCallback((query: string, options?: SearchOptions) => {
        if (!query || query.trim().length === 0) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        try {
            const results = searchWorkspace(
                query.trim(),
                projects,
                exploredInterfaces,
                {
                    maxResults: 50,
                    minScore: 0,
                    ...options,
                }
            );

            setSearchResults(results);
            setSelectedIndex(0); // Reset selection to first result
        } catch (error) {
            console.error('[SearchContext] Search failed:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [projects, exploredInterfaces]);

    /**
     * Set search query with debouncing
     */
    const setSearchQuery = useCallback((query: string) => {
        setSearchQueryState(query);

        // Clear existing timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Debounce search
        if (query.trim().length === 0) {
            setSearchResults([]);
            setIsSearching(false);
        } else {
            setIsSearching(true);
            searchTimeoutRef.current = setTimeout(() => {
                performSearch(query);
            }, 300); // 300ms debounce
        }
    }, [performSearch]);

    /**
     * Clear search state
     */
    const clearSearch = useCallback(() => {
        setSearchQueryState('');
        setSearchResults([]);
        setSelectedIndex(0);
        setIsSearching(false);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
    }, []);

    /**
     * Navigate to a search result
     * Expands tree nodes, sets selection, and opens the item in the editor
     */
    const navigateToResult = useCallback((result: SearchResult) => {
        const { data, type, view } = result;
        
        console.log('[SearchContext] Navigating to result:', { 
            type, 
            view, 
            name: result.name,
            data: {
                projectName: data.projectName,
                interfaceId: data.interface?.id,
                interfaceName: data.interface?.name,
                operationId: data.operation?.id,
                operationName: data.operation?.name,
                requestId: data.request?.id,
                requestName: data.request?.name
            }
        });

        if (view === 'projects') {
            // Switch to Projects view
            setActiveView(SidebarView.PROJECTS);
            
            const { projectName, interface: iface, operation, request, folder } = data;

            // Delay to allow view switch to complete before manipulating tree state
            setTimeout(() => {
                // Set selected project and ensure it's expanded
                if (projectName) {
                    console.log('[SearchContext] Step 1: Expanding project:', projectName);
                    setSelectedProjectName(projectName);
                    ensureProjectExpanded(projectName);
                }

                // Another delay for tree expansion to render
                setTimeout(() => {
                    // Handle different item types
                    switch (type) {
                        case 'interface':
                            if (iface && projectName) {
                                console.log('[SearchContext] Step 2: Selecting interface:', {
                                    id: iface.id,
                                    name: iface.name
                                });
                                // Expand interface and select it
                                ensureInterfaceExpanded(projectName, iface.name);
                                setSelectedInterface(iface);
                                setSelectedOperation(null);
                                setSelectedRequest(null);
                            }
                            break;

                        case 'operation':
                            if (operation && iface && projectName) {
                                console.log('[SearchContext] Step 2: Expanding interface for operation:', iface.name);
                                // Expand interface and operation
                                ensureInterfaceExpanded(projectName, iface.name);
                                
                                setTimeout(() => {
                                    console.log('[SearchContext] Step 3: Selecting operation:', {
                                        id: operation.id,
                                        name: operation.name
                                    });
                                    ensureOperationExpanded(projectName, iface.name, operation.name);
                                    // Select operation
                                    setSelectedInterface(iface);
                                    setSelectedOperation(operation);
                                    setSelectedRequest(null);
                                }, 100);
                            }
                            break;

                        case 'request':
                            if (request && operation && iface && projectName) {
                                console.log('[SearchContext] Step 2: Expanding interface for request:', iface.name);
                                // Expand all parent nodes
                                ensureInterfaceExpanded(projectName, iface.name);
                                
                                setTimeout(() => {
                                    console.log('[SearchContext] Step 3: Expanding operation:', operation.name);
                                    ensureOperationExpanded(projectName, iface.name, operation.name);
                                    
                                    setTimeout(() => {
                                        console.log('[SearchContext] Step 4: Selecting request:', {
                                            id: request.id,
                                            name: request.name
                                        });
                                        // Select request (this should open it in editor)
                                        setSelectedInterface(iface);
                                        setSelectedOperation(operation);
                                        setSelectedRequest(request);
                                        
                                        console.log('[SearchContext] Selection complete. Current selection state:', {
                                            project: projectName,
                                            interface: { id: iface.id, name: iface.name },
                                            operation: { id: operation.id, name: operation.name },
                                            request: { id: request.id, name: request.name }
                                        });
                                    }, 100);
                                }, 100);
                            }
                            break;

                        case 'folder':
                            // TODO: Implement folder navigation
                            // For now, just select the project
                            console.log('[SearchContext] Folder navigation not yet implemented');
                            break;

                        default:
                            console.warn('[SearchContext] Unknown result type:', type);
                    }
                }, 100);
            }, 100);
        } else if (view === 'explorer') {
            // Switch to Explorer view
            setActiveView(SidebarView.EXPLORER);
            
            // Handle Explorer navigation
            setTimeout(() => {
                const { operation } = data;
                if (operation) {
                    console.log('[SearchContext] Selecting explorer operation:', operation.name);
                    setSelectedOperation(operation);
                    setSelectedInterface(null);
                    setSelectedRequest(null);
                }
            }, 100);
        } else if (view === 'tests') {
            // Switch to Tests view
            setActiveView(SidebarView.TESTS);
            
            const { projectName, testSuiteId, testCaseId } = data;
            
            console.log('[SearchContext] Navigating to test:', { projectName, testSuiteId, testCaseId });
            
            // Delay to allow view switch to complete
            setTimeout(() => {
                // Find the project and test suite
                if (projectName && testSuiteId) {
                    const project = projects.find(p => p.name === projectName);
                    if (project) {
                        const testSuite = project.testSuites?.find(s => s.id === testSuiteId);
                        
                        if (testSuite) {
                            console.log('[SearchContext] Found test suite:', testSuite);
                            setSelectedTestSuite(testSuite);
                            
                            // If selecting a specific test case
                            if (testCaseId && type === 'test-case') {
                                const testCase = testSuite.testCases?.find(c => c.id === testCaseId);
                                if (testCase) {
                                    console.log('[SearchContext] Found test case:', testCase);
                                    setSelectedTestCase(testCase);
                                }
                            } else {
                                setSelectedTestCase(null);
                            }
                        } else {
                            console.warn('[SearchContext] Test suite not found:', testSuiteId);
                        }
                    }
                }
            }, 100);
        }
    }, [
        projects,
        setActiveView,
        setSelectedProjectName,
        ensureProjectExpanded,
        ensureInterfaceExpanded,
        ensureOperationExpanded,
        setSelectedInterface,
        setSelectedOperation,
        setSelectedRequest,
        setSelectedTestSuite,
        setSelectedTestCase,
    ]);

    /**
     * Show search interface
     */
    const showSearch = useCallback(() => {
        setIsSearchVisible(true);
    }, []);

    /**
     * Handle result selection
     */
    const selectResult = useCallback((result: SearchResult) => {
        // Save as last selected result
        setLastSelectedResult(result);
        
        // Navigate to the result
        navigateToResult(result);
        
        // Hide search UI
        setIsSearchVisible(false);
        clearSearch();
    }, [navigateToResult, clearSearch]);

    /**
     * Navigate to the last selected result
     */
    const navigateToLastResult = useCallback(() => {
        if (lastSelectedResult) {
            console.log('[SearchContext] Navigating to last result:', lastSelectedResult);
            navigateToResult(lastSelectedResult);
        }
    }, [lastSelectedResult, navigateToResult]);

    /**
     * Hide search interface
     */
    const hideSearch = useCallback(() => {
        setIsSearchVisible(false);
        clearSearch();
    }, [clearSearch]);

    /**
     * Toggle search visibility
     */
    const toggleSearch = useCallback(() => {
        setIsSearchVisible(prev => !prev);
        if (isSearchVisible) {
            clearSearch();
        }
    }, [isSearchVisible, clearSearch]);

    // -------------------------------------------------------------------------
    // COMPUTED VALUES
    // -------------------------------------------------------------------------

    /**
     * Group results by view for organized display
     */
    const groupedResults = useMemo(() => {
        const groups = new Map<string, SearchResult[]>();

        for (const result of searchResults) {
            const viewKey = result.view;
            const existing = groups.get(viewKey) || [];
            existing.push(result);
            groups.set(viewKey, existing);
        }

        return groups;
    }, [searchResults]);

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------

    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    // -------------------------------------------------------------------------
    // CONTEXT VALUE
    // -------------------------------------------------------------------------

    const value: SearchContextValue = {
        // State
        searchQuery,
        searchResults,
        isSearching,
        selectedIndex,
        isSearchVisible,
        lastSelectedResult,

        // Actions
        setSearchQuery,
        performSearch,
        clearSearch,
        selectResult,
        setSelectedIndex,
        showSearch,
        hideSearch,
        toggleSearch,
        navigateToLastResult,

        // Computed
        groupedResults,
    };

    return (
        <SearchContext.Provider value={value}>
            {children}
        </SearchContext.Provider>
    );
};

// =============================================================================
// HOOK
// =============================================================================

/**
 * Access the SearchContext
 * @throws Error if used outside SearchProvider
 */
export const useSearch = (): SearchContextValue => {
    const context = useContext(SearchContext);
    if (!context) {
        throw new Error('useSearch must be used within SearchProvider');
    }
    return context;
};
