import { describe, it, expect } from "vitest";
import { buildWorkflowStepsFromLogs, detectChainedValues, assembleWorkflow, elementNameFor, chainSourceLine } from "../trafficWorkflow";
import type { ChainedValue } from "../trafficWorkflow";
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

    it("carries every captured request header into the step verbatim", () => {
        const logs = [mkLog({
            id: "a",
            requestHeaders: {
                "SOAPAction": '"urn:svc#Login"',
                "Content-Type": "text/xml; charset=utf-8",
                "User-Agent": "WCF/6.0",
                "Host": "svc.example.com",
            },
        })];
        const steps = buildWorkflowStepsFromLogs(logs, {});
        expect(steps[0].headers).toEqual({
            "SOAPAction": '"urn:svc#Login"',
            "Content-Type": "text/xml; charset=utf-8",
            "User-Agent": "WCF/6.0",
            "Host": "svc.example.com",
        });
        // contentType is derived from the carried headers.
        expect(steps[0].contentType).toBe("text/xml; charset=utf-8");
    });

    it("applies value substitutions to header values like it does to bodies", () => {
        const logs = [mkLog({
            id: "a",
            requestHeaders: { Authorization: "Bearer TKN-999" },
        })];
        const steps = buildWorkflowStepsFromLogs(logs, {
            valueSubstitutions: [{ value: "TKN-999", variable: "sessionToken" }],
        });
        expect(steps[0].headers).toEqual({ Authorization: "Bearer {{sessionToken}}" });
    });

    it("honors wizard-edited per-log headers (headersByLog) over the raw capture", () => {
        const logs = [
            mkLog({ id: "a", requestHeaders: { "X-Old": "1", "X-Keep": "2" } }),
            mkLog({ id: "b", requestHeaders: { "X-B": "3" } }),
        ];
        const steps = buildWorkflowStepsFromLogs(logs, {
            headersByLog: { a: { "X-Keep": "2", "X-Added": "4" } },
        });
        // Edited log: the edited map wins (X-Old dropped, X-Added present).
        expect(steps[0].headers).toEqual({ "X-Keep": "2", "X-Added": "4" });
        // Untouched log: raw capture flows through unchanged.
        expect(steps[1].headers).toEqual({ "X-B": "3" });
    });

    it("drops header rows with a blank name", () => {
        const logs = [mkLog({ id: "a", requestHeaders: { "X-A": "1" } })];
        const steps = buildWorkflowStepsFromLogs(logs, {
            headersByLog: { a: { "X-A": "1", "   ": "junk" } },
        });
        expect(steps[0].headers).toEqual({ "X-A": "1" });
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

    it('flags a response-header value used later in a request header', () => {
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

    it("ignores a response header value the client already sent (Content-Type boilerplate)", () => {
        // A Content-Type echoed back by the server is not a captured value —
        // the request itself carried the same value.
        const logs = [
            mkLog({ id: "a", requestHeaders: { "Content-Type": "text/xml" },
                    responseHeaders: { "Content-Type": "text/xml" }, requestBody: "<Q/>" }),
            mkLog({ id: "b", requestHeaders: { "Content-Type": "text/xml" }, requestBody: "<Q/>" }),
        ];
        expect(detectChainedValues(logs)).toEqual([]);
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

    it("ignores boilerplate that was already in the source request (SOAP namespace URIs)", () => {
        const env = (inner: string) =>
            `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${inner}</soap:Body></soap:Envelope>`;
        const logs = [
            mkLog({ id: "a", url: "http://x/login",
                    requestBody: env("<Login/>"),
                    responseBody: env("<R><SessionToken>TKN-999</SessionToken></R>") }),
            mkLog({ id: "b", url: "http://x/next",
                    requestBody: env("<D><Auth>TKN-999</Auth></D>") }),
        ];
        const found = detectChainedValues(logs);
        // Only the real captured token survives; namespace-URI words shared by
        // both envelopes are boilerplate, not captured response values.
        expect(found.map(c => c.value)).toEqual(["TKN-999"]);
        expect(found[0].sourceXPath).toBe("//SessionToken/text()");
    });

    it("excludes XML tag names from body candidates (structure, not data)", () => {
        const env = (inner: string) =>
            `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${inner}</soap:Body></soap:Envelope>`;
        const logs = [
            mkLog({ id: "a", url: "http://x/step1",
                    requestBody: env("<S1/>"),
                    responseBody: env("<R><OrderId>ORD-4829</OrderId></R>") }),
            mkLog({ id: "b", url: "http://x/step2",
                    requestBody: env("<S2><OrderId>ORD-4829</OrderId></S2>") }),
        ];
        const found = detectChainedValues(logs);
        // "OrderId" is an element name (shared structure across requests), not a
        // captured value — must not be suggested. Only the real data value is.
        expect(found.map(c => c.value)).toEqual(["ORD-4829"]);
        expect(found[0].sourceXPath).toBe("//OrderId/text()");
    });

    it("excludes attribute names and namespace-URI fragments (structure, not data)", () => {
        // The response declares a namespace + a version attr whose tokens are
        // reused verbatim in the later request's markup. None of them are
        // element text values, so only the real data value should surface.
        const logs = [
            mkLog({ id: "a", url: "http://x/step1",
                    requestBody: "<S1/>",
                    responseBody: '<R xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" version="1.2"><OrderId>ORD-4829</OrderId></R>' }),
            mkLog({ id: "b", url: "http://x/step2",
                    requestBody: '<S2 xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" version="1.2"><OrderId>ORD-4829</OrderId></S2>' }),
        ];
        const found = detectChainedValues(logs);
        // "soap", "envelope", "schemas", "xmlsoap", "version", "1" etc. are all
        // structure (attr names / namespace URIs). Only the data value remains.
        expect(found.map(c => c.value)).toEqual(["ORD-4829"]);
    });

    it("still suggests a real value that also appears as a shared attribute value", () => {
        // A genuine data token that happens to equal an attribute value must
        // still be suggested when it is element text in the response and is
        // reused in a later request.
        const logs = [
            mkLog({ id: "a", url: "http://x/step1",
                    requestBody: "<S1/>",
                    responseBody: '<R ref="TKN-999"><OrderId>TKN-999</OrderId></R>' }),
            mkLog({ id: "b", url: "http://x/step2",
                    requestBody: "<S2><OrderId>TKN-999</OrderId></S2>" }),
        ];
        const found = detectChainedValues(logs);
        expect(found.map(c => c.value)).toEqual(["TKN-999"]);
    });
});

describe("elementNameFor", () => {
    it("returns the element tag that holds the value", () => {
        expect(elementNameFor("<R><SessionToken>TKN-999</SessionToken></R>", "TKN-999")).toBe("SessionToken");
    });

    it("strips namespace prefixes", () => {
        expect(elementNameFor("<R><urn:OrderId>ORD-4829</urn:OrderId></R>", "ORD-4829")).toBe("OrderId");
    });

    it("prefers an exact match over a containing match", () => {
        const xml = "<R><Note>see TKN-999 below</Note><SessionToken>TKN-999</SessionToken></R>";
        expect(elementNameFor(xml, "TKN-999")).toBe("SessionToken");
    });

    it("returns null when the value is not found as an element text", () => {
        expect(elementNameFor("<R>only-here</R>", "absent")).toBeNull();
    });
});

describe("chainSourceLine", () => {
    it("returns the raw element holding the value for a body source", () => {
        const log = mkLog({ id: "a", responseBody: "<R><SessionToken>TKN-999</SessionToken></R>" });
        const c: ChainedValue = {
            value: "TKN-999", variable: "sessionToken", sourceLogId: "a", source: "body",
            sourceXPath: "//SessionToken/text()", sourceElementName: "SessionToken",
            consumedByLogId: "b", consumedIn: "body",
        };
        expect(chainSourceLine(log, c)).toBe("<SessionToken>TKN-999</SessionToken>");
    });

    it("prefers the exact-match element over a containing one", () => {
        const log = mkLog({ id: "a", responseBody: "<R><Note>see TKN-999 below</Note><SessionToken>TKN-999</SessionToken></R>" });
        const c: ChainedValue = {
            value: "TKN-999", variable: "sessionToken", sourceLogId: "a", source: "body",
            sourceXPath: "//SessionToken/text()", sourceElementName: "SessionToken",
            consumedByLogId: "b", consumedIn: "body",
        };
        expect(chainSourceLine(log, c)).toBe("<SessionToken>TKN-999</SessionToken>");
    });

    it("returns the full header line for a header source", () => {
        const log = mkLog({ id: "a", responseHeaders: { "Set-Cookie": "t=TKN-999; Path=/" } });
        const c: ChainedValue = {
            value: "TKN-999", variable: "t", sourceLogId: "a", source: "header",
            sourceHeaderName: "Set-Cookie", consumedByLogId: "b", consumedIn: "header",
        };
        expect(chainSourceLine(log, c)).toBe("Set-Cookie: t=TKN-999; Path=/");
    });

    it("falls back to the XPath reference when the element cannot be found", () => {
        const log = mkLog({ id: "a", responseBody: "<R/>" });
        const c: ChainedValue = {
            value: "GONE-1", variable: "gone", sourceLogId: "a", source: "body",
            sourceXPath: "//Gone/text()", consumedByLogId: "b", consumedIn: "body",
        };
        expect(chainSourceLine(log, c)).toBe("//Gone/text(): GONE-1");
    });
});

describe("assembleWorkflow", () => {
    it("builds a Workflow with steps, variables, and timestamps", () => {
        const logs = [mkLog({ id: "a" }), mkLog({ id: "b" })];
        const wf = assembleWorkflow({
            name: "Login flow",
            logs,
            disabledIds: new Set(["b"]),
            initialVariables: { clientId: "acme" },
            extractors: { a: [{ id: "e1", variable: "token", type: "xpath", pattern: "//t", source: "body" }] },
            stepNames: { a: "Login" },
        });
        expect(wf.name).toBe("Login flow");
        expect(wf.variables).toEqual({ clientId: "acme" });
        expect(wf.steps).toHaveLength(1);
        expect(wf.steps[0].name).toBe("Login");
        expect(typeof wf.id).toBe("string");
        expect(typeof wf.createdAt).toBe("number");
        expect(typeof wf.modifiedAt).toBe("number");
    });

    it("substitutes tagged values with {{variable}} in consuming request bodies", () => {
        const logs = [
            mkLog({ id: "a", url: "http://x/login", requestBody: "<B><User>mark</User></B>",
                    responseBody: "<R><SessionToken>TKN-999</SessionToken></R>" }),
            mkLog({ id: "b", url: "http://x/next",
                    requestBody: "<B><Auth>TKN-999</Auth></B>" }),
        ];
        const wf = assembleWorkflow({
            name: "Chain",
            logs,
            valueSubstitutions: [
                { value: "TKN-999", variable: "sessionToken" },
                { value: "mark", variable: "user" },
            ],
        });
        // Raw captured token is replaced by the {{variable}} placeholder in the
        // consuming step, so runtime extractor substitution can populate it.
        expect(wf.steps[1].requestBody).toContain("{{sessionToken}}");
        expect(wf.steps[1].requestBody).not.toContain("TKN-999");
        // Manual variable also substituted.
        expect(wf.steps[0].requestBody).toContain("{{user}}");
        expect(wf.steps[0].requestBody).not.toContain(">mark<");
    });

    it("pretty-prints each created requestBody with the app XML formatter", () => {
        const logs = [
            mkLog({ id: "a", requestBody: "<B><User>mark</User></B>" }),
        ];
        const wf = assembleWorkflow({ name: "Fmt", logs });
        // formatXml with inline element values -> multi-line, indented.
        expect(wf.steps[0].requestBody).toContain("\n");
        expect(wf.steps[0].requestBody).toContain("  <User>mark</User>");
    });

    it("includes all captured request headers in the created steps, with wizard edits applied", () => {
        const logs = [
            mkLog({ id: "a", url: "http://x/login",
                    requestHeaders: { "SOAPAction": '"urn:svc#Login"', "Content-Type": "text/xml" },
                    responseBody: "<R><SessionToken>TKN-999</SessionToken></R>" }),
            mkLog({ id: "b", url: "http://x/next",
                    requestHeaders: { "SOAPAction": '"urn:svc#Next"', Authorization: "Bearer TKN-999" },
                    requestBody: "<B/>" }),
        ];
        const wf = assembleWorkflow({
            name: "Hdrs",
            logs,
            valueSubstitutions: [{ value: "TKN-999", variable: "sessionToken" }],
            headersByLog: { a: { "SOAPAction": '"urn:svc#Login"', "Content-Type": "text/xml", "X-Extra": "1" } },
        });
        // Untouched log keeps every captured header; a tagged value consumed in
        // a header is emitted as {{variable}} for runtime extraction.
        expect(wf.steps[1].headers).toEqual({
            "SOAPAction": '"urn:svc#Next"',
            Authorization: "Bearer {{sessionToken}}",
        });
        // Edited log: the wizard's rows (including the added header) win.
        expect(wf.steps[0].headers).toEqual({
            "SOAPAction": '"urn:svc#Login"',
            "Content-Type": "text/xml",
            "X-Extra": "1",
        });
    });
});
