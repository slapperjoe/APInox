import { describe, it, expect, vi } from 'vitest';
import {
    ensureVariableCompletionProviders,
    editorEnvVariablesByModel,
} from '../components/MonacoRequestEditor';

// The component module re-exports from '../monaco' (the real monaco-editor);
// the provider test only needs the module to load, not a live editor.
vi.mock('../monaco', () => ({ MonacoEditorWrapper: () => null }));

function fakeMonaco(captured: Record<string, any>) {
    return {
        languages: {
            registerCompletionItemProvider: (lang: string, provider: any) => {
                captured[lang] = provider;
                return { dispose: () => {} };
            },
            CompletionItemKind: { Variable: 'variable', Function: 'function' },
        },
    };
}

// Fake model: `line` is the full line text, caret at `caretColumn` (1-based).
// getValueInRange slices [startColumn-1 .. endColumn-1], which covers both the
// provider's prefix query and completionRangeAndText's after-caret query.
function fakeModel(line: string, caretColumn: number, uri: string) {
    return {
        uri: { toString: () => uri },
        getValueInRange: (r: any) => line.slice(r.startColumn - 1, r.endColumn - 1),
    };
}

describe('monaco {{ provider env variables', () => {
    it('lists env variables before functions and closes the template', () => {
        const captured: Record<string, any> = {};
        ensureVariableCompletionProviders(fakeMonaco(captured) as any, 'test-env-lang-1');
        editorEnvVariablesByModel.set('test://env-model', () => [
            { name: 'apiKey', value: 'k1', source: 'environment' },
        ]);
        // Caret at column 6 (1-based): typed `{{api` (prefix), nothing after.
        const result = captured['test-env-lang-1'].provideCompletionItems(
            fakeModel('{{api', 6, 'test://env-model'),
            { lineNumber: 1, column: 6 },
        );
        const labels = result.suggestions.map((s: any) => s.label);
        expect(labels[0]).toBe('apiKey'); // env vars first, parity with the single-line popup
        expect(labels).toContain('uuid'); // functions still listed
        const env = result.suggestions.find((s: any) => s.label === 'apiKey');
        expect(env.kind).toBe('variable');
        expect(env.detail).toBe('= k1');
        expect(env.insertText).toBe('apiKey}}');
    });

    it('falls back to functions only when the editor has no env variables', () => {
        const captured: Record<string, any> = {};
        ensureVariableCompletionProviders(fakeMonaco(captured) as any, 'test-env-lang-2');
        const result = captured['test-env-lang-2'].provideCompletionItems(
            fakeModel('{{', 3, 'test://no-env-model'),
            { lineNumber: 1, column: 3 },
        );
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.suggestions.every((s: any) => s.kind === 'function')).toBe(true);
    });

    it('does not double-close an already-closed template', () => {
        const captured: Record<string, any> = {};
        ensureVariableCompletionProviders(fakeMonaco(captured) as any, 'test-env-lang-3');
        editorEnvVariablesByModel.set('test://env-model-3', () => [
            { name: 'apiKey', value: null, source: 'environment' },
        ]);
        // Caret between `api` and the existing `}}`: prefix `{{api`, after `}}`.
        const result = captured['test-env-lang-3'].provideCompletionItems(
            fakeModel('{{api}}', 6, 'test://env-model-3'),
            { lineNumber: 1, column: 6 },
        );
        const env = result.suggestions.find((s: any) => s.label === 'apiKey');
        expect(env.insertText).toBe('apiKey');
        expect(env.detail).toBe('(not set)');
    });
});
