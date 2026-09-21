import { describe, it, expect } from 'vitest';
import { buildExecuteOperation, ExecuteOperation } from '../executeOperation';
import { ApiRequest, ApiOperation } from '@shared/models';

/**
 * buildExecuteOperation — the `operation` payload sent to the Rust
 * `execute_soap_request` command. `ServiceOperation.name` is a REQUIRED
 * String in Rust (packages/wsdl-parser/src/types.rs:33), so the payload MUST
 * always carry a non-empty `name` or the command fails at deserialization
 * with `invalid args request ... missing field name`.
 *
 * Regression: a remote-imported project with an operation whose `name` is
 * empty/undefined AND a request whose `name` is empty/undefined produced
 * `name: undefined`, which JSON strips → the reported crash.
 */

function makeRequest(partial: Partial<ApiRequest> = {}): ApiRequest {
    return {
        name: 'Request1.xml',
        request: '',
        ...partial,
    } as ApiRequest;
}

function makeOperation(partial: Partial<ApiOperation> = {}): ApiOperation {
    return {
        name: 'GetUserInfo',
        action: '',
        requests: [],
        ...partial,
    } as ApiOperation;
}

function serializedName(op: ExecuteOperation): string | undefined {
    // JSON.stringify drops undefined fields — exactly what Tauri's IPC layer
    // does before the payload reaches Rust.
    return (JSON.parse(JSON.stringify(op)) as { name?: string }).name;
}

describe('buildExecuteOperation.name is never empty (Rust requires it)', () => {
    it('uses ownerOperation.name when present', () => {
        const op = buildExecuteOperation(makeOperation({ name: 'GetUserInfo' }), makeRequest({ name: 'Req.xml' }));
        expect(serializedName(op)).toBe('GetUserInfo');
    });

    it('falls back to the request name when the operation name is empty', () => {
        const op = buildExecuteOperation(makeOperation({ name: '' }), makeRequest({ name: 'Request1.xml' }));
        expect(serializedName(op)).toBe('Request1.xml');
    });

    it('falls back to a label when BOTH operation and request names are empty', () => {
        const op = buildExecuteOperation(
            makeOperation({ name: '' }),
            makeRequest({ name: '' }),
        );
        const n = serializedName(op);
        expect(n).toBeTruthy();
        expect(typeof n).toBe('string');
        expect(n!.length).toBeGreaterThan(0);
    });

    it('does not produce an undefined/missing name when both are undefined', () => {
        const op = buildExecuteOperation(
            { ...makeOperation(), name: undefined } as unknown as ApiOperation,
            { ...makeRequest(), name: undefined } as unknown as ApiRequest,
        );
        const n = serializedName(op);
        expect(n).toBeTruthy();
        expect(n!.length).toBeGreaterThan(0);
    });

    it('still carries displayName-based fallback for operations', () => {
        const op = buildExecuteOperation(
            makeOperation({ name: '', displayName: 'My Custom Op' }),
            makeRequest({ name: 'Req.xml' }),
        );
        // displayName should surface when the stable name is empty.
        expect(serializedName(op)).toBe('My Custom Op');
    });
});
