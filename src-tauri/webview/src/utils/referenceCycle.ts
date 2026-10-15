import { TestCase } from '@shared/models';

/** All reference targets the cycle walker can reach. */
export interface ReferenceGraph {
    cases: TestCase[];
}

/**
 * Depth-first search over the test-case reference graph.
 *
 * Edges:
 *   case C --step.type==='testCase' (config.testCaseId)-----> case id
 *   case C --step.type==='loop' (config.loopSteps[].testCaseId)--> case id
 *
 * Returns the cycle as an id path starting AND ending at `startId`
 * (e.g. ['c1','c2','c1']), or null when no cycle is reachable from `startId`.
 * Missing/empty reference ids are ignored. Pure and synchronous — safe to
 * call on every save.
 */
export function findReferenceCycle(startId: string, graph: ReferenceGraph): string[] | null {
    const caseById = new Map(graph.cases.map(c => [c.id, c]));

    const edgesFrom = (id: string): string[] => {
        const out: string[] = [];
        const tc = caseById.get(id);
        if (!tc) return out;
        for (const s of tc.steps || []) {
            if (s.type === 'testCase' && s.config?.testCaseId) out.push(s.config.testCaseId);
            for (const n of s.config?.loopSteps || []) {
                if (n.type === 'testCase' && n.testCaseId) out.push(n.testCaseId);
            }
        }
        return out;
    };

    // Iterative DFS with an explicit stack of (id, path-so-far).
    const stack: Array<[string, string[]]> = [[startId, [startId]]];
    while (stack.length > 0) {
        const [id, path] = stack.pop()!;
        for (const next of edgesFrom(id)) {
            if (next === startId) return [...path, next];
            if (path.includes(next)) continue; // already explored on this path
            stack.push([next, [...path, next]]);
        }
    }
    return null;
}
