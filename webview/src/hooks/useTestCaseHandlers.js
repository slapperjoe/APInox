/**
 * useTestCaseHandlers.ts
 *
 * Hook for managing test case selection and assertion handlers.
 * Extracted from App.tsx to reduce complexity.
 */
import { useCallback } from 'react';
import { SidebarView } from '@shared/models';
import { bridge } from '../utils/bridge';
import { getInitialXml } from '@shared/utils/xmlUtils';
export function useTestCaseHandlers({ projects, setProjects, saveProject, selectedTestCase, selectedStep, setSelectedTestCase, setSelectedStep, setSelectedRequest, setSelectedOperation, setSelectedInterface, setSelectedPerformanceSuiteId, setResponse, setActiveView, closeContextMenu, setSelectedTestSuite }) {
    const handleSelectTestSuite = useCallback((suiteId) => {
        const suite = projects.find(p => p.testSuites?.some(s => s.id === suiteId))?.testSuites?.find(s => s.id === suiteId);
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
    }, [projects, setSelectedTestSuite, setSelectedTestCase, setSelectedStep, setSelectedRequest, setSelectedOperation, setSelectedInterface, setSelectedPerformanceSuiteId, setResponse]);
    const handleSelectTestCase = useCallback((caseId) => {
        let foundCase = null;
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
            if (foundCase)
                break;
        }
        if (foundCase) {
            setSelectedTestCase(foundCase);
            setSelectedStep(null);
            setSelectedRequest(null);
            setSelectedOperation(null);
            setSelectedInterface(null);
            setSelectedPerformanceSuiteId(null);
            setResponse(null);
            // Don't change activeView - let user stay on current sidebar tab
        }
        else {
            bridge.sendMessage({ command: 'error', message: `Could not find Test Case: ${caseId}` });
        }
    }, [projects, setSelectedTestCase, setSelectedStep, setSelectedRequest, setSelectedOperation, setSelectedInterface, setSelectedPerformanceSuiteId, setResponse]);
    const handleAddAssertion = useCallback((data) => {
        console.log("handleAddAssertion Called.", data, "TC:", selectedTestCase?.id, "Step:", selectedStep?.id);
        if (!selectedTestCase || !selectedStep) {
            console.error("Missing selection state", { tc: !!selectedTestCase, step: !!selectedStep });
            return;
        }
        let updatedStep = null;
        let updatedProjectOrNull = null;
        const nextProjects = projects.map(p => {
            const suite = p.testSuites?.find(s => s.testCases?.some(tc => tc.id === selectedTestCase.id));
            if (!suite)
                return p;
            const updatedSuite = {
                ...suite,
                testCases: suite.testCases?.map(tc => {
                    if (tc.id !== selectedTestCase.id)
                        return tc;
                    return {
                        ...tc,
                        steps: tc.steps.map(s => {
                            if (s.id !== selectedStep.id)
                                return s;
                            if (s.type !== 'request' || !s.config.request)
                                return s;
                            const newAssertion = {
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
            const updatedProject = { ...p, testSuites: p.testSuites.map(s => s.id === suite.id ? updatedSuite : s), dirty: true };
            updatedProjectOrNull = updatedProject;
            return updatedProject;
        });
        if (updatedProjectOrNull) {
            setProjects(nextProjects);
            setTimeout(() => saveProject(updatedProjectOrNull), 0);
            if (updatedStep) {
                setSelectedStep(updatedStep);
                if (updatedStep.type === 'request' && updatedStep.config.request) {
                    setSelectedRequest(updatedStep.config.request);
                }
            }
        }
    }, [projects, selectedTestCase, selectedStep, setProjects, saveProject, setSelectedStep, setSelectedRequest]);
    const handleAddExistenceAssertion = useCallback((data) => {
        if (!selectedTestCase || !selectedStep)
            return;
        let updatedStep = null;
        let updatedProjectOrNull = null;
        const nextProjects = projects.map(p => {
            const suite = p.testSuites?.find(s => s.testCases?.some(tc => tc.id === selectedTestCase.id));
            if (!suite)
                return p;
            const updatedSuite = {
                ...suite,
                testCases: suite.testCases?.map(tc => {
                    if (tc.id !== selectedTestCase.id)
                        return tc;
                    return {
                        ...tc,
                        steps: tc.steps.map(s => {
                            if (s.id !== selectedStep.id)
                                return s;
                            if (s.type !== 'request' || !s.config.request)
                                return s;
                            const newAssertion = {
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
            const updatedProject = { ...p, testSuites: p.testSuites.map(s => s.id === suite.id ? updatedSuite : s), dirty: true };
            updatedProjectOrNull = updatedProject;
            return updatedProject;
        });
        if (updatedProjectOrNull) {
            setProjects(nextProjects);
            setTimeout(() => saveProject(updatedProjectOrNull), 0);
            if (updatedStep) {
                setSelectedStep(updatedStep);
                if (updatedStep.type === 'request' && updatedStep.config.request) {
                    setSelectedRequest(updatedStep.config.request);
                }
            }
        }
    }, [projects, selectedTestCase, selectedStep, setProjects, saveProject, setSelectedStep, setSelectedRequest]);
    const handleGenerateTestSuite = useCallback((target) => {
        // Find the project containing this target
        let targetProject = null;
        for (const p of projects) {
            if (p.interfaces.some(i => i === target || i.operations.some(o => o === target))) {
                targetProject = p;
                break;
            }
        }
        if (!targetProject)
            return;
        // Identify Operations
        let operationsToProcess = [];
        let baseName = '';
        if (target.operations) {
            operationsToProcess = target.operations;
            baseName = target.name;
        }
        else {
            operationsToProcess = [target];
            baseName = target.name;
        }
        // Create Suite
        const newSuite = {
            id: `ts-${Date.now()}`,
            name: `Test Suite - ${baseName}`,
            testCases: [],
            expanded: true
        };
        // Generate Cases
        operationsToProcess.forEach(op => {
            const newCase = {
                id: `tc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: op.name,
                steps: [],
                expanded: true
            };
            const newStep = {
                id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: 'Request 1',
                type: 'request',
                config: {
                    request: {
                        id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: 'Request 1',
                        endpoint: op.originalEndpoint || undefined,
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
        // Save Logic
        setProjects(prev => prev.map(p => {
            if (p.id === targetProject.id || p.fileName === targetProject.fileName) {
                const updated = { ...p, testSuites: [...(p.testSuites || []), newSuite], dirty: true };
                setTimeout(() => saveProject(updated), 0);
                return updated;
            }
            return p;
        }));
        setActiveView(SidebarView.TESTS);
        closeContextMenu();
    }, [projects, setProjects, saveProject, setActiveView, closeContextMenu]);
    const handleRunTestCaseWrapper = useCallback((caseId) => {
        console.log('[handleRunTestCaseWrapper] CALLED with caseId:', caseId);
        bridge.sendMessage({ command: 'log', message: `[Run Test Case] Starting: ${caseId}` });
        // Find case
        let testCase = null;
        for (const p of projects) {
            if (p.testSuites) {
                for (const s of p.testSuites) {
                    testCase = s.testCases?.find(tc => tc.id === caseId) || null;
                    if (testCase)
                        break;
                }
            }
            if (testCase)
                break;
        }
        if (!testCase) {
            console.error('[App] Could not find Test Case for ID', caseId);
            return;
        }
        // Send runTestCase command to backend (matches RunTestCaseCommand in TestCommands.ts)
        console.log('[handleRunTestCaseWrapper] Sending runTestCase to backend for:', testCase.name);
        bridge.sendMessage({
            command: 'runTestCase',
            caseId,
            testCase,
            fallbackEndpoint: testCase.steps[0]?.config?.request?.endpoint || ''
        });
    }, [projects]);
    const handleRunTestSuiteWrapper = useCallback((suiteId) => {
        console.log('[handleRunTestSuiteWrapper] CALLED with suiteId:', suiteId);
        bridge.sendMessage({ command: 'log', message: `[Run Test Suite] Starting: ${suiteId}` });
        // Send runTestSuite command to backend (matches RunTestSuiteCommand in TestCommands.ts)
        bridge.sendMessage({
            command: 'runTestSuite',
            suiteId
        });
    }, []);
    const handleSaveExtractor = useCallback((data) => {
        if (!selectedTestCase || !selectedStep) {
            console.error('[handleSaveExtractor] Missing selection state', {
                hasTestCase: !!selectedTestCase,
                hasStep: !!selectedStep,
                data
            });
            return;
        }
        // Build the updated step for immediate UI update
        let updatedStep = null;
        if (selectedStep.type === 'request' && selectedStep.config.request) {
            let newExtractors;
            if (data.editingId) {
                // Edit mode - update existing extractor
                newExtractors = (selectedStep.config.request.extractors || []).map(ext => ext.id === data.editingId
                    ? { ...ext, path: data.xpath, variable: data.variableName, source: data.source, defaultValue: data.defaultValue }
                    : ext);
                console.log('[handleSaveExtractor] Editing extractor:', data.editingId);
            }
            else {
                // Create mode - add new extractor
                const newExtractor = {
                    id: crypto.randomUUID(),
                    type: 'XPath',
                    path: data.xpath,
                    variable: data.variableName,
                    source: data.source,
                    defaultValue: data.defaultValue
                };
                newExtractors = [...(selectedStep.config.request.extractors || []), newExtractor];
                console.log('[handleSaveExtractor] Creating new extractor');
            }
            updatedStep = {
                ...selectedStep,
                config: {
                    ...selectedStep.config,
                    request: {
                        ...selectedStep.config.request,
                        extractors: newExtractors,
                        dirty: true
                    }
                }
            };
        }
        const nextProjects = projects.map(p => {
            const suite = p.testSuites?.find(s => s.testCases?.some(tc => tc.id === selectedTestCase.id));
            if (!suite)
                return p;
            const updatedSuite = {
                ...suite,
                testCases: suite.testCases?.map(tc => {
                    if (tc.id !== selectedTestCase.id)
                        return tc;
                    return {
                        ...tc,
                        steps: tc.steps.map(s => {
                            if (s.id !== selectedStep.id)
                                return s;
                            return updatedStep || s;
                        })
                    };
                })
            };
            const updatedProject = { ...p, testSuites: p.testSuites.map(s => s.id === suite.id ? updatedSuite : s), dirty: true };
            setTimeout(() => saveProject(updatedProject), 0);
            return updatedProject;
        });
        setProjects(nextProjects);
        // Update selectedStep so UI reflects the new extractor immediately
        if (updatedStep) {
            setSelectedStep(updatedStep);
            // CRITICAL: Also update selectedRequest, as ExtractorsPanel renders from selectedRequest.extractors
            if (updatedStep.config.request) {
                setSelectedRequest(updatedStep.config.request);
            }
        }
    }, [projects, selectedTestCase, selectedStep, setProjects, setSelectedStep, setSelectedRequest, saveProject]);
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
