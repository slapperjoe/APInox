/**
 * useTestCaseHandlers.ts
 * 
 * Hook for managing test case selection and assertion handlers.
 * Extracted from App.tsx to reduce complexity.
 */

import { useCallback } from 'react';
import {
    UnifiedProject,
    ApiInterface,
    ApiOperation,
    ApiRequest,
    TestCase,
    TestStep,
    TestSuite,
    Assertion,
    RequestExtractor,
    SidebarView
} from '@shared/models';
import { bridge, isTauri } from '../utils/bridge';
import { BackendCommand, FrontendCommand } from '@shared/messages';
import { getInitialXml } from '@shared/utils/xmlUtils';
import { useTestSuites } from '../contexts/TestSuiteContext';

interface UseTestCaseHandlersParams {
    projects: UnifiedProject[];
    setProjects: React.Dispatch<React.SetStateAction<UnifiedProject[]>>;
    saveProject: (project: UnifiedProject) => void;
    selectedTestCase: TestCase | null;
    selectedStep: TestStep | null;
    setSelectedTestCase: React.Dispatch<React.SetStateAction<TestCase | null>>;
    setSelectedStep: React.Dispatch<React.SetStateAction<TestStep | null>>;
    setSelectedRequest: React.Dispatch<React.SetStateAction<ApiRequest | null>>;
    setSelectedOperation: React.Dispatch<React.SetStateAction<ApiOperation | null>>;
    setSelectedInterface: React.Dispatch<React.SetStateAction<ApiInterface | null>>;
    setSelectedPerformanceSuiteId: React.Dispatch<React.SetStateAction<string | null>>;
    setResponse: React.Dispatch<React.SetStateAction<any>>;
    setActiveView: React.Dispatch<React.SetStateAction<SidebarView>>;
    closeContextMenu: () => void;
    selectedTestSuite: TestSuite | null;
    setSelectedTestSuite: React.Dispatch<React.SetStateAction<TestSuite | null>>;
}

interface UseTestCaseHandlersReturn {
    handleSelectTestSuite: (suiteId: string) => void;
    handleSelectTestCase: (caseId: string) => void;
    handleAddAssertion: (data: { xpath: string, expectedContent: string }) => void;
    handleAddExistenceAssertion: (data: { xpath: string }) => void;
    handleGenerateTestSuite: (target: ApiOperation) => void;
    handleRunTestCaseWrapper: (caseId: string) => void;
    handleRunTestSuiteWrapper: (suiteId: string) => void;
    handleSaveExtractor: (data: { xpath: string, value: string, source: 'body' | 'header', variableName: string, defaultValue?: string, editingId?: string, type?: 'XPath' | 'JSONPath' | 'Regex' | 'Header' }) => void;
}

export function useTestCaseHandlers({
    projects,
    setProjects: _setProjects,
    saveProject: _saveProject,
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
    closeContextMenu,
    setSelectedTestSuite
}: UseTestCaseHandlersParams): UseTestCaseHandlersReturn {

    const { testSuites, addSuite, updateTestCase, findSuiteById, findCaseById } = useTestSuites();
    /** Compute the next step object for an in-place step mutation (no-op if
        the step isn't a request step), then persist it through the global
        suite store and refresh the selection state. Replaces the old
        `projects.map(p => p.testSuites.map(...))` + `saveProject` pattern. */
    const applyStepUpdate = useCallback(
        (fn: (step: TestStep) => TestStep) => {
            if (!selectedTestCase || !selectedStep) return;
            const updatedStep = fn(selectedStep);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const isReq = (updatedStep as any).type === 'request';
            void updateTestCase(selectedTestCase.id, tc => ({
                ...tc,
                steps: tc.steps.map(s => (s.id === updatedStep.id ? updatedStep : s))
            }));
            setSelectedStep(updatedStep);
            if (isReq && (updatedStep as any).config?.request) {
                setSelectedRequest((updatedStep as any).config.request);
            }
        },
        [selectedTestCase, selectedStep, updateTestCase, setSelectedStep, setSelectedRequest]
    );

    const handleSelectTestSuite = useCallback((suiteId: string) => {
        const suite = findSuiteById(suiteId);
        if (suite) {
            // Set the selected suite
            setSelectedTestSuite(suite);

            // Clear other specific selections
            setSelectedTestCase(null);
            setSelectedStep(null);
            setSelectedRequest(null);
            setSelectedOperation(null);
            setSelectedInterface(null);
            setSelectedPerformanceSuiteId(null);
            setResponse(null);

            // Don't change activeView - let user stay on current sidebar tab
            // (Assumes SidebarView.TESTS is active if clicking suite)
        }
    }, [findSuiteById, setSelectedTestSuite, setSelectedTestCase, setSelectedStep, setSelectedRequest, setSelectedOperation, setSelectedInterface, setSelectedPerformanceSuiteId, setResponse]);

    const handleSelectTestCase = useCallback((caseId: string) => {
        const found = findCaseById(caseId);
        const foundCase = found?.testCase ?? null;

        if (foundCase) {
            setSelectedTestCase(foundCase);
            setSelectedStep(null);
            setSelectedRequest(null);
            setSelectedOperation(null);
            setSelectedInterface(null);
            setSelectedPerformanceSuiteId(null);
            setResponse(null);
            // Don't change activeView - let user stay on current sidebar tab
        } else {
            bridge.emit({ command: BackendCommand.Error, error: `Could not find Test Case: ${caseId}`, message: `Could not find Test Case: ${caseId}` });
        }
    }, [findCaseById, setSelectedTestCase, setSelectedStep, setSelectedRequest, setSelectedOperation, setSelectedInterface, setSelectedPerformanceSuiteId, setResponse]);

    const handleAddAssertion = useCallback((data: { xpath: string, expectedContent: string }) => {
        console.log("handleAddAssertion Called.", data, "TC:", selectedTestCase?.id, "Step:", selectedStep?.id);

        applyStepUpdate(s => {
            if (s.type !== 'request' || !s.config.request) return s;
            const newAssertion: Assertion = {
                id: crypto.randomUUID(),
                type: 'XPath Match',
                name: 'XPath Match - ' + data.xpath.split('/').pop(),
                configuration: {
                    xpath: data.xpath,
                    expectedContent: data.expectedContent
                }
            };
            return {
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
        });
    }, [selectedTestCase, selectedStep, applyStepUpdate]);

    const handleAddExistenceAssertion = useCallback((data: { xpath: string }) => {
        if (!selectedTestCase || !selectedStep) return;

        applyStepUpdate(s => {
            if (s.type !== 'request' || !s.config.request) return s;
            const newAssertion: Assertion = {
                id: crypto.randomUUID(),
                type: 'XPath Match',
                name: 'Node Exists - ' + data.xpath.split('/').pop(),
                configuration: {
                    xpath: `count(${data.xpath}) > 0`,
                    expectedContent: 'true'
                }
            };
            return {
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
        });
    }, [selectedTestCase, selectedStep, applyStepUpdate]);

    const handleGenerateTestSuite = useCallback((target: ApiOperation) => {
        // C (global suites): the generated suite is stored in the GLOBAL test
        // suite store — no owning project to append it to. The target project
        // is still located to match operations by reference/name, but the
        // suite itself is project-agnostic.
        let targetProject: UnifiedProject | null = null;
        for (const p of projects) {
            const op = (p.operations || []).find(o => o === target || o.name === target.name);
            if (op) {
                targetProject = p;
                break;
            }
        }
        if (!targetProject) return;

        // Identify Operations (the single target operation)
        let operationsToProcess: ApiOperation[] = [target];
        let baseName = target.name;

        // Create Suite
        const newSuite: TestSuite = {
            id: `ts-${Date.now()}`,
            name: `Test Suite - ${baseName}`,
            testCases: [],
            expanded: true
        };

        // Generate Cases
        operationsToProcess.forEach(op => {
            const newCase: TestCase = {
                id: `tc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: op.name,
                steps: [],
                expanded: true
            };

            const newStep: TestStep = {
                id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: 'Request 1',
                type: 'request',
                config: {
                    request: {
                        id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: 'Request 1',
                        endpoint: (op as any).originalEndpoint || undefined,
                        request: `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="${op.targetNamespace || 'http://tempuri.org/'}">
   <soapenv:Header/>
   <soapenv:Body>
      <tem:${op.name}>
         <!--Optional:-->
         ${getInitialXml(op.input)}
      </tem:${op.name}>
   </soapenv:Body>
</soapenv:Envelope>`,
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

        // Save Logic: append to the GLOBAL suite store (no project involved).
        void addSuite(newSuite);

        setActiveView(SidebarView.TESTS);
        closeContextMenu();
    }, [projects, addSuite, setActiveView, closeContextMenu]);

    const handleRunTestCaseWrapper = useCallback((caseId: string) => {
        console.log('[handleRunTestCaseWrapper] CALLED with caseId:', caseId);

        // Find case in the global suite store
        const found = findCaseById(caseId);
        const testCase = found?.testCase ?? null;

        if (!testCase) {
            console.error('[App] Could not find Test Case for ID', caseId);
            return;
        }

        // Send runTestCase command to backend (matches RunTestCaseCommand in TestCommands.ts)
        console.log('[handleRunTestCaseWrapper] Sending runTestCase to backend for:', testCase.name);

        if (isTauri()) {
            (async () => {
                try {
                    const start = await bridge.sendMessageAsync<{ runId: string }>({
                        command: FrontendCommand.RunTestCase,
                        caseId,
                        testCase,
                        fallbackEndpoint: testCase.steps[0]?.config?.request?.endpoint || '',
                        stream: true
                    });

                    const runId = start?.runId;
                    if (!runId) return;

                    let fromIndex = 0;
                    let done = false;
                    while (!done) {
                        const batch = await bridge.sendMessageAsync<{ updates: any[]; nextIndex: number; done: boolean; error?: string }>({
                            command: FrontendCommand.GetTestRunUpdates,
                            runId,
                            fromIndex
                        });

                        if (batch?.updates?.length) {
                            batch.updates.forEach(update => {
                                bridge.emit({ command: BackendCommand.TestRunnerUpdate, update });
                            });
                            fromIndex = batch.nextIndex;
                        }

                        if (batch?.error) {
                            console.error('[handleRunTestCaseWrapper] Test run error:', batch.error);
                            done = true;
                            break;
                        }

                        done = !!batch?.done;
                        if (!done) {
                            await new Promise(resolve => setTimeout(resolve, 250));
                        }
                    }
                } catch (error) {
                    console.error('[handleRunTestCaseWrapper] Tauri run failed', error);
                }
            })();
            return;
        }

        bridge.sendMessage({
            command: 'runTestCase',
            caseId,
            testCase,
            fallbackEndpoint: testCase.steps[0]?.config?.request?.endpoint || ''
        });
    }, [findCaseById]);

    const handleRunTestSuiteWrapper = useCallback((suiteId: string) => {
        console.log('[handleRunTestSuiteWrapper] CALLED with suiteId:', suiteId);

        // Send runTestSuite command to backend (matches RunTestSuiteCommand in TestCommands.ts)
        bridge.sendMessage({
            command: 'runTestSuite',
            suiteId
        });
    }, []);

    const handleSaveExtractor = useCallback((data: { xpath: string, value: string, source: 'body' | 'header', variableName: string, defaultValue?: string, editingId?: string, type?: 'XPath' | 'JSONPath' | 'Regex' | 'Header' }) => {
        if (!selectedTestCase || !selectedStep) {
            console.error('[handleSaveExtractor] Missing selection state', {
                hasTestCase: !!selectedTestCase,
                hasStep: !!selectedStep,
                data
            });
            return;
        }

        applyStepUpdate(s => {
            if (s.type !== 'request' || !s.config.request) return s;

            let newExtractors: RequestExtractor[];

            if (data.editingId) {
                // Edit mode - update existing extractor
                newExtractors = (s.config.request.extractors || []).map(ext =>
                    ext.id === data.editingId
                        ? { ...ext, path: data.xpath, variable: data.variableName, source: data.source, defaultValue: data.defaultValue, type: data.type || ext.type || 'XPath' }
                        : ext
                );
                console.log('[handleSaveExtractor] Editing extractor:', data.editingId);
            } else {
                // Create mode - add new extractor
                const newExtractor: RequestExtractor = {
                    id: crypto.randomUUID(),
                    type: data.type || 'XPath', // Use provided type or default to XPath
                    path: data.xpath,
                    variable: data.variableName,
                    source: data.source,
                    defaultValue: data.defaultValue
                };
                newExtractors = [...(s.config.request.extractors || []), newExtractor];
                console.log('[handleSaveExtractor] Creating new extractor with type:', data.type);
            }

            return {
                ...s,
                config: {
                    ...s.config,
                    request: {
                        ...s.config.request,
                        extractors: newExtractors,
                        dirty: true
                    }
                }
            };
        });
    }, [selectedTestCase, selectedStep, applyStepUpdate]);

    return {
        handleSelectTestSuite,
        handleSelectTestCase,
        handleAddAssertion,
        handleAddExistenceAssertion,
        handleGenerateTestSuite,
        handleRunTestCaseWrapper,
        handleRunTestSuiteWrapper,
        handleSaveExtractor
    };
}
