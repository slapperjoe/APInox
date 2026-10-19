import { describe, it, expect } from 'vitest';
import { commandErrorText, commandErrorKind } from '../bridge';

/**
 * Tauri commands that return `Result<T, String>` reject with a plain string, so
 * `error.message` is undefined. These are the two shapes the helpers must handle:
 * the string form (still produced by unmigrated modules) and the `{ kind,
 * message }` form produced by `CommandError`.
 */
describe('commandErrorText', () => {
    it('returns a plain string rejection as-is', () => {
        // This is what an unmigrated `Result<_, String>` command rejects with.
        // Before the helper, callers reading `error.message` got undefined and
        // showed a generic fallback instead of the actual cause.
        expect(commandErrorText('Failed to write /x: permission denied')).toBe(
            'Failed to write /x: permission denied'
        );
    });

    it('reads the message from a CommandError-shaped rejection', () => {
        expect(
            commandErrorText({ kind: 'not-found', message: 'Project directory does not exist: x' })
        ).toBe('Project directory does not exist: x');
    });

    it('still handles a real Error', () => {
        expect(commandErrorText(new Error('boom'))).toBe('boom');
    });

    it('falls back to String() for anything else', () => {
        expect(commandErrorText(42)).toBe('42');
        expect(commandErrorText(null)).toBe('null');
    });

    it('does not return an empty string for an object with no message', () => {
        expect(commandErrorText({ kind: 'io' })).toBe('[object Object]');
    });
});

describe('commandErrorKind', () => {
    it('returns null for a string rejection — there is no kind to read', () => {
        expect(commandErrorKind('Failed to write /x')).toBeNull();
    });

    it('returns the wire name for a CommandError', () => {
        expect(commandErrorKind({ kind: 'not-found', message: 'gone' })).toBe('not-found');
    });

    it('returns null for a plain Error', () => {
        expect(commandErrorKind(new Error('boom'))).toBeNull();
    });
});
