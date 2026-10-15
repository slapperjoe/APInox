/**
 * @vitest-environment jsdom
 */

/**
 * Regression tests for useTestsAutoSelect.
 *
 * Bug pinned: clicking the parent test suite in the sidebar from a test-case
 * page briefly rendered the suite page, then bounced back to the case page.
 * The auto-select effect in MainContent re-selected the first case whenever
 * `selectedTestCase` was null in the TESTS view — and selecting a suite row
 * is exactly what nulls it. The guard: an explicitly selected suite keeps
 * the suite page on screen (WorkspaceLayout renders TestSuiteSummary only
 * while `selectedTestCase` is null).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTestsAutoSelect } from '../useTestsAutoSelect';
import { SidebarView, TestSuite, TestCase } from '@shared/models';

const makeCase = (id: string): TestCase => ({ id, name: `Case ${id}`, steps: [] });

const makeSuite = (id: string, caseIds: string[]): TestSuite => ({
    id,
    name: `Suite ${id}`,
    testCases: caseIds.map(makeCase),
});

interface SetupOverrides {
    activeView?: SidebarView;
    selectedTestCase?: TestCase | null;
    selectedTestSuite?: TestSuite | null;
    globalTestSuites?: TestSuite[];
}

const setup = (overrides: SetupOverrides = {}) => {
    const setSelectedTestCase = vi.fn();
    renderHook(() =>
        useTestsAutoSelect({
            activeView: SidebarView.TESTS,
            selectedTestCase: null,
            selectedTestSuite: null,
            globalTestSuites: [makeSuite('s1', ['c1', 'c2'])],
            setSelectedTestCase,
            ...overrides
        })
    );
    return { setSelectedTestCase };
};

describe('useTestsAutoSelect', () => {
    it('auto-selects the first case in the TESTS view when nothing is selected', () => {
        const { setSelectedTestCase } = setup();
        const firstCase = makeSuite('s1', ['c1', 'c2']).testCases[0];
        expect(setSelectedTestCase).toHaveBeenCalledTimes(1);
        expect(setSelectedTestCase).toHaveBeenCalledWith(firstCase);
    });

    it('does NOT select a case when a suite is explicitly selected (suite page stays)', () => {
        // The regression: clicking the parent suite row clears selectedTestCase;
        // without this guard the effect immediately re-selects a case and the
        // main area bounces from the suite page back to the case page.
        const { setSelectedTestCase } = setup({
            selectedTestSuite: makeSuite('s1', ['c1', 'c2']),
        });
        expect(setSelectedTestCase).not.toHaveBeenCalled();
    });

    it('does not select outside the TESTS view', () => {
        const { setSelectedTestCase } = setup({ activeView: SidebarView.UNIFIED_EXPLORER });
        expect(setSelectedTestCase).not.toHaveBeenCalled();
    });

    it('does not re-select when a case is already selected', () => {
        const { setSelectedTestCase } = setup({ selectedTestCase: makeCase('c1') });
        expect(setSelectedTestCase).not.toHaveBeenCalled();
    });

    it('selects again once the suite selection is cleared (e.g. suite deleted)', () => {
        // The selectedTestSuite sync effect nulls a deleted suite; from there
        // the auto-select should resume so the view is not left empty.
        const { setSelectedTestCase } = setup({ selectedTestSuite: null });
        expect(setSelectedTestCase).toHaveBeenCalledTimes(1);
    });

    it('does not select when no cases exist', () => {
        const { setSelectedTestCase } = setup({ globalTestSuites: [makeSuite('s1', [])] });
        expect(setSelectedTestCase).not.toHaveBeenCalled();
    });
});
