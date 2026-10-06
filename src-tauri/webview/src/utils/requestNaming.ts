/**
 * requestNaming — one display-name resolution chain shared by every surface
 * that labels a request without a meaningful stored name (History rows,
 * Favorites rows, Quick Requests rows).
 *
 * A blank quick request is stored under the placeholder name "Request", and
 * history entries inherit it — so every list that shows "Request" on several
 * rows becomes useless. Instead of the placeholder, take the most specific
 * identity the request itself carries:
 *
 *   1. the real name (anything that isn't the placeholder)
 *   2. the owning WSDL operation name (project requests)
 *   3. the SOAPAction header (e.g. `"urn:GetCityInfo"` → GetCityInfo)
 *   4. the SOAP envelope's body element (the `<FamilyName>` inside `<Body>` —
 *      works even when no SOAPAction was sent)
 *   5. the last endpoint path segment (REST quick requests, e.g.
 *      `https://x/api/v2/orders/123` → `orders`)
 *   6. 'Request' as the absolute last resort
 *
 * Display-only: this NEVER rewrites stored names — old history entries pick
 * up better labels the same way new ones do.
 */

/** The placeholder name a blank quick request gets (and history inherits). */
export const GENERIC_REQUEST_NAME = "Request";

/** True when `name` carries no information (empty or the generic placeholder). */
const meaningful = (name?: string | null): string | null => {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === GENERIC_REQUEST_NAME) return null;
  return trimmed;
};

/** `soap:FamilyName` → `FamilyName`. */
const stripNamespace = (tag: string): string => {
  const i = tag.indexOf(":");
  return i >= 0 ? tag.slice(i + 1) : tag;
};

/**
 * The first element inside the envelope's <Body> (namespace-agnostic). That
 * element IS the operation for document-literal SOAP (the WSDL generates
 * `<soap:Body><FamilyName>…` for FamilyName). Falls back to the document
 * root element when the body isn't an envelope (a bare `<GetCityInfo/>`
 * payload). Returns null when there's nothing parseable.
 */
export function soapBodyElementName(xml?: string | null): string | null {
  if (!xml) return null;
  const cleaned = xml.replace(/<!--[\s\S]*?-->/g, "");
  // <Body>…</Body> (any namespace prefix) — prefer its first child element.
  const body = /<(?:[A-Za-z_][\w.-]*:)?Body\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?Body>/i.exec(cleaned);
  const haystack = body ? body[1] : cleaned;
  const el = /<([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)[\s/>]/.exec(haystack);
  if (!el) return null;
  const name = stripNamespace(el[1]);
  // The envelope parts themselves carry no operation information.
  if (!name || /^(Envelope|Header|Body)$/i.test(name)) {
    return body ? null : name || null;
  }
  return name;
}

/**
 * The SOAPAction header's operation name: strips quotes and any URI prefix
 * (`"urn:oasis:…#GetCityInfo"` / `"http://x/GetCityInfo"` → `GetCityInfo`).
 */
export function soapActionName(headers?: Record<string, string> | null): string | null {
  if (!headers) return null;
  const entry = Object.entries(headers).find(([k]) => k.toLowerCase() === "soapaction");
  const value = entry?.[1] ?? "";
  const valueClean = value.replace(/["']/g, "").trim();
  if (!valueClean) return null;
  const last = valueClean.split(/[#/]/).pop() ?? "";
  // Strip a URN scheme prefix too: "urn:GetCityInfo" → GetCityInfo.
  const ci = last.lastIndexOf(":");
  return (ci >= 0 ? last.slice(ci + 1) : last) || null;
}

/**
 * The most specific path segment of an endpoint URL: strips the query/hash,
 * trailing numeric/UUID segments and file extensions so
 * `…/api/v2/orders/123` → `orders` and `CountryInfoService.wso` →
 * `CountryInfoService`. Null when nothing usable remains.
 */
export function endpointName(endpoint?: string | null): string | null {
  if (!endpoint) return null;
  let path: string;
  try {
    path = new URL(endpoint).pathname;
  } catch {
    path = endpoint.split(/[?#]/)[0];
  }
  const segments = path.split("/").filter(Boolean);
  // Drop trailing dynamic-resource ids (numbers, UUIDs) to reach the noun.
  while (segments.length && /^(\d+|[0-9a-fA-F-]{32,36})$/.test(segments[segments.length - 1])) {
    segments.pop();
  }
  const last = segments[segments.length - 1];
  if (!last) return null;
  const stem = last.replace(/\.[^.]+$/, ""); // strip .xml/.wso/.asmx/…
  return stem || null;
}

export interface RequestNamingFields {
  /** Stored request name (the placeholder "Request" is treated as absent). */
  name?: string | null;
  /** Owning WSDL operation (project requests only). */
  operationName?: string | null;
  /** Request headers — scanned for SOAPAction. */
  headers?: Record<string, string> | null;
  /** The request body XML — scanned for the envelope's body element. */
  requestBody?: string | null;
  /** Request URL — last-resort structural name. */
  endpoint?: string | null;
}

/**
 * Resolve the best display name for a request. See the chain at the top of
 * this file. Never returns empty — falls back to 'Request'.
 */
export function resolveDisplayRequestTitle(fields: RequestNamingFields): string {
  return (
    meaningful(fields.name) ??
    meaningful(fields.operationName) ??
    soapActionName(fields.headers) ??
    soapBodyElementName(fields.requestBody) ??
    endpointName(fields.endpoint) ??
    GENERIC_REQUEST_NAME
  );
}
