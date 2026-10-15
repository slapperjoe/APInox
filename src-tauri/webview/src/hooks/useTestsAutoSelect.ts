/**
 * useTestsAutoSelect.ts
 *
 * Auto-selects the first test case when the TESTS view has no selection —
 * so opening the view shows something useful instead of an empty state.
 *
 * Guard: an explicitly selected test suite means the user is on the suite
 * page. Selecting a suite row clears `selectedTestCase` to show that page
 * (WorkspaceLayout renders TestSuiteSummary only while `selectedTestCase`
 * is null), and re-selecting a case here is what made the suite page flash
 * for one frame and bounce back to a case page.
 */

import { useEffect } from 'react';
import { SidebarView, TestSuite, TestCase } from '@shared/models';

interface UseTestsAutoSelectParams {
    activeView: SidebarView;
    selectedTestCase: TestCase | null;
    selectedTestSuite: TestSuite | null;
    /** The global suite store (C: suites are project-agnostic). */
    globalTestSuites: TestSuite[];
    setSelectedTestCase: React.Dispatch<React.SetStateAction<TestCase | null>>;
}

/**
 * Auto-selects the first test case when the Tests view is active and
 * nothing (no suite, no case) is selected but cases exist.
 */
export function useTestsAutoSelect({
    activeView,
    selectedTestCase,
    selectedTestSuite,
    globalTestSuites,
    setSelectedTestCase
}: UseTestsAutoSelectParams): void {
    // ONLY in Tests view to avoid re-selecting after user clears selection
    // for navigation.
    useEffect(() => {
        if (activeView !== SidebarView.TESTS) return;
        // An explicitly selected suite keeps the suite page on screen.
        if (selectedTestSuite) return;
        // Flatten all test cases from the global suite store (C)
        const allCases = globalTestSuites.flatMap(s => s.testCases || []);
        if (allCases.length > 0 && !selectedTestCase) {
            setSelectedTestCase(allCases[0]);
        }
    }, [globalTestSuites, selectedTestCase, selectedTestSuite, setSelectedTestCase, activeView]);
}
