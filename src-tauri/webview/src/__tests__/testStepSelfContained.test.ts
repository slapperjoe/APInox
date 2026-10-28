/**
 * A test step's request is a copy, not a link.
 *
 * The retired per-project layout stored `config.requestId` pointing at a project request, so
 * a step could change when the project changed. The global suite store is only safe because
 * that is no longer true: every step embeds a full `ApiRequest`, and the runner reads
 * `config.request` directly with no lookup to fall back to.
 *
 * The two halves have to agree, so both are guarded. If the link came back on one side only,
 * the UI would write it while the runner silently ignored it — a field that looks like a link
 * and does nothing is worse than no field at all.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const WEBVIEW = resolve(__dirname, '..', '..');
const ROOT = resolve(WEBVIEW, '..', '..');
const MODELS = resolve(ROOT, 'shared/src/models.ts');
const RUST_CONFIG = resolve(ROOT, 'src-tauri/src/testing/frontend_types.rs');

/** A struct/interface body, sliced from its declaration to its closing brace at column 0. */
function bodyOf(source: string, declaration: string): string {
    const start = source.indexOf(declaration);
    expect(start, `${declaration} not found`).toBeGreaterThan(-1);
    const end = source.indexOf('\n}', start);
    expect(end, `${declaration} has no closing brace`).toBeGreaterThan(start);
    return source.slice(start, end);
}

describe('a test step is self-contained', () => {
    it('the TypeScript model carries the request copy, not a project link', () => {
        const block = bodyOf(readFileSync(MODELS, 'utf8'), 'export interface TestStep {');
        expect(block).toMatch(/request\?: ApiRequest/);
        // A field declaration, not the word — the comment above explains why the link is gone.
        expect(block).not.toMatch(/^\s*requestId\??:/m);
    });

    it('the Rust wire shape does not carry the link either', () => {
        const block = bodyOf(readFileSync(RUST_CONFIG, 'utf8'), 'pub struct FrontendStepConfig {');
        expect(block).toMatch(/pub request: Option<FrontendRequest>/);
        expect(block).not.toMatch(/^\s*pub request_id:/m);
    });
});
