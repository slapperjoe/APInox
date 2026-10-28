/**
 * Help coverage for the raw JSON editor on a test case.
 *
 * Same shape as `helpContentNotes.test.ts`: the help must state what the feature is FOR
 * (renaming a variable across step bodies, which the variables panel cannot do) and must
 * not describe the retired per-project layout as current.
 */
import { describe, it, expect } from 'vitest';
import { HELP_SECTIONS } from '../helpContent';

function findPage(id: string) {
    for (const section of HELP_SECTIONS as any[]) {
        if (section.id === id) return section;
        const child = (section.children || []).find((c: any) => c.id === id);
        if (child) return child;
    }
    return undefined;
}

describe('the Test Suites help page', () => {
    const page = findPage('test-suite');
    // Read lazily: resolving `page.content` in the describe body throws during collection
    // when the page is missing, which reports as a broken file rather than a failed
    // assertion.
    const content = () => (page as any).content as string;

    it('exists', () => {
        expect(page).toBeDefined();
    });

    it('documents Edit as JSON as the way to rename a variable across steps', () => {
        expect(content()).toContain('Edit as JSON');
        // The reason the feature exists: the variables panel edits values but cannot
        // rename a name.
        expect(content()).toMatch(/cannot rename a name/);
        expect(content()).toMatch(/Ctrl\+F|Ctrl\+H/);
        // It covers both entities, not just cases — the suite menu offers it too.
        expect(content()).toMatch(/Right-click a case or a suite/);
    });

    it('documents that renaming a variable in the panel now updates its references', () => {
        // The footgun this fixes: the panel used to change only the definition, leaving
        // every `{{oldName}}` dangling silently.
        expect(content()).toMatch(/updates the references to it as well/);
        // Both syntaxes `utils/template.rs` substitutes.
        expect(content()).toContain('{{name}}');
        expect(content()).toContain('${name}');
        expect(content()).toMatch(/when the name field loses focus/);
    });

    it('states the global store is the source of truth, not the retired per-project layout', () => {
        expect(content()).toMatch(/global store/);
        expect(content()).toMatch(/retired/);
    });

    it('states what saving validates', () => {
        expect(content()).toMatch(/must parse/);
        expect(content()).toMatch(/warned about/);
        // The entity id is the store key, so the editor blocks changing it — for cases and
        // suites alike.
        expect(content()).toMatch(/entity `id` itself cannot\s+change/);
    });
});
