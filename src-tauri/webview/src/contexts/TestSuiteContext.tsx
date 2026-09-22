/**
 * TestSuiteContext.tsx
 *
 * Global test-suite store (C: suites are no longer per-project).
 *
 * Suites live in a single `~/.apinox/test-suites.json` (mirroring the
 * scrapbook: one global file, whole suite objects as opaque blobs). This is
 * safe because a test step embeds a full `ApiRequest` copy in `config.request`
 * — suites are self-contained and never resolve against a project at runtime.
 *
 * On mount this context runs a one-time, idempotent migration
 * (`migrate_all_project_suites_to_global`) that moves every project's
 * historical `tests/` suites into the global store, then re-loads.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { TestSuite, TestCase } from '@shared/models';
import { bridge, invokeTauriCommand } from '../utils/bridge';
import { debugLog } from '../utils/logger';

interface TestSuiteContextType {
    testSuites: TestSuite[];
    loading: boolean;
    /** Append a new suite (and persist). */
    addSuite: (suite: TestSuite) => Promise<void>;
    /** Remove a suite by id (and persist). */
    deleteSuite: (suiteId: string) => Promise<void>;
    /** Replace a suite by id (and persist). */
    updateSuite: (suite: TestSuite) => Promise<void>;
    /** Replace a test case inside its suite (and persist). */
    updateTestCase: (caseId: string, updater: (tc: TestCase) => TestCase) => Promise<void>;
    /** Find a suite by id. */
    findSuiteById: (suiteId: string) => TestSuite | null;
    /** Find a test case by id (with its parent suite). */
    findCaseById: (caseId: string) => { testCase: TestCase; suite: TestSuite } | null;
}

const TestSuiteContext = createContext<TestSuiteContextType | undefined>(undefined);

export const useTestSuites = () => {
    const context = useContext(TestSuiteContext);
    if (!context) {
        throw new Error('useTestSuites must be used within a TestSuiteProvider');
    }
    return context;
};

/**
 * Non-throwing variant for surfaces that may render outside the provider
 * (isolated component tests). Returns an inert empty store so the component
 * can degrade instead of throwing.
 */
export const useTestSuitesOptional = () =>
    useContext(TestSuiteContext) ?? {
        testSuites: [],
        loading: false,
        addSuite: async () => {},
        deleteSuite: async () => {},
        updateSuite: async () => {},
        updateTestCase: async () => {},
        findSuiteById: () => null,
        findCaseById: () => null,
    };

export const TestSuiteProvider = ({ children }: { children: ReactNode }) => {
    const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    /** Read the global store from the backend. */
    const load = useCallback(async () => {
        try {
            const suites = await invokeTauriCommand<TestSuite[]>('get_test_suites');
            setTestSuites(Array.isArray(suites) ? suites : []);
        } catch (e) {
            debugLog('[TestSuiteContext] get_test_suites failed:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    /** Persist the full suite list (atomic replace, debounced). */
    const persist = useCallback((suites: TestSuite[]) => {
        if (saveTimer.current) {
            clearTimeout(saveTimer.current);
        }
        saveTimer.current = setTimeout(async () => {
            try {
                await invokeTauriCommand('save_test_suites', { suites });
            } catch (e) {
                debugLog('[TestSuiteContext] save_test_suites failed:', e);
            }
        }, 0);
    }, []);

    /** One-time idempotent migration, then load. */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // Moves each project's historical tests/ suites into the global
                // store and removes the tests/ dir. Idempotent by suite id.
                await invokeTauriCommand('migrate_all_project_suites_to_global');
            } catch (e) {
                debugLog('[TestSuiteContext] migration failed (continuing):', e);
            }
            if (!cancelled) await load();
        })();
        return () => {
            cancelled = true;
        };
    }, [load]);

    const addSuite = useCallback(async (suite: TestSuite) => {
        setTestSuites(prev => {
            const next = [...prev.filter(s => s.id !== suite.id), suite];
            persist(next);
            return next;
        });
    }, [persist]);

    const deleteSuite = useCallback(async (suiteId: string) => {
        setTestSuites(prev => {
            const next = prev.filter(s => s.id !== suiteId);
            persist(next);
            return next;
        });
    }, [persist]);

    const updateSuite = useCallback(async (suite: TestSuite) => {
        setTestSuites(prev => {
            const next = prev.map(s => (s.id === suite.id ? suite : s));
            persist(next);
            return next;
        });
    }, [persist]);

    const updateTestCase = useCallback(async (caseId: string, updater: (tc: TestCase) => TestCase) => {
        setTestSuites(prev => {
            let changed = false;
            const next = prev.map(suite => {
                const idx = suite.testCases?.findIndex(tc => tc.id === caseId);
                if (idx === -1) return suite;
                changed = true;
                return {
                    ...suite,
                    testCases: suite.testCases.map((tc, j) => (j === idx ? updater(tc) : tc)),
                };
            });
            if (changed) persist(next);
            return changed ? next : prev;
        });
    }, [persist]);

    const findSuiteById = useCallback((suiteId: string): TestSuite | null => {
        return testSuites.find(s => s.id === suiteId) ?? null;
    }, [testSuites]);

    const findCaseById = useCallback((caseId: string): { testCase: TestCase; suite: TestSuite } | null => {
        for (const suite of testSuites) {
            const testCase = suite.testCases?.find(tc => tc.id === caseId);
            if (testCase) return { testCase, suite };
        }
        return null;
    }, [testSuites]);

    return (
        <TestSuiteContext.Provider value={{ testSuites, loading, addSuite, deleteSuite, updateSuite, updateTestCase, findSuiteById, findCaseById }}>
            {children}
        </TestSuiteContext.Provider>
    );
};
