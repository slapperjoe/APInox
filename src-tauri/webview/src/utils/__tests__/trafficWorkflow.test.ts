import { describe, it, expect } from "vitest";
import { buildWorkflowStepsFromLogs } from "../trafficWorkflow";
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
