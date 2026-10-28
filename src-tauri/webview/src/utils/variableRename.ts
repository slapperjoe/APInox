/**
 * Renaming a variable means two things: the definition (the name→value map) and the
 * references to it. `VariablesEditor` only ever changed the definition, so renaming a name
 * there left every `{{oldName}}` in the step bodies pointing at a variable that no longer
 * exists — silently, because nothing warned.
 *
 * This walks the definitions and the references together. Both syntaxes the backend
 * substitutes are handled: `utils/template.rs` replaces `{{name}}` and `${name}`.
 *
 * The scope is one case (or one suite's cases). A reference in a request that lives outside
 * the case is not reachable from here, which is why the editor reports how many references
 * it updated rather than claiming the rename is complete app-wide.
 */
import { TestCase, TestStep, TestSuite } from '@shared/models';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replace both token syntaxes for one variable name. */
export function replaceToken(text: string, from: string, to: string): string {
    if (!text) return text;
    const escaped = escapeRegExp(from);
    return text
        .replace(new RegExp(`\\{\\{${escaped}\\}\\}`, 'g'), `{{${to}}}`)
        .replace(new RegExp(`\\$\\{${escaped}\\}`, 'g'), `\${${to}}`);
}

/**
 * Rename one variable's references inside a case. Returns the case and the number of
 * references rewritten, so the caller can say what it actually did.
 *
 * The definition itself is not touched here — `VariablesEditor` commits the renamed map,
 * and this rewrites what points at it.
 */
export function renameVariableReferences(
    testCase: TestCase,
    from: string,
    to: string
): { testCase: TestCase; updated: number } {
    if (!from || !to || from === to) return { testCase, updated: 0 };

    let updated = 0;

    const steps: TestStep[] = testCase.steps.map((step) => {
        const request = step.config?.request;
        if (!request) return step;

        const body = request.request;
        const nextBody = replaceToken(body, from, to);
        if (nextBody !== body) updated += countOccurrences(body, from);

        const assertions = request.assertions?.map((assertion) => {
            const token = assertion.configuration?.token;
            if (!token) return assertion;
            const nextToken = replaceToken(token, from, to);
            if (nextToken !== token) updated += countOccurrences(token, from);
            return { ...assertion, configuration: { ...assertion.configuration, token: nextToken } };
        });

        // The extractor is the definition of the value; renaming the variable means
        // renaming what it writes to, otherwise the extracted value lands under the old
        // name while the references look for the new one.
        const extractors = request.extractors?.map((extractor) => {
            if (extractor.variable !== from) return extractor;
            updated += 1;
            return { ...extractor, variable: to };
        });

        if (nextBody === body && !assertions && !extractors) return step;

        return {
            ...step,
            config: {
                ...step.config,
                request: { ...request, request: nextBody, assertions, extractors },
            },
        };
    });

    return { testCase: { ...testCase, steps }, updated };
}

/** Rename a suite variable across every case in the suite. Returns the suite and the
 *  number of references rewritten. */
export function renameVariableInSuite(
    suite: TestSuite,
    from: string,
    to: string
): { suite: TestSuite; updated: number } {
    if (!from || !to || from === to) return { suite, updated: 0 };

    let updated = 0;
    const testCases = suite.testCases.map((testCase) => {
        const result = renameVariableReferences(testCase, from, to);
        updated += result.updated;
        return result.testCase;
    });

    return { suite: { ...suite, testCases }, updated };
}

function countOccurrences(text: string, name: string): number {
    const escaped = escapeRegExp(name);
    const braces = (text.match(new RegExp(`\\{\\{${escaped}\\}\\}`, 'g')) ?? []).length;
    const dollar = (text.match(new RegExp(`\\$\\{${escaped}\\}`, 'g')) ?? []).length;
    return braces + dollar;
}
