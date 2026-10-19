import { PerformanceSuite, TestCase, TestStep } from '@shared/models';

/** Hard cap on how deep testCase references are expanded.
 * Beyond this (or on a visited-set hit) the reference is left unembedded and
 * the Rust runner fails that step with a clear message instead of looping. */
export const MAX_EMBED_DEPTH = 10;

interface EmbedCtx {
    cases: Map<string, TestCase>;
    depth: number;
    /** Ids on the current expansion path — a second visit means a cycle. */
    path: Set<string>;
}

/** Expand `testCase` references in a TestStep array (in place on a cloned
 * array). Pure: inputs are never mutated. */
function embedSteps(steps: TestStep[], ctx: EmbedCtx): TestStep[] {
    return steps.map(step => {
        if (ctx.depth >= MAX_EMBED_DEPTH) return step;

        if (step.type === 'testCase' && step.config?.testCaseId) {
            const tc = ctx.cases.get(step.config.testCaseId);
            if (!tc) return step;
            if (ctx.path.has(tc.id)) return step; // cycle — leave unembedded
            const child: EmbedCtx = { ...ctx, depth: ctx.depth + 1, path: new Set([...ctx.path, tc.id]) };
            return {
                ...step,
                config: {
                    ...step.config,
                    testCaseSteps: embedSteps(tc.steps, child),
                    // Hand Rust ONE already-ordered variable map: the
                    // referenced case's own variables, overridden by this
                    // step's overrides. Rust seeds this into the referenced
                    // case's sub-context (after snapshotting the pre-run key
                    // set), so nothing leaks back out.
                    testCaseVariables: { ...(tc.variables || {}), ...(step.config.testCaseVariables || {}) },
                },
            };
        }

        return step;
    });
}

/** Build the self-contained payload for running `testCases` (single case or
 * whole suite): every `testCase` reference is expanded into its target's
 * steps so the backend executes a self-contained copy. */
export function embedTestRun(
    testCases: TestCase[],
    allCases: TestCase[],
): TestCase[] {
    const casesById = new Map(allCases.map(c => [c.id, c]));
    return testCases.map(tc => {
        // Seed the path with the root case: a reference chain that leads back
        // to it is a cycle and must be cut, not expanded once more.
        const ctx: EmbedCtx = {
            cases: casesById,
            depth: 0,
            path: new Set([tc.id]),
        };
        return { ...tc, steps: embedSteps(tc.steps, ctx) };
    });
}

/** Build the run payload for a performance suite: every `testCase` step is
 * expanded into its referenced case's steps exactly like a test run, so the
 * backend executes a self-contained copy. Plain request steps pass through
 * untouched, and the same depth cap / cycle cut applies. */
export function embedPerfRun(
    suite: PerformanceSuite,
    allCases: TestCase[],
): PerformanceSuite {
    const casesById = new Map(allCases.map(c => [c.id, c]));
    return {
        ...suite,
        requests: (suite.requests || []).map(step => {
            if (step.type !== 'testCase' || !step.testCaseId) return step;
            const tc = casesById.get(step.testCaseId);
            if (!tc) return step;
            const ctx: EmbedCtx = {
                cases: casesById,
                depth: 0,
                path: new Set([tc.id]),
            };
            return {
                ...step,
                testCaseSteps: embedSteps(tc.steps, ctx),
                // One already-ordered map: the case's variables under the
                // step's overrides — the same contract the test runner uses.
                testCaseVariables: { ...(tc.variables || {}), ...(step.testCaseVariables || {}) },
            };
        }),
    };
}
