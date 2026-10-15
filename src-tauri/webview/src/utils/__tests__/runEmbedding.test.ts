import { describe, expect, it } from 'vitest';
import { embedTestRun, embedWorkflowRun, MAX_EMBED_DEPTH } from '../runEmbedding';
import { TestCase, TestStep, Workflow } from '@shared/models';

const wf = (id: string, steps: any[]): Workflow =>
    ({ id, name: id, steps, createdAt: 0, modifiedAt: 0 } as unknown as Workflow);
const tc = (id: string, steps: TestStep[]): TestCase => ({ id, name: id, steps });
const req = (id: string): TestStep =>
    ({ id, name: id, type: 'request', config: { request: { id, name: id, endpoint: 'http://x', request: '<X/>' } } }) as TestStep;

describe('embedTestRun', () => {
    it('embeds a referenced workflow\'s steps (existing behavior preserved)', () => {
        const w = wf('w1', [{ id: 'ws1', name: 'A', type: 'request', endpoint: 'http://a' }]);
        const c = tc('c1', [{ id: 's1', name: 'W', type: 'workflow', config: { workflowId: 'w1' } }] as TestStep[]);
        const out = embedTestRun([c], [w], [c]);
        expect(out[0].steps[0].config.workflowSteps).toHaveLength(1);
        expect(out[0].steps[0].config.workflowSteps![0].id).toBe('ws1');
    });

    it('embeds a referenced test case\'s steps', () => {
        const target = tc('c2', [req('r1')]);
        const source = tc('c1', [{ id: 's1', name: 'T', type: 'testCase', config: { testCaseId: 'c2' } }] as TestStep[]);
        const out = embedTestRun([source], [], [source, target]);
        expect(out[0].steps[0].config.testCaseSteps).toHaveLength(1);
        expect(out[0].steps[0].config.testCaseSteps![0].id).toBe('r1');
    });

    it('folds the referenced case\'s variables under the step overrides', () => {
        const target: TestCase = { ...tc('c2', [req('r1')]), variables: { a: 'case', b: 'case' } };
        const source = tc('c1', [{ id: 's1', name: 'T', type: 'testCase', config: { testCaseId: 'c2', testCaseVariables: { b: 'step', c: 'step' } } }] as TestStep[]);
        const out = embedTestRun([source], [], [source, target]);
        expect(out[0].steps[0].config.testCaseVariables).toEqual({ a: 'case', b: 'step', c: 'step' });
    });

    it('expands nesting: case -> workflow -> case', () => {
        const inner = tc('c3', [req('r1')]);
        const w = wf('w1', [{ id: 'ws1', type: 'testCase', testCaseId: 'c3' }]);
        const outer = tc('c1', [{ id: 's1', type: 'workflow', config: { workflowId: 'w1' } }] as TestStep[]);
        const out = embedTestRun([outer], [w], [outer, inner]);
        const wfSteps = out[0].steps[0].config.workflowSteps!;
        expect(wfSteps[0].testCase?.steps).toHaveLength(1);
        expect(wfSteps[0].testCase?.steps[0].id).toBe('r1');
    });

    it('stops at a cycle: both directions stay unembedded, no hang', () => {
        const w = wf('w1', [{ id: 'ws1', type: 'testCase', testCaseId: 'c1' }]);
        const c = tc('c1', [{ id: 's1', type: 'workflow', config: { workflowId: 'w1' } }] as TestStep[]);
        const out = embedTestRun([c], [w], [c]);
        // The case's workflow step embeds the workflow's steps...
        expect(out[0].steps[0].config.workflowSteps).toHaveLength(1);
        // ...but the back-reference to the case is NOT embedded (cycle cut).
        expect(out[0].steps[0].config.workflowSteps![0].testCase).toBeUndefined();
    });

    it('caps recursion depth at MAX_EMBED_DEPTH', () => {
        // Chain c1 -> c2 -> ... -> c12 (each a testCase step to the next).
        const cases: TestCase[] = [];
        for (let i = 1; i <= 12; i++) {
            cases.push(tc(`c${i}`, [{ id: `s${i}`, type: 'testCase', config: { testCaseId: `c${i + 1}` } }] as TestStep[]));
        }
        const out = embedTestRun([cases[0]], [], cases);
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
        const out = embedTestRun([c], [], [c]);
        expect(out[0].steps[0].config.testCaseSteps).toBeUndefined();
    });
});

describe('embedWorkflowRun', () => {
    it('embeds testCase steps and their nested workflow references', () => {
        const wInner = wf('w2', [{ id: 'ws2', type: 'request', endpoint: 'http://b' }]);
        const c = tc('c1', [{ id: 's1', type: 'workflow', config: { workflowId: 'w2' } }] as TestStep[]);
        const wOuter = wf('w1', [{ id: 'ws1', type: 'testCase', testCaseId: 'c1' }]);
        const out = embedWorkflowRun(wOuter, [wOuter, wInner], [c]);
        expect(out.steps[0].testCase?.id).toBe('c1');
        expect(out.steps[0].testCase?.steps[0].config.workflowSteps).toHaveLength(1);
    });
});
