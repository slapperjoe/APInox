/**
 * Renaming a variable means the definition AND the references.
 *
 * `VariablesEditor` used to change only the definition, so every `{{oldName}}` in the step
 * bodies was left pointing at a variable that no longer exists — silently, because nothing
 * warned. These tests pin that the references are rewritten, in all three places a name can
 * appear: the body, an assertion token, and the extractor that produces the value.
 *
 * Both syntaxes the backend substitutes are covered, because `utils/template.rs` replaces
 * `{{name}}` and `${name}` — a rename that handled only one would leave half the references
 * dangling.
 */
import { describe, it, expect } from 'vitest';
import {
    renameVariableInSuite,
    renameVariableReferences,
    replaceToken,
} from '../variableRename';
import { TestCase, TestSuite } from '@shared/models';

const caseWithRefs: TestCase = {
    id: 'c1',
    name: 'Case',
    steps: [
        {
            id: 's1',
            name: 'First',
            type: 'request',
            config: {
                request: {
                    name: 'R',
                    request: '<Name>{{token}}</Name><Other>${token}</Other>',
                    assertions: [{ type: 'Simple Contains', configuration: { token: '{{token}}' } }],
                    extractors: [
                        { type: 'XPath', source: 'body', path: '/Name', variable: 'token', id: 'e1' },
                        { type: 'Header', source: 'header', path: 'X', variable: 'other', id: 'e2' },
                    ],
                },
            },
        },
        { id: 's2', name: 'Second', type: 'delay', config: { delayMs: 5 } },
    ],
};

describe('replaceToken', () => {
    it('handles both syntaxes the backend substitutes', () => {
        expect(replaceToken('{{token}} and ${token}', 'token', 'tok')).toBe('{{tok}} and ${tok}');
    });

    it('does not match a longer name that merely starts with it', () => {
        // `utils/template.rs` sorts keys by length descending for the same reason: a
        // substring match would rewrite `{{tokenId}}` when renaming `token`.
        expect(replaceToken('{{tokenId}}', 'token', 'tok')).toBe('{{tokenId}}');
    });

    it('escapes regex metacharacters in the name', () => {
        expect(replaceToken('{{a.b}}', 'a.b', 'c')).toBe('{{c}}');
    });
});

describe('renameVariableReferences', () => {
    it('rewrites the body, the assertion token, and the extractor definition', () => {
        const result = renameVariableReferences(caseWithRefs, 'token', 'tok');

        const request = result.testCase.steps[0].config!.request!;
        expect(request.request).toBe('<Name>{{tok}}</Name><Other>${tok}</Other>');
        expect(request.assertions?.[0].configuration?.token).toBe('{{tok}}');
        expect(request.extractors?.[0].variable).toBe('tok');

        // 2 in the body + 1 assertion + 1 extractor definition.
        expect(result.updated).toBe(4);
    });

    it('leaves an unrelated extractor alone', () => {
        const result = renameVariableReferences(caseWithRefs, 'token', 'tok');
        expect(result.testCase.steps[0].config!.request!.extractors?.[1].variable).toBe('other');
    });

    it('is a no-op when the name is unchanged', () => {
        const result = renameVariableReferences(caseWithRefs, 'token', 'token');
        expect(result.updated).toBe(0);
        expect(result.testCase).toBe(caseWithRefs);
    });

    it('leaves steps with no request untouched', () => {
        const result = renameVariableReferences(caseWithRefs, 'token', 'tok');
        expect(result.testCase.steps[1].config).toEqual({ delayMs: 5 });
    });
});

describe('renameVariableInSuite', () => {
    it('rewrites references across every case in the suite', () => {
        const suite: TestSuite = {
            id: 's1',
            name: 'Suite',
            variables: { token: 'v' },
            testCases: [
                {
                    id: 'c1',
                    name: 'Case A',
                    steps: [{ id: 'x1', name: 'S', type: 'request', config: { request: { name: 'R', request: '{{token}}' } } }],
                },
                {
                    id: 'c2',
                    name: 'Case B',
                    steps: [{ id: 'x2', name: 'S', type: 'request', config: { request: { name: 'R', request: '${token}' } } }],
                },
            ],
        };

        const result = renameVariableInSuite(suite, 'token', 'tok');
        expect(result.suite.testCases[0].steps[0].config.request?.request).toBe('{{tok}}');
        expect(result.suite.testCases[1].steps[0].config.request?.request).toBe('${tok}');
        expect(result.updated).toBe(2);
    });
});
