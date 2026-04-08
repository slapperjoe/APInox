/**
 * Platform Bridge - Tauri Desktop Application
 * 
 * Provides unified communication between the React webview and the Rust/Tauri backend.
 * 
 * ## Architecture
 * 
 * This bridge serves two purposes:
 * 
 * 1. **Event-Driven Commands** (Keep using bridge):
 *    - Async operations that emit events (WSDL parsing, test execution, workflows)
 *    - Commands that need progress updates or streaming results
 *    - Examples: loadWsdl, executeRequest, runTestCase, runTestSuite
 * 
 * 2. **Simple CRUD Commands** (Migrate to direct Tauri calls):
 *    - TODO: These should be migrated to use `invoke()` directly from components
 *    - Examples: saveProject, loadProject, saveSettings, getSettings
 *    - Benefit: Simpler, faster, better type safety
 * 
 * ## Migration Guide (Future)
 * 
 * To migrate a simple command to direct Tauri calls:
 * 
 * ```typescript
 * // BEFORE (using bridge)
 * await bridge.sendMessageAsync({
 *     command: FrontendCommand.SaveProject,
 *     project
 * });
 * 
 * // AFTER (direct Tauri call)
 * import { invoke } from '@tauri-apps/api/core';
 * await invoke('save_project', { project, dirPath });
 * ```
 */

declare global {
    interface Window {
        __TAURI__?: any;
        __TAURI_INTERNALS__?: any;
    }
}

// ============== Environment Detection ==============

export const isTauri = (): boolean => typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);

export type Platform = 'tauri' | 'standalone';
export const getPlatform = (): Platform => {
    if (isTauri()) return 'tauri';
    return 'standalone';
};

// ============== Tauri Imports ==============

let tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;
let tauriListen: ((event: string, handler: (e: any) => void) => Promise<() => void>) | null = null;
let tauriInitPromise: Promise<void> | null = null;

async function initTauri(): Promise<void> {
    if (!isTauri()) return;

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { listen } = await import('@tauri-apps/api/event');
        tauriInvoke = invoke;
        tauriListen = listen;
    } catch (e) {
        console.error('[Bridge] Failed to initialize Tauri:', e);
    }
}

function ensureTauriInitialized(): Promise<void> {
    if (!isTauri()) return Promise.resolve();
    if (!tauriInitPromise) {
        tauriInitPromise = initTauri();
    }
    return tauriInitPromise;
}

// Initialize Tauri on load
if (isTauri()) {
    ensureTauriInitialized();
}

// ============== Message Types ==============

import { FrontendCommand, BackendCommand } from '@shared/messages';

interface BridgeMessage {
    command: FrontendCommand | string;
    [key: string]: any;
}

export interface BackendMessage {
    command: BackendCommand | string;
    [key: string]: any;
}

// ============== Tauri Command Helpers ==============

/**
 * Call a Tauri command directly
 * Use this for commands implemented in Rust (file I/O, config, etc.)
 */
export async function invokeTauriCommand<T = any>(command: string, args?: Record<string, any>): Promise<T> {
    await ensureTauriInitialized();
    
    if (!tauriInvoke) {
        throw new Error('Tauri not initialized');
    }
    
    try {
        return await tauriInvoke(command, args);
    } catch (error: any) {
        console.error(`[Bridge] Tauri command '${command}' failed:`, error);
        throw error;
    }
}

// ============== Rust Backend Routing ==============

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const hasRequestBody = (method: string) => BODY_METHODS.has(method.toUpperCase());

/**
 * Per-host GraphQL introspection depth cache.
 * Tracks the maximum query depth each server accepts so we don't keep hitting limits.
 * 3 tiers:
 *   'deep'    → type { kind ofType { kind ofType { kind } } }  (depth 6 — full unwrap)
 *   'shallow' → type { kind }                                   (depth 4 — top kind only)
 *   'none'    → no type info, assume object                     (depth 3 — CDN floor)
 */
type GqlDepthTier = 'deep' | 'shallow' | 'none';
const gqlDepthCache = new Map<string, GqlDepthTier>();

function gqlHostKey(url: string): string {
    try { return new URL(url).hostname; } catch { return url; }
}

/** Query depths our three tiers actually produce (used to map a server-reported limit to a tier). */
const TIER_DEPTHS: Record<GqlDepthTier, number> = { deep: 6, shallow: 4, none: 3 };

/**
 * Checks whether a GraphQL response body is a depth-limit error, and if so tries to extract the
 * server's advertised max depth. Common conventions:
 *   - extensions.maxDepth / extensions.max_depth  (graphql-depth-limit, Apollo, WunderGraph)
 *   - extensions.code === 'GCDN_QUERY_DEPTH_LIMIT' (Stellate CDN)
 *   - message text: "exceeds maximum operation depth of N" / "max depth: N" / "depth limit of N"
 * Returns null if it is NOT a depth-limit error, otherwise returns the server's max (or undefined
 * if the server didn't advertise one).
 */
function parseDepthLimitError(body: string): { isLimit: true; maxDepth?: number } | null {
    try {
        const parsed = JSON.parse(body);
        const errors: any[] = parsed?.errors || [];
        for (const e of errors) {
            const ext = e?.extensions || {};
            const msg: string = e?.message || '';
            const isLimit =
                ext.code === 'GCDN_QUERY_DEPTH_LIMIT' ||
                /depth.{0,30}limit|maximum.{0,30}depth|too deep/i.test(msg);
            if (!isLimit) continue;
            // Try to read advertised max depth from extensions first, then message text
            const fromExt = ext.maxDepth ?? ext.max_depth ?? ext.maximumDepth;
            if (typeof fromExt === 'number') return { isLimit: true, maxDepth: fromExt };
            const match = msg.match(/\b(\d+)\b/);
            if (match) return { isLimit: true, maxDepth: parseInt(match[1], 10) };
            return { isLimit: true };
        }
        return null;
    } catch { return null; }
}

/** Maps a server-reported max depth to the deepest tier we can use without exceeding it. */
function tierForMaxDepth(maxDepth: number): GqlDepthTier {
    if (maxDepth >= TIER_DEPTHS.deep)    return 'deep';
    if (maxDepth >= TIER_DEPTHS.shallow) return 'shallow';
    return 'none';
}

function buildIntrospectionQuery(tier: GqlDepthTier): string {
    const typeFragment =
        tier === 'deep'    ? 'type { kind ofType { kind ofType { kind } } }' :
        tier === 'shallow' ? 'type { kind }' :
                             '';
    const fieldSel = ['name', 'description', typeFragment].filter(Boolean).join(' ');
    return JSON.stringify({
        query: `{
            __schema { queryType { name } mutationType { name } }
            query: __type(name: "Query") { fields(includeDeprecated: false) { ${fieldSel} } }
            mutation: __type(name: "Mutation") { fields(includeDeprecated: false) { ${fieldSel} } }
        }`
    });
}

/** Builds a minimal fallback body when Rust sample_body is unavailable (pre-rebuild). */
function buildFallbackBody(p: any): string {
    if (!hasRequestBody(p.method)) return '';
    // Try to build from body parameters (Swagger 2.0 style)
    const bodyParams = (p.parameters || []).filter((param: any) => param.location === 'body');
    if (bodyParams.length === 0) return '{}';
    const obj: Record<string, unknown> = {};
    for (const param of bodyParams) {
        obj[param.name] = param.param_type === 'integer' ? 0 : param.param_type === 'boolean' ? false : '';
    }
    return JSON.stringify(obj, null, 2);
}

/** Builds the initial queryParams map from query parameters. */
function buildQueryParams(parameters: any[]): Record<string, string> {
    const params: Record<string, string> = {};
    for (const param of parameters) {
        if (param.location === 'query') {
            // Use empty string as placeholder; required params are still shown in the panel
            params[param.name] = '';
        }
    }
    return params;
}

/** Converts a GraphQL introspection type ref to a string like 'String!' or '[ID!]!' */
function gqlTypeName(typeRef: any): string {
    if (!typeRef) return 'String';
    if (typeRef.kind === 'NON_NULL') return `${gqlTypeName(typeRef.ofType)}!`;
    if (typeRef.kind === 'LIST') return `[${gqlTypeName(typeRef.ofType)}]`;
    return typeRef.name || 'String';
}

/**
 * Routes commands to Rust Tauri backend
 * Returns null if command is not implemented
 */
async function tryRustCommand(message: BridgeMessage): Promise<any | null> {
    if (!tauriInvoke) {
        return null; // Tauri not initialized
    }

    try {
        // Route LoadWsdl to appropriate Rust parser based on URL type
        if (message.command === FrontendCommand.LoadWsdl) {
            const url: string = message.url || '';
            const urlLower = url.toLowerCase().split('?')[0]; // strip query string for extension check
            const isOpenApi = urlLower.endsWith('.json') || urlLower.endsWith('.yaml') || urlLower.endsWith('.yml');

            if (isOpenApi) {
                console.log('[Bridge] Routing LoadWsdl → parse_openapi_spec (OpenAPI/Swagger):', url);
                const spec = await tauriInvoke('parse_openapi_spec', { urlOrJson: url });

                // Group paths by first tag → one ApiInterface per tag
                const groups: Record<string, any[]> = {};
                for (const p of (spec.paths || [])) {
                    const tag = (p.tags && p.tags.length > 0) ? p.tags[0] : (spec.title || 'API');
                    if (!groups[tag]) groups[tag] = [];
                    groups[tag].push(p);
                }
                if (Object.keys(groups).length === 0) {
                    groups[spec.title || 'API'] = [];
                }

                const baseUrl = spec.base_url || '';
                const interfaces = Object.entries(groups).map(([tag, paths]) => ({
                    id: crypto.randomUUID(),
                    name: tag,
                    type: 'rest',
                    bindingName: '',
                    soapVersion: '',
                    definition: url,
                    expanded: false,
                    operations: paths.map((p: any) => {
                        const endpoint = baseUrl + p.path;
                        const opName = p.operation_id || `${p.method.toUpperCase()} ${p.path}`;
                        return {
                            id: crypto.randomUUID(),
                            name: opName,
                            action: '',
                            input: { parameters: p.parameters || [] },
                            fullSchema: null,
                            targetNamespace: '',
                            originalEndpoint: endpoint,
                            expanded: false,
                            requests: [{
                                id: crypto.randomUUID(),
                                name: 'Sample',
                                endpoint,
                                method: p.method.toUpperCase(),
                                contentType: 'application/json',
                                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                                queryParams: buildQueryParams(p.parameters || []),
                                request: p.sample_body || buildFallbackBody(p),
                                requestType: 'rest',
                                bodyType: hasRequestBody(p.method) ? 'json' : 'none'
                            }]
                        };
                    })
                }));

                console.log('[Bridge] OpenAPI parsed:', interfaces.length, 'interface(s)');
                return { interfaces, wsdlUrl: url, targetProjectId: message.targetProjectId };
            }

            // GraphQL — detect by URL path containing "graphql"
            const isGraphQL = urlLower.includes('graphql') || urlLower.includes('/gql');
            if (isGraphQL) {
                console.log('[Bridge] Routing LoadWsdl → GraphQL introspection:', url);

                // Adaptive depth: start from cached tier, back off on depth-limit errors.
                // Tiers: 'deep' (full type unwrap) → 'shallow' (kind only) → 'none' (no type info)
                const hostKey = gqlHostKey(url);
                const TIERS: GqlDepthTier[] = ['deep', 'shallow', 'none'];
                const startTier = gqlDepthCache.get(hostKey) ?? 'deep';
                let nextIdx = TIERS.indexOf(startTier);

                let rawBody = '';
                while (nextIdx < TIERS.length) {
                    const tier = TIERS[nextIdx];
                    console.log(`[Bridge] GraphQL introspection attempt: tier=${tier} host=${hostKey}`);
                    const resp = await tauriInvoke('execute_rest_request', {
                        method: 'POST',
                        url,
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: buildIntrospectionQuery(tier),
                    });
                    const body: string = resp.body || '';
                    console.log('[Bridge] GraphQL introspection raw response (first 500):', body.slice(0, 500));

                    if (!body) {
                        throw new Error(`GraphQL introspection failed (HTTP ${resp.status}): ${resp.error || 'empty response'}`);
                    }

                    const depthErr = parseDepthLimitError(body);
                    if (depthErr) {
                        if (depthErr.maxDepth !== undefined) {
                            // Server told us its limit — jump straight to the right tier
                            const safeTier = tierForMaxDepth(depthErr.maxDepth);
                            console.warn(`[Bridge] GraphQL depth limit: server max=${depthErr.maxDepth}, jumping to tier=${safeTier}`);
                            gqlDepthCache.set(hostKey, safeTier);
                            nextIdx = TIERS.indexOf(safeTier);
                            if (safeTier === tier) nextIdx++; // already tried this tier, step past it
                        } else {
                            console.warn(`[Bridge] GraphQL depth limit hit at tier=${tier} (no limit advertised), backing off`);
                            nextIdx++;
                        }
                        continue;
                    }

                    rawBody = body;
                    gqlDepthCache.set(hostKey, tier); // remember what worked
                    console.log(`[Bridge] GraphQL introspection succeeded at tier=${tier}`);
                    break;
                }

                if (!rawBody) {
                    throw new Error('GraphQL introspection failed: server rejected all query depth levels');
                }

                let introspection: any;
                try {
                    introspection = JSON.parse(rawBody);
                } catch (e) {
                    throw new Error(`GraphQL response is not valid JSON: ${rawBody.slice(0, 200)}`);
                }

                if (introspection.errors && !introspection.data) {
                    throw new Error(`GraphQL introspection error: ${introspection.errors[0]?.message || JSON.stringify(introspection.errors)}`);
                }

                const schema = introspection.data?.__schema;
                if (!schema) throw new Error(`Invalid GraphQL introspection response: ${rawBody.slice(0, 300)}`);

                const queryTypeName: string = schema.queryType?.name || 'Query';
                const mutationTypeName: string | null = schema.mutationType?.name || null;

                // Fields come from the __type alias queries (not schema.types)
                const buildOperationsFromFields = (fields: any[], isMutation: boolean) => {
                    return (fields || []).map((field: any) => {
                        // Determine whether the field returns an object type (needs subfield selection).
                        // With 'deep' tier we can fully unwrap NON_NULL/LIST wrappers.
                        // With 'shallow' we only have the top-level kind.
                        // With 'none' we have no type info — default to object (safer than bare name).
                        const baseKind = (function unwrap(t: any): string {
                            if (!t) return 'OBJECT'; // unknown → assume object
                            if (t.kind === 'NON_NULL' || t.kind === 'LIST') return unwrap(t.ofType);
                            return t.kind || 'OBJECT';
                        })(field.type);
                        const needsSelection = !['SCALAR', 'ENUM', 'INPUT_OBJECT'].includes(baseKind);
                        const fieldSelection = needsSelection
                            ? `${field.name} {\n    __typename\n  }` : field.name;
                        const sampleQuery = isMutation
                            ? `mutation {\n  ${fieldSelection}\n}`
                            : `query {\n  ${fieldSelection}\n}`;
                        return {
                            id: crypto.randomUUID(),
                            name: field.name,
                            action: field.description || '',
                            input: {},
                            fullSchema: null,
                            targetNamespace: '',
                            originalEndpoint: url,
                            expanded: false,
                            requests: [{
                                id: crypto.randomUUID(),
                                name: 'Sample',
                                endpoint: url,
                                method: 'POST',
                                contentType: 'application/json',
                                headers: { 'Content-Type': 'application/json' },
                                request: sampleQuery,  // raw GraphQL text; wrapped as {"query":...} at send time
                                requestType: 'graphql',
                                bodyType: 'graphql',
                            }],
                        };
                    });
                };

                const queryFields: any[] = introspection.data?.query?.fields || [];
                const mutationFields: any[] = introspection.data?.mutation?.fields || [];

                const interfaces: any[] = [];
                if (queryFields.length > 0) {
                    interfaces.push({
                        id: crypto.randomUUID(),
                        name: queryTypeName,
                        type: 'graphql',
                        bindingName: '',
                        soapVersion: '',
                        definition: url,
                        expanded: false,
                        operations: buildOperationsFromFields(queryFields, false),
                    });
                }
                if (mutationFields.length > 0) {
                    interfaces.push({
                        id: crypto.randomUUID(),
                        name: mutationTypeName || 'Mutation',
                        type: 'graphql',
                        bindingName: '',
                        soapVersion: '',
                        definition: url,
                        expanded: false,
                        operations: buildOperationsFromFields(mutationFields, true),
                    });
                }
                console.log('[Bridge] GraphQL introspection complete:', interfaces.length, 'interface(s)');
                return { interfaces, wsdlUrl: url, targetProjectId: message.targetProjectId };
            }

            // WSDL / SOAP
            console.log('[Bridge] Routing LoadWsdl → parse_wsdl (WSDL/SOAP):', url);
            const response = await tauriInvoke('parse_wsdl', {
                request: { url }
            });
            
            if (!response.services || !Array.isArray(response.services)) {
                throw new Error('Invalid WSDL response from Rust backend');
            }
            
            console.log('[Bridge] WSDL parsed successfully:', response.services.length, 'services');
            return {
                services: response.services,
                wsdlUrl: url,
                targetProjectId: message.targetProjectId
            };
        }

        // Route ExecuteRequest (REST) to Rust execute_rest_request command
        if (message.command === FrontendCommand.ExecuteRequest && (message.requestType === 'rest' || message.requestType === 'graphql')) {
            const method = (message.method || 'GET').toUpperCase();
            let url: string = message.url || '';

            // Append query params to URL
            const qp: Record<string, string> = message.queryParams || {};
            if (Object.keys(qp).length > 0) {
                const qs = new URLSearchParams(qp).toString();
                url = url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
            }

            console.log('[Bridge] Routing REST/GraphQL ExecuteRequest to Rust backend:', method, url);

            const headers: Record<string, string> = { ...(message.headers || {}) };
            // GraphQL always POSTs JSON body; REST only for body methods
            const isGraphQL = message.requestType === 'graphql';
            const hasBody = isGraphQL || ['POST', 'PUT', 'PATCH'].includes(method);
            let body: string | null = hasBody ? (message.xml || null) : null;

            // If GraphQL, wrap raw query text as {"query": "...", "variables": {...}, "operationName": "..."}
            if (isGraphQL && body) {
                const trimmed = body.trim();
                if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                    // Extract operationName from query text: query/mutation/subscription Name
                    const opMatch = trimmed.match(/^\s*(?:query|mutation|subscription)\s+(\w+)/m);
                    const operationName = opMatch ? opMatch[1] : undefined;
                    const variables = message.graphqlConfig?.variables || undefined;
                    const payload: any = { query: body };
                    if (variables && Object.keys(variables).length > 0) payload.variables = variables;
                    if (operationName) payload.operationName = operationName;
                    body = JSON.stringify(payload);
                }
            }

            const startTime = Date.now();
            const response = await tauriInvoke('execute_rest_request', {
                method,
                url,
                headers,
                body,
            });
            const duration = Date.now() - startTime;

            const responseHeaders: Record<string, string> = Object.fromEntries(
                Object.entries(response.headers || {})
            );
            const responseBody: string = response.body || '';
            const statusCode: number = response.status ?? 0;
            const success = statusCode >= 200 && statusCode < 300;

            // Save history
            const historyEntry: any = {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                requestName: message.operation || url,
                endpoint: url,
                method,
                projectName: message.projectName || '',
                interfaceName: message.interfaceName || '',
                operationName: message.operation || '',
                requestBody: body || '',
                headers,
                status: statusCode,
                duration,
                responseBody,
                responseHeaders,
                responseSize: responseBody.length,
                success,
                starred: false,
            };
            tauriInvoke('add_history_entry', { entry: historyEntry }).catch((e: any) =>
                console.warn('[Bridge] Failed to save history entry:', e)
            );
            listeners.forEach(cb => cb({ command: BackendCommand.HistoryUpdate, entry: historyEntry } as any));

            if (!success && !response.body) {
                return {
                    error: response.error || `HTTP ${statusCode}`,
                };
            }

            return {
                response: {
                    rawResponse: responseBody,
                    headers: responseHeaders,
                    status: statusCode,
                    timeTaken: duration,
                }
            };
        }

        // Route ExecuteRequest (SOAP) to Rust execute_soap_request command
        if (message.command === FrontendCommand.ExecuteRequest && message.xml) {
            console.log('[Bridge] Routing SOAP ExecuteRequest to Rust backend');

            // Read proxy setting from persisted config
            let proxyUrl: string | null = null;
            try {
                const cfg: any = await tauriInvoke('get_settings', {});
                proxyUrl = cfg?.config?.network?.proxy || cfg?.network?.proxy || null;
            } catch {
                // non-fatal — proceed without proxy
            }
            
            // Build request from message parameters
            const request: any = {
                operation: {
                    name: message.operation || '',
                    targetNamespace: message.targetNamespace || '',
                    action: message.soapAction || '',
                    input: { name: message.operation || '' },
                    output: { name: `${message.operation || ''}Response` },
                    originalEndpoint: message.url,
                    fullSchema: null,
                    description: null,
                    portName: null
                },
                soapVersion: message.soapVersion || '1.1',
                values: {}, // Raw XML mode, no values needed
                endpoint: message.url,
                username: message.username || null,
                password: message.password || null,
                passwordType: message.passwordType || null,
                addTimestamp: message.addTimestamp || false,
                rawXml: message.xml, // Send raw XML body
                proxyUrl: proxyUrl || null,
            };

            const startTime = Date.now();
            const response = await tauriInvoke('execute_soap_request', { request });
            const duration = Date.now() - startTime;
            
            const responseHeaders: Record<string, string> = Object.fromEntries(response.headers || []);
            const responseBody: string = response.body || response.rawXml || '';

            // Save history entry
            const historyEntry: any = {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                requestName: message.operation || message.url || 'Request',
                endpoint: message.url || '',
                method: 'POST',
                projectName: message.projectName || '',
                interfaceName: message.interfaceName || '',
                operationName: message.operation || '',
                requestBody: message.xml || '',
                headers: message.headers || {},
                status: response.statusCode || (response.success ? 200 : 500),
                duration,
                responseBody,
                responseHeaders,
                responseSize: responseBody.length,
                success: !!response.success,
                error: response.success ? undefined : (response.error || undefined),
                starred: false,
            };
            tauriInvoke('add_history_entry', { entry: historyEntry }).catch((e: any) =>
                console.warn('[Bridge] Failed to save history entry:', e)
            );
            // Immediately surface in UI
            listeners.forEach(cb => cb({ command: BackendCommand.HistoryUpdate, entry: historyEntry } as any));

            if (!response.success) {
                return {
                    error: response.error || 'SOAP request failed',
                    fault: response.fault
                };
            }

            // Return in format expected by frontend
            return {
                response: {
                    rawResponse: responseBody,
                    headers: responseHeaders,
                    status: response.statusCode || 500,
                    timeTaken: duration
                }
            };
        }

        // Route RunTestCase to Rust run_test_case command
        if (message.command === FrontendCommand.RunTestCase) {
            const response = await tauriInvoke('run_test_case', {
                request: {
                    testCase: message.testCase,
                    variables: message.environment || {},
                    stream: message.stream !== false,
                    fallbackEndpoint: message.fallbackEndpoint || ''
                }
            });
            // Streaming: response = { runId: '...' }
            // Sync: response = { passed: bool, durationMs: number }
            return response;
        }

        // Route ExecuteWorkflow to Rust run_workflow command
        if (message.command === FrontendCommand.ExecuteWorkflow) {
            const response = await tauriInvoke('run_workflow', {
                request: {
                    workflow: message.workflow,
                    environment: message.environment || {}
                }
            });

            if (!response.success) {
                throw new Error(response.error || 'Workflow execution failed');
            }

            return response.result || {};
        }

        if (message.command === 'saveUiState') {
            // Save UI state via Rust
            try {
                await tauriInvoke('update_ui_settings', { ui: message.ui });
                
                // Reload full config and emit update event
                const config = await tauriInvoke('get_settings', {});
                
                // Emit settingsUpdate for frontend contexts to pick up
                setTimeout(() => {
                    bridge.emit({ command: 'settingsUpdate', config } as any);
                }, 0);
                
                return { success: true };
            } catch (error) {
                console.error('[Bridge] Failed to save UI state:', error);
                return { success: false, error: String(error) };
            }
        }

        // Route GetSettings to Rust get_settings command
        if (message.command === FrontendCommand.GetSettings || message.command === 'getSettings') {
            try {
                const response = await tauriInvoke('get_settings', {});
                return response;
            } catch (error: any) {
                console.error('[Bridge] Get settings failed:', error);
                throw new Error(`Failed to get settings: ${error.message || error}`);
            }
        }

        // Route SaveSettings to Rust
        if (message.command === FrontendCommand.SaveSettings || message.command === 'saveSettings') {
            try {
                const response = await tauriInvoke('save_settings', {
                    config: message.config
                });
                
                // Reload and emit update
                const config = await tauriInvoke('get_settings', {});
                setTimeout(() => {
                    bridge.emit({ command: 'settingsUpdate', config } as any);
                }, 0);
                
                return response;
            } catch (error: any) {
                console.error('[Bridge] Save settings failed:', error);
                throw new Error(`Failed to save settings: ${error.message || error}`);
            }
        }

        // Route SaveProject to Rust save_project command
        if (message.command === FrontendCommand.SaveProject) {
            console.log('[Bridge] Routing SaveProject to Rust backend');
            
            try {
                await tauriInvoke('save_project', {
                    project: message.project,
                    dirPath: message.filePath || message.project?.fileName  // Tauri converts to dir_path
                });
                
                console.log('[Bridge] Project saved successfully');
                return { success: true };
            } catch (error: any) {
                console.error('[Bridge] Save project failed:', error);
                throw new Error(`Failed to save project: ${error.message || error}`);
            }
        }

        // Route LoadProject to Rust load_project command
        if (message.command === FrontendCommand.LoadProject) {
            console.log('[Bridge] Routing LoadProject to Rust backend');
            
            const response = await tauriInvoke('load_project', {
                filePath: message.filePath
            });
            
            console.log('[Bridge] Project loaded successfully');
            return {
                project: response.project,
                filename: message.filePath
            };
        }

        // Route ExportWorkspace to Rust export_workspace command
        if (message.command === FrontendCommand.ExportWorkspace) {
            console.log('[Bridge] Routing ExportWorkspace to Rust backend');
            
            try {
                const response = await tauriInvoke('export_workspace', {
                    projects: message.projects,
                    filePath: message.filePath
                });
                
                console.log('[Bridge] Workspace exported successfully:', response);
                return response;
            } catch (error: any) {
                console.error('[Bridge] Export workspace failed:', error);
                throw new Error(`Failed to export workspace: ${error.message || error}`);
            }
        }

        // Route ImportWorkspace to Rust import_workspace command
        if (message.command === 'importWorkspace') {
            console.log('[Bridge] Routing ImportWorkspace to Rust backend');
            
            try {
                const response = await tauriInvoke('import_workspace', {
                    filePath: message.filePath
                });
                
                console.log('[Bridge] Workspace imported successfully:', response);
                return response;
            } catch (error: any) {
                console.error('[Bridge] Import workspace failed:', error);
                throw new Error(`Failed to import workspace: ${error.message || error}`);
            }
        }

        // Route RunTestSuite to Rust run_test_suite command
        if (message.command === FrontendCommand.RunTestSuite) {
            console.log('[Bridge] Routing RunTestSuite to Rust backend');
            
            try {
                const response = await tauriInvoke('run_test_suite', {
                    testSuite: message.testSuite,
                    variables: message.environment || {},
                    stream: message.stream || false
                });
                
                console.log('[Bridge] Test suite command sent:', response);
                return response;
            } catch (error: any) {
                console.error('[Bridge] Run test suite failed:', error);
                throw new Error(`Failed to run test suite: ${error.message || error}`);
            }
        }

        // Route GetTestRunUpdates to Rust get_test_run_updates command
        if (message.command === FrontendCommand.GetTestRunUpdates) {
            try {
                const response = await tauriInvoke('get_test_run_updates', {
                    runId: message.runId,
                    fromIndex: message.fromIndex || 0
                });
                
                return response;
            } catch (error: any) {
                console.error('[Bridge] Get test run updates failed:', error);
                throw new Error(`Failed to get test run updates: ${error.message || error}`);
            }
        }

        // ── Performance suite execution ────────────────────────────────────────

        if (message.command === FrontendCommand.RunPerformanceSuite || message.command === 'runPerformanceSuite') {
            try {
                const response = await tauriInvoke('run_performance_suite', {
                    request: {
                        suiteId: message.suiteId,
                        stream: message.stream !== false
                    }
                });
                return response;
            } catch (error: any) {
                console.error('[Bridge] Run performance suite failed:', error);
                throw new Error(`Failed to run performance suite: ${error.message || error}`);
            }
        }

        if (message.command === FrontendCommand.GetPerformanceRunUpdates || message.command === 'getPerformanceRunUpdates') {
            try {
                const response = await tauriInvoke('get_performance_run_updates', {
                    runId: message.runId,
                    fromIndex: message.fromIndex || 0
                });
                return response;
            } catch (error: any) {
                console.error('[Bridge] Get performance run updates failed:', error);
                throw new Error(`Failed to get performance run updates: ${error.message || error}`);
            }
        }

        if (message.command === 'abortPerformanceSuite' || message.command === FrontendCommand.AbortPerformanceSuite) {
            try {
                await tauriInvoke('abort_performance_suite', { runId: message.runId || '' });
                return { success: true };
            } catch (error: any) {
                console.error('[Bridge] Abort performance suite failed:', error);
                return { success: false };
            }
        }

        // ── Performance suite/request CRUD ────────────────────────────────────

        if (['addPerformanceRequest', 'deletePerformanceRequest', 'updatePerformanceRequest',
             'updatePerformanceSuite', 'deletePerformanceSuite',
             FrontendCommand.AddPerformanceRequest, FrontendCommand.UpdatePerformanceRequest,
             FrontendCommand.DeletePerformanceRequest, FrontendCommand.UpdatePerformanceSuite,
             'deletePerfomanceSuite'].includes(message.command)) {
            try {
                const config = await tauriInvoke('get_settings', {});
                let suites: any[] = (config as any)?.performanceSuites || [];

                if (message.command === 'addPerformanceRequest' || message.command === FrontendCommand.AddPerformanceRequest) {
                    const suiteIdx = suites.findIndex((s: any) => s.id === message.suiteId);
                    if (suiteIdx !== -1) {
                        const newReq = {
                            id: `perf-req-${Date.now()}`,
                            name: message.name || 'New Request',
                            endpoint: message.endpoint || '',
                            method: message.method || 'POST',
                            soapAction: message.soapAction,
                            requestBody: message.requestBody || '',
                            headers: message.headers || {},
                            extractors: message.extractors || [],
                            order: (suites[suiteIdx].requests || []).length,
                            requestType: message.requestType,
                            bodyType: message.bodyType,
                            restConfig: message.restConfig,
                            graphqlConfig: message.graphqlConfig,
                        };
                        suites[suiteIdx] = { ...suites[suiteIdx], requests: [...(suites[suiteIdx].requests || []), newReq] };
                    }
                } else if (message.command === 'updatePerformanceRequest' || message.command === FrontendCommand.UpdatePerformanceRequest) {
                    const suiteIdx = suites.findIndex((s: any) => s.id === message.suiteId);
                    if (suiteIdx !== -1) {
                        const reqs = suites[suiteIdx].requests || [];
                        const reqIdx = reqs.findIndex((r: any) => r.id === message.requestId);
                        if (reqIdx !== -1) {
                            reqs[reqIdx] = { ...reqs[reqIdx], ...message.updates };
                            suites[suiteIdx] = { ...suites[suiteIdx], requests: reqs };
                        }
                    }
                } else if (message.command === 'deletePerformanceRequest' || message.command === FrontendCommand.DeletePerformanceRequest) {
                    const suiteIdx = suites.findIndex((s: any) => s.id === message.suiteId);
                    if (suiteIdx !== -1) {
                        suites[suiteIdx] = { ...suites[suiteIdx], requests: (suites[suiteIdx].requests || []).filter((r: any) => r.id !== message.requestId) };
                    }
                } else if (message.command === 'updatePerformanceSuite' || message.command === FrontendCommand.UpdatePerformanceSuite) {
                    const suiteIdx = suites.findIndex((s: any) => s.id === message.suiteId);
                    if (suiteIdx !== -1) {
                        suites[suiteIdx] = { ...suites[suiteIdx], ...message.updates };
                    }
                } else if (message.command === 'deletePerformanceSuite' || message.command === 'deletePerfomanceSuite' || message.command === FrontendCommand.DeletePerformanceSuite) {
                    suites = suites.filter((s: any) => s.id !== message.suiteId);
                }

                const updatedConfig = { ...(config as any), performanceSuites: suites };
                await tauriInvoke('save_settings', { config: updatedConfig });
                setTimeout(() => bridge.emit({ command: 'settingsUpdate', config: updatedConfig } as any), 0);
                return { success: true };
            } catch (error: any) {
                console.error('[Bridge] Performance CRUD failed:', error);
                return { success: false, error: String(error) };
            }
        }

        // Route workflow commands to Rust
        if (message.command === FrontendCommand.SaveWorkflow) {
            console.log('[Bridge] Routing SaveWorkflow to Rust backend');
            
            try {
                const response = await tauriInvoke('save_workflow', {
                    workflow: message.workflow
                });
                
                console.log('[Bridge] Workflow saved successfully');
                return response;
            } catch (error: any) {
                console.error('[Bridge] Save workflow failed:', error);
                throw new Error(`Failed to save workflow: ${error.message || error}`);
            }
        }

        if (message.command === FrontendCommand.DeleteWorkflow) {
            console.log('[Bridge] Routing DeleteWorkflow to Rust backend');
            
            try {
                const response = await tauriInvoke('delete_workflow', {
                    workflowId: message.workflowId
                });
                
                console.log('[Bridge] Workflow deleted successfully');
                return response;
            } catch (error: any) {
                console.error('[Bridge] Delete workflow failed:', error);
                throw new Error(`Failed to delete workflow: ${error.message || error}`);
            }
        }

        if (message.command === FrontendCommand.GetWorkflows) {
            try {
                const response = await tauriInvoke('get_workflows', {});
                return response;
            } catch (error: any) {
                console.error('[Bridge] Get workflows failed:', error);
                throw new Error(`Failed to get workflows: ${error.message || error}`);
            }
        }

        // Route RefreshWsdl to Rust refresh_wsdl command
        if (message.command === FrontendCommand.RefreshWsdl) {
            console.log('[Bridge] Routing RefreshWsdl to Rust backend');
            
            try {
                const response = await tauriInvoke('refresh_wsdl', {
                    url: message.interfaceDef || message.definition,
                    existingInterface: message.existingInterface || {}
                });
                
                console.log('[Bridge] WSDL refreshed successfully');
                return response;
            } catch (error: any) {
                console.error('[Bridge] Refresh WSDL failed:', error);
                throw new Error(`Failed to refresh WSDL: ${error.message || error}`);
            }
        }

        // Route ApplyWsdlSync to Rust apply_wsdl_sync command
        if (message.command === FrontendCommand.ApplyWsdlSync) {
            console.log('[Bridge] Routing ApplyWsdlSync to Rust backend');
            
            try {
                const response = await tauriInvoke('apply_wsdl_sync', {
                    projectId: message.projectId,
                    diff: message.diff,
                    dirPath: message.dirPath || ''
                });
                
                console.log('[Bridge] WSDL sync applied successfully');
                return response;
            } catch (error: any) {
                console.error('[Bridge] Apply WSDL sync failed:', error);
                throw new Error(`Failed to apply WSDL sync: ${error.message || error}`);
            }
        }

        // Route CloseProject to Rust close_project command
        if (message.command === FrontendCommand.CloseProject) {
            console.log('[Bridge] Routing CloseProject to Rust backend');
            
            try {
                const response = await tauriInvoke('close_project', {
                    projectId: message.projectId
                });
                
                console.log('[Bridge] Project closed successfully');
                return response;
            } catch (error: any) {
                console.error('[Bridge] Close project failed:', error);
                throw new Error(`Failed to close project: ${error.message || error}`);
            }
        }

        // Route CancelRequest to Rust cancel_request command
        if (message.command === FrontendCommand.CancelRequest) {
            console.log('[Bridge] Routing CancelRequest to Rust backend');
            
            try {
                const response = await tauriInvoke('cancel_request', {});
                console.log('[Bridge] Request cancelled successfully');
                return response;
            } catch (error: any) {
                console.error('[Bridge] Cancel request failed:', error);
                throw new Error(`Failed to cancel request: ${error.message || error}`);
            }
        }

        // Route GetDebugInfo to Rust get_debug_info command
        if (message.command === FrontendCommand.GetDebugInfo) {
            const debugInfo = await tauriInvoke('get_debug_info', {});
            return { debugInfo };
        }

        // Scrapbook commands — backed by ~/.apinox/scrapbook.json via Rust
        if (message.command === FrontendCommand.GetScrapbook) {
            const requests = await tauriInvoke('get_scrapbook');
            return { state: { requests } };
        }

        if (message.command === FrontendCommand.AddScrapbookRequest) {
            const requests = await tauriInvoke('add_scrapbook_request', { request: message.request });
            return { state: { requests } };
        }

        if (message.command === FrontendCommand.UpdateScrapbookRequest) {
            const requests = await tauriInvoke('update_scrapbook_request', { id: message.id, updates: message.updates });
            return { state: { requests } };
        }

        if (message.command === FrontendCommand.DeleteScrapbookRequest) {
            const requests = await tauriInvoke('delete_scrapbook_request', { id: message.id });
            return { state: { requests } };
        }

        // Command not implemented in Rust
        return null;

    } catch (error: any) {
        console.error('[Bridge] Rust command failed:', error);
        throw error;
    }
}

// ============== Rust Command Invocation ==============

/**
 * Invoke a Rust backend command
 */
async function invokeRustCommand(message: BridgeMessage): Promise<any> {
    await ensureTauriInitialized();
    
    if (!tauriInvoke) {
        throw new Error('Tauri not initialized');
    }

    try {
        const rustResult = await tryRustCommand(message);
        if (rustResult !== null) {
            console.log(`[Bridge] Command '${message.command}' handled by Rust backend`);
            return rustResult;
        }

        // Command not implemented
        console.error(`[Bridge] Command '${message.command}' not yet implemented in Rust backend`);
        throw new Error(`Command '${message.command}' not implemented. Please add Rust implementation.`);

    } catch (error: any) {
        console.error('[Bridge] Rust command failed:', error);
        throw error;
    }
}

// ============== Response to Event Mapping ==============

/**
 * Maps backend responses to BackendCommand events
 */
function mapResponseToBackendEvent(command: string, data: any): BackendMessage | null {
    // Map frontend commands to their corresponding backend response events
    const commandToEventMap: Record<string, (data: any) => BackendMessage | null> = {
        [FrontendCommand.LoadWsdl]: (data) => ({
            command: BackendCommand.WsdlParsed,
            // Backend returns array of services directly from parseWsdl
            services: Array.isArray(data) ? data : (data?.services || data || []),
            wsdlUrl: data?.wsdlUrl || '',
            targetProjectId: data?.targetProjectId
        }),
        [FrontendCommand.ExecuteRequest]: (data) => ({
            command: BackendCommand.Response,
            // Frontend expects response data in 'result' property
            result: (data && 'response' in data) ? data.response : data || { rawResponse: '', headers: {}, status: 0, timeTaken: 0 }
        }),
        [FrontendCommand.GetHistory]: (data) => ({
            command: BackendCommand.HistoryLoaded,
            entries: data || []
        }),
        // [FrontendCommand.GetWatcherHistory]: (data) => ({ // Removed - watcher features
        //     command: BackendCommand.WatcherUpdate,
        //     history: data || []
        // }),
        [FrontendCommand.GetSettings]: (data) => ({
            command: BackendCommand.SettingsUpdate,
            // Frontend expects 'config' not 'settings'
            config: data?.config ?? data,
            raw: data?.raw,
            configDir: data?.configDir,
            configPath: data?.configPath
        }),
        [FrontendCommand.SaveProject]: (data) => ({
            command: BackendCommand.ProjectSaved,
            ...data
        }),
        [FrontendCommand.SaveSettings]: (data) => ({
            command: BackendCommand.SettingsUpdate,
            config: data?.config,
            raw: data?.raw,
            configDir: data?.configDir,
            configPath: data?.configPath
        }),
        [FrontendCommand.SaveUiState]: (data) => ({
            command: BackendCommand.SettingsUpdate,
            config: data?.config,
            raw: data?.raw
        }),
        [FrontendCommand.AddPerformanceSuite]: (data) => ({
            command: BackendCommand.SettingsUpdate,
            config: data?.config ?? data
        }),
        [FrontendCommand.UpdatePerformanceSuite]: (data) => ({
            command: BackendCommand.SettingsUpdate,
            config: data?.config ?? data
        }),
        [FrontendCommand.DeletePerformanceSuite]: (data) => ({
            command: BackendCommand.SettingsUpdate,
            config: data?.config ?? data
        }),
        [FrontendCommand.LoadProject]: (data) => {
            const project = data?.project ?? data;
            const fileName = data?.filename || data?.fileName;
            return {
                command: BackendCommand.ProjectLoaded,
                project: fileName && project ? { ...project, fileName } : project,
                filename: fileName
            };
        },
        // [FrontendCommand.GetMockStatus]: (data) => ({ // Removed - mock features
        //     command: BackendCommand.MockStatus,
        //     ...data
        // }),
        ['webviewReady']: (data) => data, // Pass through response with samplesProject and changelog
        // Add more mappings as needed
    };

    const mapper = commandToEventMap[command];
    if (mapper) {
        return mapper(data);
    }

    // For commands without specific mappings, return null (no event emitted)
    return null;
}

// ============== Unified Bridge API ==============
// 
// Commands Suitable for Direct Migration (simple CRUD):
// - SaveProject, LoadProject, DeleteProject
// - SaveSettings, GetSettings, SaveUiState
// - GetWorkflows, SaveWorkflow, DeleteWorkflow
// - GetHistory, AddHistoryEntry, ClearHistory
// - GetScrapbook, AddScrapbookRequest, UpdateScrapbookRequest
// 
// Commands That Should Stay in Bridge (async/events):
// - LoadWsdl (emits WsdlParsed event)
// - ExecuteRequest (emits Response + HistoryUpdate events)
// - RunTestCase, RunTestSuite (emit TestRunnerUpdate events)
// - ExecuteWorkflow (emits progress events)
// - RefreshWsdl (async operation)
//

type MessageListener = (message: BackendMessage) => void;
const listeners: Set<MessageListener> = new Set();

export const bridge = {
    /**
     * Send message to Rust backend
     * 
     * Responses are converted to backend messages and emitted to listeners.
     * Use this for async/event-driven commands.
     * 
     * For simple CRUD operations, consider using direct Tauri invoke() in the future.
     */
    sendMessage: (message: BridgeMessage): void => {
        // Log saveSettings commands for debugging
        if (message.command === 'saveSettings') {
            console.log('[Bridge] Sending saveSettings command:', {
                hasConfig: !!message.config,
                uiConfig: message.config?.ui
            });
        }
        
        // Pre-process loadWsdl command for local XSD resolution
        if (message.command === 'loadWsdl' && message.isLocal && message.url) {
            const lastSlash = Math.max(message.url.lastIndexOf('/'), message.url.lastIndexOf('\\'));
            if (lastSlash > 0) {
                message.localWsdlDir = message.url.substring(0, lastSlash);
            }
        }
        
        if (isTauri()) {
            // Send to Rust backend and convert response to backend message
            invokeRustCommand(message)
                .then(data => {
                    // Emit test runner updates for test runs
                    if ((message.command === FrontendCommand.RunTestCase || message.command === FrontendCommand.RunTestSuite) && data?.updates) {
                        data.updates.forEach((update: any) => {
                            listeners.forEach(cb => cb({
                                command: BackendCommand.TestRunnerUpdate,
                                update
                            }));
                        });
                    }

                    // Emit history entry if provided
                    if (message.command === FrontendCommand.ExecuteRequest && data?.historyEntry) {
                        listeners.forEach(cb => cb({
                            command: BackendCommand.HistoryUpdate,
                            entry: data.historyEntry
                        }));
                    }

                    // Emit error if present
                    if (message.command === FrontendCommand.ExecuteRequest && data?.error) {
                        listeners.forEach(cb => cb({
                            command: BackendCommand.Error,
                            error: data.error,
                            message: data.error,
                            originalCommand: message.command
                        }));
                        return;
                    }

                    // Map command responses to backend events
                    const backendEvent = mapResponseToBackendEvent(message.command, data);
                    if (backendEvent) {
                        if (message.command === 'saveSettings') {
                            console.log('[Bridge] Emitting SettingsUpdate event from saveSettings response:', {
                                hasConfig: !!backendEvent.config,
                                uiConfig: backendEvent.config?.ui
                            });
                        }
                        listeners.forEach(cb => cb(backendEvent));
                    }
                })
                .catch(e => {
                    console.error('[Bridge] Rust backend error:', e);
                    listeners.forEach(cb => cb({
                        command: BackendCommand.Error,
                        error: e.message,
                        originalCommand: message.command,
                        // Include project info for save errors
                        projectName: message.command === FrontendCommand.SaveProject ? message.project?.name : undefined
                    }));
                });
        } else {
            console.warn('[Bridge] No backend available (standalone mode)');
        }
    },

    /**
     * Send message and wait for response (async version)
     * 
     * Use this when you need the response data immediately.
     * For simple CRUD operations, consider using direct Tauri invoke() in the future.
     */
    sendMessageAsync: async <T = any>(message: BridgeMessage): Promise<T> => {
        if (isTauri()) {
            return await invokeRustCommand(message) as T;
        }
        throw new Error('No backend available');
    },

    /**
     * Listen for messages from Rust backend
     * 
     * Use this to handle async events like WSDL parsing, test execution, etc.
     */
    onMessage: (callback: MessageListener): (() => void) => {
        listeners.add(callback);

        // Listen to Tauri events from backend
        let tauriUnlisten: (() => void) | null = null;
        if (isTauri() && tauriListen) {
            tauriListen('backend_command', (event: any) => {
                callback(event.payload);
            }).then(unlisten => {
                tauriUnlisten = unlisten;
            });
        }

        return () => {
            listeners.delete(callback);
            if (tauriUnlisten) {
                tauriUnlisten();
            }
        };
    },

    /**
     * State Persistence
     */
    setState: (state: any): void => {
        if (isTauri()) {
            try {
                localStorage.setItem('apinox_state', JSON.stringify(state));
            } catch (e) {
                console.error('[Bridge] Failed to save state:', e);
            }
        }
    },

    getState: (): any => {
        if (isTauri()) {
            try {
                const saved = localStorage.getItem('apinox_state');
                return saved ? JSON.parse(saved) : undefined;
            } catch (e) {
                return undefined;
            }
        }
        return undefined;
    },

    /**
     * Emit a local event to all listeners
     */
    emit: (message: BackendMessage): void => {
        listeners.forEach(cb => cb(message));
    },

    /**
     * Get current platform
     */
    getPlatform,
    isTauri,
    invokeTauriCommand, // Direct Rust command access
    
    // Deprecated - kept for backwards compatibility
    isVsCode: () => false,
    isStandalone: () => !isTauri()
};

// Export for backwards compatibility
export { FrontendCommand, BackendCommand };

// Deprecated exports - for backwards compatibility
export const isVsCode = () => false;
export const isStandalone = () => !isTauri();
