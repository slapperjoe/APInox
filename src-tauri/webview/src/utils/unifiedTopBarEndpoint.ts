import { UnifiedProject, ScrapbookRequest } from '@shared/models';

export interface TopBarSelection {
    type: string;
    id: string;
}

/**
 * Endpoint for the UnifiedExplorerMain top bar, resolved from the current
 * selection. `null` means "no endpoint-bearing selection" → the top bar shows
 * the WSDL/definition loader instead of the endpoint input.
 *
 * Precedence: request.endpoint → owning operation.originalEndpoint.
 * Project and unresolvable selections return null (the project's source URL
 * is already shown in the project summary).
 */
export function resolveTopBarEndpoint(
    selectedNode: TopBarSelection | null,
    projects: UnifiedProject[],
    selectedScrapbook: ScrapbookRequest | null,
): string | null {
    if (!selectedNode) return null;

    if (selectedNode.type === 'scrapbook') {
        if (selectedScrapbook && selectedScrapbook.id === selectedNode.id) {
            return selectedScrapbook.endpoint || null;
        }
        return null;
    }

    for (const project of projects) {
        if (selectedNode.type === 'project') continue; // → WSDL loader mode

        for (const op of project.operations || []) {
            const opId = op.id || op.name;
            if (selectedNode.type === 'operation' && opId === selectedNode.id) {
                return op.originalEndpoint || null;
            }
            if (selectedNode.type === 'request') {
                const req = (op.requests || []).find(r => (r.id || r.name) === selectedNode.id);
                if (req) {
                    return req.endpoint || op.originalEndpoint || null;
                }
            }
        }
    }
    return null;
}
