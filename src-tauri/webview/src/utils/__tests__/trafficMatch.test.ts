import { describe, it, expect } from "vitest";
import {
    matchTrafficToOperations, matchPathTemplate, deriveRequestName, looksLikeValue,
    actionTail, contentTypeAction, bodyElementName, pathOnly,
} from "../trafficMatch";
import type { TrafficLog } from "../../components/proxy/TrafficViewer";
import type { UnifiedProject } from "@shared/models";

function mkLog(partial: Partial<TrafficLog> & { id: string }): TrafficLog {
    return { timestamp: 0, method: "POST", url: "http://x", ...partial };
}

function mkProject(partial: Partial<UnifiedProject> & { name: string }): UnifiedProject {
    return { parsedAt: new Date(), operations: [], ...partial } as UnifiedProject;
}

const op = (name: string, action = "", displayName?: string) =>
    ({ name, action, displayName, requests: [] });

describe("actionTail", () => {
    it("takes the URI tail and the namespace prefix", () => {
        expect(actionTail('"http://t.org/I/Login"')).toBe("Login");
        expect(actionTail("urn:svc#Login")).toBe("Login");
        expect(actionTail("tns:Login")).toBe("Login");
        expect(actionTail("urn:demo:login")).toBe("login");
        expect(actionTail("")).toBe("");
    });
});

describe("contentTypeAction", () => {
    it("reads the SOAP 1.2 action parameter (no SOAPAction header)", () => {
        const log = mkLog({ id: "a", requestHeaders: { "Content-Type": 'application/soap+xml; charset=utf-8; action="urn:demo:login"' } });
        expect(contentTypeAction(log)).toBe("urn:demo:login");
    });

    it("returns '' for a plain Content-Type", () => {
        expect(contentTypeAction(mkLog({ id: "a", requestHeaders: { "Content-Type": "text/xml; charset=utf-8" } }))).toBe("");
    });
});

describe("bodyElementName", () => {
    it("takes the first element under Body, prefix stripped", () => {
        expect(bodyElementName(mkLog({ id: "a", requestBody: "<e:Envelope><e:Body><GetPrice/></e:Body></e:Envelope>" }))).toBe("GetPrice");
        expect(bodyElementName(mkLog({ id: "a", requestBody: '{"json":true}' }))).toBe("");
    });
});

describe("matchTrafficToOperations", () => {
    it("matches on the SOAPAction header against the operation's action", () => {
        const log = mkLog({
            id: "a", url: "http://svc/Service1.asmx",
            requestHeaders: { "SOAPAction": '"urn:svc#Login"' },
            requestBody: "<e:Envelope><e:Body><Login/></e:Body></e:Envelope>",
        });
        const matches = matchTrafficToOperations(log, [mkProject({ name: "Svc", operations: [op("Login", "urn:svc#Login")] })]);
        expect(matches).toHaveLength(1);
        expect(matches[0].reason).toBe("SOAPAction");
        expect(matches[0].operationName).toBe("Login");
    });

    it("matches a SOAP 1.2 action carried in Content-Type", () => {
        const log = mkLog({
            id: "a", url: "http://svc/",
            requestHeaders: { "Content-Type": 'application/soap+xml; action="urn:demo:login"' },
            requestBody: "<e:Envelope><e:Body><login/></e:Body></e:Envelope>",
        });
        const matches = matchTrafficToOperations(log, [mkProject({ name: "Svc", operations: [op("login", "urn:demo:login")] })]);
        expect(matches[0].reason).toBe("SOAPAction");
    });

    it("falls back to the Body element name on a skeleton (action unknown)", () => {
        const log = mkLog({ id: "a", url: "http://svc/", requestBody: "<e:Envelope><e:Body><GetPrice/></e:Body></e:Envelope>" });
        const matches = matchTrafficToOperations(log, [mkProject({ name: "Svc", operations: [op("GetPrice", "")] })]);
        expect(matches[0].reason).toBe("Body element");
    });

    it("matches REST traffic by the URL's last path segment", () => {
        const log = mkLog({ id: "a", method: "GET", url: "http://api/users/profile" });
        const matches = matchTrafficToOperations(log, [mkProject({ name: "Api", operations: [op("profile")] })]);
        expect(matches[0].reason).toBe("URL path");
    });

    it("scores case-insensitively", () => {
        const log = mkLog({ id: "a", url: "http://svc/", requestBody: "<e:Envelope><e:Body><login/></e:Body></e:Envelope>" });
        const matches = matchTrafficToOperations(log, [mkProject({ name: "Svc", operations: [op("Login")] })]);
        expect(matches).toHaveLength(1);
    });

    it("returns every candidate, strongest first, host as the tie-breaker", () => {
        const log = mkLog({
            id: "a", url: "http://prod/svc",
            requestHeaders: { "SOAPAction": '"urn:svc#Login"' },
            requestBody: "<e:Envelope><e:Body><Login/></e:Body></e:Envelope>",
        });
        const matches = matchTrafficToOperations(log, [
            mkProject({ name: "Dev", sourceUrl: "http://dev/svc", operations: [op("Login", "urn:svc#Login")] }),
            mkProject({ name: "Prod", sourceUrl: "http://prod/svc", operations: [op("Login", "urn:svc#Login")] }),
        ]);
        expect(matches).toHaveLength(2);
        expect(matches[0].projectName).toBe("Prod");
        expect(matches[0].score).toBeGreaterThan(matches[1].score);
    });

    it("skips read-only projects and unmatched operations", () => {
        const log = mkLog({ id: "a", url: "http://svc/", requestBody: "<e:Envelope><e:Body><Login/></e:Body></e:Envelope>" });
        const matches = matchTrafficToOperations(log, [
            mkProject({ name: "RO", readOnly: true, operations: [op("Login")] }),
            mkProject({ name: "Other", operations: [op("Unrelated")] }),
        ]);
        expect(matches).toHaveLength(0);
    });

    it("shows the display name while keeping the stable name for the write", () => {
        const log = mkLog({ id: "a", url: "http://svc/", requestBody: "<e:Envelope><e:Body><Login/></e:Body></e:Envelope>" });
        const matches = matchTrafficToOperations(log, [mkProject({ name: "Svc", displayName: "Production", operations: [op("Login", "", "Auth")] })]);
        expect(matches[0].operationName).toBe("Login");
        expect(matches[0].operationDisplay).toBe("Auth");
        expect(matches[0].projectDisplay).toBe("Production");
    });
});

describe("matchPathTemplate", () => {
    it("takes a single segment per placeholder and requires the literals", () => {
        expect(matchPathTemplate("/orders/{id}", "/orders/123")).toBe(0);
        expect(matchPathTemplate("/orders/{id}/items/{sku}", "/orders/123/items/AB")).toBe(0);
        expect(matchPathTemplate("/orders/{id}", "/orders/123/items")).toBe(null);
        expect(matchPathTemplate("/orders/{id}", "/users/123")).toBe(null);
        expect(matchPathTemplate("/orders/{id}", "/orders/")).toBe(null);
    });

    it("reports the spec base path as extra leading segments", () => {
        // The import stores the template relative to servers[0].url, so a
        // capture to /api/orders/123 carries a segment the template does not.
        expect(matchPathTemplate("/orders/{id}", "/api/orders/123")).toBe(1);
        expect(matchPathTemplate("/orders/{id}", "/v1/api/orders/123")).toBe(2);
        expect(matchPathTemplate("/orders/{id}", "/a/b/c/d/orders/123")).toBe(null);
    });

    it("matches a placeholder inside a segment, not only a whole one", () => {
        expect(matchPathTemplate("/files/{version}.pdf", "/files/2.0.pdf")).toBe(0);
        expect(matchPathTemplate("/files/{version}.pdf", "/files/2.0.docx")).toBe(null);
    });

    it("leaves placeholder-free templates to the operation-name check", () => {
        expect(matchPathTemplate("/orders", "/orders")).toBe(null);
    });

    it("ignores the query", () => {
        expect(pathOnly("http://x/orders/123?expand=customer")).toBe("/orders/123");
    });
});

describe("deriveRequestName", () => {
    const match = {
        projectName: "Api", projectDisplay: "Api",
        operationName: "Orders/get", operationDisplay: "Orders/get",
        score: 55, reason: "Path template",
    };

    it("uses the operation name when the path segment is a captured value", () => {
        expect(deriveRequestName(mkLog({ id: "a", url: "http://api/orders/123" }), match)).toBe("Orders/get");
        expect(deriveRequestName(mkLog({ id: "a", url: "http://api/orders/6f1c2b3a-1111-2222-3333-444455556666" }), match)).toBe("Orders/get");
    });

    it("keeps the traffic row's own text when the segment is a route name", () => {
        expect(deriveRequestName(mkLog({ id: "a", url: "http://api/orders/profile" }), match)).toBe("profile");
        expect(deriveRequestName(mkLog({ id: "a", url: "http://svc/Service1.asmx" }), match)).toBe("Service1.asmx");
    });

    it("recognises values", () => {
        expect(looksLikeValue("123")).toBe(true);
        expect(looksLikeValue("6f1c2b3a-1111-2222-3333-444455556666")).toBe(true);
        expect(looksLikeValue("deadbeefdeadbeef")).toBe(true);
        expect(looksLikeValue("profile")).toBe(false);
        expect(looksLikeValue("Service1.asmx")).toBe(false);
    });
});

describe("matchTrafficToOperations — REST path templates", () => {
    const restOp = (name: string, path: string, method: string) =>
        ({ name, action: "", input: { path, method }, requests: [] });

    it("matches a concrete URL against the stored template", () => {
        const log = mkLog({ id: "a", method: "GET", url: "http://api/orders/123?expand=customer" });
        const matches = matchTrafficToOperations(log, [mkProject({ name: "Api", operations: [restOp("Orders/get", "/orders/{id}", "get")] })]);
        expect(matches[0].reason).toBe("Path template");
    });

    it("does not match the same template under a different method", () => {
        const log = mkLog({ id: "a", method: "DELETE", url: "http://api/orders/123" });
        const matches = matchTrafficToOperations(log, [mkProject({ name: "Api", operations: [restOp("Orders/get", "/orders/{id}", "get")] })]);
        expect(matches).toHaveLength(0);
    });

    it("matches past a spec base path and says so in the reason", () => {
        const log = mkLog({ id: "a", method: "GET", url: "http://api.example.com/v1/orders/123" });
        const matches = matchTrafficToOperations(log, [mkProject({ name: "Api", operations: [restOp("Orders/get", "/orders/{id}", "get")] })]);
        expect(matches[0].reason).toBe("Path template (base path)");
    });

    it("ranks a template match above a bare segment match", () => {
        const log = mkLog({ id: "a", method: "GET", url: "http://api/orders/123" });
        const matches = matchTrafficToOperations(log, [mkProject({
            name: "Api",
            operations: [restOp("orders", "/orders/{id}", "get"), restOp("123", "", "get")],
        })]);
        expect(matches[0].operationName).toBe("orders");
        expect(matches[0].reason).toBe("Path template");
    });
});

describe("skeleton-shaped projects", () => {
    // A skeleton is a name-only tree with empty bodies, but it carries `action`,
    // `path` and `method` — the scalars the scorer needs — so an unopened
    // project still matches without a detail load. That is what keeps a large
    // workspace matchable in one pass instead of one IPC call per project.
    const literalLog = mkLog({
        id: "a", url: "http://svc/Service1.asmx",
        requestHeaders: { "SOAPAction": '"urn:svc#Login"' },
        requestBody: "<e:Envelope><e:Body><SomethingElse/></e:Body></e:Envelope>",
    });

    it("scores a skeleton through its action even when the operation name differs", () => {
        const skeleton = mkProject({
            name: "Svc",
            sourceUrl: "http://svc/Service1.asmx?WSDL",
            operations: [{ name: "Authenticate", action: "urn:svc#Login", requests: [{ name: "sample", request: "" }] }],
        });
        const matches = matchTrafficToOperations(literalLog, [skeleton]);
        expect(matches[0].reason).toBe("SOAPAction");
    });

    it("scores a skeleton through its path template", () => {
        const restLog = mkLog({ id: "b", method: "GET", url: "http://api/orders/123" });
        const skeleton = mkProject({
            name: "Api",
            sourceUrl: "http://api/openapi.json",
            operations: [{ name: "Orders/get", action: "", input: { path: "/orders/{id}", method: "get" }, requests: [{ name: "sample", request: "" }] }],
        });
        const matches = matchTrafficToOperations(restLog, [skeleton]);
        expect(matches[0].reason).toBe("Path template");
    });
});
