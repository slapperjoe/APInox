import { describe, expect, it } from 'vitest';
import { embedTestRun, embedPerfRun, MAX_EMBED_DEPTH } from '../runEmbedding';
import { PerformanceSuite, TestCase, TestStep } from '@shared/models';

const tc = (id: string, steps: TestStep[]): TestCase => ({ id, name: id, steps });
const req = (id: string): TestStep =>
    ({ id, name: id, type: 'request', config: { request: { id, name: id, endpoint: 'http://x', request: '<X/>' } } }) as TestStep;

describe('embedTestRun', () => {
    it('embeds a referenced test case\'s steps', () => {
        const target = tc('c2', [req('r1')]);
        const source = tc('c1', [{ id: 's1', name: 'T', type: 'testCase', config: { testCaseId: 'c2' } }] as TestStep[]);
        const out = embedTestRun([source], [source, target]);
        expect(out[0].steps[0].config.testCaseSteps).toHaveLength(1);
        expect(out[0].steps[0].config.testCaseSteps![0].id).toBe('r1');
    });

    it('folds the referenced case\'s variables under the step overrides', () => {
        const target: TestCase = { ...tc('c2', [req('r1')]), variables: { a: 'case', b: 'case' } };
        const source = tc('c1', [{ id: 's1', name: 'T', type: 'testCase', config: { testCaseId: 'c2', testCaseVariables: { b: 'step', c: 'step' } } }] as TestStep[]);
        const out = embedTestRun([source], [source, target]);
        expect(out[0].steps[0].config.testCaseVariables).toEqual({ a: 'case', b: 'step', c: 'step' });
    });

    it('expands nesting: case -> case -> case', () => {
        const inner = tc('c3', [req('r1')]);
        const middle = tc('c2', [{ id: 's2', type: 'testCase', config: { testCaseId: 'c3' } }] as TestStep[]);
        const outer = tc('c1', [{ id: 's1', type: 'testCase', config: { testCaseId: 'c2' } }] as TestStep[]);
        const out = embedTestRun([outer], [outer, middle, inner]);
        const nested = out[0].steps[0].config.testCaseSteps!;
        expect(nested[0].config.testCaseSteps).toHaveLength(1);
        expect(nested[0].config.testCaseSteps![0].id).toBe('r1');
    });

    it('stops at a cycle: the back-reference stays unembedded, no hang', () => {
        const c = tc('c1', [{ id: 's1', type: 'testCase', config: { testCaseId: 'c1' } }] as TestStep[]);
        const out = embedTestRun([c], [c]);
        // Self-reference is cut (the root case is seeded on the path).
        expect(out[0].steps[0].config.testCaseSteps).toBeUndefined();
    });

    it('caps recursion depth at MAX_EMBED_DEPTH', () => {
        // Chain c1 -> c2 -> ... -> c12 (each a testCase step to the next).
        const cases: TestCase[] = [];
        for (let i = 1; i <= 12; i++) {
            cases.push(tc(`c${i}`, [{ id: `s${i}`, type: 'testCase', config: { testCaseId: `c${i + 1}` } }] as TestStep[]));
        }
        const out = embedTestRun([cases[0]], cases);
        // Walk the embedded chain; it must terminate well before any overflow.
        let cur: TestStep[] | undefined = out[0].steps[0].config.testCaseSteps;
        let depth = 0;
        while (cur && cur.length > 0) {
            depth += 1;
            cur = cur[0].config.testCaseSteps;
        }
        expect(depth).toBeLessThanOrEqual(MAX_EMBED_DEPTH);
    });

    it('leaves steps with missing reference ids untouched', () => {
        const c = tc('c1', [{ id: 's1', type: 'testCase', config: { testCaseId: 'gone' } }] as TestStep[]);
        const out = embedTestRun([c], [c]);
        expect(out[0].steps[0].config.testCaseSteps).toBeUndefined();
    });
});

describe('embedPerfRun', () => {
    const perfSuite = (requests: PerformanceSuite['requests']): PerformanceSuite => ({
        id: 'perf-suite-1',
        name: 'Perf',
        requests,
        iterations: 1,
        delayBetweenRequests: 0,
        warmupRuns: 0,
        concurrency: 1,
        createdAt: 0,
        modifiedAt: 0,
    });
    const perfRequestStep = (id: string) => ({
        id,
        name: id,
        type: 'request' as const,
        endpoint: 'http://x',
        requestBody: '<X/>',
        extractors: [],
        order: 0,
    });
    const perfCaseStep = (id: string, testCaseId: string) => ({
        id,
        name: id,
        type: 'testCase' as const,
        testCaseId,
        endpoint: '',
        requestBody: '',
        extractors: [],
        order: 1,
    });

    it('embeds the referenced case into a testCase perf step', () => {
        const target = tc('c2', [req('r1')]);
        const out = embedPerfRun(perfSuite([perfCaseStep('p1', 'c2')]), [target]);
        expect(out.requests[0].testCaseSteps).toHaveLength(1);
        expect(out.requests[0].testCaseSteps![0].id).toBe('r1');
    });

    it('leaves plain request steps untouched', () => {
        const out = embedPerfRun(perfSuite([perfRequestStep('p1')]), [tc('c2', [req('r1')])]);
        expect(out.requests[0].testCaseSteps).toBeUndefined();
        expect(out.requests[0].endpoint).toBe('http://x');
    });

    it('folds the case variables under the step overrides', () => {
        const target: TestCase = { ...tc('c2', [req('r1')]), variables: { a: 'case' } };
        const out = embedPerfRun(
            perfSuite([{ ...perfCaseStep('p1', 'c2'), testCaseVariables: { b: 'step' } }]),
            [target]
        );
        expect(out.requests[0].testCaseVariables).toEqual({ a: 'case', b: 'step' });
    });

    it('cuts a cycle back to the referenced case', () => {
        const c = tc('c1', [{ id: 's1', name: 's1', type: 'testCase', config: { testCaseId: 'c1' } }] as TestStep[]);
        const out = embedPerfRun(perfSuite([perfCaseStep('p1', 'c1')]), [c]);
        // The perf step embeds the case once; the back-reference inside it is
        // cut (the root case is seeded on the path), so expansion terminates.
        const nested = out.requests[0].testCaseSteps!;
        expect(nested).toHaveLength(1);
        expect(nested[0].config.testCaseSteps).toBeUndefined();
    });
});
