# Spec: Content-Type is a header, chosen in the Headers tab

Status: current. Supersedes the earlier "Interface-Level SOAP Content-Type Override"
spec (issue `t_da120619`), which added an interface-level override picker and a
"Lock Content-Type to WSDL / interface value" setting. Both are gone: there is now
exactly one place to choose Content-Type.

## 1. The rule

**The `Content-Type` header on the request is the single source of truth, and the
Headers tab is the only place it is chosen.** Whatever the dropdown shows is what
is sent — for SOAP and for REST, and in the test/workflow runner.

There is no lock, no override tier, and no second editable location:

- the toolbar no longer carries a Content-Type control (`RequestTypeSelector`),
- the project/interface Content-Type picker is gone (`UnifiedExplorerMain`),
- the Settings → General "Lock Content-Type to WSDL / interface value" toggle is
  gone (`config.ui.contentTypeLocked`, and its Rust `UiConfig` field).

## 2. The Headers tab row

The row keeps the fixed header name `Content-Type` and a value dropdown:

- standard options: `application/json`, `application/xml`, `text/xml`,
  `text/xml; charset=utf-8`, `application/soap+xml`,
  `application/soap+xml; charset=utf-8`, `text/plain`,
  `application/x-www-form-urlencoded`, `multipart/form-data`;
- **Other…** turns the value into a free-text input (Monaco single-line, so
  `{{env}}` and `${var}` still work).

A stored value outside the standard list — a captured header carrying
`action="urn:..."`, for example — opens the row in Other mode and is preserved
verbatim rather than snapped to the nearest standard option. Content-Type is
filtered out of the editable table below, so a second row named Content-Type
cannot be created.

## 3. Precedence

`resolveEffectiveContentType` (`shared/src/utils/soapUtils.ts`) is the canonical
helper, and it is now header-first:

1. `request.headers["Content-Type"]` (case-insensitive, non-empty).
2. `request.contentType` — the derived mirror, for requests stored before the
   header existed.
3. Action default — `operation.sampleMetadata?.contentType` ??
   `operation.input?.contentType` ?? the operation's sample request `contentType`.
4. `soapDefault(soapVersion)` — `1.1` → `text/xml; charset=utf-8`,
   `1.2` → `application/soap+xml; charset=utf-8`.

No charset is auto-appended; the value is sent exactly as stored.

## 4. The `contentType` field

`ApiRequest.contentType` (and `TestStep.contentType`, `UnifiedProject.contentType`,
`ApiInterface.contentType`) are kept only as a **derived mirror** of the header —
for persistence, editor language, form enctype, badges and sample metadata. They
are backfilled from the header, never the other way round. `UnifiedProject.contentType`
and `ApiInterface.contentType` now only seed the header when a request is created;
they no longer override an existing request.

## 5. Execution

- Classic SOAP: `useRequestExecution.fixContentType` resolves header-first and
  sends that value; it no longer force-overwrites the header from the field.
- Unified SOAP: `UnifiedExplorerMain` sends `resolveEffectiveContentType(req, op, soapVersion)`.
- REST: the Rust HTTP client applies request headers verbatim, so the header is
  what lands on the wire.
- Test runner (`src-tauri/src/testing/frontend_runner.rs`): an explicit
  `Content-Type` header entry overrides the step's field default — consistent with
  the rule above.

## 6. Invariant

Every path that writes Content-Type writes the header, and the mirror is refreshed
from it in the same write. Display sites use `effectiveContentType(request)` so
what the UI shows is what the wire sends.

## 7. Out of scope

- The proxy mock rules page has its own Content-Type select — that is the *response*
  Content-Type the mock replies with, not the request's, and is unaffected.
