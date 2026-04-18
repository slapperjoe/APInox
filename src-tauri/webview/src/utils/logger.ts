/**
 * logger.ts
 *
 * Shared frontend logging utility for APInox.
 *
 * `debugLog()` writes entries directly to the in-memory frontend log store so
 * they appear in the Debug Modal (Ctrl+Shift+D → Frontend Logs) WITHOUT being
 * emitted to the browser DevTools console during normal use.
 *
 * `captureLog()` is the low-level writer used by DebugModal's console intercepts
 * (console.log / warn / error); those still forward to the original console so
 * errors and warnings remain visible in DevTools.
 */

export interface FrontendLogEntry {
    timestamp: number;
    level: string;
    message: string;
}

export const frontendLogs: FrontendLogEntry[] = [];
export const MAX_FRONTEND_LOGS = 2000;

/** Serialise a single argument to a readable string. */
function argToString(arg: unknown): string {
    if (typeof arg === 'object' && arg !== null) {
        try {
            return JSON.stringify(arg);
        } catch {
            if (arg instanceof Error) return `Error: ${arg.message}`;
            if (
                typeof (arg as any).toString === 'function' &&
                (arg as any).toString !== Object.prototype.toString
            ) {
                return (arg as any).toString();
            }
            return '[Circular or Complex Object]';
        }
    }
    return String(arg);
}

/**
 * Low-level log capture — adds an entry to the in-memory store.
 * Called by the console intercepts in DebugModal.tsx and by `debugLog`.
 */
export const captureLog = (level: string, ...args: unknown[]): void => {
    const message = args.map(argToString).join(' ');
    frontendLogs.push({ timestamp: Date.now(), level, message });
    if (frontendLogs.length > MAX_FRONTEND_LOGS) {
        frontendLogs.shift();
    }
};

/**
 * Debug-only log: captured to the Debug Modal's "Frontend Logs" panel but
 * never written to the browser DevTools console.
 *
 * Usage:
 *   debugLog('[Bridge] Routing SaveProject to Rust backend');
 *   debugLog('[Context] Extracted variable', { name: 'token', value });
 */
export const debugLog = (context: string, data?: unknown): void => {
    if (data !== undefined) {
        captureLog('debug', context, data);
    } else {
        captureLog('debug', context);
    }
};
