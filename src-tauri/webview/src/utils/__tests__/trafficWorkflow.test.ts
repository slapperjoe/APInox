import { describe, it, expect } from "vitest";
import { detectChainedValues, elementNameFor, chainSourceLine, trafficStepName, extractPath, extractSoapAction } from "../trafficWorkflow";
import type { ChainedValue } from "../trafficWorkflow";
import type { TrafficLog } from "../../components/proxy/TrafficViewer";

function mkLog(partial: Partial<TrafficLog> & { id: string }): TrafficLog {
    return { timestamp: 0, method: "POST", url: "http://x", ...partial };
}

describe("trafficStepName", () => {
    it("uses the sidebar line-1 text (method + path + query) for non-SOAP requests", () => {
        expect(trafficStepName(mkLog({ id: "a", method: "GET", url: "http://x/users/profile" })))
            .toBe("GET /users/profile");
    });

    it("appends the SOAP action from the SOAPAction header as the second line", () => {
        const log = mkLog({
            id: "a", method: "POST", url: "http://x/svc/Service1.asmx",
            requestHeaders: { "SOAPAction": '"urn:svc#Login"' },
        });
        expect(trafficStepName(log)).toBe("POST /svc/Service1.asmx Login");
    });

    it("falls back to the first Body child element name when no SOAPAction header is set", () => {
        const log = mkLog({
            id: "a", method: "POST", url: "http://x/svc",
            requestBody: '<soap:Envelope><soap:Body><Login/></soap:Body></soap:Envelope>',
        });
        expect(trafficStepName(log)).toBe("POST /svc Login");
    });

    it("returns the raw URL as the path when it is not parseable", () => {
        expect(trafficStepName(mkLog({ id: "a", method: "POST", url: "not a url" })))
            .toBe("POST not a url");
    });
});

describe("extractPath / extractSoapAction", () => {
    it("extractPath keeps pathname + query and drops the host", () => {
        expect(extractPath("http://x:8080/a/b?c=d")).toBe("/a/b?c=d");
        expect(extractPath("junk")).toBe("junk");
    });

    it("extractSoapAction reads the header (uri-tail) and falls back to the Body child", () => {
        expect(extractSoapAction(mkLog({ id: "a", requestHeaders: { "SOAPAction": '"http://t.org/I/Login"' } })))
            .toBe("Login");
        expect(extractSoapAction(mkLog({ id: "a", requestBody: "<e:Envelope><e:Body><Get/></e:Body></e:Envelope>" })))
            .toBe("Get");
        expect(extractSoapAction(mkLog({ id: "a", requestBody: "<B>plain</B>" })))
            .toBeNull();
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
