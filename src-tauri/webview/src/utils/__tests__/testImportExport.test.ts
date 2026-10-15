/**
 * testImportExport — pure id-rekeying / file-name helpers behind the TESTS
 * rail's right-click import/export menu.
 *
 * Root vitest (node env) — no jsdom APIs used, so this file must stay
 * side-effect-free (it also runs under the webview jsdom config).
 */
import { describe, it, expect } from 'vitest';
import { sanitizeFileName, rekeyTestSuite, rekeyTestCase } from '../testImportExport';

describe('sanitizeFileName', () => {
    it('strips illegal characters and collapses whitespace', () => {
        expect(sanitizeFileName('My Suite: v2?', 'fallback')).toBe('My-Suite-v2');
    });

    it('keeps hyphens and underscores', () => {
        expect(sanitizeFileName('a-b_c', 'x')).toBe('a-b_c');
    });

    it('falls back when the name sanitizes to empty', () => {
        expect(sanitizeFileName('???', 'fallback')).toBe('fallback');
        expect(sanitizeFileName('', 'fallback')).toBe('fallback');
    });
});

describe('rekeyTestCase', () => {
    it('reassigns the case id and every step id', () => {
        const raw = {
            id: 'tc-orig',
            name: 'Case 1',
            steps: [
                { id: 'step-1', name: 'A', type: 'request', config: { request: { endpoint: 'http://x' } } },
                { id: 'step-2', name: 'B', type: 'delay', config: { durationMs: 500 } },
            ],
        };
        const rekeyed = rekeyTestCase(raw);

        expect(rekeyed.id).not.toBe('tc-orig');
        expect(rekeyed.id).toMatch(/^tc-/);
        expect(rekeyed.steps.map(s => s.id)).not.toEqual(['step-1', 'step-2']);
        expect(new Set(rekeyed.steps.map(s => s.id)).size).toBe(2, 'step ids must be unique');
        // Step ids must not collide with the case id.
        expect(rekeyed.steps.map(s => s.id)).not.toContain(rekeyed.id);
    });

    it('preserves step content, order and optional fields', () => {
        const raw = {
            id: 'tc-orig',
            name: 'Case 1',
            steps: [{ id: 'step-1', name: 'A', type: 'workflow', config: { workflowId: 'wf-123' } }],
            variables: { token: 'abc' },
            expanded: false,
        };
        const rekeyed = rekeyTestCase(raw);

        expect(rekeyed.name).toBe('Case 1');
        expect(rekeyed.steps[0].name).toBe('A');
        expect(rekeyed.steps[0].type).toBe('workflow');
        // The workflow reference survives re-keying (only step/case ids change).
        expect(rekeyed.steps[0].config.workflowId).toBe('wf-123');
        expect(rekeyed.variables).toEqual({ token: 'abc' });
        expect(rekeyed.expanded).toBe(false);
    });

    it('tolerates a minimal hand-edited file (no steps / name default)', () => {
        const rekeyed = rekeyTestCase({ id: 'c', name: 'Hand' });
        expect(rekeyed.steps).toEqual([]);
        expect(rekeyed.name).toBe('Hand');
    });

    it('two rekey passes never share ids (same-millisecond imports)', () => {
        const raw = { id: 'tc-orig', name: 'Case', steps: [{ id: 's-1', name: 'x' }] };
        const a = rekeyTestCase(raw);
        const b = rekeyTestCase(raw);
        const ids = [a.id, ...a.steps.map(s => s.id), b.id, ...b.steps.map(s => s.id)];
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('rekeyTestSuite', () => {
    it('reassigns the suite id, all case ids and all step ids — all unique', () => {
        const raw = {
            id: 'suite-orig',
            name: 'Suite 1',
            testCases: [
                { id: 'tc-1', name: 'Case 1', steps: [{ id: 's-1', name: 'A' }] },
                { id: 'tc-2', name: 'Case 2', steps: [{ id: 's-2', name: 'B' }, { id: 's-3', name: 'C' }] },
            ],
        };
        const rekeyed = rekeyTestSuite(raw);

        expect(rekeyed.id).not.toBe('suite-orig');
        expect(rekeyed.id).toMatch(/^suite-/);
        const caseIds = rekeyed.testCases.map(c => c.id);
        expect(caseIds).not.toEqual(['tc-1', 'tc-2']);
        const stepIds = rekeyed.testCases.flatMap(c => c.steps.map(s => s.id));
        expect(stepIds).not.toEqual(['s-1', 's-2', 's-3']);

        const all = [rekeyed.id, ...caseIds, ...stepIds];
        expect(new Set(all).size).toBe(all.length, 'every id must be unique within the suite');
    });

    it('preserves names, case order, variables and step configs', () => {
        const raw = {
            id: 'suite-orig',
            name: 'Suite 1',
            variables: { base: 'http://env' },
            testCases: [
                { id: 'tc-1', name: 'Case 1', variables: { override: '1' }, steps: [{ id: 's-1', name: 'A', type: 'request', config: { request: { endpoint: 'http://x' } } }] },
                { id: 'tc-2', name: 'Case 2', steps: [] },
            ],
        };
        const rekeyed = rekeyTestSuite(raw);

        expect(rekeyed.name).toBe('Suite 1');
        expect(rekeyed.variables).toEqual({ base: 'http://env' });
        expect(rekeyed.testCases.map(c => c.name)).toEqual(['Case 1', 'Case 2']);
        expect(rekeyed.testCases[0].variables).toEqual({ override: '1' });
        expect(rekeyed.testCases[0].steps[0].config.request.endpoint).toBe('http://x');
        expect(rekeyed.testCases[1].steps).toEqual([]);
    });

    it('normalizes a minimal file (no testCases) and does not mutate the input', () => {
        const raw: Record<string, unknown> = { id: 's', name: 'Hand' };
        const snapshot = JSON.stringify(raw);
        const rekeyed = rekeyTestSuite(raw);

        expect(rekeyed.testCases).toEqual([]);
        expect(JSON.stringify(raw)).toBe(snapshot, 'the imported value must stay untouched');
        // A second import of the same value gets a fresh set of ids.
        const again = rekeyTestSuite(raw);
        expect(again.id).not.toBe(rekeyed.id);
    });
});
