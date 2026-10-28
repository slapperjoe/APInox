/**
 * Validation for the raw JSON editor.
 *
 * Deliberately minimal: a raw editor exists precisely so you can write something the
 * structured UI would not allow, so the common part checks only what the store and the
 * runner depend on — the document is an object, it has an `id` and a `name`, and the `id`
 * still matches the entry being edited.
 *
 * The `id` is blocked because it is the key the store, the runner and the current selection
 * resolve against. Renaming it in the text leaves the UI holding one key while the object
 * carries another, and unlike the fields inside the document there is no way to recover by
 * editing the text back — the entry is already filed under the old key. Step ids stay
 * editable: they are references inside the document, not the document's identity.
 *
 * These live in `utils/` rather than in the modal so the modal can stay lazily loaded.
 */

export type Validation = { error?: string; warnings: string[] };
export type EntityValidator = (parsed: Record<string, unknown>) => Validation;

const STEP_TYPES = ['request', 'delay', 'transfer', 'script', 'condition', 'loop', 'testCase'];

export function validateJsonDocument(
    parsed: unknown,
    expectedId: string,
    entityValidator: EntityValidator
): Validation {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { error: 'The document must be an object.', warnings: [] };
    }

    const entity = parsed as Record<string, unknown>;
    if (typeof entity.id !== 'string' || entity.id.length === 0) {
        return { error: '`id` must be a non-empty string.', warnings: [] };
    }
    if (entity.id !== expectedId) {
        return {
            error: `The \`id\` cannot be changed — it is the key the store and the runner resolve against. Expected "${expectedId}".`,
            warnings: [],
        };
    }
    if (typeof entity.name !== 'string' || entity.name.length === 0) {
        return { error: '`name` must be a non-empty string.', warnings: [] };
    }

    return entityValidator(entity);
}

/** Test case: `steps` must be an array of well-formed steps, and transfers must resolve. */
export const testCaseValidator: EntityValidator = (entity) => {
    if (!Array.isArray(entity.steps)) {
        return { error: '`steps` must be an array.', warnings: [] };
    }

    const steps = entity.steps as Record<string, unknown>[];
    const ids = new Set<string>();

    for (const step of steps) {
        if (typeof step.id !== 'string' || step.id.length === 0) {
            return { error: 'Every step needs a non-empty `id`.', warnings: [] };
        }
        if (typeof step.name !== 'string' || step.name.length === 0) {
            return { error: 'Every step needs a non-empty `name`.', warnings: [] };
        }
        if (typeof step.type !== 'string' || !STEP_TYPES.includes(step.type)) {
            return {
                error: `Step "${step.name}" has an unknown type: ${String(step.type)}.`,
                warnings: [],
            };
        }
        ids.add(step.id);
    }

    // A transfer pointing at a step that is no longer in the case is a warning rather than
    // an error — the document may be mid-restructure — but it silently does nothing at run
    // time, so it is worth saying out loud before saving.
    const warnings: string[] = [];
    for (const step of steps) {
        const config = (step.config ?? {}) as Record<string, unknown>;
        for (const key of ['sourceStepId', 'targetStepId']) {
            const ref = config[key];
            if (typeof ref === 'string' && ref.length > 0 && !ids.has(ref)) {
                warnings.push(
                    `Step "${step.name}" references ${key} "${ref}", which is not in this case — it will do nothing at run time.`
                );
            }
        }
    }

    return { warnings };
};

/** Test suite: `testCases` must be an array of well-formed cases. */
export const testSuiteValidator: EntityValidator = (entity) => {
    if (!Array.isArray(entity.testCases)) {
        return { error: '`testCases` must be an array.', warnings: [] };
    }

    const cases = entity.testCases as Record<string, unknown>[];
    for (const testCase of cases) {
        if (typeof testCase.id !== 'string' || testCase.id.length === 0) {
            return { error: 'Every test case needs a non-empty `id`.', warnings: [] };
        }
        if (typeof testCase.name !== 'string' || testCase.name.length === 0) {
            return { error: 'Every test case needs a non-empty `name`.', warnings: [] };
        }
        if (!Array.isArray(testCase.steps)) {
            return { error: `Test case "${testCase.name}" needs a \`steps\` array.`, warnings: [] };
        }
    }

    return { warnings: [] };
};
