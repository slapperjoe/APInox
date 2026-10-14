import { describe, it, expect } from 'vitest';
import { mergeTestRunVariables } from '../bridge';

describe('mergeTestRunVariables', () => {
    it('returns the environment alone when no scopes are provided', () => {
        expect(mergeTestRunVariables({ a: '1' }, undefined, undefined)).toEqual({ a: '1' });
    });

    it('layers suite variables over the environment', () => {
        const merged = mergeTestRunVariables(
            { host: 'env.example.com', a: 'env' },
            { host: 'suite.example.com' },
            undefined,
        );
        expect(merged).toEqual({ host: 'suite.example.com', a: 'env' });
    });

    it('layers case variables over suite variables (case wins)', () => {
        const merged = mergeTestRunVariables(
            { host: 'env.example.com', token: 'env-token', onlyEnv: 'x' },
            { token: 'suite-token', onlySuite: 'y' },
            { token: 'case-token', onlyCase: 'z' },
        );
        expect(merged).toEqual({
            host: 'env.example.com',
            token: 'case-token',
            onlyEnv: 'x',
            onlySuite: 'y',
            onlyCase: 'z',
        });
    });

    it('ignores null/undefined scope maps', () => {
        expect(mergeTestRunVariables({}, null, undefined)).toEqual({});
        expect(mergeTestRunVariables({ a: '1' }, null, { b: '2' })).toEqual({ a: '1', b: '2' });
    });
});
