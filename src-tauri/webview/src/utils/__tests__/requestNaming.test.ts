import { describe, it, expect } from "vitest";
import {
  resolveDisplayRequestTitle,
  soapBodyElementName,
  soapActionName,
  endpointName,
  GENERIC_REQUEST_NAME,
} from "../requestNaming";

describe("resolveDisplayRequestTitle — the name fallback chain", () => {
  it("a real stored name always wins", () => {
    expect(
      resolveDisplayRequestTitle({
        name: "My Smoke Test",
        operationName: "GetCityInfo",
        requestBody: "<soap:Envelope><soap:Body><Other/></soap:Body></soap:Envelope>",
      })
    ).toBe("My Smoke Test");
  });

  it("the 'Request' placeholder is NOT a name — falls through to the operation", () => {
    expect(
      resolveDisplayRequestTitle({ name: "Request", operationName: "FamilyName" })
    ).toBe("FamilyName");
    expect(
      resolveDisplayRequestTitle({ name: "   ", operationName: "FamilyName" })
    ).toBe("FamilyName");
  });

  it("no name/operation: takes the SOAPAction header", () => {
    expect(
      resolveDisplayRequestTitle({
        name: GENERIC_REQUEST_NAME,
        headers: { SOAPAction: '"urn:GetCityInfo"' },
      })
    ).toBe("GetCityInfo");
  });

  it("no SOAPAction: takes the envelope's body element", () => {
    expect(
      resolveDisplayRequestTitle({
        requestBody:
          "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">" +
          "<soap:Body><FamilyName><something>1</something></FamilyName></soap:Body></soap:Envelope>",
      })
    ).toBe("FamilyName");
  });

  it("bare (non-envelope) XML: takes the root element", () => {
    expect(resolveDisplayRequestTitle({ requestBody: "<GetPopulationOfCity><code>GB</code></GetPopulationOfCity>" })).toBe(
      "GetPopulationOfCity"
    );
  });

  it("no XML at all: takes the endpoint noun", () => {
    expect(
      resolveDisplayRequestTitle({ endpoint: "https://api.example.com/v2/orders/123" })
    ).toBe("orders");
  });

  it("'Request' is the absolute last resort", () => {
    expect(resolveDisplayRequestTitle({})).toBe("Request");
  });
});

describe("soapBodyElementName", () => {
  it("ignores leading comments/PIs", () => {
    expect(
      soapBodyElementName(
        "<?xml version=\"1.0\"?><!-- c --><soapenv:Envelope><soapenv:Header/><soapenv:Body>  <!--x--><DoIt/></soapenv:Body></soapenv:Envelope>"
      )
    ).toBe("DoIt");
  });
  it("self-closing body child", () => {
    expect(soapBodyElementName("<Envelope><Body><Ping/></Body></Envelope>")).toBe("Ping");
  });
  it("empty body / no envelope yields null", () => {
    expect(soapBodyElementName("<Envelope><Body>   </Body></Envelope>")).toBeNull();
    expect(soapBodyElementName("")).toBeNull();
    expect(soapBodyElementName("{ not xml at all }")).toBeNull();
  });
});

describe("soapActionName", () => {
  it("is header-key case-insensitive and strips quotes + URI prefix", () => {
    expect(soapActionName({ soapaction: "\"http://tempuri.org/#Lookup\"" })).toBe("Lookup");
    expect(soapActionName({ SoapAction: "tempuri/Query" })).toBe("Query");
  });
  it("empty SOAPAction (legal SOAP 1.2) is null", () => {
    expect(soapActionName({ SOAPAction: '""' })).toBeNull();
    expect(soapActionName(undefined)).toBeNull();
  });
});

describe("endpointName", () => {
  it("strips query, trailing ids and extensions", () => {
    expect(endpointName("http://x/websamples.countryinfo/CountryInfoService.wso?WSDL")).toBe(
      "CountryInfoService"
    );
    expect(endpointName("https://a/b/items/f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe("items");
  });
  it("null when nothing usable remains", () => {
    expect(endpointName("https://example.com")).toBeNull();
    expect(endpointName(undefined)).toBeNull();
  });
});
