/**
 * useSidebarCallbacks.ts
 * 
 * Hook that provides callbacks for Sidebar test suite/case operations.
 * Extracted from App.tsx to reduce inline handler complexity.
 */

import { useCallback } from 'react';
import { UnifiedProject, TestCase, TestSuite } from '@shared/models';
import { BackendCommand } from '@shared/messages';
import { bridge } from '../utils/bridge';
import { debugLog } from '../utils/logger';
import { rekeyTestSuite, rekeyTestCase, sanitizeFileName } from '../utils/testImportExport';
import { useTestSuites } from '../contexts/TestSuiteContext';

interface UseSidebarCallbacksParams {
    // Phase B (t_86c34d38): the TESTS suite CRUD now operates on the GLOBAL
    // test-suite store (suites are no longer per-project). The `projects` /
    // `setProjects` / `saveProject` params are retained for the callers that
    // pass them, but suite mutations flow through `useTestSuites` (auto-saved
    // to `~/.apinox/test-suites.json`).
    projects: UnifiedProject[];
    setProjects: React.Dispatch<React.SetStateAction<UnifiedProject[]>>;
    deleteConfirm: string | null;
    setDeleteConfirm: React.Dispatch<React.SetStateAction<string | null>>;
    saveProject: (project: UnifiedProject) => void;
    config: any;
}

interface UseSidebarCallbacksReturn {
    handleAddSuite: (projName?: string, suiteName?: string) => void;
    handleDeleteSuite: (suiteId: string) => void;
    handleToggleSuiteExpand: (suiteId: string) => void;
    handleToggleCaseExpand: (caseId: string) => void;
    handleAddTestCase: (suiteId: string) => void;
    handleDeleteTestCase: (caseId: string) => void;
    handleRenameTestCase: (caseId: string, newName: string) => void;
    handleRenameSuite: (suiteId: string, newName: string) => void;
    handleRenameTestStep: (caseId: string, stepId: string, newName: string) => void;
    handleDeleteTestStep: (caseId: string, stepId: string) => void;
    handleExportSuite: (suiteId: string) => void;
    handleExportTestCase: (caseId: string) => void;
    handleImportSuite: () => void;
    handleImportTestCase: (suiteId: string) => void;
    handleSaveUiState: () => void;
}

export function useSidebarCallbacks({
    projects: _projects,
    setProjects: _setProjects,
    deleteConfirm,
    setDeleteConfirm,
    saveProject: _saveProject,
    config
}: UseSidebarCallbacksParams): UseSidebarCallbacksReturn {

    const { testSuites, addSuite, deleteSuite, updateSuite, updateTestCase, findCaseById } = useTestSuites();

    /** Update one suite by id (no-op if not found). */
    const updateSuiteLocal = useCallback((suiteId: string, updater: (s: TestSuite) => TestSuite) => {
        const suite = testSuites.find(s => s.id === suiteId);
        if (!suite) return;
        void updateSuite(updater(suite));
    }, [testSuites, updateSuite]);

    const handleAddSuite = useCallback((_projName?: string, suiteName?: string) => {
        // `_projName` is accepted for signature compatibility but no longer used:
        // suites are global, so there is no owning project to pick.
        if (config?.isReadOnly) {
            bridge.emit({ command: BackendCommand.Error, error: 'Cannot create test suites in a read-only workspace.', message: 'Cannot create test suites in a read-only workspace.' });
            return;
        }
        const name = suiteName || `TestSuite ${testSuites.length + 1}`;
        const newSuite: TestSuite = {
            id: `suite-${Date.now()}`,
            name,
            testCases: [],
            expanded: true
        };
        void addSuite(newSuite);
    }, [testSuites.length, addSuite, config]);

    const handleDeleteSuite = useCallback((suiteId: string) => {
        if (deleteConfirm === suiteId) {
            void deleteSuite(suiteId);
            setDeleteConfirm(null);
        } else {
            setDeleteConfirm(suiteId);
            setTimeout(() => setDeleteConfirm(null), 2000);
        }
    }, [deleteConfirm, deleteSuite, setDeleteConfirm]);

    const handleToggleSuiteExpand = useCallback((suiteId: string) => {
        updateSuiteLocal(suiteId, s => ({ ...s, expanded: s.expanded === false ? true : false }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updateSuite]);

    const handleToggleCaseExpand = useCallback((caseId: string) => {
        void updateTestCase(caseId, tc => ({ ...tc, expanded: tc.expanded === false ? true : false }));
    }, [updateTestCase]);

    const handleAddTestCase = useCallback((suiteId: string) => {
        const suite = testSuites.find(s => s.id === suiteId);
        if (!suite) return;
        const newCase: TestCase = {
            id: `tc-${Date.now()}`,
            name: `TestCase ${(suite.testCases?.length || 0) + 1}`,
            expanded: true,
            steps: []
        };
        void updateSuite({ ...suite, testCases: [...(suite.testCases || []), newCase] });
    }, [testSuites, updateSuite]);

    const handleDeleteTestCase = useCallback((caseId: string) => {
        if (deleteConfirm === caseId) {
            const found = findCaseById(caseId);
            if (found) {
                void updateSuite({ ...found.suite, testCases: found.suite.testCases?.filter(tc => tc.id !== caseId) || [] });
            }
            setDeleteConfirm(null);
        } else {
            setDeleteConfirm(caseId);
            setTimeout(() => setDeleteConfirm(null), 2000);
        }
    }, [deleteConfirm, findCaseById, updateSuite, setDeleteConfirm]);

    const handleRenameTestCase = useCallback((caseId: string, newName: string) => {
        debugLog('[useSidebarCallbacks] handleRenameTestCase called', { caseId, newName });
        void updateTestCase(caseId, tc => ({ ...tc, name: newName }));
    }, [updateTestCase]);

    const handleRenameSuite = useCallback((suiteId: string, newName: string) => {
        const suite = testSuites.find(s => s.id === suiteId);
        if (suite) {
            void updateSuite({ ...suite, name: newName });
        }
    }, [testSuites, updateSuite]);

    const handleRenameTestStep = useCallback((caseId: string, stepId: string, newName: string) => {
        void updateTestCase(caseId, tc => ({
            ...tc,
            steps: tc.steps.map(step => (step.id === stepId ? { ...step, name: newName } : step))
        }));
    }, [updateTestCase]);

    // Two-click confirm for the RIGHT-CLICK menu delete (matches suite/case):
    // first click arms `deleteConfirm`, second deletes. Step ids are distinct
    // from case/suite ids (`step-${Date.now()}`), so the shared `deleteConfirm`
    // never cross-arms an unrelated row.
    const handleDeleteTestStep = useCallback((caseId: string, stepId: string) => {
        if (deleteConfirm === stepId) {
            void updateTestCase(caseId, tc => ({
                ...tc,
                steps: tc.steps.filter(s => s.id !== stepId)
            }));
            setDeleteConfirm(null);
        } else {
            setDeleteConfirm(stepId);
            setTimeout(() => setDeleteConfirm(null), 2000);
        }
    }, [deleteConfirm, updateTestCase, setDeleteConfirm]);

    const handleSaveUiState = useCallback(() => {
        if (config) {
            bridge.sendMessage({ command: 'saveUiState', ui: config.ui });
        }
    }, [config]);

    // ── File import/export (right-click menu) ───────────────────────────────
    // Mirrors the test-suite test-case file IO split: this hook owns the
    // native save/open dialogs, Rust does the file IO, and the global suite
    // store persists the result. Exports re-source the object from the
    // store by id; imports are ALWAYS adds — rekeyTestSuite/rekeyTestCase
    // reassign every id, so importing a file (even a re-import of one you
    // exported) never silently replaces an existing suite or case.
    const handleExportSuite = useCallback(async (suiteId: string) => {
        const suite = testSuites.find(s => s.id === suiteId);
        if (!suite) return;
        try {
            const { save } = await import('@tauri-apps/plugin-dialog');
            const filePath = await save({
                defaultPath: `${sanitizeFileName(suite.name, suite.id)}.test-suite.json`,
                filters: [{ name: 'APInox Test Suite', extensions: ['json'] }],
            });
            if (!filePath) return; // user cancelled the dialog
            await bridge.invokeTauriCommand('export_test_suite_to_file', { suiteId, filePath });
        } catch (error) {
            console.error('[useSidebarCallbacks] Failed to export test suite:', error);
            alert(`Failed to export test suite: ${(error as any)?.message || error}`);
        }
    }, [testSuites]);

    const handleExportTestCase = useCallback(async (caseId: string) => {
        const found = findCaseById(caseId);
        if (!found) return;
        try {
            const { save } = await import('@tauri-apps/plugin-dialog');
            const filePath = await save({
                defaultPath: `${sanitizeFileName(found.testCase.name, caseId)}.test-case.json`,
                filters: [{ name: 'APInox Test Case', extensions: ['json'] }],
            });
            if (!filePath) return; // user cancelled the dialog
            await bridge.invokeTauriCommand('export_test_case_to_file', { caseId, filePath });
        } catch (error) {
            console.error('[useSidebarCallbacks] Failed to export test case:', error);
            alert(`Failed to export test case: ${(error as any)?.message || error}`);
        }
    }, [findCaseById]);

    const handleImportSuite = useCallback(async () => {
        if (config?.isReadOnly) {
            bridge.emit({ command: BackendCommand.Error, error: 'Cannot import test suites in a read-only workspace.', message: 'Cannot import test suites in a read-only workspace.' });
            return;
        }
        try {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const res = await open({
                multiple: false,
                directory: false,
                filters: [{ name: 'APInox Test Suite', extensions: ['json'] }],
            });
            const filePath = Array.isArray(res) ? res[0] : res;
            if (!filePath) return; // user cancelled the dialog
            const raw = await bridge.invokeTauriCommand('import_test_suite_from_file', { filePath });
            void addSuite(rekeyTestSuite(raw));
        } catch (error) {
            console.error('[useSidebarCallbacks] Failed to import test suite:', error);
            alert(`Failed to import test suite: ${(error as any)?.message || error}`);
        }
    }, [addSuite, config]);

    const handleImportTestCase = useCallback(async (suiteId: string) => {
        if (config?.isReadOnly) {
            bridge.emit({ command: BackendCommand.Error, error: 'Cannot import test cases in a read-only workspace.', message: 'Cannot import test cases in a read-only workspace.' });
            return;
        }
        const suite = testSuites.find(s => s.id === suiteId);
        if (!suite) return;
        try {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const res = await open({
                multiple: false,
                directory: false,
                filters: [{ name: 'APInox Test Case', extensions: ['json'] }],
            });
            const filePath = Array.isArray(res) ? res[0] : res;
            if (!filePath) return; // user cancelled the dialog
            const raw = await bridge.invokeTauriCommand('import_test_case_from_file', { filePath });
            const imported = rekeyTestCase(raw);
            void updateSuite({ ...suite, testCases: [...(suite.testCases || []), imported] });
        } catch (error) {
            console.error('[useSidebarCallbacks] Failed to import test case:', error);
            alert(`Failed to import test case: ${(error as any)?.message || error}`);
        }
    }, [config, testSuites, updateSuite]);

    return {
        handleAddSuite,
        handleDeleteSuite,
        handleToggleSuiteExpand,
        handleToggleCaseExpand,
        handleAddTestCase,
        handleDeleteTestCase,
        handleRenameTestCase,
        handleRenameSuite,
        handleRenameTestStep,
        handleDeleteTestStep,
        handleExportSuite,
        handleExportTestCase,
        handleImportSuite,
        handleImportTestCase,
        handleSaveUiState
    };
}
