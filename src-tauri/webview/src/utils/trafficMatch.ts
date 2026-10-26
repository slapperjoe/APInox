/**
 * trafficMatch.ts
 *
 * Scores a captured proxy request against the operations already in the
 * unified explorer, so the traffic sidebar's right-click menu can offer
 * "Add to" the operation the capture belongs to instead of opening the
 * pick-a-project dialog.
 *
 * Signals, strongest first:
 *   1. SOAPAction — the header, or the `action=` Content-Type parameter
 *      (SOAP 1.2 carries the action in Content-Type, not in a header).
 *   2. The first element under <Body> — for document/literal-wrapped WSDLs
 *      that element IS the operation name.
 *   3. The URL path — an OpenAPI template (`/orders/{id}`) matched
 *      segment-wise against the captured path, or the last segment against the
 *      operation name when no template is stored.
 * Host is a tie-breaker, never a match on its own: it is what separates two
 * projects that both define an operation of the same name.
 *
 * SKELETONS: the unified explorer first-paints projects as name-only skeletons
 * (UnifiedProjectContext), but the skeleton carries `action`, `path` and
 * `method` — exactly the scalars signals 1 and 3 score — so an unopened project
 * still matches without a detail load. The scorer loads nothing itself.
 *
 * NOTE: `extractSoapAction` (trafficWorkflow) is the DISPLAY variant — it
 * returns the header tail or the Body child, whichever it finds, as one
 * string. Matching needs the raw header value and the Body element name
 * separately, so they are scored against different things, hence the helpers
 * below rather than reuse.
 */
import type { TrafficLog } from '../components/proxy/TrafficViewer';
import type { UnifiedProject } from '@shared/models';
import { lastPathSegment } from './trafficWorkflow';
import { findContentTypeHeader } from '@shared/utils/contentType';

/** Where a matched capture lands — the same destination AddToProjectDialog writes. */
export interface AddToProjectDestination {
    /** Target operation name (stable name, not display name). */
    operationName: string;
    /** True → create a NEW operation; false → append to the existing one. */
    isNew: boolean;
}

/** One scored candidate: a project + operation this capture could belong to. */
export interface TrafficMatch {
    projectName: string;
    projectDisplay: string;
    operationName: string;
    operationDisplay: string;
    score: number;
    /** Which signal fired — shown as the menu's sub-line. */
    reason: string;
}

export const SCORE_ACTION_FULL = 70;
export const SCORE_ACTION_TAIL = 65;
export const SCORE_BODY_ELEMENT = 60;
export const SCORE_PATH_TEMPLATE = 55;
/** A template matched past a spec base path — same operation, less certain. */
export const SCORE_PATH_TEMPLATE_BASE = 50;
export const SCORE_PATH_SEGMENT = 40;
/** Leading captured segments allowed to be the spec's base path. */
export const MAX_BASE_PATH_SEGMENTS = 3;
export const HOST_BONUS = 20;
/** Menu cap — a project with 200 operations would otherwise blow out the submenu.
 *  Applied by the caller, which is also what knows whether it truncated. */
export const MAX_MENU_MATCHES = 12;

/** `urn:svc#Login` / `tns:Login` → `Login`; the value unchanged when no separator. */
export function actionTail(value: string): string {
    const v = (value || '').replace(/"/g, '').trim();
    if (!v) return '';
    const idx = Math.max(v.lastIndexOf('#'), v.lastIndexOf('/'), v.lastIndexOf(':'));
    return idx >= 0 && idx < v.length - 1 ? v.slice(idx + 1) : v;
}

/** The SOAPAction header verbatim (quotes stripped), '' when absent. */
export function rawSoapAction(log: TrafficLog): string {
    const headers = log.requestHeaders ?? {};
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'soapaction') {
            return (headers[key] as string).replace(/"/g, '').trim();
        }
    }
    return '';
}

/** SOAP 1.2 carries the action as a Content-Type parameter, not a header. */
export function contentTypeAction(log: TrafficLog): string {
    const raw = findContentTypeHeader(log.requestHeaders);
    const match = raw.match(/;\s*action=(?:"([^"]*)"|([^;]*))/i);
    return (match?.[1] ?? match?.[2] ?? '').trim();
}

/** First element under <Body> — the wrapped-style operation name, '' when not SOAP. */
export function bodyElementName(log: TrafficLog): string {
    const body = log.requestBody ?? '';
    if (!body.trim().startsWith('<') || !body.includes('Body')) return '';
    const match = body.match(/<(?:[a-zA-Z0-9_]+:)?Body[^>]*>\s*<(?:[a-zA-Z0-9_]+:)?([a-zA-Z0-9_]+)/);
    return match ? match[1] : '';
}

/** Lowercase host (port kept) of a URL, '' when it isn't one. */
export function hostOf(url: string): string {
    try { return new URL(url).host.toLowerCase(); } catch { return ''; }
}

/** Path without the query — an OpenAPI template is matched against this. */
export function pathOnly(url: string): string {
    try { return new URL(url).pathname; } catch { return url; }
}

/**
 * Segment-wise match of a captured path against an OpenAPI template.
 *
 * Returns the number of extra leading captured segments — the spec's base path
 * — or null when the path does not match. The stored template is relative to
 * `servers[0].url` (or Swagger's `basePath`), which the import bakes into
 * `originalEndpoint` but not into `input.path`, so a capture to
 * `/api/orders/123` carries a segment the template does not know about. Capped
 * at `MAX_BASE_PATH_SEGMENTS` so a stray prefix cannot match anything.
 *
 * Placeholders are matched inside a segment too (`/files/{version}.pdf`), not
 * only when the whole segment is one. A template with no placeholders returns
 * null — a literal path is already covered by the operation-name check.
 */
export function matchPathTemplate(template: string, capturedPath: string): number | null {
    if (!template || !template.includes('{')) return null;
    const tSeg = template.split('/').filter(Boolean);
    const cSeg = capturedPath.split('/').filter(Boolean);
    if (cSeg.length < tSeg.length) return null;
    const baseSegments = cSeg.length - tSeg.length;
    if (baseSegments > MAX_BASE_PATH_SEGMENTS) return null;

    for (let i = 0; i < tSeg.length; i++) {
        const captured = cSeg[baseSegments + i];
        if (!captured) return null;
        const seg = tSeg[i];
        if (!seg.includes('{')) {
            if (seg.toLowerCase() !== captured.toLowerCase()) return null;
            continue;
        }
        // Escape the literals first, then turn each escaped `{name}` into a
        // single-segment wildcard.
        const pattern = new RegExp(
            `^${seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+')}$`,
            'i',
        );
        if (!pattern.test(captured)) return null;
    }
    return baseSegments;
}

/**
 * Score every operation in `projects` against `log`, strongest match first.
 * Read-only projects are skipped — the menu can only add to a writable one.
 */
export function matchTrafficToOperations(log: TrafficLog, projects: UnifiedProject[]): TrafficMatch[] {
    const headerAction = rawSoapAction(log);
    const ctAction = contentTypeAction(log);
    const bodyEl = bodyElementName(log);
    const pathSeg = lastPathSegment(log.url);
    const capturedPath = pathOnly(log.url);
    const logHost = hostOf(log.url);

    const matches: TrafficMatch[] = [];
    for (const project of projects) {
        if (project.readOnly) continue;
        const projectHost = hostOf(project.sourceUrl || '');

        for (const op of project.operations || []) {
            let score = 0;
            let reason = '';

            const action = (op.action || '').replace(/"/g, '').trim();
            if (action) {
                const lower = action.toLowerCase();
                if ((headerAction && headerAction.toLowerCase() === lower)
                    || (ctAction && ctAction.toLowerCase() === lower)) {
                    score = SCORE_ACTION_FULL;
                    reason = 'SOAPAction';
                } else if (bodyEl && actionTail(action).toLowerCase() === bodyEl.toLowerCase()) {
                    score = SCORE_ACTION_TAIL;
                    reason = 'SOAPAction';
                }
            }

            if (!score) {
                if (bodyEl && bodyEl.toLowerCase() === op.name.toLowerCase()) {
                    score = SCORE_BODY_ELEMENT;
                    reason = 'Body element';
                } else {
                    // OpenAPI import stores the template on the operation's
                    // input (`/orders/{id}`), which is what a concrete captured
                    // path has to be matched against. Method is part of the
                    // match: the same template with GET and POST is two
                    // operations, and the capture is one of them.
                    const template = op.input?.path;
                    const opMethod = op.input?.method;
                    const baseSegments = template ? matchPathTemplate(template, capturedPath) : null;
                    if (baseSegments !== null
                        && (!opMethod || opMethod.toUpperCase() === (log.method || '').toUpperCase())) {
                        score = baseSegments === 0 ? SCORE_PATH_TEMPLATE : SCORE_PATH_TEMPLATE_BASE;
                        reason = baseSegments === 0 ? 'Path template' : 'Path template (base path)';
                    } else if (pathSeg && pathSeg.toLowerCase() === op.name.toLowerCase()) {
                        score = SCORE_PATH_SEGMENT;
                        reason = 'URL path';
                    }
                }
            }

            if (!score) continue;

            // Tie-breaker only — same operation name in two projects.
            if (logHost && (projectHost === logHost || hostOf(op.originalEndpoint || '') === logHost)) {
                score += HOST_BONUS;
            }

            matches.push({
                projectName: project.name,
                projectDisplay: project.displayName || project.name,
                operationName: op.name,
                operationDisplay: op.displayName || op.name,
                score,
                reason,
            });
        }
    }

    return matches.sort((a, b) => b.score - a.score
        || a.projectDisplay.localeCompare(b.projectDisplay)
        || a.operationDisplay.localeCompare(b.operationDisplay));
}

