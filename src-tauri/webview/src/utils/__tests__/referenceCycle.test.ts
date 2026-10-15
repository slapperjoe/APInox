import { describe, expect, it } from 'vitest';
import { findReferenceCycle, type ReferenceGraph } from '../referenceCycle';
import { TestCase } from '@shared/models';

const tc = (id: string, steps: any[]): TestCase =>
    ({ id, name: `tc ${id}`, steps } as unknown as TestCase);

const graph = (cases: TestCase[]): ReferenceGraph => ({ cases });

describe('findReferenceCycle', () => {
    it('returns null for a DAG (case -> case)', () => {
        const g = graph([
            tc('c1', [{ id: 's1', type: 'testCase', config: { testCaseId: 'c2' } }]),
            tc('c2', []),
        ]);
        expect(findReferenceCycle('c1', g)).toBeNull();
    });

    it('detects direct case -> case cycles', () => {
        const g = graph([
            tc('c1', [{ id: 's1', type: 'testCase', config: { testCaseId: 'c2' } }]),
            tc('c2', [{ id: 's1', type: 'testCase', config: { testCaseId: 'c1' } }]),
        ]);
        expect(findReferenceCycle('c1', g)).not.toBeNull();
    });

    it('detects a case referencing itself', () => {
        const g = graph([
            tc('c1', [{ id: 's1', type: 'testCase', config: { testCaseId: 'c1' } }]),
        ]);
        expect(findReferenceCycle('c1', g)?.[0]).toBe('c1');
    });

    it('follows references nested in loopSteps', () => {
        const g = graph([
            tc('c1', [{ id: 's1', type: 'loop', config: { loopSteps: [{ id: 'n1', type: 'testCase', testCaseId: 'c1' }] } }]),
        ]);
        expect(findReferenceCycle('c1', g)).not.toBeNull();
    });

    it('ignores missing/empty reference ids without crashing', () => {
        const g = graph([
            tc('c1', [{ id: 's1', type: 'testCase', config: { testCaseId: '' } }, { id: 's2', type: 'request' }]),
        ]);
        expect(findReferenceCycle('c1', g)).toBeNull();
    });
});
