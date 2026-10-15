import { describe, expect, it } from 'vitest';
import { findReferenceCycle, type ReferenceGraph } from '../referenceCycle';
import { TestCase, Workflow } from '@shared/models';

const wf = (id: string, steps: any[]): Workflow =>
    ({ id, name: `wf ${id}`, steps, createdAt: 0, modifiedAt: 0 } as unknown as Workflow);
const tc = (id: string, steps: any[]): TestCase =>
    ({ id, name: `tc ${id}`, steps } as unknown as TestCase);

const graph = (workflows: Workflow[], cases: TestCase[]): ReferenceGraph => ({ workflows, cases });

describe('findReferenceCycle', () => {
    it('returns null for a DAG (case -> workflow -> other case)', () => {
        const g = graph(
            [wf('w1', [{ id: 's1', type: 'testCase', testCaseId: 'c2' }])],
            [tc('c1', [{ id: 's1', type: 'workflow', config: { workflowId: 'w1' } }]),
             tc('c2', [])]
        );
        expect(findReferenceCycle('c1', g)).toBeNull();
    });

    it('detects workflow -> testCase -> workflow cycle', () => {
        const g = graph(
            [wf('w1', [{ id: 's1', type: 'testCase', testCaseId: 'c1' }])],
            [tc('c1', [{ id: 's1', type: 'workflow', config: { workflowId: 'w1' } }])]
        );
        const cycle = findReferenceCycle('w1', g);
        expect(cycle).not.toBeNull();
        expect(cycle![0]).toBe('w1');
        expect(cycle!.at(-1)).toBe('w1');
        expect(cycle!).toContain('c1');
    });

    it('detects a case referencing itself through a workflow', () => {
        const g = graph(
            [wf('w1', [{ id: 's1', type: 'testCase', testCaseId: 'c1' }])],
            [tc('c1', [{ id: 's1', type: 'workflow', config: { workflowId: 'w1' } }])]
        );
        expect(findReferenceCycle('c1', g)?.[0]).toBe('c1');
    });

    it('detects direct case -> case cycles', () => {
        const g = graph([], [
            tc('c1', [{ id: 's1', type: 'testCase', config: { testCaseId: 'c2' } }]),
            tc('c2', [{ id: 's1', type: 'testCase', config: { testCaseId: 'c1' } }]),
        ]);
        expect(findReferenceCycle('c1', g)).not.toBeNull();
    });

    it('follows references nested in loopSteps', () => {
        const g = graph(
            [wf('w1', [{ id: 's1', type: 'loop', loopSteps: [{ id: 'n1', type: 'testCase', testCaseId: 'c1' }] }])],
            [tc('c1', [{ id: 's1', type: 'workflow', config: { workflowId: 'w1' } }])]
        );
        expect(findReferenceCycle('w1', g)).not.toBeNull();
    });

    it('ignores missing/empty reference ids without crashing', () => {
        const g = graph(
            [wf('w1', [{ id: 's1', type: 'testCase', testCaseId: '' }, { id: 's2', type: 'request' }])],
            [tc('c1', [{ id: 's1', type: 'workflow', config: {} }])]
        );
        expect(findReferenceCycle('w1', g)).toBeNull();
    });
});
