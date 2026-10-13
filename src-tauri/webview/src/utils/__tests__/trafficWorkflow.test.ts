import { describe, it, expect } from "vitest";
import { buildWorkflowStepsFromLogs, detectChainedValues } from "../trafficWorkflow";
import type { TrafficLog } from "../../components/proxy/TrafficViewer";

function mkLog(partial: Partial<TrafficLog> & { id: string }): TrafficLog {
    return { timestamp: 0, method: "POST", url: "http://x", ...partial };
}

describe("buildWorkflowStepsFromLogs", () => {
    it("produces one request step per log in chronological (array) order", () => {
        const logs = [
            mkLog({ id: "a", url: "http://x/login", timestamp: 1 }),
            mkLog({ id: "b", url: "http://x/data", timestamp: 2 }),
        ];
        const steps = buildWorkflowStepsFromLogs(logs, {});
        expect(steps).toHaveLength(2);
        expect(steps.map(s => s.endpoint)).toEqual(["http://x/login", "http://x/data"]);
        expect(steps.every(s => s.type === "request")).toBe(true);
        expect(steps.map(s => s.order)).toEqual([0, 1]);
    });

    it("honors enabled=false exclusion and renumbers", () => {
        const logs = [
            mkLog({ id: "a" }), mkLog({ id: "b" }), mkLog({ id: "c" }),
        ];
        const steps = buildWorkflowStepsFromLogs(logs, { disabledIds: new Set(["b"]) });
        expect(steps.map(s => s.id)).toEqual(["a", "c"]);
        expect(steps.map(s => s.order)).toEqual([0, 1]);
    });

    it("applies the provided initial variable map and per-step extractors", () => {
        const logs = [
            mkLog({ id: "a", requestBody: "<B>1</B>", responseHeaders: { "set-cookie": "t=1" } }),
            mkLog({ id: "b", requestBody: "<B>2</B>", url: "http://x/next" }),
        ];
        const steps = buildWorkflowStepsFromLogs(logs, {
            extractors: { a: [{ id: "e1", variable: "token", type: "xpath", pattern: "//t", source: "body" }] },
        });
        expect(steps[0].extractors).toEqual([
            { id: "e1", variable: "token", type: "xpath", pattern: "//t", source: "body" },
        ]);
        expect(steps[1].extractors).toBeUndefined();
    });

    it("sets step.name from a stable default (method + last path segment)", () => {
        const logs = [mkLog({ id: "a", method: "POST", url: "http://x/a/b" })];
        const steps = buildWorkflowStepsFromLogs(logs, {});
        expect(steps[0].name).toBe("POST b");
    });
});

describe("detectChainedValues", () => {
    it("flags a response-body value that reappears in a later request body", () => {
        const logs = [
            mkLog({ id: "a", requestBody: "<Q/>",
                    responseBody: "<R><SessionToken>TKN-999</SessionToken></R>" }),
            mkLog({ id: "b", url: "http://x/next",
                    requestBody: "<Q><Auth>TKN-999</Auth></Q>" }),
        ];
        const found = detectChainedValues(logs);
        expect(found).toHaveLength(1);
        expect(found[0].value).toBe("TKN-999");
        expect(found[0].sourceLogId).toBe("a");
        expect(found[0].consumedByLogId).toBe("b");
        expect(found[0].source).toBe("body");
    });

    it("flags a response-header value used later in a request header", () => {
        const logs = [
            mkLog({ id: "a", responseHeaders: { "X-Session": "S-1" }, requestBody: "<Q/>" }),
            mkLog({ id: "b", requestHeaders: { "X-Session": "S-1" }, requestBody: "<Q/>" }),
        ];
        const found = detectChainedValues(logs);
        expect(found).toHaveLength(1);
        expect(found[0].value).toBe("S-1");
        expect(found[0].source).toBe("header");
        expect(found[0].sourceHeaderName).toBe("X-Session");
    });

    it("returns empty when no value is reused across requests", () => {
        const logs = [
            mkLog({ id: "a", responseBody: "<R>only-here</R>" }),
            mkLog({ id: "b", requestBody: "<Q>never-there</Q>" }),
        ];
        expect(detectChainedValues(logs)).toEqual([]);
    });

    it("skips trivial/short values (noise filter)", () => {
        const logs = [
            mkLog({ id: "a", responseBody: "<R>200</R>" }),
            mkLog({ id: "b", requestBody: "<Q>200</Q>" }),
        ];
        // "200" is short / a status-ish token -> filtered.
        expect(detectChainedValues(logs)).toEqual([]);
    });
});
