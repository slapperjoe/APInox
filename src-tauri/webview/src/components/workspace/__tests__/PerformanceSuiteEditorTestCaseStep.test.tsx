import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PerformanceSuiteEditor } from '../PerformanceSuiteEditor';
import { PerformanceSuite, PerformanceRun, TestCase, TestStep } from '@shared/models';

const suite: PerformanceSuite = {
    id: 'perf-1',
    name: 'Load test',
    requests: [],
    iterations: 1,
    delayBetweenRequests: 0,
    warmupRuns: 0,
    concurrency: 1,
    createdAt: 0,
    modifiedAt: 0,
};

const cases: TestCase[] = [
    {
        id: 'c1',
        name: 'Login flow',
        steps: [{ id: 's1', name: 'Call', type: 'request', config: {} }],
    },
];

const renderEditor = (
    overrides: Partial<Parameters<typeof PerformanceSuiteEditor>[0]> = {}
) => {
    const onAddTestCase = overrides.onAddTestCase ?? vi.fn();
    const utils = render(
        <PerformanceSuiteEditor
            suite={suite}
            onUpdate={vi.fn()}
            onRun={vi.fn()}
            onStop={vi.fn()}
            isRunning={false}
            testCases={cases}
            onAddTestCase={onAddTestCase}
            {...overrides}
        />
    );
    return { ...utils, onAddTestCase };
};

describe('PerformanceSuiteEditor test-case steps', () => {
    it('opens the case picker and adds the picked case as one step', () => {
        const { onAddTestCase } = renderEditor();

        fireEvent.click(screen.getByText('Add Test Case'));
        // The picker lists the global cases with their step counts.
        expect(screen.getByText('Login flow')).toBeInTheDocument();
        expect(screen.getByText('1 steps')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Login flow/ }));
        expect(onAddTestCase).toHaveBeenCalledWith('perf-1', 'c1');
    });

    it('shows the empty picker hint when no test cases exist', () => {
        renderEditor({ testCases: [] });
        fireEvent.click(screen.getByText('Add Test Case'));
        expect(
            screen.getByText('No test cases yet — create one in the TESTS view first.')
        ).toBeInTheDocument();
    });

    it('renders a testCase step as a live reference, not as an endpoint row', () => {
        const step = {
            id: 'perf-req-1',
            name: 'Login flow',
            type: 'testCase' as const,
            testCaseId: 'c1',
            endpoint: '',
            requestBody: '',
            extractors: [],
            order: 0,
        };
        renderEditor({ suite: { ...suite, requests: [step] } });

        expect(screen.getByText('Steps (1)')).toBeInTheDocument();
        expect(screen.getByText('1 steps • runs "Login flow"')).toBeInTheDocument();
    });

    it('flags a broken case reference', () => {
        const step = {
            id: 'perf-req-1',
            name: 'Login flow',
            type: 'testCase' as const,
            testCaseId: 'gone',
            endpoint: '',
            requestBody: '',
            extractors: [],
            order: 0,
        };
        renderEditor({ suite: { ...suite, requests: [step] } });
        expect(screen.getByText('Test case not found — the reference is broken')).toBeInTheDocument();
    });

    it('groups result rows under the case step they came from', () => {
        const run: PerformanceRun = {
            id: 'run-1',
            suiteId: 'perf-1',
            suiteName: 'Load test',
            startTime: 0,
            endTime: 100,
            status: 'completed',
            results: [
                {
                    requestId: 's1',
                    requestName: 'Call',
                    parentStepId: 'perf-req-1',
                    parentStepName: 'Login flow',
                    iteration: 0,
                    duration: 42,
                    status: 200,
                    success: true,
                    slaBreached: false,
                    timestamp: 0,
                },
            ],
            summary: {
                totalRequests: 1, successCount: 1, failureCount: 0, successRate: 1,
                avgResponseTime: 42, minResponseTime: 42, maxResponseTime: 42,
                p50: 42, p95: 42, p99: 42, slaBreachCount: 0, totalDuration: 42,
            },
        };

        renderEditor({ history: [run] });
        // Runs start collapsed — expand the run to see its result rows.
        fireEvent.click(screen.getByText('1 requests • 100% success • avg 42ms'));
        expect(screen.getByText('Login flow › Call')).toBeInTheDocument();
    });
});
