/**
 * testImportExport.ts
 *
 * Pure helpers for the TESTS rail's right-click import/export menu
 * (suite: Export Suite / Import Suite / Import Test Case; case: Export
 * Test Case). The native save/open dialogs and the Rust file IO live in
 * useSidebarCallbacks; everything in this module is side-effect-free so it
 * runs under the root (node-env) vitest config too.
 *
 * Why re-key ids on import: the global suite store is keyed by suite id
 * (addSuite upserts by id), and case ids are looked up across ALL suites
 * (updateTestCase / findCaseById search by id only). Importing a file with
 * its original ids would silently REPLACE an existing suite — or, for
 * cross-workspace files, clash with unrelated cases. An import is always an
 * ADD: every suite / case / step id is reassigned, content is untouched.
 */

import { TestSuite, TestCase } from '@shared/models';

/**
 * Make a string safe for use as a default file name (mirrors the "Save to
 * disk" handler: strip non-alphanumerics/hyphens/underscores, collapse
 * whitespace to hyphens, fall back to `fallback` when empty).
 */
export function sanitizeFileName(name: string, fallback: string): string {
    return (
        (name || '')
            .replace(/[^a-zA-Z0-9\-_ ]/g, '')
            .trim()
            .replace(/\s+/g, '-') || fallback
    );
}

/** New id generator: collision-free even for many ids minted in the same ms. */
const nextId = (prefix: string): string => {
    const rand = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    return `${prefix}-${rand}`;
};

/**
 * Deep-copy an imported test case, reassigning the case id and every step id.
 * All other fields (name, steps + configs, variables, expanded) round-trip
 * byte-for-byte — a step's `config.testCaseId` still points at the same
 * referenced case, so 'testCase' steps keep working after import.
 */
export function rekeyTestCase(raw: unknown): TestCase {
    const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
    const steps: TestCase['steps'] = Array.isArray(src.steps)
        ? src.steps.map(step => ({
            ...step,
            id: nextId('step'),
        }))
        : [];
    const caseCopy: TestCase = {
        id: nextId('tc'),
        name: typeof src.name === 'string' ? src.name : 'Imported Test Case',
        steps,
    };
    // Preserve the optional fields verbatim (variables / expanded / anything
    // a future version adds — opaque round-trip, mirroring the global store).
    if (src.variables !== undefined) caseCopy.variables = src.variables;
    if (src.expanded !== undefined) caseCopy.expanded = src.expanded;
    return caseCopy;
}

/**
 * Deep-copy an imported test suite, reassigning the suite id, every case id
 * and every step id (see rekeyTestCase). Returns a fresh object graph — the
 * caller is safe to mutate the result without touching the imported value.
 */
export function rekeyTestSuite(raw: unknown): TestSuite {
    const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
    const cases: TestCase[] = Array.isArray(src.testCases)
        ? src.testCases.map(tc => rekeyTestCase(tc))
        : [];
    const suiteCopy: TestSuite = {
        id: nextId('suite'),
        name: typeof src.name === 'string' ? src.name : 'Imported Test Suite',
        testCases: cases,
    };
    if (src.variables !== undefined) suiteCopy.variables = src.variables;
    if (src.expanded !== undefined) suiteCopy.expanded = src.expanded;
    return suiteCopy;
}
