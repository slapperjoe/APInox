import { describe, it, expect } from "vitest";
import { buildTrafficTestSteps, findContentType } from "../trafficTestCase";
import type { TestStep } from "@shared/models";
import type { TrafficLog } from "../../components/proxy/TrafficViewer";

function mkLog(partial: Partial<TrafficLog> & { id: string }): TrafficLog {
    return { timestamp: 0, method: "POST", url: "http://x", ...partial };
}

function reqOf(step: TestStep): any {
    return (step as any).config.request;
}

describe("findContentType", () => {
    it("finds the header case-insensitively", () => {
        expect(findContentType({ "content-type": "text/xml" })).toBe("text/xml");
        expect(findContentType({ "Content-Type": "text/xml", Host: "h" })).toBe("text/xml");
    });

    it("returns '' when absent", () => {
        expect(findContentType({ Host: "h" })).toBe("");
        expect(findContentType(undefined)).toBe("");
    });
});

describe("buildTrafficTestSteps", () => {
    it("copies the exact captured Content-Type string, including the action parameter", () => {
        const rawCT = 'application/soap+xml; charset=utf-8; action="urn:demo:login"';
        const logs: TrafficLog[] = [
            mkLog({
                id: "a",
                url: "http://x/soap",
                requestHeaders: { "Content-Type": rawCT, Host: "x" },
                requestBody: "<Login/>",
            }),
        ];
        const steps = buildTrafficTestSteps(logs);
        expect(steps).toHaveLength(1);
        const req = reqOf(steps[0]);
        // Verbatim in BOTH the header (sent verbatim by the runner) and the
        // contentType field (drives the editor + request-type routing).
        expect(req.headers["Content-Type"]).toBe(rawCT);
        expect(req.contentType).toBe(rawCT);
        expect(req.headers.Host).toBe("x");
        expect(req.requestType).toBe("soap");
        expect(req.fromTraffic).toBe(true);
        // bodyType stays unset so the runner's content-type "fixing" never
        // rewrites the captured header.
        expect(req.bodyType).toBeUndefined();
    });

    it("keeps the captured headers, body, method and URL verbatim", () => {
        const logs: TrafficLog[] = [
            mkLog({
                id: "a",
                method: "POST",
                url: "http://x/api/login?tenant=42",
                requestHeaders: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": '"http://tempuri.org/IService/Login"' },
                requestBody: "<a:Login><a:User>u</a:User></a:Login>",
            }),
        ];
        const [step] = buildTrafficTestSteps(logs);
        const req = reqOf(step);
        expect(req.method).toBe("POST");
        expect(req.endpoint).toBe("http://x/api/login?tenant=42");
        expect(req.request).toBe("<a:Login><a:User>u</a:User></a:Login>");
        expect(req.headers["SOAPAction"]).toBe('"http://tempuri.org/IService/Login"');
        // Named from the traffic sidebar entry's lines: method + path (line 1)
        // + SOAP action (line 2).
        expect(step.name).toBe("POST /api/login?tenant=42 Login");
        expect(step.type).toBe("request");
    });

    it("routes non-SOAP content types through the REST path, verbatim", () => {
        const rawCT = "application/json; charset=utf-8";
        const logs: TrafficLog[] = [
            mkLog({
                id: "a",
                method: "GET",
                url: "http://x/users/profile",
                requestHeaders: { "content-type": rawCT },
                requestBody: "",
            }),
        ];
        const [step] = buildTrafficTestSteps(logs);
        const req = reqOf(step);
        expect(req.requestType).toBe("rest");
        // The lower-cased captured key is preserved as-is in the headers copy;
        // the contentType field still carries the exact value.
        expect(req.headers["content-type"]).toBe(rawCT);
        expect(req.contentType).toBe(rawCT);
    });

    it("handles logs without a Content-Type header", () => {
        const logs: TrafficLog[] = [
            mkLog({ id: "a", url: "http://x/plain", requestHeaders: {} }),
        ];
        const [step] = buildTrafficTestSteps(logs);
        const req = reqOf(step);
        expect(req.contentType).toBe("");
        expect(req.requestType).toBe("rest");
        expect(req.fromTraffic).toBe(true);
    });

    it("preserves capture order and marks every step fromTraffic", () => {
        const logs: TrafficLog[] = [
            mkLog({ id: "a", url: "http://x/1", requestHeaders: { "Content-Type": "application/soap+xml; action=\"u:1\"" } }),
            mkLog({ id: "b", url: "http://x/2", requestHeaders: { "Content-Type": "application/soap+xml; action=\"u:2\"" } }),
        ];
        const steps = buildTrafficTestSteps(logs);
        expect(steps.map(s => reqOf(s).endpoint)).toEqual(["http://x/1", "http://x/2"]);
        expect(steps.every(s => reqOf(s).fromTraffic === true)).toBe(true);
        // Distinct step/request ids.
        const stepIds = new Set(steps.map(s => s.id));
        const reqIds = new Set(steps.map(s => reqOf(s).id));
        expect(stepIds.size).toBe(2);
        expect(reqIds.size).toBe(2);
    });

    it("does not mutate the input log headers", () => {
        const headers = { "Content-Type": "text/xml" };
        const logs: TrafficLog[] = [mkLog({ id: "a", requestHeaders: headers })];
        buildTrafficTestSteps(logs);
        expect(Object.keys(headers)).toEqual(["Content-Type"]);
    });
});

describe("buildTrafficTestSteps with chain capture", () => {
    it("emits {{variable}} for tagged values in body, URL and headers, and attaches extractors", () => {
        const logs: TrafficLog[] = [
            mkLog({
                id: "a",
                url: "http://x/login",
                requestHeaders: { "Content-Type": "text/xml" },
                requestBody: "<Login/>",
            }),
            mkLog({
                id: "b",
                url: "http://x/me?token=TKN-999",
                requestHeaders: { Authorization: "Bearer TKN-999" },
                requestBody: "<Call><t>TKN-999</t></Call>",
            }),
        ];
        const steps = buildTrafficTestSteps(logs, {
            valueSubstitutions: [{ value: "TKN-999", variable: "token" }],
            extractors: { a: [{ id: "e1", variable: "token", type: "XPath", source: "body", path: "//Token/text()" }] },
        });
        const ra = reqOf(steps[0]);
        const rb = reqOf(steps[1]);
        // Extractor lands on the SOURCE step only.
        expect(ra.extractors).toEqual([{ id: "e1", variable: "token", type: "XPath", source: "body", path: "//Token/text()" }]);
        expect(rb.extractors).toBeUndefined();
        // The tagged value is a placeholder in the consuming step's URL/headers/body.
        expect(rb.endpoint).toBe("http://x/me?token={{token}}");
        expect(rb.headers.Authorization).toBe("Bearer {{token}}");
        expect(rb.request).toBe("<Call><t>{{token}}</t></Call>");
        // Untagged content stays verbatim.
        expect(ra.request).toBe("<Login/>");
        expect(ra.endpoint).toBe("http://x/login");
    });

    it("substitutes the longest value first so overlapping tokens don't clobber", () => {
        const logs: TrafficLog[] = [
            mkLog({ id: "a", url: "http://x/a", requestHeaders: {}, requestBody: "<v>AB-12345</v><w>AB-1234</w>" }),
        ];
        const steps = buildTrafficTestSteps(logs, {
            valueSubstitutions: [
                { value: "AB-1234", variable: "short" },
                { value: "AB-12345", variable: "long" },
            ],
        });
        expect(reqOf(steps[0]).request).toBe("<v>{{long}}</v><w>{{short}}</w>");
    });

    it("keeps the Content-Type field and header in sync after substitution", () => {
        const logs: TrafficLog[] = [
            mkLog({
                id: "a",
                url: "http://x/a",
                requestHeaders: { "Content-Type": "text/xml; token=TKN-999" },
            }),
        ];
        const steps = buildTrafficTestSteps(logs, {
            valueSubstitutions: [{ value: "TKN-999", variable: "token" }],
        });
        const req = reqOf(steps[0]);
        expect(req.headers["Content-Type"]).toBe("text/xml; token={{token}}");
        expect(req.contentType).toBe("text/xml; token={{token}}");
    });

    it("omits extractors when none are provided for a log", () => {
        const logs: TrafficLog[] = [mkLog({ id: "a", url: "http://x/a" })];
        const steps = buildTrafficTestSteps(logs, { extractors: { b: [] } });
        expect(reqOf(steps[0]).extractors).toBeUndefined();
    });
});
