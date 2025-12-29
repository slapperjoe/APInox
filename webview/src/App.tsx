import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, ContextMenu, ContextMenuItem } from './styles/App.styles';
import { bridge, isVsCode } from './utils/bridge';
import { Sidebar } from './components/Sidebar';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { HelpModal } from './components/HelpModal';

import { AddToTestCaseModal } from './components/modals/AddToTestCaseModal';
import { ConfirmationModal } from './components/modals/ConfirmationModal';
import { RenameModal } from './components/modals/RenameModal';
import { SampleModal } from './components/modals/SampleModal';
import { ExtractorModal } from './components/modals/ExtractorModal';
import { SettingsEditorModal } from './components/modals/SettingsEditorModal';
import { CreateReplaceRuleModal } from './components/modals/CreateReplaceRuleModal';
import { AddToDevOpsModal } from './components/modals/AddToDevOpsModal';
import { SoapUIInterface, SoapUIProject, SoapUIOperation, SoapUIRequest, SoapTestCase, SoapTestStep, SoapTestSuite, WatcherEvent, SidebarView, SoapRequestExtractor, SoapUIAssertion, ReplaceRule } from './models';
import { formatXml } from './utils/xmlFormatter';
import { CustomXPathEvaluator } from './utils/xpathEvaluator';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useProject } from './contexts/ProjectContext';
import { useSelection } from './contexts/SelectionContext';
import { useUI } from './contexts/UIContext';

// NOTE: DirtySoapConfigWeb interface removed - config type comes from models.ts

interface ConfirmationState {
    title: string;
    message: string;
    onConfirm: () => void;
}

// NOTE: Container, ContextMenu, ContextMenuItem moved to styles/App.styles.ts


function App() {
    // ==========================================================================
    // CONTEXT - Project state from ProjectContext
    // ==========================================================================
    const {
        projects,
        setProjects,
        selectedProjectName,
        setSelectedProjectName,
        workspaceDirty,
        setWorkspaceDirty,
        savedProjects,
        setSavedProjects,
        deleteConfirm,
        setDeleteConfirm,
        addProject,
        closeProject,
        loadProject,
        saveProject,
        toggleProjectExpand
    } = useProject();

    // ==========================================================================
    // CONTEXT - Selection state from SelectionContext
    // ==========================================================================
    const {
        selectedInterface,
        setSelectedInterface,
        selectedOperation,
        setSelectedOperation,
        selectedRequest,
        setSelectedRequest,
        selectedStep,
        setSelectedStep,
        selectedTestCase,
        setSelectedTestCase,
        response,
        setResponse,
        loading,
        setLoading
    } = useSelection();

    // ==========================================================================
    // LOCAL STATE - Remaining state that stays in App
    // ==========================================================================

    // Explorer State
    const [exploredInterfaces, setExploredInterfaces] = useState<SoapUIInterface[]>([]);
    const [explorerExpanded, setExplorerExpanded] = useState(false);
    const [testExecution, setTestExecution] = useState<Record<string, Record<string, {
        status: 'running' | 'pass' | 'fail',
        error?: string,
        assertionResults?: any[],
        response?: any
    }>>>({});



    const handleSelectTestSuite = (suiteId: string) => {
        const suite = projects.find(p => p.testSuites?.some(s => s.id === suiteId))?.testSuites?.find(s => s.id === suiteId);
        if (suite) {
            setSelectedTestCase(null);
            setSelectedStep(null);
            setSelectedRequest(null);
            setSelectedOperation(null);
            setSelectedInterface(null);
            setResponse(null);
            setActiveView(SidebarView.PROJECTS);
        }
    };

    const handleSelectTestCase = (caseId: string) => {
        // Find Case
        let foundCase: SoapTestCase | null = null;
        for (const p of projects) {
            if (p.testSuites) {
                for (const s of p.testSuites) {
                    const c = s.testCases?.find(tc => tc.id === caseId);
                    if (c) {
                        foundCase = c;
                        break;
                    }
                }
            }
            if (foundCase) break;
        }

        if (foundCase) {
            setSelectedTestCase(foundCase);
            setSelectedStep(null);
            setSelectedRequest(null);
            setSelectedOperation(null);
            setSelectedInterface(null);
            setResponse(null);
            setActiveView(SidebarView.PROJECTS);

            // Auto-select first step if it's a request?
            // For now, let WorkspaceLayout handle the Case View.
        } else {
            bridge.sendMessage({ command: 'error', message: `Could not find Test Case: ${caseId}` });
        }
    };

    // Backend Connection
    const [backendConnected, setBackendConnected] = useState(false);

    // ==========================================================================
    // CONTEXT - UI state from UIContext
    // ==========================================================================
    const {
        activeView,
        setActiveView,
        layoutMode,
        setLayoutMode,
        showLineNumbers,
        setShowLineNumbers,
        inlineElementValues,
        setInlineElementValues,
        hideCausalityData,
        setHideCausalityData,
        splitRatio,
        setSplitRatio,
        isResizing,
        setIsResizing,
        showSettings,
        setShowSettings,
        showHelp,
        setShowHelp,
        showDevOpsModal,
        setShowDevOpsModal,
        config,
        setConfig,
        rawConfig,
        setRawConfig,
        configPath,
        setConfigPath
    } = useUI();

    // UI State (remaining)
    const [inputType, setInputType] = useState<'url' | 'file'>('url');
    const [wsdlUrl, setWsdlUrl] = useState('http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL');
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [downloadStatus, setDownloadStatus] = useState<string[] | null>(null);

    // Watcher / Proxy State
    const [watcherHistory, setWatcherHistory] = useState<WatcherEvent[]>([]);
    const [watcherRunning, setWatcherRunning] = useState(false);
    const [proxyHistory, setProxyHistory] = useState<WatcherEvent[]>([]);
    const [proxyRunning, setProxyRunning] = useState(false);
    const [proxyConfig, setProxyConfig] = useState({ port: 9000, target: 'http://localhost:8080', systemProxyEnabled: true });

    const startTimeRef = useRef<number>(0);

    // Modals & Menu
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: string, data: any, isExplorer: boolean } | null>(null);
    const [renameState, setRenameState] = useState<{ active: boolean, type: string, data: any, value: string } | null>(null);
    const [confirmationModal, setConfirmationModal] = useState<ConfirmationState | null>(null);
    const [addToTestCaseModal, setAddToTestCaseModal] = React.useState<{ open: boolean, request: SoapUIRequest | null }>({ open: false, request: null });
    const [sampleModal, setSampleModal] = React.useState<{ open: boolean, schema: any | null, operationName: string }>({ open: false, schema: null, operationName: '' });
    const [extractorModal, setExtractorModal] = React.useState<{ xpath: string, value: string, source: 'body' | 'header', variableName: string } | null>(null);
    const [replaceRuleModal, setReplaceRuleModal] = React.useState<{ open: boolean, xpath: string, matchText: string, target: 'request' | 'response' }>({ open: false, xpath: '', matchText: '', target: 'response' });

    // Workspace State
    const [changelog, setChangelog] = useState<string>('');

    // NOTE: saveProject now comes from ProjectContext

    // Message Handler Hook
    useMessageHandler({
        setProjects,
        setExploredInterfaces,
        setExplorerExpanded,
        setLoading,
        setResponse,
        setDownloadStatus,
        setSelectedFile,
        setSampleModal,
        setBackendConnected,
        setConfig,
        setRawConfig,
        setLayoutMode,
        setShowLineNumbers,
        setSplitRatio,
        setInlineElementValues,
        setConfigPath,
        setProxyConfig,
        setSelectedProjectName,
        setWsdlUrl,
        setWorkspaceDirty,
        setSavedProjects,
        setChangelog,
        setWatcherHistory,
        setProxyHistory,
        setProxyRunning,
        setTestExecution,
        setActiveView,
        wsdlUrl,
        projects,
        proxyConfig,
        selectedTestCase,
        selectedRequest,
        startTimeRef,
        saveProject
    });

    // Initial Load
    useEffect(() => {
        // Request settings on load
        bridge.sendMessage({ command: 'getSettings' });
        bridge.sendMessage({ command: 'getAutosave' });
        bridge.sendMessage({ command: 'getWatcherHistory' });

        const state = bridge.getState();
        if (state) {
            setProjects(state.projects || []);
            setExploredInterfaces(state.exploredInterfaces || []);
            setExplorerExpanded(state.explorerExpanded ?? true);
            setWsdlUrl(state.wsdlUrl || '');
            if (state.lastSelectedProject) setSelectedProjectName(state.lastSelectedProject);
        }

        // Test Backend Connection
        bridge.sendMessage({ command: 'echo', message: 'ping' });
        // Retry every 5 seconds if not connected
        const interval = setInterval(() => {
            bridge.sendMessage({ command: 'echo', message: 'ping' });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Save State & Autosave
    useEffect(() => {
        const state = {
            projects,
            exploredInterfaces,
            explorerExpanded,
            wsdlUrl,
            lastSelectedProject: selectedProjectName
        };
        bridge.setState(state);

        // Autosave to file (debounced)
        const timer = setTimeout(() => {
            bridge.sendMessage({ command: 'autoSaveWorkspace', content: JSON.stringify(state) });
        }, 2000);
        return () => clearTimeout(timer);
    }, [projects, exploredInterfaces, explorerExpanded, wsdlUrl, selectedProjectName]);

    // Auto-save Open Projects (Project Paths)
    useEffect(() => {
        // Collect file names of all open projects
        const paths = projects.map(p => p.fileName).filter(Boolean) as string[];
        // Debounce slightly to avoid excessive writes
        const timer = setTimeout(() => {
            bridge.sendMessage({ command: 'saveOpenProjects', paths });
        }, 1000);
        return () => clearTimeout(timer);
    }, [projects]);

    // Sync selectedTestCase with latest projects state
    useEffect(() => {
        if (selectedTestCase) {
            // Re-hydrate stale selectedTestCase
            for (const p of projects) {
                if (p.testSuites) {
                    for (const s of p.testSuites) {
                        const updatedCase = s.testCases?.find(tc => tc.id === selectedTestCase.id);
                        if (updatedCase) {
                            if (updatedCase !== selectedTestCase) {
                                // console.log('[sync] Re-hydrating selectedTestCase', updatedCase.name);
                                setSelectedTestCase(updatedCase);
                            }
                            return;
                        }
                    }
                }
            }
        }
    }, [projects, selectedTestCase]);

    // (Message handling moved to useMessageHandler hook)

    // Resizing Logic
    const startResizing = useCallback(() => setIsResizing(true), []);
    const stopResizing = useCallback(() => {
        setIsResizing(false);
        if (config?.ui) {
            bridge.sendMessage({ command: 'saveUiState', ui: { ...config.ui, splitRatio: splitRatio } });
        }
    }, [config, splitRatio]);
    const resize = useCallback((e: MouseEvent) => {
        if (isResizing) {
            let newRatio = 0.5;
            if (layoutMode === 'horizontal') {
                newRatio = e.clientX / window.innerWidth;
            } else {
                newRatio = (e.clientY - 40) / (window.innerHeight - 40 - 30); // Approx headers
            }
            if (newRatio < 0.1) newRatio = 0.1;
            if (newRatio > 0.9) newRatio = 0.9;
            setSplitRatio(newRatio);
        }
    }, [isResizing, layoutMode]);

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


    // Handlers
    const loadWsdl = () => {
        if (inputType === 'url' && wsdlUrl) {
            bridge.sendMessage({ command: 'loadWsdl', url: wsdlUrl, isLocal: false });
        } else if (inputType === 'file' && selectedFile) {
            bridge.sendMessage({ command: 'loadWsdl', url: selectedFile, isLocal: true });
        }
    };

    const pickLocalWsdl = () => {
        bridge.sendMessage({ command: 'selectLocalWsdl' });
    };

    const executeRequest = (xml: string) => {
        console.log('[App] executeRequest called');
        console.log('[App] Context - Operation:', selectedOperation?.name, 'Request:', selectedRequest?.name);

        setLoading(true);
        setResponse(null);
        startTimeRef.current = Date.now();

        // Allow execution if we have a request context, even if not fully in an Operation content (e.g. Test Step)
        if (selectedOperation || selectedRequest) {
            const url = selectedRequest?.endpoint || selectedInterface?.definition || wsdlUrl;
            const opName = selectedOperation?.name || selectedRequest?.name || 'Unknown Operation';

            console.log('[App] Sending executeRequest message. URL:', url, 'Op:', opName);

            const logToOutput = (msg: string) => bridge.sendMessage({ command: 'log', message: msg });
            logToOutput(`Starting execution of step: ${selectedStep?.name || selectedRequest?.name}`);

            // Calculate context variables if running a test step
            const contextVariables: Record<string, string> = {};
            if (selectedTestCase && selectedStep) {
                const currentIndex = selectedTestCase.steps.findIndex(s => s.id === selectedStep.id);
                if (currentIndex > 0) {
                    const priorSteps = selectedTestCase.steps.slice(0, currentIndex);
                    priorSteps.forEach(step => {
                        if (step.type === 'request' && step.config.request?.extractors) {
                            const stepExec = testExecution[selectedTestCase.id]?.[step.id];
                            if (stepExec?.response) {
                                const rawResp = stepExec.response.rawResponse || (typeof stepExec.response.result === 'string'
                                    ? stepExec.response.result
                                    : JSON.stringify(stepExec.response.result));

                                if (rawResp) {
                                    step.config.request.extractors.forEach(ext => {
                                        if (ext.source === 'body') {
                                            try {
                                                const val = CustomXPathEvaluator.evaluate(rawResp, ext.path);
                                                if (val) {
                                                    contextVariables[ext.variable] = val;
                                                    logToOutput(`[Context] Extracted '${ext.variable}' = '${val}' from step '${step.name}'`);
                                                } else {
                                                    logToOutput(`[Context] Warning: Extractor for '${ext.variable}' in step '${step.name}' returned null.`);
                                                }
                                            } catch (e) {
                                                console.warn('[App] Extractor failed for variable ' + ext.variable, e);
                                                logToOutput(`[Context] Error evaluating extractor for '${ext.variable}': ${e}`);
                                            }
                                        }
                                    });
                                }
                            }
                        }
                    });
                }
            }

            console.log('[App] Context Variables:', contextVariables);
            if (Object.keys(contextVariables).length > 0) {
                logToOutput(`[Context] Sending ${Object.keys(contextVariables).length} context variables to backend.`);
            }

            bridge.sendMessage({
                command: 'executeRequest',
                url,
                operation: opName,
                xml,
                contentType: selectedRequest?.contentType,
                assertions: selectedRequest?.assertions,
                headers: selectedRequest?.headers,
                contextVariables
            });
        } else {
            console.error('[App] executeRequest aborted: No selectedOperation or selectedRequest');
            setLoading(false);
        }
    };

    const cancelRequest = () => {
        bridge.sendMessage({ command: 'cancelRequest' });
        setLoading(false);
    };

    const handleRequestUpdate = (updated: SoapUIRequest) => {
        const dirtyUpdated = { ...updated, dirty: true };
        setSelectedRequest(dirtyUpdated);
        setWorkspaceDirty(true);

        // Update in Project/Explorer
        if (selectedProjectName) {
            setProjects(prev => prev.map(p => {
                if (p.name !== selectedProjectName) return p;

                // 1. Is it a Test Case modification?
                if (selectedTestCase) {
                    console.log('[handleRequestUpdate] Updating within Test Case:', selectedTestCase.name);
                    let caseUpdated = false;
                    const updatedSuites = p.testSuites?.map(s => {
                        const tcIndex = s.testCases?.findIndex(tc => tc.id === selectedTestCase.id) ?? -1;
                        if (tcIndex === -1) return s;

                        const updatedCases = [...(s.testCases || [])];
                        // Find step containing this request - Prefer ID match, fallback to Name
                        const stepIndex = updatedCases[tcIndex].steps.findIndex(step =>
                            (updated.id && step.config.request?.id === updated.id) ||
                            step.config.request?.name === updated.name ||
                            (selectedRequest && step.config.request?.name === selectedRequest.name)
                        );

                        console.log('[handleRequestUpdate] Step Search Result:', stepIndex, 'for request:', updated.name);

                        if (stepIndex !== -1) {
                            caseUpdated = true;
                            updatedCases[tcIndex] = {
                                ...updatedCases[tcIndex],
                                steps: updatedCases[tcIndex].steps.map((st, i) => {
                                    if (i === stepIndex) {
                                        // Ensure ID exists on the saved request (Heal legacy data)
                                        const finalRequest = {
                                            ...dirtyUpdated,
                                            id: dirtyUpdated.id || `req-${Date.now()}-healed`
                                        };
                                        return { ...st, config: { ...st.config, request: finalRequest } };
                                    }
                                    return st;
                                })
                            };
                        }
                        return { ...s, testCases: updatedCases };
                    });

                    if (caseUpdated) {
                        const updatedProject = { ...p, testSuites: updatedSuites, dirty: true };
                        setTimeout(() => saveProject(updatedProject), 0);
                        return updatedProject;
                    }
                }

                // 2. Normal Request Modification
                const updatedProject = {
                    ...p,
                    dirty: true,
                    interfaces: p.interfaces.map(i => {
                        if (i.name !== selectedInterface?.name) return i;
                        return {
                            ...i,
                            operations: i.operations.map(o => {
                                if (o.name !== selectedOperation?.name) return o;
                                return {
                                    ...o,
                                    requests: o.requests.map(r => r.name === selectedRequest?.name ? dirtyUpdated : r)
                                };
                            })
                        };
                    })
                };
                setTimeout(() => saveProject(updatedProject), 0);
                return updatedProject;
            }));
        } else {
            setExploredInterfaces(prev => prev.map(i => {
                if (i.name !== selectedInterface?.name) return i;
                return {
                    ...i,
                    operations: i.operations.map(o => {
                        if (o.name !== selectedOperation?.name) return o;
                        return {
                            ...o,
                            requests: o.requests.map(r => r.name === selectedRequest?.name ? dirtyUpdated : r)
                        };
                    })
                };
            }));
        }
    };

    const handleResetRequest = () => {
        if (selectedRequest && selectedOperation) {
            const xml = getInitialXml(selectedOperation.input);
            const updated = { ...selectedRequest, request: xml };
            handleRequestUpdate(updated);
        }
    };

    const handleAddAssertion = (data: { xpath: string, expectedContent: string }) => {
        console.log("App.tsx: handleAddAssertion Called.", data, "TC:", selectedTestCase?.id, "Step:", selectedStep?.id);

        if (!selectedTestCase || !selectedStep) {
            console.error("App.tsx: Missing selection state", { tc: !!selectedTestCase, step: !!selectedStep });
            return;
        }

        let updatedStep: SoapTestStep | null = null;
        let updatedProjectOrNull: SoapUIProject | null = null;

        // Calculate new state
        const nextProjects = projects.map(p => {
            const suite = p.testSuites?.find(s => s.testCases?.some(tc => tc.id === selectedTestCase.id));
            if (!suite) return p;

            const updatedSuite = {
                ...suite,
                testCases: suite.testCases?.map(tc => {
                    if (tc.id !== selectedTestCase.id) return tc;
                    return {
                        ...tc,
                        steps: tc.steps.map(s => {
                            if (s.id !== selectedStep.id) return s;
                            if (s.type !== 'request' || !s.config.request) return s;

                            const newAssertion: SoapUIAssertion = {
                                id: crypto.randomUUID(),
                                type: 'XPath Match',
                                name: 'XPath Match - ' + data.xpath.split('/').pop(),
                                configuration: {
                                    xpath: data.xpath,
                                    expectedContent: data.expectedContent
                                }
                            };

                            const newStep = {
                                ...s,
                                config: {
                                    ...s.config,
                                    request: {
                                        ...s.config.request,
                                        assertions: [...(s.config.request.assertions || []), newAssertion],
                                        dirty: true
                                    }
                                }
                            };
                            updatedStep = newStep;
                            return newStep;
                        })
                    };
                })
            };

            const updatedProject = { ...p, testSuites: p.testSuites!.map(s => s.id === suite.id ? updatedSuite : s), dirty: true };
            updatedProjectOrNull = updatedProject;
            return updatedProject;
        });

        if (updatedProjectOrNull) {
            setProjects(nextProjects);
            setTimeout(() => saveProject(updatedProjectOrNull!), 0);
            if (updatedStep) {
                console.log("Updating Selected Step State:", (updatedStep as any).config.request.assertions.length, "assertions");
                setSelectedStep(updatedStep);
                if ((updatedStep as any).type === 'request' && (updatedStep as any).config.request) {
                    setSelectedRequest((updatedStep as any).config.request);
                }
            }
        }
    };

    const handleAddExistenceAssertion = (data: { xpath: string }) => {
        console.log("Adding Existence Assertion:", data);
        if (!selectedTestCase || !selectedStep) return;

        let updatedStep: SoapTestStep | null = null;
        let updatedProjectOrNull: SoapUIProject | null = null;

        const nextProjects = projects.map(p => {
            const suite = p.testSuites?.find(s => s.testCases?.some(tc => tc.id === selectedTestCase.id));
            if (!suite) return p;

            const updatedSuite = {
                ...suite,
                testCases: suite.testCases?.map(tc => {
                    if (tc.id !== selectedTestCase.id) return tc;
                    return {
                        ...tc,
                        steps: tc.steps.map(s => {
                            if (s.id !== selectedStep.id) return s;
                            if (s.type !== 'request' || !s.config.request) return s;

                            const newAssertion: SoapUIAssertion = {
                                id: crypto.randomUUID(),
                                type: 'XPath Match',
                                name: 'Node Exists - ' + data.xpath.split('/').pop(),
                                configuration: {
                                    xpath: `count(${data.xpath}) > 0`,
                                    expectedContent: 'true'
                                }
                            };

                            const newStep = {
                                ...s,
                                config: {
                                    ...s.config,
                                    request: {
                                        ...s.config.request,
                                        assertions: [...(s.config.request.assertions || []), newAssertion],
                                        dirty: true
                                    }
                                }
                            };
                            updatedStep = newStep;
                            return newStep;
                        })
                    };
                })
            };

            const updatedProject = { ...p, testSuites: p.testSuites!.map(s => s.id === suite.id ? updatedSuite : s), dirty: true };
            updatedProjectOrNull = updatedProject;
            return updatedProject;
        });

        if (updatedProjectOrNull) {
            setProjects(nextProjects);
            setTimeout(() => saveProject(updatedProjectOrNull!), 0);
            if (updatedStep) {
                console.log("Updating Selected Step State:", (updatedStep as any).config.request.assertions.length, "assertions");
                setSelectedStep(updatedStep);
                if ((updatedStep as any).type === 'request' && (updatedStep as any).config.request) {
                    setSelectedRequest((updatedStep as any).config.request);
                }
            }
        }
    };
    // Sidebar Helpers
    const addToProject = (iface: SoapUIInterface) => {
        // Prevent duplicates
        if (projects.length > 0 && projects[0].interfaces.some(i => i.name === iface.name)) {
            console.warn(`Interface ${iface.name} already exists in project`);
            return;
        }

        if (projects.length === 0) {
            setProjects([{ name: 'Project 1', interfaces: [iface], expanded: true, dirty: true, id: Date.now().toString() }]);
        } else {
            setProjects(prev => prev.map((p, i) =>
                i === 0 ? { ...p, interfaces: [...p.interfaces, iface], dirty: true } : p
            ));
        }
        setWorkspaceDirty(true);
        // Clear from explorer
        setExploredInterfaces(prev => prev.filter(i => i.name !== iface.name));
        if (exploredInterfaces.length <= 1) { // If it was the last one
            setExplorerExpanded(false);
        }
    };

    const addAllToProject = () => {
        if (projects.length === 0) {
            setProjects([{ name: 'Project 1', interfaces: [...exploredInterfaces], expanded: true, dirty: true, id: Date.now().toString() }]);
        } else {
            setProjects(prev => prev.map((p, i) =>
                i === 0 ? {
                    ...p,
                    interfaces: [
                        ...p.interfaces,
                        ...exploredInterfaces.filter(ex => !p.interfaces.some(existing => existing.name === ex.name))
                    ],
                    dirty: true
                } : p
            ));
        }
        setWorkspaceDirty(true);
        clearExplorer();
    };

    const clearExplorer = () => {
        setExploredInterfaces([]);
        setExplorerExpanded(false);
    };

    const removeFromExplorer = (iface: SoapUIInterface) => {
        setExploredInterfaces(prev => prev.filter(i => i !== iface));
    };

    // runSuite and runCase are defined above

    // NOTE: closeProject, loadProject, addProject now come from ProjectContext
    // Handle selection reset when closing a project (context handles the deletion)
    const handleCloseProject = (name: string) => {
        // If we're closing the selected project, clear selection
        if (deleteConfirm === name && selectedProjectName === name) {
            setSelectedInterface(null);
            setSelectedOperation(null);
            setSelectedRequest(null);
        }
        // Delegate to context
        closeProject(name);
    };

    // Expand Toggles
    const toggleExplorerExpand = () => setExplorerExpanded(!explorerExpanded);
    // NOTE: toggleProjectExpand now comes from ProjectContext
    const toggleInterfaceExpand = (pName: string, iName: string) => {
        setProjects(prev => prev.map(p => {
            if (p.name !== pName) return p;
            return { ...p, interfaces: p.interfaces.map(i => i.name === iName ? { ...i, expanded: !i.expanded } : i) };
        }));
    };
    const toggleOperationExpand = (pName: string, iName: string, oName: string) => {
        setProjects(prev => prev.map(p => {
            if (p.name !== pName) return p;
            return {
                ...p,
                interfaces: p.interfaces.map(i => {
                    if (i.name !== iName) return i;
                    return { ...i, operations: i.operations.map(o => o.name === oName ? { ...o, expanded: !o.expanded } : o) };
                })
            };
        }));
    };

    const toggleExploredInterface = (iName: string) => {
        setExploredInterfaces(prev => prev.map(i => i.name === iName ? { ...i, expanded: !i.expanded } : i));
    };

    const toggleExploredOperation = (iName: string, oName: string) => {
        setExploredInterfaces(prev => prev.map(i => {
            if (i.name !== iName) return i;
            return { ...i, operations: i.operations.map(o => o.name === oName ? { ...o, expanded: !o.expanded } : o) };
        }));
    };

    // Context Menu
    const handleContextMenu = (e: React.MouseEvent, type: string, data: any, isExplorer = false) => {
        // Prevent empty context menus
        if (type === 'interface') return;
        if (isExplorer && type === 'request') return; // Requests in explorer are read-only (no rename/delete/clone)

        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, type, data, isExplorer });
    };

    const closeContextMenu = () => setContextMenu(null);

    // Context Menu Actions
    const handleRename = () => {
        if (contextMenu) {
            setRenameState({ active: true, type: contextMenu.type, data: contextMenu.data, value: contextMenu.data.name });
            closeContextMenu();
        }
    };

    const handleDeleteRequest = (targetReq?: SoapUIRequest) => {
        const reqToRemove = targetReq || (contextMenu?.type === 'request' ? contextMenu.data as SoapUIRequest : null);
        if (reqToRemove) {
            // Check context menu if relying on it
            if (!targetReq && contextMenu?.isExplorer) return;

            setProjects(prev => {
                let projectChanged: SoapUIProject | null = null;
                const newProjects = prev.map(p => {
                    let changed = false;
                    const newInterfaces = p.interfaces.map(i => ({
                        ...i,
                        operations: i.operations.map(o => {
                            if (o.requests.includes(reqToRemove)) {
                                changed = true;
                                return { ...o, requests: o.requests.filter(r => r !== reqToRemove) };
                            }
                            return o;
                        })
                    }));

                    if (changed) {
                        const newP = { ...p, interfaces: newInterfaces, dirty: true };
                        projectChanged = newP;
                        return newP;
                    }
                    return p;
                });

                if (projectChanged) saveProject(projectChanged);
                return newProjects;
            });

            if (contextMenu) closeContextMenu();
        }
    };
    // Helper to store context if needed, or just rely on Sidebar calling it correctly.
    // Actually ContextMenu has isExplorer. Direct call? Sidebar should prevent calling if explorer.

    const handleCloneRequest = () => {
        if (contextMenu && contextMenu.type === 'request' && !contextMenu.isExplorer) {
            const req = contextMenu.data as SoapUIRequest;
            setProjects(prev => prev.map(p => ({
                ...p,
                interfaces: p.interfaces.map(i => ({
                    ...i,
                    operations: i.operations.map(o => {
                        if (o.requests.includes(req)) {
                            const newReq = { ...req, name: `${req.name} Copy` };
                            return { ...o, requests: [...o.requests, newReq] };
                        }
                        return o;
                    })
                }))
            })));
            closeContextMenu();
        }
    };

    const handleAddRequest = (targetOp?: SoapUIOperation) => {
        const op = targetOp || (contextMenu?.type === 'operation' ? contextMenu.data as SoapUIOperation : null);
        if (op) {
            const newReqName = `Request ${op.requests.length + 1}`;

            // Try to clone first request or create blank
            let newReqContent = '';
            if (op.requests.length > 0) {
                newReqContent = op.requests[0].request;
            } else {
                newReqContent = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="${op.input || 'http://example.com/'}">\n   <soapenv:Header/>\n   <soapenv:Body>\n      <web:${op.name}>\n         <!--Optional:-->\n      </web:${op.name}>\n   </soapenv:Body>\n</soapenv:Envelope>`;
            }

            const newRequest: SoapUIRequest = {
                name: newReqName,
                request: newReqContent,
                id: crypto.randomUUID(),
                dirty: true,
                endpoint: op.requests[0]?.endpoint || '' // Copy endpoint from sibling or empty
            };

            setProjects(prev => prev.map(p => {
                // Find project containing this operation
                let found = false;
                const newInterfaces = p.interfaces.map(i => {
                    const newOps = i.operations.map(o => {
                        if (o.name === op.name && i.operations.includes(op)) {
                            found = true;
                            return { ...o, requests: [...o.requests, newRequest], expanded: true };
                        }
                        return o;
                    });
                    return { ...i, operations: newOps };
                });

                if (found) {
                    const updatedProject = { ...p, interfaces: newInterfaces, dirty: true };
                    saveProject(updatedProject);
                    return updatedProject;
                }
                return p;
            }));

            if (contextMenu) closeContextMenu();
        }
    };

    const handleDeleteInterface = (iface: SoapUIInterface) => {
        setProjects(prev => {
            let projectChanged: SoapUIProject | null = null;
            const newProjects = prev.map(p => {
                const hasInterface = p.interfaces.some(i => i.name === iface.name);
                if (hasInterface) {
                    const newInterfaces = p.interfaces.filter(i => i.name !== iface.name);
                    const newP = { ...p, interfaces: newInterfaces, dirty: true };
                    projectChanged = newP;
                    return newP;
                }
                return p;
            });

            if (projectChanged) saveProject(projectChanged as SoapUIProject);
            return newProjects;
        });
        setWorkspaceDirty(true);

        if (selectedInterface?.name === iface.name) {
            setSelectedInterface(null);
            setSelectedOperation(null);
            setSelectedRequest(null);
            setResponse(null);
        }
    };

    const handleDeleteOperation = (op: SoapUIOperation, iface: SoapUIInterface) => {
        setProjects(prev => {
            let projectChanged: SoapUIProject | null = null;
            const newProjects = prev.map(p => {
                const targetInterface = p.interfaces.find(i => i.name === iface.name);
                if (targetInterface) {
                    const newInterfaces = p.interfaces.map(i => {
                        if (i.name === iface.name) {
                            // Filter operation by name
                            const newOps = i.operations.filter(o => o.name !== op.name);
                            return { ...i, operations: newOps };
                        }
                        return i;
                    });
                    const newP = { ...p, interfaces: newInterfaces, dirty: true };
                    projectChanged = newP;
                    return newP;
                }
                return p;
            });

            if (projectChanged) saveProject(projectChanged as SoapUIProject);
            return newProjects;
        });
        setWorkspaceDirty(true);

        // Clear selection if needed
        if (selectedOperation?.name === op.name && selectedInterface?.name === iface.name) {
            setSelectedOperation(null);
            setSelectedRequest(null);
            setResponse(null);
        }
    };

    const handleViewSample = () => {
        if (contextMenu && (contextMenu.type === 'operation' || contextMenu.type === 'request')) {
            // How to get schema? Extension logic `sampleSchema`.
            // We need to send message.
            // Op Name?
            // Sidebar context menu 'data' for request is the request object. It doesn't have op name directly?
            // We might need to find it.
            // Simplified: only support on Operation.
            if (contextMenu.type === 'operation') {
                bridge.sendMessage({ command: 'getSampleSchema', operationName: contextMenu.data.name });
            }
            closeContextMenu();
        }
    };

    const handleGenerateTestSuite = (target: SoapUIInterface | SoapUIOperation) => {
        console.log('[handleGenerateTestSuite] ENTRY. Target:', target);
        if ((target as any).operations) console.log('Target is Interface with operations:', (target as any).operations.length);
        if ((target as any).originalEndpoint) console.log('Target is Operation with Endpoint:', (target as any).originalEndpoint);

        // 1. Find the project containing this target
        let targetProject: SoapUIProject | null = null;
        for (const p of projects) {
            if (p.interfaces.some(i => i === target || i.operations.some(o => o === target))) {
                targetProject = p;
                break;
            }
        }
        if (!targetProject) return;

        // 2. Identify Operations
        let operationsToProcess: SoapUIOperation[] = [];
        let baseName = '';
        if ((target as any).operations) {
            operationsToProcess = (target as SoapUIInterface).operations;
            baseName = target.name;
        } else {
            operationsToProcess = [target as SoapUIOperation];
            baseName = target.name;
        }

        // 3. Create Suite
        const newSuite: SoapTestSuite = {
            id: `ts-${Date.now()}`,
            name: `Test Suite - ${baseName}`,
            testCases: [],
            expanded: true
        };

        // 4. Generate Cases
        operationsToProcess.forEach(op => {
            console.log('[handleGenerateTestSuite] Processing op:', op.name, op);

            const newCase: SoapTestCase = {
                id: `tc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: op.name,
                steps: [],
                expanded: true
            };
            console.log(`[DEBUG] Generating Test Case for ${op.name}`);
            console.log(`[DEBUG] TargetNamespace: ${(op as any).targetNamespace}`);
            console.log(`[DEBUG] OriginalEndpoint: ${(op as any).originalEndpoint}`);

            const newStep: SoapTestStep = {
                id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: 'Request 1',
                type: 'request',
                config: {
                    request: {
                        id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: 'Request 1',
                        endpoint: (op as any).originalEndpoint || undefined, // Set Endpoint!
                        request: `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="${op.targetNamespace || 'http://tempuri.org/'}">\n   <soapenv:Header/>\n   <soapenv:Body>\n      <tem:${op.name}>\n         <!--Optional:-->\n         ${getInitialXml(op.input)}\n      </tem:${op.name}>\n   </soapenv:Body>\n</soapenv:Envelope>`,
                        assertions: [
                            {
                                id: `assert-${Date.now()}-1`,
                                type: 'Simple Not Contains',
                                name: 'Not SOAP Fault',
                                description: 'Response should not contain Fault',
                                configuration: { token: 'Fault' }
                            },
                            {
                                id: `assert-${Date.now()}-2`,
                                type: 'Response SLA',
                                name: 'Response SLA',
                                description: 'Response time check',
                                configuration: { sla: '200' }
                            }
                        ]
                    }
                }
            };
            newCase.steps.push(newStep);
            newSuite.testCases.push(newCase);
        });

        // 5. Save Logic
        setProjects(prev => prev.map(p => {
            if (p.id === targetProject!.id || p.fileName === targetProject!.fileName) {
                const updated = { ...p, testSuites: [...(p.testSuites || []), newSuite], dirty: true };
                setTimeout(() => saveProject(updated), 0);
                return updated;
            }
            return p;
        }));

        setActiveView(SidebarView.PROJECTS);
        closeContextMenu();
    };

    const handleSelectWatcherEvent = (event: WatcherEvent) => {
        let requestBody = event.formattedBody;
        if (requestBody === undefined) {
            const raw = event.requestContent || event.requestBody || '';
            requestBody = formatXml(raw, true, inlineElementValues, hideCausalityData);

            // Cache the formatted body so it doesn't re-format on next click
            if (activeView === SidebarView.PROXY) {
                setProxyHistory(prev => prev.map(e => e.id === event.id ? { ...e, formattedBody: requestBody } : e));
            } else {
                setWatcherHistory(prev => prev.map(e => e.id === event.id ? { ...e, formattedBody: requestBody } : e));
            }
        }

        const tempRequest: SoapUIRequest = {
            id: event.id,
            name: `Logged: ${event.timestampLabel}`,
            request: requestBody,
            dirty: false,
            headers: event.requestHeaders || {},
            endpoint: event.url || '',
            method: event.method || 'POST'
        };

        const tempOp: SoapUIOperation = {
            name: 'External Request',
            input: '',
            requests: [tempRequest],
            action: 'WatcherAction'
        };

        const tempIface: SoapUIInterface = {
            name: 'File Watcher',
            type: 'wsdl',
            soapVersion: '1.1',
            definition: '',
            operations: [tempOp],
            bindingName: 'WatcherBinding'
        };

        setSelectedInterface(tempIface);
        setSelectedOperation(tempOp);
        setSelectedInterface(tempIface);
        setSelectedOperation(tempOp);
        setSelectedRequest(tempRequest);
        setSelectedTestCase(null); // Ensure we exit test case context

        const responseContent = event.responseContent || event.responseBody;
        if (responseContent) {
            setResponse({
                rawResponse: responseContent,
                duration: event.duration || 0,
                lineCount: responseContent.split(/\r\n|\r|\n/).length,
                success: event.success,
                headers: event.responseHeaders
            });
        } else {
            setResponse(null);
        }
    };

    const handleRunTestCaseWrapper = (caseId: string) => {
        // Find Project and Context to determine proper endpoint fallback
        let fallbackEndpoint = wsdlUrl || '';
        let targetProject: SoapUIProject | undefined;
        let foundCase: SoapTestCase | undefined;

        for (const p of projects) {
            if (p.testSuites) {
                for (const s of p.testSuites) {
                    const c = s.testCases?.find(tc => tc.id === caseId);
                    if (c) {
                        targetProject = p;
                        foundCase = c;
                        break;
                    }
                }
            }
            if (foundCase) break;
        }

        if (targetProject && targetProject.interfaces && targetProject.interfaces.length > 0) {
            if (foundCase) {
                const matchingIface = targetProject.interfaces.find(i => i.operations.some(o => o.name === foundCase?.name));
                if (matchingIface && matchingIface.definition) {
                    fallbackEndpoint = matchingIface.definition;
                } else if (targetProject.interfaces[0].definition) {
                    fallbackEndpoint = targetProject.interfaces[0].definition;
                }
            } else if (targetProject.interfaces[0].definition) {
                fallbackEndpoint = targetProject.interfaces[0].definition;
            }
        }

        console.log('[App] Running Case with Fallback:', fallbackEndpoint);
        bridge.sendMessage({ command: 'runTestCase', caseId, testCase: foundCase, fallbackEndpoint });
    };

    const handleRunTestSuiteWrapper = (suiteId: string) => {
        let fallbackEndpoint = wsdlUrl || '';
        const targetProject = projects.find(p => p.testSuites?.some(s => s.id === suiteId));

        if (targetProject && targetProject.interfaces && targetProject.interfaces.length > 0) {
            if (targetProject.interfaces[0].definition) {
                fallbackEndpoint = targetProject.interfaces[0].definition;
            }
        }
        console.log('[App] Running Suite with Fallback:', fallbackEndpoint);
        bridge.sendMessage({ command: 'runTestSuite', suiteId, fallbackEndpoint });
    };

    const handleSaveExtractor = (data: { xpath: string, value: string, source: 'body' | 'header', variableName: string }) => {
        if (!selectedTestCase || !selectedStep?.config?.request) return;

        const newExtractor: SoapRequestExtractor = {
            id: `ext-${Date.now()}`,
            type: 'XPath',
            variable: data.variableName,
            source: data.source,
            path: data.xpath
        };

        const updatedStep = {
            ...selectedStep,
            config: {
                ...selectedStep.config,
                request: {
                    ...selectedStep.config.request,
                    extractors: [...(selectedStep.config.request.extractors || []), newExtractor]
                }
            }
        };

        // Update Project State
        setProjects(prev => prev.map(p => {
            const suite = p.testSuites?.find(s => s.testCases?.some(tc => tc.id === selectedTestCase.id));
            if (!suite) return p;

            const updatedSuite = {
                ...suite,
                testCases: suite.testCases?.map(tc => {
                    if (tc.id !== selectedTestCase.id) return tc;
                    return {
                        ...tc,
                        steps: tc.steps.map(s => s.id === selectedStep.id ? updatedStep : s)
                    };
                })
            };
            const newP = { ...p, testSuites: p.testSuites!.map(s => s.id === suite.id ? updatedSuite : s), dirty: true };
            setTimeout(() => saveProject(newP), 0);
            return newP;
        }));

        // Update Local State for UI
        setSelectedStep(updatedStep);
        if (selectedRequest && selectedRequest.id === updatedStep.config.request.id) {
            setSelectedRequest(updatedStep.config.request);
        }
    };

    return (
        <Container onClick={closeContextMenu}>
            <Sidebar
                explorerExpanded={explorerExpanded}
                toggleExplorerExpand={toggleExplorerExpand}
                exploredInterfaces={exploredInterfaces}
                projects={projects}
                inputType={inputType}
                setInputType={setInputType}
                wsdlUrl={wsdlUrl}
                setWsdlUrl={setWsdlUrl}
                selectedFile={selectedFile}
                loadWsdl={loadWsdl}
                pickLocalWsdl={pickLocalWsdl}
                downloadStatus={downloadStatus}
                addToProject={addToProject}
                addAllToProject={addAllToProject}
                clearExplorer={clearExplorer}
                removeFromExplorer={removeFromExplorer}
                toggleProjectExpand={toggleProjectExpand}
                toggleInterfaceExpand={toggleInterfaceExpand}
                toggleOperationExpand={toggleOperationExpand}
                toggleExploredInterface={toggleExploredInterface}
                toggleExploredOperation={toggleExploredOperation}
                // saveWorkspace={saveWorkspace} // Removed
                // openWorkspace={openWorkspace} // Removed
                loadProject={() => loadProject()}
                saveProject={saveProject}
                closeProject={handleCloseProject}
                onAddProject={addProject}
                selectedProjectName={selectedProjectName}
                setSelectedProjectName={setSelectedProjectName}
                selectedInterface={selectedInterface}
                setSelectedInterface={setSelectedInterface}
                selectedOperation={selectedOperation}
                setSelectedOperation={setSelectedOperation}
                selectedRequest={selectedRequest}
                setSelectedRequest={(req) => {
                    setSelectedRequest(req);
                    setSelectedTestCase(null); // Clear test case when main request is selected
                }}
                setResponse={setResponse}
                handleContextMenu={handleContextMenu}
                onDeleteInterface={handleDeleteInterface}
                onDeleteOperation={handleDeleteOperation}
                deleteConfirm={deleteConfirm}
                setDeleteConfirm={setDeleteConfirm}
                backendConnected={backendConnected}
                savedProjects={savedProjects}
                onOpenSettings={() => setShowSettings(true)}
                onOpenHelp={() => setShowHelp(true)}
                workspaceDirty={workspaceDirty}
                showBackendStatus={!isVsCode()}

                activeView={activeView}
                onChangeView={setActiveView}
                onAddSuite={(projName) => {
                    const project = projects.find(p => p.name === projName);
                    if (project) {
                        const newSuite = {
                            id: `suite-${Date.now()}`,
                            name: `TestSuite ${((project.testSuites || []).length + 1)}`,
                            testCases: [],
                            expanded: true
                        };
                        const updatedProject = {
                            ...project,
                            testSuites: [...(project.testSuites || []), newSuite],
                            dirty: true
                        };

                        // Update State
                        setProjects(projects.map(p => p.name === projName ? updatedProject : p));

                        // Save
                        saveProject(updatedProject);
                    }
                }}
                onRunSuite={handleRunTestSuiteWrapper}
                onDeleteSuite={(suiteId) => {
                    if (deleteConfirm === suiteId) {
                        setProjects(prev => prev.map(p => {
                            if (!p.testSuites || !p.testSuites.some(s => s.id === suiteId)) return p;

                            const remaining = p.testSuites.filter(s => s.id !== suiteId);
                            const updated = { ...p, testSuites: remaining, dirty: true };

                            setTimeout(() => saveProject(updated), 0);
                            return updated;
                        }));
                        setDeleteConfirm(null);
                    } else {
                        setDeleteConfirm(suiteId);
                        setTimeout(() => setDeleteConfirm(null), 2000);
                    }
                }}
                onSelectSuite={handleSelectTestSuite}
                onSelectTestCase={handleSelectTestCase}
                onToggleSuiteExpand={(suiteId) => {
                    setProjects(prev => prev.map(p => {
                        if (!p.testSuites?.some(s => s.id === suiteId)) return p;

                        const updatedSuites = p.testSuites.map(s => {
                            if (s.id !== suiteId) return s;
                            return { ...s, expanded: s.expanded === false ? true : false };
                        });

                        const updatedProject = { ...p, testSuites: updatedSuites, dirty: true };
                        setTimeout(() => saveProject(updatedProject), 0);
                        return updatedProject;
                    }));
                }}
                onToggleCaseExpand={(caseId) => {
                    setProjects(prev => prev.map(p => {
                        const suite = p.testSuites?.find(s => s.testCases?.some(tc => tc.id === caseId));
                        if (!suite) return p;

                        const updatedSuite = {
                            ...suite,
                            testCases: suite.testCases?.map(tc => {
                                if (tc.id !== caseId) return tc;
                                return { ...tc, expanded: tc.expanded === false ? true : false };
                            })
                        };

                        const updatedProject = {
                            ...p,
                            testSuites: p.testSuites!.map(s => s.id === suite.id ? updatedSuite : s),
                            dirty: true
                        };
                        setTimeout(() => saveProject(updatedProject), 0);
                        return updatedProject;
                    }));
                }}
                onAddTestCase={(suiteId) => {
                    setProjects(prev => prev.map(p => {
                        const suite = p.testSuites?.find(s => s.id === suiteId);
                        if (!suite) return p;

                        const newCase: SoapTestCase = {
                            id: `tc-${Date.now()}`,
                            name: `TestCase ${(suite.testCases?.length || 0) + 1}`,
                            expanded: true,
                            steps: []
                        };
                        const updatedSuite = { ...suite, testCases: [...(suite.testCases || []), newCase] };
                        const updatedProject = {
                            ...p,
                            testSuites: p.testSuites!.map(s => s.id === suiteId ? updatedSuite : s),
                            dirty: true
                        };

                        setTimeout(() => saveProject(updatedProject), 0);
                        return updatedProject;
                    }));
                }}
                onRunCase={handleRunTestCaseWrapper}
                onDeleteTestCase={(caseId) => {
                    if (deleteConfirm === caseId) {
                        setProjects(prev => prev.map(p => {
                            const suite = p.testSuites?.find(s => s.testCases?.some(tc => tc.id === caseId));
                            if (!suite) return p;

                            const updatedSuite = { ...suite, testCases: suite.testCases?.filter(tc => tc.id !== caseId) || [] };
                            const updatedProject = {
                                ...p,
                                testSuites: p.testSuites!.map(s => s.id === suite.id ? updatedSuite : s),
                                dirty: true
                            };

                            setTimeout(() => saveProject(updatedProject), 0);
                            return updatedProject;
                        }));
                        setDeleteConfirm(null);
                    } else {
                        setDeleteConfirm(caseId);
                        setTimeout(() => setDeleteConfirm(null), 2000);
                    }
                }}

                watcherHistory={watcherHistory}
                onSelectWatcherEvent={handleSelectWatcherEvent}
                watcherRunning={watcherRunning}
                onStartWatcher={() => {
                    setWatcherRunning(true);
                    bridge.sendMessage({ command: 'startWatcher' });
                }}
                onStopWatcher={() => {
                    setWatcherRunning(false);
                    bridge.sendMessage({ command: 'stopWatcher' });
                }}
                onClearWatcher={() => {
                    setWatcherHistory([]);
                    bridge.sendMessage({ command: 'clearWatcherHistory' });
                }}

                proxyRunning={proxyRunning}
                onStartProxy={() => {
                    bridge.sendMessage({ command: 'startProxy' });
                    // Optimistic update
                    setProxyRunning(true);
                }}
                onStopProxy={() => {
                    bridge.sendMessage({ command: 'stopProxy' });
                    setProxyRunning(false);
                }}
                proxyConfig={proxyConfig}
                onUpdateProxyConfig={(config) => {
                    const newConfig = { ...config, systemProxyEnabled: config.systemProxyEnabled ?? true };
                    setProxyConfig(newConfig);
                    bridge.sendMessage({ command: 'updateProxyConfig', config: newConfig });
                }}
                proxyHistory={proxyHistory}
                onClearProxy={() => setProxyHistory([])}
                configPath={configPath}
                onSelectConfigFile={() => bridge.sendMessage({ command: 'selectConfigFile' })}
                onOpenCertificate={() => bridge.sendMessage({ command: 'installCertificate' })}
                onSaveProxyHistory={(content) => bridge.sendMessage({ command: 'saveProxyHistory', content })}
                onInjectProxy={() => {
                    if (configPath) {
                        const proxyUrl = `http://localhost:${proxyConfig.port}`;
                        bridge.sendMessage({ command: 'injectProxy', path: configPath, proxyUrl });
                    }
                }}
                onRestoreProxy={() => {
                    if (configPath) {
                        bridge.sendMessage({ command: 'restoreProxy', path: configPath });
                    }
                }}
                onSaveUiState={() => {
                    if (config) {
                        bridge.sendMessage({ command: 'saveUiState', ui: config.ui });
                    }
                }}
                onAddRequest={handleAddRequest}
                onDeleteRequest={handleDeleteRequest}
            />

            <WorkspaceLayout
                selectedRequest={selectedRequest}
                selectedOperation={selectedOperation}
                selectedTestCase={selectedTestCase}
                onRunTestCase={handleRunTestCaseWrapper}
                onOpenStepRequest={(req) => {
                    // Legacy Support / Deep Linking? 
                    // This is triggered by clicking a Request Step in the list IF onSelectStep is not passed.
                    // But we will pass onSelectStep now.
                    // However, we still need this logic if invoked elsewise?
                    // Let's keep the logic inside the new handler or keep this for now.
                    setSelectedRequest(req);
                    // ... (rest of logic) ...
                }}
                onSelectStep={(step) => {
                    setSelectedStep(step);
                    if (step) {
                        if (step.type === 'request' && step.config.request) {
                            setSelectedRequest(step.config.request);
                            // Update Response Panel Logic
                            if (selectedTestCase) {
                                const result = testExecution[selectedTestCase.id]?.[step.id];
                                if (result && result.response) {
                                    setResponse({
                                        ...result.response,
                                        assertionResults: result.assertionResults
                                    });
                                } else {
                                    setResponse(null);
                                }
                            }
                        } else {
                            setSelectedRequest(null);
                            setResponse(null);
                        }
                    } else {
                        setSelectedRequest(null);
                        setResponse(null);
                    }
                }}
                onDeleteStep={(stepId) => {
                    if (!selectedTestCase) return;
                    setProjects(prev => prev.map(p => {
                        const suite = p.testSuites?.find(s => s.testCases?.some(tc => tc.id === selectedTestCase.id));
                        if (!suite) return p;

                        const updatedSuite = {
                            ...suite,
                            testCases: suite.testCases?.map(tc => {
                                if (tc.id !== selectedTestCase.id) return tc;
                                return {
                                    ...tc,
                                    steps: tc.steps.filter(s => s.id !== stepId)
                                };
                            })
                        };
                        const updatedProject = { ...p, testSuites: p.testSuites!.map(s => s.id === suite.id ? updatedSuite : s), dirty: true };
                        setTimeout(() => saveProject(updatedProject), 0);
                        return updatedProject;
                    }));

                    if (selectedStep?.id === stepId) {
                        setSelectedStep(null);
                        setSelectedRequest(null);
                        setResponse(null);
                    }
                }}
                onMoveStep={(stepId, direction) => {
                    if (!selectedTestCase) return;
                    setProjects(prev => prev.map(p => {
                        const suite = p.testSuites?.find(s => s.testCases?.some(tc => tc.id === selectedTestCase.id));
                        if (!suite) return p;

                        const updatedSuite = {
                            ...suite,
                            testCases: suite.testCases?.map(tc => {
                                if (tc.id !== selectedTestCase.id) return tc;
                                const steps = [...tc.steps];
                                const index = steps.findIndex(s => s.id === stepId);
                                if (index === -1) return tc;

                                if (direction === 'up' && index > 0) {
                                    [steps[index], steps[index - 1]] = [steps[index - 1], steps[index]];
                                } else if (direction === 'down' && index < steps.length - 1) {
                                    [steps[index], steps[index + 1]] = [steps[index + 1], steps[index]];
                                } else {
                                    return tc; // No change
                                }

                                return { ...tc, steps };
                            })
                        };
                        const updatedProject = { ...p, testSuites: p.testSuites!.map(s => s.id === suite.id ? updatedSuite : s), dirty: true };
                        setTimeout(() => saveProject(updatedProject), 0);
                        return updatedProject;
                    }));
                }}
                onAddExtractor={(data) => {
                    if (!selectedStep) return;
                    setExtractorModal({ ...data, variableName: '' });
                }}
                onAddAssertion={handleAddAssertion}
                onAddExistenceAssertion={handleAddExistenceAssertion}
                onAddReplaceRule={(data) => setReplaceRuleModal({ open: true, ...data })}
                onUpdateStep={(updatedStep) => {
                    if (!selectedTestCase) return;
                    setProjects(prev => prev.map(p => {
                        const suite = p.testSuites?.find(s => s.testCases?.some(tc => tc.id === selectedTestCase.id));
                        if (!suite) return p; // Should be rare

                        const updatedSuite = {
                            ...suite,
                            testCases: suite.testCases?.map(tc => {
                                if (tc.id !== selectedTestCase.id) return tc;
                                return {
                                    ...tc,
                                    steps: tc.steps.map(s => s.id === updatedStep.id ? updatedStep : s)
                                };
                            })
                        };

                        const updatedProject = { ...p, testSuites: p.testSuites!.map(s => s.id === suite.id ? updatedSuite : s), dirty: true };
                        // Debounce save? User requested less notifications.
                        // We will address the notification suppression in the backend, but we should debounce the save here too if typing.
                        // For now, direct save.
                        setTimeout(() => saveProject(updatedProject), 0);
                        return updatedProject;
                    }));
                    setSelectedStep(updatedStep);
                }}
                onBackToCase={() => {
                    setSelectedRequest(null);
                    setSelectedStep(null);
                    setResponse(null); // Clear response when going back so we don't show stale data
                }}
                selectedStep={selectedStep}
                onAddStep={(caseId, type) => {
                    if (type === 'delay') {
                        setProjects(prev => prev.map(p => {
                            const suite = p.testSuites?.find(s => s.testCases?.some(tc => tc.id === caseId));
                            if (!suite) return p;

                            const updatedSuite = {
                                ...suite,
                                testCases: suite.testCases?.map(tc => {
                                    if (tc.id !== caseId) return tc;
                                    const newStep: SoapTestStep = {
                                        id: `step-${Date.now()}`,
                                        name: 'Delay',
                                        type: 'delay',
                                        config: { delayMs: 1000 }
                                    };
                                    return { ...tc, steps: [...tc.steps, newStep] };
                                }) || []
                            };

                            const updatedProject = { ...p, testSuites: p.testSuites!.map(s => s.id === suite.id ? updatedSuite : s), dirty: true };
                            setTimeout(() => saveProject(updatedProject), 0);
                            return updatedProject;
                        }));
                    } else if (type === 'request') {
                        bridge.sendMessage({ command: 'pickOperationForTestCase', caseId });
                    }
                }}
                testExecution={testExecution}
                response={response}
                loading={loading}
                layoutMode={layoutMode}
                showLineNumbers={showLineNumbers}
                splitRatio={splitRatio}
                isResizing={isResizing}
                onExecute={executeRequest}
                onCancel={cancelRequest}
                onUpdateRequest={handleRequestUpdate}
                onReset={handleResetRequest}
                defaultEndpoint={selectedInterface?.definition || wsdlUrl}
                onToggleLayout={() => {
                    const newMode = layoutMode === 'vertical' ? 'horizontal' : 'vertical';
                    setLayoutMode(newMode);
                    bridge.sendMessage({ command: 'saveUiState', ui: { ...config?.ui, layoutMode: newMode } });
                }}
                onToggleLineNumbers={() => {
                    const newState = !showLineNumbers;
                    setShowLineNumbers(newState);
                    bridge.sendMessage({ command: 'saveUiState', ui: { ...config?.ui, showLineNumbers: newState } });
                }}
                inlineElementValues={inlineElementValues}
                onToggleInlineElementValues={() => {
                    const newState = !inlineElementValues;
                    setInlineElementValues(newState);
                    // Invalidate formatted body cache to force re-format with new settings
                    setProxyHistory(prev => prev.map(e => ({ ...e, formattedBody: undefined })));
                    setWatcherHistory(prev => prev.map(e => ({ ...e, formattedBody: undefined })));
                    bridge.sendMessage({ command: 'saveUiState', ui: { ...config?.ui, inlineElementValues: newState } });
                }}
                hideCausalityData={hideCausalityData}
                onToggleHideCausalityData={() => {
                    const newState = !hideCausalityData;
                    setHideCausalityData(newState);
                    // Invalidate formatted body cache
                    setProxyHistory(prev => prev.map(e => ({ ...e, formattedBody: undefined })));
                    setWatcherHistory(prev => prev.map(e => ({ ...e, formattedBody: undefined })));
                    bridge.sendMessage({ command: 'saveUiState', ui: { ...config?.ui, hideCausalityData: newState } });
                }}
                isReadOnly={activeView === SidebarView.WATCHER || activeView === SidebarView.PROXY}
                onStartResizing={startResizing}
                config={config}
                onChangeEnvironment={(env) => bridge.sendMessage({ command: 'updateActiveEnvironment', envName: env })}
                changelog={changelog}
                onOpenDevOps={() => setShowDevOpsModal(true)}
            />

            {showDevOpsModal && config?.azureDevOps?.orgUrl && config?.azureDevOps?.project && selectedRequest && (
                <AddToDevOpsModal
                    orgUrl={config.azureDevOps.orgUrl}
                    project={config.azureDevOps.project}
                    requestContent={selectedRequest.request || ''}
                    responseContent={response?.body}
                    requestName={selectedRequest.name}
                    onClose={() => setShowDevOpsModal(false)}
                />
            )}

            {showSettings && (
                <SettingsEditorModal
                    rawConfig={rawConfig}
                    onClose={() => setShowSettings(false)}
                    onSave={(content, config) => {
                        bridge.sendMessage({ command: 'saveSettings', raw: !config, content, config });
                        setShowSettings(false);
                    }}
                />
            )}
            {showHelp && (
                <HelpModal
                    onClose={() => setShowHelp(false)}
                />
            )}
            {contextMenu && (
                <ContextMenu top={contextMenu.y} left={contextMenu.x}>
                    {(contextMenu.type === 'request' || contextMenu.type === 'project') && (
                        <ContextMenuItem onClick={handleRename}>Rename</ContextMenuItem>
                    )}
                    {!contextMenu.isExplorer && contextMenu.type === 'request' && (
                        <>
                            <ContextMenuItem onClick={handleCloneRequest}>Clone Request</ContextMenuItem>
                            <ContextMenuItem onClick={() => {
                                if (contextMenu) {
                                    setAddToTestCaseModal({ open: true, request: contextMenu.data as SoapUIRequest });
                                    closeContextMenu();
                                }
                            }}>Add to Test Case</ContextMenuItem>
                            <ContextMenuItem onClick={() => handleDeleteRequest()} style={{ color: 'var(--vscode-errorForeground)' }}>Delete</ContextMenuItem>
                        </>
                    )}
                    {(contextMenu.type === 'operation') && (
                        <>
                            <ContextMenuItem onClick={() => handleGenerateTestSuite(contextMenu.data)}>Generate Test Suite</ContextMenuItem>
                            <ContextMenuItem onClick={() => handleAddRequest()}>Add Request</ContextMenuItem>
                            <ContextMenuItem onClick={handleViewSample}>View Sample Schema</ContextMenuItem>
                        </>
                    )}
                    {(contextMenu.type === 'interface') && (
                        <ContextMenuItem onClick={() => handleGenerateTestSuite(contextMenu.data)}>Generate Test Suite</ContextMenuItem>
                    )}
                </ContextMenu>
            )}



            {/* Rename Modal */}
            <RenameModal
                isOpen={!!renameState}
                title={`Rename ${renameState?.type}`}
                initialValue={renameState?.value || ''}
                onCancel={() => setRenameState(null)}
                onSave={(value) => {
                    if (!renameState) return;
                    // Apply rename logic here (update state)
                    if (renameState.type === 'project') {
                        setProjects(projects.map(p => p === renameState.data ? { ...p, name: value } : p));
                    } else if (renameState.type === 'interface') {
                        setProjects(prev => prev.map(p => {
                            const hasInterface = p.interfaces.some(i => i === renameState.data);
                            if (hasInterface) {
                                return {
                                    ...p,
                                    interfaces: p.interfaces.map(i => i === renameState.data ? { ...i, name: value } : i)
                                };
                            }
                            return p;
                        }));
                    }
                    setRenameState(null);
                }}
            />

            {/* Sample Schema Modal */}
            <SampleModal
                isOpen={sampleModal.open}
                operationName={sampleModal.operationName}
                schema={sampleModal.schema}
                onClose={() => setSampleModal({ open: false, schema: null, operationName: '' })}
            />

            {/* Add to Test Case Modal */}
            {
                addToTestCaseModal.open && addToTestCaseModal.request && (
                    <AddToTestCaseModal
                        projects={projects}
                        onClose={() => setAddToTestCaseModal({ open: false, request: null })}
                        onAdd={(target) => {
                            const req = addToTestCaseModal.request!;
                            const newStep: SoapTestStep = {
                                id: `step-${Date.now()}`,
                                name: req.name,
                                type: 'request',
                                config: {
                                    request: { ...req, id: `req-${Date.now()}` },
                                    requestId: undefined
                                }
                            };

                            setProjects(prev => prev.map(p => {
                                const suite = target.suiteId ? p.testSuites?.find(s => s.id === target.suiteId) :
                                    p.testSuites?.find(s => s.testCases.some(tc => tc.id === target.caseId));

                                if (!suite) return p;

                                const updatedTestSuites = (p.testSuites || []).map(s => {
                                    if (s.id === suite.id) {
                                        // If creating new case
                                        if (target.type === 'new') {
                                            const newCase: SoapTestCase = {
                                                id: `tc-${Date.now()}`,
                                                name: `TestCase ${(s.testCases?.length || 0) + 1}`,
                                                expanded: true,
                                                steps: [newStep]
                                            };
                                            return { ...s, testCases: [...(s.testCases || []), newCase] };
                                        }
                                        // If adding to existing
                                        if (target.type === 'existing' && target.caseId) {
                                            return {
                                                ...s,
                                                testCases: s.testCases.map(tc =>
                                                    tc.id === target.caseId ? { ...tc, steps: [...tc.steps, newStep] } : tc
                                                )
                                            };
                                        }
                                    }
                                    return s;
                                });

                                const newProj = { ...p, testSuites: updatedTestSuites, dirty: true };
                                setTimeout(() => saveProject(newProj), 0);
                                return newProj;
                            }));
                            setAddToTestCaseModal({ open: false, request: null });
                            setActiveView(SidebarView.PROJECTS);
                        }}
                    />
                )
            }

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!confirmationModal}
                title={confirmationModal?.title || ''}
                message={confirmationModal?.message || ''}
                onCancel={() => setConfirmationModal(null)}
                onConfirm={() => {
                    confirmationModal?.onConfirm();
                    setConfirmationModal(null);
                }}
            />

            {/* Extractor Modal */}
            <ExtractorModal
                isOpen={!!extractorModal}
                data={extractorModal}
                onClose={() => setExtractorModal(null)}
                onSave={(data) => {
                    handleSaveExtractor(data);
                    setExtractorModal(null);
                }}
            />

            <CreateReplaceRuleModal
                isOpen={replaceRuleModal.open}
                xpath={replaceRuleModal.xpath}
                matchText={replaceRuleModal.matchText}
                initialTarget={replaceRuleModal.target}
                onCancel={() => setReplaceRuleModal({ open: false, xpath: '', matchText: '', target: 'response' })}
                onSave={(rule) => {
                    // Create rule with unique ID and save to config
                    const newRule: ReplaceRule = {
                        id: crypto.randomUUID(),
                        name: rule.name,
                        xpath: rule.xpath,
                        matchText: rule.matchText,
                        replaceWith: rule.replaceWith,
                        target: rule.target,
                        enabled: true
                    };
                    const currentRules = config?.replaceRules || [];
                    bridge.sendMessage({
                        command: 'saveSettings',
                        raw: false,
                        config: { ...config, replaceRules: [...currentRules, newRule] }
                    });
                    setReplaceRuleModal({ open: false, xpath: '', matchText: '', target: 'response' });
                }}
            />

        </Container >
    );
}

// Utility
function getInitialXml(input: any): string {
    // Basic XML generation from WSDL input definition
    if (!input) return '';
    let xml = '';
    for (const key in input) {
        xml += `<${key}>?</${key}>\n`;
    }
    return xml;
}

export default App;
