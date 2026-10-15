import { TestCase, Workflow } from '@shared/models';

/** All reference targets the cycle walker can reach. */
export interface ReferenceGraph {
    workflows: Workflow[];
    cases: TestCase[];
}

/**
 * Depth-first search over the workflow <-> test-case reference graph.
 *
 * Edges:
 *   workflow W  --step.type==='testCase' (incl. inside loopSteps)--> case id
 *   case C      --step.type==='workflow' (config.workflowId)-------> workflow id
 *   case C      --step.type==='testCase'  (config.testCaseId)-----> case id
 *
 * Returns the cycle as an id path starting AND ending at `startId`
 * (e.g. ['w1','c1','w1']), or null when no cycle is reachable from `startId`.
 * Missing/empty reference ids are ignored. Pure and synchronous — safe to
 * call on every save.
 */
export function findReferenceCycle(startId: string, graph: ReferenceGraph): string[] | null {
    const wfById = new Map(graph.workflows.map(w => [w.id, w]));
    const caseById = new Map(graph.cases.map(c => [c.id, c]));

    const edgesFrom = (id: string): string[] => {
        const out: string[] = [];
        const wf = wfById.get(id);
        if (wf) {
            for (const s of wf.steps || []) {
                if (s.type === 'testCase' && s.testCaseId) out.push(s.testCaseId);
                for (const n of s.loopSteps || []) {
                    if (n.type === 'testCase' && n.testCaseId) out.push(n.testCaseId);
                }
            }
            return out;
        }
        const tc = caseById.get(id);
        if (!tc) return out;
        for (const s of tc.steps || []) {
            if (s.type === 'workflow' && s.config?.workflowId) out.push(s.config.workflowId);
            if (s.type === 'testCase' && s.config?.testCaseId) out.push(s.config.testCaseId);
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
