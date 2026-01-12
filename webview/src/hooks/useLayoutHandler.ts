import { useState, useCallback, useEffect } from 'react';
import { SidebarView } from '@shared/models';

interface UseLayoutHandlerProps {
    config: any;
    setConfig: (config: any) => void;
    activeView: SidebarView;
    setActiveView: (view: SidebarView) => void;
    selectedRequest: any;
    selectedOperation: any;
    selectedInterface: any;
    projects: any[];
    selectedProjectName: string | null;
    setSelectedProjectName: (name: string | null) => void;
    setSelectedInterface: (iface: any) => void;
    setSelectedOperation: (op: any) => void;
    setSelectedRequest: (req: any) => void;
    selectedStep: any;
    selectedTestCase: any;
    setSelectedTestCase: (tc: any) => void;
    selectedPerformanceSuiteId: string | null;
    setSelectedPerformanceSuiteId: (id: string | null) => void;
}

export const useLayoutHandler = ({
    config,

    setConfig,
    setActiveView,
    selectedRequest,
    selectedOperation,
    selectedInterface,
    projects,
    selectedProjectName,
    setSelectedProjectName,
    setSelectedInterface,
    setSelectedOperation,
    setSelectedRequest,
    selectedStep,
    selectedTestCase,
    setSelectedTestCase,
    selectedPerformanceSuiteId,
    setSelectedPerformanceSuiteId
}: UseLayoutHandlerProps) => {
    const [isResizing, setIsResizing] = useState(false);

    // Split Ratio (default 20%)
    const [splitRatio, setSplitRatioState] = useState(20);

    // Sync split ratio with config
    useEffect(() => {
        if (config?.ui?.sidebarWidth) {
            setSplitRatioState(config.ui.sidebarWidth);
        }
    }, [config]);

    const setSplitRatio = useCallback((ratio: number) => {
        setSplitRatioState(ratio);
        // Debounce config update if needed, or update on stopResizing
    }, []);

    const startResizing = useCallback(() => setIsResizing(true), []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        if (config) {
            const newConfig = { ...config, ui: { ...config?.ui, sidebarWidth: splitRatio } };
            setConfig(newConfig);
        }
    }, [config, splitRatio, setConfig]);

    const resize = useCallback(
        (e: MouseEvent) => {
            if (isResizing) {
                const newWidth = (e.clientX / window.innerWidth) * 100;
                if (newWidth > 10 && newWidth < 50) {
                    setSplitRatio(newWidth);
                }
            }
        },
        [isResizing, setSplitRatio]
    );

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    // Layout Mode (Sidebar/Top)
    const layoutMode = config?.ui?.layoutMode || 'sidebar';

    // Auto-select logic when switching views
    const handleSetActiveViewWrapper = useCallback((view: SidebarView) => {
        setActiveView(view);

        if (view === SidebarView.PROJECTS || view === SidebarView.EXPLORER) {
            // If nothing selected, select the first available item deep-first
            if (!selectedRequest && !selectedOperation && !selectedInterface && projects.length > 0) {
                const p = projects[0];
                // Always ensure project is selected if none
                if (!selectedProjectName) setSelectedProjectName(p.name);

                // If nothing else is selected, drill down
                if (!selectedInterface && !selectedOperation && !selectedRequest) {
                    if (p.interfaces?.length > 0) {
                        const i = p.interfaces[0];
                        setSelectedInterface(i);
                        if (i.operations?.length > 0) {
                            const o = i.operations[0];
                            setSelectedOperation(o);
                            if (o.requests?.length > 0) {
                                setSelectedRequest(o.requests[0]);
                            }
                        }
                    }
                }
            }
        } else if (view === SidebarView.TESTS) {
            // Clear workspace request to prevent bleed-through
            setSelectedRequest(null);

            if (!selectedTestCase && !selectedStep) {
                for (const p of projects) {
                    if (p.testSuites?.length) {
                        const suite = p.testSuites[0];
                        if (suite.testCases?.length) {
                            setSelectedTestCase(suite.testCases[0]);
                            break;
                        }
                    }
                }
            }
        } else if (view === SidebarView.PERFORMANCE) {
            // Clear workspace request to prevent bleed-through
            setSelectedRequest(null);

            if (!selectedPerformanceSuiteId && config?.performanceSuites?.length) {
                setSelectedPerformanceSuiteId(config.performanceSuites[0].id);
            }
        }
    }, [
        setActiveView,
        selectedRequest,
        selectedOperation,
        selectedInterface,
        projects,
        selectedProjectName,
        selectedTestCase,
        selectedStep,
        selectedPerformanceSuiteId,
        config?.performanceSuites,
        setSelectedProjectName,
        setSelectedInterface,
        setSelectedOperation,
        setSelectedRequest,
        setSelectedTestCase,
        setSelectedPerformanceSuiteId
    ]);

    return {
        isResizing,
        splitRatio,
        layoutMode,
        startResizing,
        stopResizing,
        resize,
        handleSetActiveViewWrapper,
        setSplitRatio
    };
};
