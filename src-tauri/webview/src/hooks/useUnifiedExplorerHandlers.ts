/**
 * useUnifiedExplorerHandlers.ts
 *
 * The unified-explorer handler bundle, extracted from MainContent.tsx.
 *
 * These 21 callbacks existed only to satisfy `UnifiedExplorerView`'s props and
 * the `unifiedProps` sidebar bundle. They take no arguments from MainContent —
 * every value they close over comes from a context provider that already sits
 * above it, so the hook is self-contained and needs no parameter passing.
 *
 * `unifiedExecuteFn` moved here with them: it is the execute function
 * registered by UnifiedExplorerMain, and only the scrapbook handlers use it.
 */

import { useCallback, useState } from 'react';
import { ApiRequest, ScrapbookRequest, UnifiedProject } from '@shared/models';
import { BackendCommand } from '@shared/messages';
import { bridge } from '../utils/bridge';
import { saveImportedProjectsAsUnified } from '../utils/importUnifiedStore';
import { generateInitialXmlForOperation, soapDefault, rewriteRequestsForContentTypeChange } from '../utils/soapUtils';
import { useUnifiedProjects } from '../contexts/UnifiedProjectContext';
import { useScrapbook } from '../contexts/ScrapbookContext';

export function useUnifiedExplorerHandlers() {
    const {
        projects: unifiedProjects,
        setProjects: setUnifiedProjects,
        saveProject: saveUnifiedProject,
        refresh: refreshUnifiedProjects,
        selectedNode: unifiedSelectedNode,
        setSelectedNode: setUnifiedSelectedNode,
        ensureProjectFull: ensureProjectFullUnified,
        updateProject: updateUnifiedProject
    } = useUnifiedProjects();

    const {
        scrapbookRequests,
        selectedScrapbookRequest,
        loading: scrapbookLoading,
        createRequest: createScrapbookRequest,
        selectRequest: selectScrapbookRequest,
        deleteRequest: deleteScrapbookRequest,
        updateRequest: updateScrapbookRequest
    } = useScrapbook();

    /** F-01: the unified execute function, registered by UnifiedExplorerMain. */
    const [unifiedExecuteFn, setUnifiedExecuteFn] = useState<((req: ApiRequest) => Promise<void>) | null>(null);

    const handleUnifiedSelectNode = useCallback((type: string, id: string) => {
        setUnifiedSelectedNode({ type, id });
    }, [setUnifiedSelectedNode]);

    // ──────────────────────────────────────────────────────────────────────────
    // F-01 / R-05 — Quick Requests (scrapbook) for the unified explorer.
    //
    // State lives in the app-level ScrapbookProvider (shared with the legacy
    // view — R4: the legacy `useScrapbookAutoSave` hook and legacy scrapbook
    // CRUD are untouched; this is the NEW unified surface reusing the same
    // store). The sidebar Quick Requests section (UnifiedExplorerSidebar's
    // bottom section, Q1(a)) receives these handlers via `unifiedProps`;
    // execution routes through UnifiedExplorerMain's unified SOAP path
    // (registered via `unifiedExecuteRef`), which also performs the history
    // write (F-13) and auto-capture (F-02, Q4(c)).
    // ──────────────────────────────────────────────────────────────────────────
    const registerUnifiedExecute = useCallback((execute: (req: ApiRequest) => Promise<void>) => {
        // Pass a thunk so React treats this as "set state to `execute`", NOT as
        // an updater function. `setUnifiedExecuteFn(execute)` would make React
        // INVOKE `execute(prevState)` — executing a phantom request (the state
        // value, not a real request) on every re-registration, which fires on
        // every selection change and set a spurious "Request body is empty"
        // banner. Do not "simplify" this back to a bare function argument.
        setUnifiedExecuteFn(() => execute);
    }, []);

    const handleUnifiedScrapbookCreate = useCallback(async () => {
        try {
            const created = await createScrapbookRequest();
            if (!created) return;
            // Seed the fresh quick request from the currently-selected WSDL
            // operation (when one is selected), so it is immediately runnable
            // instead of an empty blank slate: body = the operation's
            // generated envelope (real target namespace + schema), endpoint =
            // the operation's WSDL endpoint, name = the operation name (the
            // scrapbook's capture/display identifier).
            //
            // `ensureProjectFull` resolves with the FULL project (upgrading
            // the body-less first-paint skeleton first), so the envelope is
            // real — without this the quick request would be seeded with the
            // empty tempuri template and its first Run would fail with
            // "Request body is empty".
            const seeded = created;
            const sn = unifiedSelectedNode;
            if (sn && (sn.type === 'operation' || sn.type === 'project' || sn.type === 'request')) {
                const project = unifiedProjects.find(p => (p.id || p.name) === sn.id || p.name === sn.id);
                if (project) {
                    const full = await ensureProjectFullUnified(project.name);
                    const selOp = full?.operations?.find(op =>
                        op.id === sn.id || op.name === sn.id || op.displayName === sn.id,
                    )
                    // The user is on a REQUEST node — seed from its owning
                    // operation (find the op containing the selected request).
                    ?? (sn.type === 'request'
                        ? full?.operations?.find(op => (op.requests || []).some(r => (r.id || r.name) === sn.id))
                        : undefined);
                    if (selOp) {
                        const sample = (selOp.requests || []).find(r => r.name.startsWith('sample_'));
                        const body = sample?.request || generateInitialXmlForOperation(selOp);
                        const endpoint = sample?.endpoint || selOp.originalEndpoint || '';
                        if (body.trim() !== '') {
                            await updateScrapbookRequest(created.id, {
                                name: selOp.displayName || selOp.name,
                                request: body,
                                endpoint,
                            }).catch((e) => {
                                console.error('[UnifiedExplorer] Failed to seed quick request from operation:', e);
                            });
                        }
                    }
                }
            }
            selectScrapbookRequest(seeded);
            setUnifiedSelectedNode({ type: 'scrapbook', id: seeded.id });
        } catch (e) {
            console.error('[UnifiedExplorer] Failed to create quick request:', e);
        }
    }, [createScrapbookRequest, selectScrapbookRequest, updateScrapbookRequest, unifiedSelectedNode, unifiedProjects, ensureProjectFullUnified, setUnifiedSelectedNode]);

    const handleUnifiedScrapbookSelect = useCallback((request: ScrapbookRequest) => {
        selectScrapbookRequest(request);
        setUnifiedSelectedNode({ type: 'scrapbook', id: request.id });
    }, [selectScrapbookRequest, setUnifiedSelectedNode]);

    const handleUnifiedScrapbookDelete = useCallback((id: string) => {
        deleteScrapbookRequest(id).catch((e) => {
            console.error('[UnifiedExplorer] Failed to delete quick request:', e);
        });
        // If the deleted entry is the selected node, clear the unified
        // selection so the main view leaves the quick-request editor.
        setUnifiedSelectedNode(prev => (prev && prev.type === 'scrapbook' && prev.id === id) ? null : prev);
    }, [deleteScrapbookRequest, setUnifiedSelectedNode]);

    const handleUnifiedScrapbookExecute = useCallback((request: ScrapbookRequest) => {
        if (!request) return;
        selectScrapbookRequest(request);
        setUnifiedSelectedNode({ type: 'scrapbook', id: request.id });
        if (unifiedExecuteFn) {
            unifiedExecuteFn(request).catch((e) => {
                console.error('[UnifiedExplorer] Quick request execution failed:', e);
            });
        }
    }, [unifiedExecuteFn, selectScrapbookRequest, setUnifiedSelectedNode]);

    const handleUnifiedRefresh = useCallback(async (projectName: string) => {
        const project = unifiedProjects.find(p => p.name === projectName);
        if (!project?.sourceUrl) return;
        try {
            // `existingRequests` was sent here but never read by the Rust
            // command, which only looks up the project by sourceUrl.
            const refreshed: UnifiedProject = await bridge.invokeTauriCommand('refresh_project_wsdl', {
                sourceUrl: project.sourceUrl,
            });
            // Enrich refreshed project: add XML bodies for any sample requests missing them
            const enrichedProject: UnifiedProject = {
                ...refreshed,
                operations: (refreshed.operations || []).map(op => {
                    const enrichedRequests = (op.requests || []).map(req => {
                        if (!req.request && op.input && op.targetNamespace) {
                            return { ...req, request: generateInitialXmlForOperation(op) };
                        }
                        return req;
                    });
                    return { ...op, requests: enrichedRequests };
                }),
            };
            const persisted: UnifiedProject = { ...enrichedProject, dirty: true };
            setUnifiedProjects(prev => prev.map(p => p.name === projectName ? persisted : p));
            // Persist the refreshed project. Previously only in-memory state was
            // updated, so the refreshed operations/schemas silently vanished on
            // restart. If the save fails, the dirty flag stays set and the
            // unified auto-save retries it.
            try {
                await saveUnifiedProject(persisted);
            } catch (e) {
                console.error('[UnifiedExplorer] Persist after WSDL refresh failed:', e);
            }
        } catch (e) {
            console.error('[UnifiedExplorer] Refresh failed:', e);
        }
    }, [unifiedProjects, saveUnifiedProject, setUnifiedProjects]);

    const handleUnifiedDeleteProject = useCallback(async (projectName: string) => {
        try {
            await bridge.invokeTauriCommand('delete_unified_project', { name: projectName });
            setUnifiedProjects(prev => prev.filter(p => p.name !== projectName));
            // The selected node lived in the deleted project — clear it so the
            // editor doesn't keep pointing at a ghost.
            setUnifiedSelectedNode(null);
        } catch (e) {
            console.error('[UnifiedExplorer] Delete project failed:', e);
        }
    }, [setUnifiedSelectedNode, setUnifiedProjects]);

    const handleUnifiedDeleteOperation = useCallback(async (projectName: string, operationName: string) => {
        // Capture the deleted subtree's selection ids before the state update
        // so we can tell whether the current selection is inside it.
        const project = unifiedProjects.find(p => p.name === projectName);
        const deletedOp = project?.operations?.find(op => op.name === operationName);
        const deletedIds = new Set<string>();
        if (deletedOp) {
            deletedIds.add(deletedOp.id || deletedOp.name);
            deletedIds.add(deletedOp.name);
            (deletedOp.requests || []).forEach(r => {
                deletedIds.add(r.id || r.name);
                deletedIds.add(r.name);
            });
        }
        try {
            await bridge.invokeTauriCommand('delete_unified_operation', { projectName, operationName });
            setUnifiedProjects(prev => prev.map(p => {
                if (p.name !== projectName) return p;
                return { ...p, operations: p.operations.filter(op => op.name !== operationName) };
            }));
            if (unifiedSelectedNode && deletedIds.has(unifiedSelectedNode.id)) {
                setUnifiedSelectedNode(null);
            }
        } catch (e) {
            console.error('[UnifiedExplorer] Delete operation failed:', e);
        }
    }, [unifiedProjects, unifiedSelectedNode, setUnifiedSelectedNode, setUnifiedProjects]);

    const handleUnifiedDeleteRequest = useCallback(async (projectName: string, operationName: string, requestName: string) => {
        // Capture the deleted request's selection id before removal.
        const project = unifiedProjects.find(p => p.name === projectName);
        const deletedReq = project?.operations?.find(op => op.name === operationName)?.requests?.find(r => r.name === requestName);
        const deletedIds = new Set<string>();
        if (deletedReq) {
            deletedIds.add(deletedReq.id || deletedReq.name);
            deletedIds.add(deletedReq.name);
        }
        try {
            await bridge.invokeTauriCommand('delete_unified_request', { projectName, operationName, requestName });
            setUnifiedProjects(prev => prev.map(p => {
                if (p.name !== projectName) return p;
                return {
                    ...p,
                    operations: p.operations.map(op => {
                        if (op.name !== operationName) return op;
                        return { ...op, requests: op.requests?.filter(r => r.name !== requestName) || [] };
                    })
                };
            }));
            if (unifiedSelectedNode && deletedIds.has(unifiedSelectedNode.id)) {
                setUnifiedSelectedNode(null);
            }
        } catch (e) {
            console.error('[UnifiedExplorer] Delete request failed:', e);
        }
    }, [unifiedProjects, unifiedSelectedNode, setUnifiedSelectedNode, setUnifiedProjects]);

    // ── R-10 (F-17): context-menu rename (display-only `displayName`) ──────
    // Each rename command loads the project, sets/clears the additive
    // `displayName` field, persists it, and returns the FULL updated project —
    // so we replace the in-memory copy verbatim. The stable `name` (on-disk
    // directory, WSDL binding, refresh merge key, selection identity) is
    // untouched, so selection survives the rename.

    const handleUnifiedRenameProject = useCallback(async (projectName: string, displayName: string) => {
        const updated = await bridge.invokeTauriCommand<UnifiedProject>('rename_unified_project', { projectName, displayName });
        setUnifiedProjects(prev => prev.map(p => (p.name === projectName ? updated : p)));
    }, [setUnifiedProjects]);

    const handleUnifiedRenameOperation = useCallback(async (projectName: string, operationName: string, displayName: string) => {
        const updated = await bridge.invokeTauriCommand<UnifiedProject>('rename_unified_operation', { projectName, operationName, displayName });
        setUnifiedProjects(prev => prev.map(p => (p.name === projectName ? updated : p)));
    }, [setUnifiedProjects]);

    const handleUnifiedRenameRequest = useCallback(async (projectName: string, operationName: string, requestName: string, displayName: string) => {
        const updated = await bridge.invokeTauriCommand<UnifiedProject>('rename_unified_request', { projectName, operationName, requestName, displayName });
        setUnifiedProjects(prev => prev.map(p => (p.name === projectName ? updated : p)));
    }, [setUnifiedProjects]);

    const handleUnifiedNewRequest = useCallback(async (projectName: string, operationName: string) => {
        try {
            // Route through the fullness-guarded updater: it upgrades
            // a body-less first-paint skeleton to FULL detail (fullSchema +
            // request bodies + targetNamespace) before the updater runs and
            // persists through `saveProject` (which also guards fullness).
            // Doing the create against the raw skeleton instead would (a)
            // seed the new request with an empty/tempuri body and (b) save
            // the skeleton shape over the on-disk full data, dropping
            // fullSchema + bodies from disk.
            //
            // Selection uses the request's stable UUID `id` (never its name):
            // the sidebar matches `(req.id || req.name)`, so once the full
            // detail carries the UUID, a name-keyed selection would drop.
            let createdId: string | null = null;
            await updateUnifiedProject(projectName, (project) => {
                const operation = project.operations?.find(op => op.name === operationName);
                if (!operation) return project;

                const existingRequests = operation.requests || [];
                const existingNames = new Set(existingRequests.map(req => req.name));
                const sampleRequest = existingRequests.find(req => req.name.startsWith("sample_"));

                let requestNumber = existingRequests.filter(req => !req.name.startsWith("sample_")).length + 1;
                let requestName = `Request${requestNumber}.xml`;
                while (existingNames.has(requestName)) {
                    requestNumber += 1;
                    requestName = `Request${requestNumber}.xml`;
                }

                // Precedence (SOAP_INTERFACE_CONTENT_TYPE_SPEC.md §5.2): project
                // contentType override ?? op.input.contentType ?? SOAP-version
                // default. No bare "application/soap+xml" fallback.
                const newContentType: string = project.contentType || operation.input?.contentType || soapDefault(project.soapVersion);

                const newReq: ApiRequest = {
                    ...(sampleRequest || {}),
                    id: crypto.randomUUID(),
                    name: requestName,
                    request: sampleRequest?.request || generateInitialXmlForOperation(operation),
                    endpoint: sampleRequest?.endpoint || operation.originalEndpoint || "",
                    method: sampleRequest?.method || "POST",
                    contentType: newContentType,
                    dirty: true,
                    readOnly: false,
                };
                // Invariant (spec §6): keep the header in sync with the field so the
                // locked Content-Type row shows exactly what will be sent.
                newReq.headers = { ...(sampleRequest?.headers || {}), "Content-Type": newContentType };
                createdId = newReq.id || requestName;

                return {
                    ...project,
                    operations: project.operations.map(op => {
                        if (op.name !== operationName) return op;
                        return { ...op, requests: [...(op.requests || []), newReq] };
                    }),
                };
            });
            if (createdId) {
                setUnifiedSelectedNode({ type: "request", id: createdId });
            }
        } catch (e) {
            console.error("[UnifiedExplorer] New request failed:", e);
        }
    }, [updateUnifiedProject, setUnifiedSelectedNode]);

    const handleUnifiedProjectContentTypeChange = useCallback(async (projectName: string, contentType: string) => {
        const project = unifiedProjects.find(p => p.name === projectName);
        if (!project) return;
        const oldValue = project.contentType || "";
        if (oldValue === contentType) return;

        // Propagate in place (SOAP_INTERFACE_CONTENT_TYPE_SPEC.md §5.4): sample
        // requests and inheriting requests are rewritten to the new effective
        // value (field + Content-Type header); user-customized requests are
        // untouched. Then persist immediately.
        const updatedProject: UnifiedProject = {
            ...project,
            contentType: contentType || undefined,
            operations: rewriteRequestsForContentTypeChange(project.operations, project.contentType, contentType, project.soapVersion),
        };

        try {
            await bridge.invokeTauriCommand("save_unified_project", {
                dirPath: project.name,
                project: JSON.parse(JSON.stringify(updatedProject)),
            });
            setUnifiedProjects(prev => prev.map(p => p.name === projectName ? updatedProject : p));
        } catch (e) {
            console.error("[UnifiedExplorer] Content-type change failed:", e);
        }
    }, [unifiedProjects, setUnifiedProjects]);

    const handleUnifiedExport = useCallback(async (projectName: string) => {
        const project = unifiedProjects.find(p => p.name === projectName);
        if (!project) return;
        try {
            const { save } = await import('@tauri-apps/plugin-dialog');
            const filePath = await save({
                defaultPath: `${projectName}.apinox`,
                filters: [{ name: 'APInox Project', extensions: ['apinox', 'json'] }]
            });
            if (!filePath) return;
            await bridge.invokeTauriCommand('export_unified_project', { projectName, filePath });
        } catch (e) {
            console.error('[UnifiedExplorer] Export failed:', e);
        }
    }, [unifiedProjects]);

    // Unified import pipeline (t_b2eae8b0): parse a workspace/project export
    // file into nested projects via the `importWorkspace` command, persist
    // each to the canonical UNIFIED store (save_imported_project_as_unified),
    // publish the nested values for in-session legacy readers (PROXY), and
    // reload the unified list. Shared by the sidebar
    // context menu's "Import SoapUI Workspace" and "Import Workspace"
    // (APInox .apinox / .json / .xml exports).
    const handleUnifiedImportFile = useCallback(async (opts: {
        title: string;
        filters: { name: string; extensions: string[] }[];
    }) => {
        if (!bridge.isTauri()) return;
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
            multiple: false,
            directory: false,
            filters: opts.filters,
            title: opts.title,
        });
        if (!selected) return;
        const targetPath = selected as string;
        const response: any = await bridge.sendMessageAsync({
            command: 'importWorkspace',
            filePath: targetPath,
        });
        const imported: any[] =
            response?.projects && Array.isArray(response.projects)
                ? response.projects
                : [];
        if (imported.length > 0) {
            // Persist each imported project to the canonical unified store
            // (idempotent merge; additive nested write for PROXY).
            await saveImportedProjectsAsUnified(imported);
            // In-session legacy list: PROXY (AddToProjectDialog) reads the
            // nested model from useProject().projects IN THIS SESSION (it does
            // not re-load from disk on demand), so publish each nested value
            // now to keep it visible without a restart.
            for (const project of imported) {
                if (!project?.name) continue;
                (project as any).fileName = targetPath;
                bridge.emit({
                    command: BackendCommand.ProjectLoaded,
                    project,
                    filename: targetPath,
                });
            }
            // The unified store now owns these projects — reload the unified
            // list so the explorer shows them immediately.
            await refreshUnifiedProjects();
        }
    }, [refreshUnifiedProjects]);

    // "Import Workspace" (sidebar context menu): an APInox workspace or
    // project export file. The Rust `import_workspace` command already
    // accepts .apinox / .json / .xml, so the dialog only needs the filter.
    const handleUnifiedImportWorkspace = useCallback(async () => {
        await handleUnifiedImportFile({
            title: 'Import APInox Workspace or Project',
            filters: [{ name: 'APInox Workspace or Project', extensions: ['apinox', 'json', 'xml'] }],
        });
    }, [handleUnifiedImportFile]);

    // "Import SoapUI Workspace" (sidebar context menu).
    const handleUnifiedImportSoapUI = useCallback(async () => {
        await handleUnifiedImportFile({
            title: 'Import SoapUI Workspace or Project',
            filters: [{ name: 'SoapUI Workspace or Project', extensions: ['xml'] }],
        });
    }, [handleUnifiedImportFile]);

    const handleUnifiedWsdlLoaded = useCallback((project: UnifiedProject) => {
        // Enrich sample requests with generated XML bodies
        const enrichedProject: UnifiedProject = {
            ...project,
            operations: project.operations.map(op => {
                const enrichedRequests = (op.requests || []).map(req => {
                    // If the request has no 'request' field (no body), generate one
                    if (!req.request && op.input && op.targetNamespace) {
                        return {
                            ...req,
                            request: generateInitialXmlForOperation(op),
                        };
                    }
                    return req;
                });
                return { ...op, requests: enrichedRequests };
            }),
        };
        setUnifiedProjects(prev => [...prev, enrichedProject]);
    }, [setUnifiedProjects]);

    const handleUnifiedReorderOperation = useCallback(async (projectName: string, fromIndex: number, toIndex: number) => {
        try {
            // Route through the fullness-guarded updater: reordering a project
            // that is still a body-less skeleton and saving it raw would persist
            // the skeleton over the full on-disk data, dropping fullSchema +
            // request bodies.
            await updateUnifiedProject(projectName, (project) => {
                const ops = [...(project.operations || [])];
                const [moved] = ops.splice(fromIndex, 1);
                // When moving down (fromIndex < original toIndex), removal shifts all later indices left
                const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex;
                ops.splice(adjustedTo, 0, moved);
                return { ...project, operations: ops, dirty: true };
            });
        } catch (e) {
            console.error("[UnifiedExplorer] Reorder operation failed:", e);
        }
    }, [updateUnifiedProject]);

    const handleUnifiedReorderRequest = useCallback(async (projectName: string, operationName: string, fromIndex: number, toIndex: number) => {
        try {
            // Fullness-guarded updater — see handleUnifiedReorderOperation.
            await updateUnifiedProject(projectName, (project) => ({
                ...project,
                dirty: true,
                operations: (project.operations || []).map(op => {
                    if (op.name !== operationName) return op;
                    const reqs = [...(op.requests || [])];
                    const [moved] = reqs.splice(fromIndex, 1);
                    // When moving down (fromIndex < original toIndex), removal shifts all later indices left
                    const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex;
                    reqs.splice(adjustedTo, 0, moved);
                    return { ...op, requests: reqs };
                }),
            }));
        } catch (e) {
            console.error("[UnifiedExplorer] Reorder request failed:", e);
        }
    }, [updateUnifiedProject]);

    return {
        unifiedProjects,
        unifiedSelectedNode,
        refreshUnifiedProjects,
        scrapbookRequests,
        selectedScrapbookRequest,
        scrapbookLoading,
        handleUnifiedSelectNode,
        handleUnifiedRefresh,
        handleUnifiedDeleteProject,
        handleUnifiedDeleteOperation,
        handleUnifiedDeleteRequest,
        handleUnifiedRenameProject,
        handleUnifiedRenameOperation,
        handleUnifiedRenameRequest,
        handleUnifiedNewRequest,
        handleUnifiedProjectContentTypeChange,
        handleUnifiedExport,
        // handleUnifiedImportFile stays internal: only the two named import
        // entry points (workspace / SoapUI) are consumed, and they differ by
        // nothing but the dialog filter.
        handleUnifiedImportWorkspace,
        handleUnifiedImportSoapUI,
        handleUnifiedWsdlLoaded,
        handleUnifiedReorderOperation,
        handleUnifiedReorderRequest,
        handleUnifiedScrapbookCreate,
        handleUnifiedScrapbookSelect,
        handleUnifiedScrapbookDelete,
        handleUnifiedScrapbookExecute,
        registerUnifiedExecute,
    };
}
