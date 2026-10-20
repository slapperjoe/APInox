/**
 * Application-wide constants for the APInox webview.
 *
 * Keep values here instead of scattering magic literals throughout hooks,
 * contexts, and components so changes stay in one place.
 */

// ---------------------------------------------------------------------------
// Performance request IDs
// ---------------------------------------------------------------------------

/** ID prefix for ephemeral performance-suite requests.
 *  Consumers use `id.startsWith(PERF_REQUEST_ID_PREFIX)` to detect them. */
export const PERF_REQUEST_ID_PREFIX = 'perf-req-';

/** ID prefix for performance suites. */
export const PERF_SUITE_ID_PREFIX = 'perf-suite-';

// ---------------------------------------------------------------------------
// Debounce / polling delays (milliseconds)
// ---------------------------------------------------------------------------

/** Debounce interval for search inputs and tree-update writes. */
export const DEBOUNCE_MS = 300;

/** Short delay used when waiting for a DOM tree node to render before
 *  programmatic selection (e.g. search-result navigation). */
export const TREE_NAV_DELAY_MS = 100;

// ---------------------------------------------------------------------------
// List caps
// ---------------------------------------------------------------------------

/** Cap on the in-memory traffic list. The proxy emits one event per exchange
 *  and every entry renders as a DOM row, so an uncapped array grows for the
 *  whole session. Newest entries are kept — the traffic list renders
 *  newest-first — and the oldest are dropped. */
export const MAX_TRAFFIC_LOGS = 1000;

// ---------------------------------------------------------------------------
// UI interaction delays (milliseconds)
// ---------------------------------------------------------------------------

/** Window after which a click sequence is considered complete and the
 *  click-count is reset (used for multi-click detection in title bars). */
export const MULTI_CLICK_RESET_MS = 300;
