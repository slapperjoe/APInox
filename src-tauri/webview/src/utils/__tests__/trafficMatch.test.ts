import { describe, it, expect } from "vitest";
import { matchTrafficToOperations, candidateProjectsForActionMatch, actionTail, contentTypeAction, bodyElementName } from "../trafficMatch";
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

describe("candidateProjectsForActionMatch", () => {
    // A wrapped-style capture names its operation through the Body element, so
    // a skeleton scores it. A style-literal capture does not — its operation is
    // only findable through the action, which a skeleton does not carry.
    const literalLog = mkLog({
        id: "a", url: "http://svc/Service1.asmx",
        requestHeaders: { "SOAPAction": '"urn:svc#Login"' },
        requestBody: "<e:Envelope><e:Body><SomethingElse/></e:Body></e:Envelope>",
    });

    it("includes the project the capture's host points at", () => {
        const candidates = candidateProjectsForActionMatch(literalLog, [
            mkProject({ name: "Svc", sourceUrl: "http://svc/Service1.asmx?WSDL", operations: [op("Authenticate")] }),
            mkProject({ name: "Unrelated", sourceUrl: "http://other/api", operations: [op("Nothing")] }),
        ]);
        expect(candidates.map(p => p.name)).toEqual(["Svc"]);
    });

    it("includes a project already matching by name, even on a different host", () => {
        const bodyLog = mkLog({ id: "b", url: "http://svc/", requestBody: "<e:Envelope><e:Body><GetPrice/></e:Body></e:Envelope>" });
        const candidates = candidateProjectsForActionMatch(bodyLog, [
            mkProject({ name: "Other", sourceUrl: "http://other/api", operations: [op("GetPrice")] }),
        ]);
        expect(candidates.map(p => p.name)).toEqual(["Other"]);
    });

    it("matches on an operation's own endpoint, not just the project source URL", () => {
        const candidates = candidateProjectsForActionMatch(literalLog, [
            mkProject({ name: "Svc", operations: [{ name: "Authenticate", action: "", originalEndpoint: "http://svc/Service1.asmx", requests: [] }] }),
        ]);
        expect(candidates.map(p => p.name)).toEqual(["Svc"]);
    });

    it("skips read-only projects", () => {
        const candidates = candidateProjectsForActionMatch(literalLog, [
            mkProject({ name: "Svc", sourceUrl: "http://svc/", readOnly: true, operations: [op("Authenticate")] }),
        ]);
        expect(candidates).toHaveLength(0);
    });
});
