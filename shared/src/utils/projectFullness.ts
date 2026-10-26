/**
 * projectFullness.ts
 *
 * The unified explorer first-paints projects as name-only skeletons
 * (t_aafaf92b, contract §3.1.2): operation and request NAMES, empty request
 * bodies, no fullSchema, no `action`. Anything that needs real content — the
 * editor pane, a save, an updater, traffic matching — has to upgrade the
 * project first.
 *
 * The check is content-based, not presence-based: a skeleton carries an EMPTY
 * string body, so `'' !== null` would misclassify it as full.
 */
import type { UnifiedProject } from '../models';

export function isFullProject(p: UnifiedProject | undefined | null): boolean {
    if (!p || !Array.isArray(p.operations)) return false;
    return p.operations.some(
        op => op.fullSchema != null
            || (Array.isArray(op.requests) && op.requests.some(
                r => typeof r.request === 'string' && r.request.length > 0,
            )),
    );
}
