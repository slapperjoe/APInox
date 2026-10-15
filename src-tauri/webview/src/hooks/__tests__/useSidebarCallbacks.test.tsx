/**
 * Regression tests for useSidebarCallbacks.
 *
 * Bug pinned: the TESTS sidebar chevron on a test suite did nothing when
 * clicked. `handleToggleSuiteExpand` was memoised with `[updateSuite]` only,
 * and `updateSuite` is stable across renders — so the callback kept the
 * `updateSuiteLocal` closure from the FIRST render, which captured the empty
 * pre-load `testSuites`. `find` then returned undefined and the handler
 * returned early, so the suite never collapsed.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { TestSuite } from '@shared/models';
import { useSidebarCallbacks } from '../useSidebarCallbacks';
import { TestSuiteProvider, useTestSuites } from '../../contexts/TestSuiteContext';

// ── hermetic mock of the bridge (global suite store round-trip) ──────────────
// Path is relative to THIS test file (hooks/__tests__/): TestSuiteContext
// imports '../utils/bridge' → src/utils/bridge.
const invokeMock = vi.fn();
vi.mock('../../utils/bridge', () => ({
    bridge: { sendMessage: vi.fn(), onMessage: vi.fn(), emit: vi.fn() },
    invokeTauriCommand: (...args: any[]) => invokeMock(...args),
    isVsCode: () => false,
}));

const fixtureSuites: TestSuite[] = [
    {
        id: 'suite-1',
        name: 'Smoke Suite',
        testCases: [{ id: 'tc-1', name: 'Case 1', expanded: true, steps: [] }],
        expanded: true,
    },
];

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestSuiteProvider>{children}</TestSuiteProvider>
);

/** Render the hook inside the global suite store and expose both sides. */
const setup = async () => {
    const { result } = renderHook(
        () => ({
            testSuites: useTestSuites().testSuites,
            api: useSidebarCallbacks({
                projects: [],
                setProjects: () => {},
                deleteConfirm: null,
                setDeleteConfirm: () => {},
                saveProject: () => {},
                config: {},
            }),
        }),
        { wrapper }
    );
    // The provider loads the store on mount; the stale-closure bug only shows
    // up once that load has replaced the initial empty state, so wait for it.
    await waitFor(() => expect(result.current.testSuites.length).toBe(1));
    return result;
};

describe('useSidebarCallbacks suite expand', () => {
    beforeEach(() => {
        invokeMock.mockReset();
        invokeMock.mockImplementation(async (command: string, args: any) => {
            if (command === 'get_test_suites') return fixtureSuites;
            if (command === 'save_test_suites') return args.suites;
            return null;
        });
    });

    it('collapses a suite when its chevron is clicked', async () => {
        const result = await setup();

        act(() => result.current.api.handleToggleSuiteExpand('suite-1'));
        expect(result.current.testSuites[0].expanded).toBe(false);
    });

    it('re-expands a collapsed suite on the next click', async () => {
        const result = await setup();

        act(() => result.current.api.handleToggleSuiteExpand('suite-1'));
        act(() => result.current.api.handleToggleSuiteExpand('suite-1'));
        expect(result.current.testSuites[0].expanded).toBe(true);
    });

    it('toggles a test case chevron too (the working sibling, pinned)', async () => {
        const result = await setup();

        act(() => result.current.api.handleToggleCaseExpand('tc-1'));
        expect(result.current.testSuites[0].testCases[0].expanded).toBe(false);
    });
});
