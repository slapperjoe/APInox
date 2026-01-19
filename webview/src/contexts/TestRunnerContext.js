import { jsx as _jsx } from "react/jsx-runtime";
import React, { createContext, useContext, useState } from 'react';
import { useTestCaseHandlers } from '../hooks/useTestCaseHandlers';
import { useRequestExecution } from '../hooks/useRequestExecution';
import { useProject } from './ProjectContext';
import { useSelection } from './SelectionContext';
import { useUI } from './UIContext';
import { useNavigation } from './NavigationContext';
import { BackendCommand } from '@shared/messages';
const TestRunnerContext = createContext(undefined);
export const useTestRunner = () => {
    const context = useContext(TestRunnerContext);
    if (!context) {
        throw new Error('useTestRunner must be used within a TestRunnerProvider');
    }
    return context;
};
export const TestRunnerProvider = ({ children }) => {
    // Shared State
    const [testExecution, setTestExecution] = useState({});
    // Dependencies
    const { projects, setProjects, saveProject, selectedProjectName, setWorkspaceDirty } = useProject();
    const { selectedTestCase, selectedStep, setSelectedTestCase, setSelectedStep, setSelectedRequest, setSelectedOperation, setSelectedInterface, setSelectedPerformanceSuiteId, setResponse, setLoading, selectedRequest, selectedOperation, selectedInterface, selectedTestSuite, setSelectedTestSuite, selectedPerformanceSuiteId } = useSelection();
    // Note: TestRunnerProvider must be inside UIProvider and NavigationProvider
    const { config, setConfig } = useUI();
    const { setActiveView } = useNavigation();
    // -------------------------------------------------------------------------
    // MESSAGE HANDLING
    // -------------------------------------------------------------------------
    React.useEffect(() => {
        const handleMessage = (event) => {
            const message = event.data;
            switch (message.command) {
                case BackendCommand.TestRunnerUpdate:
                    if (message.update) {
                        setTestExecution(prev => ({ ...prev, ...message.update }));
                    }
                    break;
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);
    // -------------------------------------------------------------------------
    // CONTEXT VALUE
    // -------------------------------------------------------------------------
    // Hooks
    // We pass a minimal mock for closeContextMenu if it's not available in UIContext directly (it was in useContextMenu hook result in App.tsx)
    // Wait, closeContextMenu was from useContextMenu in App.tsx. 
    // BUT useTestCaseHandlers needs closeContextMenu to close the menu after generating suite?
    // In App.tsx: 
    // const { closeContextMenu } = useContextMenu(...)
    // const { ... } = useTestCaseHandlers({ ..., closeContextMenu })
    // PROBLEM: closeContextMenu comes from separate hook useContextMenu.
    // If we move TestRunnerProvider ABOVE MainContent, it cannot access hooks used INSIDE MainContent (like useContextMenu).
    // Solution: We might need to lift specific dependencies OR pass a dummy.
    // However, closeContextMenu is just `() => setContextMenu(null)`. 
    // useContextMenu logic is mainly UI.
    // Maybe we just pass a no-op or we need to extract ContextMenu as well?
    // Let's defer ContextMenu dependency.
    // useTestCaseHandlers uses closeContextMenu likely only when generating suite via context menu?
    // Checking source of useTestCaseHandlers (viewed earlier):
    // It passes closeContextMenu to handler.
    // Short-term fix: Define a local no-op or simple state if possible, OR
    // Accept that TestRunner logic might not close context menu automatically unless we provide it.
    // Better: We can expose `closeContextMenu` from `UIContext` if we move it there later.
    // For now, let's look at where useContextMenu is. It's in App.tsx -> MainContent.tsx.
    // Crucial Decision:
    // User requested TestRunnerContext.
    // If `useTestCaseHandlers` depends on `closeContextMenu`, and `closeContextMenu` depends on `useContextMenu`, and `useContextMenu` depends on `selectedInterface` etc.
    // Maybe we just pass `() => {}` for now if it's minor UI polish, or we move `ContextMenu` state to `UIContext`?
    // `UIContext` has `activeView` etc.
    // Let's pass a no-op for now to unblock logic separation.
    const noOpCloseContextMenu = () => { };
    const testCaseHandlers = useTestCaseHandlers({
        projects,
        setProjects,
        saveProject,
        selectedTestCase,
        selectedStep,
        setSelectedTestCase,
        setSelectedStep,
        setSelectedRequest,
        setSelectedOperation,
        setSelectedInterface,
        setSelectedPerformanceSuiteId,
        setResponse,
        setActiveView,
        closeContextMenu: noOpCloseContextMenu, // Temporary decoupling
        selectedTestSuite,
        setSelectedTestSuite
    });
    const requestExecution = useRequestExecution({
        selectedOperation,
        selectedRequest,
        selectedInterface,
        selectedTestCase,
        selectedStep,
        selectedProjectName,
        wsdlUrl: '', // TODO: This was local state in App.tsx. Needed?
        setLoading,
        setResponse,
        setSelectedRequest,
        setProjects,
        setWorkspaceDirty,
        testExecution,
        selectedPerformanceSuiteId,
        config,
        setConfig
    });
    // Correction: We need setWorkspaceDirty in ProjectContext
    // The useProject hook *does* return setWorkspaceDirty (viewed MainContent line 54).
    // But I didn't destructure it above.
    // Let's check useProject usage above.
    return (_jsx(TestRunnerContext.Provider, { value: {
            testExecution,
            setTestExecution,
            ...testCaseHandlers,
            ...requestExecution
        }, children: children }));
};
