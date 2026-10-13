import type { WorkflowStep, WorkflowExtractor } from "@shared/models";
import type { TrafficLog } from "../components/proxy/TrafficViewer";

export interface BuildOpts {
    /** Log ids to exclude (user unchecked in the wizard). */
    disabledIds?: Set<string>;
    /** Per-log-id extractors to attach to that step. */
    extractors?: Record<string, WorkflowExtractor[]>;
    /** Explicit per-step names (keyed by log id). */
    stepNames?: Record<string, string>;
}

export function lastPathSegment(url: string): string {
    try {
        const seg = new URL(url).pathname.split("/").filter(Boolean).pop();
        if (seg) return seg;
    } catch { /* not a URL */ }
    return "request";
}

/** Convert captured traffic into ordered, self-contained request steps (chronological). */
export function buildWorkflowStepsFromLogs(logs: TrafficLog[], opts: BuildOpts = {}): WorkflowStep[] {
    const { disabledIds, extractors = {}, stepNames = {} } = opts;
    const included = logs.filter(l => !disabledIds?.has(l.id));
    return included.map((log, idx) => ({
        id: log.id,
        name: stepNames[log.id] || `${log.method} ${lastPathSegment(log.url)}`,
        type: "request",
        order: idx,
        endpoint: log.url,
        method: log.method,
        httpMethod: log.method as WorkflowStep["httpMethod"],
        requestBody: log.requestBody || "",
        headers: log.requestHeaders || {},
        contentType: log.requestHeaders?.["Content-Type"] || log.requestHeaders?.["content-type"],
        extractors: extractors[log.id]?.length ? extractors[log.id] : undefined,
    }));
}
