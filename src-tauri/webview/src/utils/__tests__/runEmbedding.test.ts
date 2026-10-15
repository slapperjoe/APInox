import { describe, expect, it } from 'vitest';
import { embedTestRun, MAX_EMBED_DEPTH } from '../runEmbedding';
import { TestCase, TestStep } from '@shared/models';

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
