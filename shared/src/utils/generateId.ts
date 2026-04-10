/**
 * Generate a unique ID, optionally with a semantic prefix.
 *
 * Uses `crypto.randomUUID()` which is available in all modern browsers and
 * Node.js ≥ 14.17. The optional prefix makes IDs human-readable in logs and
 * tests without affecting uniqueness.
 *
 * @example
 * generateId()           // "a1b2c3d4-..."
 * generateId('step')     // "step-a1b2c3d4-..."
 * generateId('perf-req') // "perf-req-a1b2c3d4-..."
 */
export function generateId(prefix?: string): string {
    const uuid = crypto.randomUUID();
    return prefix ? `${prefix}-${uuid}` : uuid;
}
