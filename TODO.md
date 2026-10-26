# Feature Backlog

This document tracks planned features for APInox, ordered by priority.

**Last Updated**: 2026-10-26

---

## 📋 Remaining Work

### OpenAPI/REST — Response Validation
- [x] Response validation against the stored OpenAPI schema — the import now keeps the resolved response schema per request, and `src-tauri/src/parsers/schema_validator.rs` checks the subset OpenAPI response schemas actually use (type, nullable, enum, required, properties, items). Findings show in the response pane.
- [ ] Keywords the subset validator does not read (minLength, oneOf, format, …) are skipped rather than judged
- [ ] A non-JSON response body is skipped, not judged
- [ ] Validation is reported, not enforced — a violation does not fail a test step

### Request Chaining — Optional Enhancements
- [ ] Test data sets (parameterized testing with CSV/JSON input)

### Traffic → Operation Matching
Right-click a capture and add it to the unified-explorer operation its WSDL matches, with multiple matches offered as submenu options (`src-tauri/webview/src/utils/trafficMatch.ts`). Shipped: SOAPAction (header, or the `action=` Content-Type parameter for SOAP 1.2), the first element under `<Body>`, the URL path, host as the tie-breaker, and the skeleton upgrade kicked for candidate projects so the content-based signals can fire.

- [x] REST path templates — a concrete URL (`/orders/123`) is now matched segment-wise against the stored OpenAPI template (`/orders/{id}`), with the method as part of the match
- [x] Loading feedback — the menu line carries `checking WSDLs` while candidate projects are still upgrading, so a match appearing under the cursor is not silent
- [x] The 12-match cap — the menu still caps at 12, but the picker dialog now takes the full ranked list, opens on the top match and shows which signal ranked each operation
- [ ] Templates still only score projects already opened — a skeleton carries neither `action` nor `input`, so the upgrade kick has to guess candidates from the host, and a capture whose project is only findable through its template is missed until the host matches

---

## ✅ Completed Features

### Mock Server
Return canned responses for operations — define per-operation mocks, match by URL/XPath/regex, latency simulation, passthrough for unmatched requests.

### Environment Variables
Visual editor for Dev/Test/Prod environments; quick switcher; AES-256-GCM encrypted secrets; `{{variable}}` resolution in requests; import/export.

### Performance Metrics
Response time graphs, load testing (concurrent requests), SLA indicators, CSV/JSON export, historical comparison.

### Request Chaining / Workflows
Variable extraction (XPath, JSONPath, Regex), header extractors (case-insensitive header lookup), inject into subsequent requests, conditional execution, loops, workflow summary view, variable autocomplete, drag & drop workflow builder. All four types are dispatched by one shared rule (shared/src/utils/extractValue.ts) so the webview runner, the Rust test runner and the performance runner agree; JSONPath and Regex were selectable in the UI but executed as XPath until this was fixed.

### OpenAPI/REST Support
REST + GraphQL request editor; OpenAPI/Swagger import with auto-generated requests; query/path params; REST auth (Basic, Bearer, API Key).

### Standalone Desktop Build (Tauri)
Single native Rust/Tauri binary — no separate backend process, zero runtime dependencies, cross-platform (Windows/macOS/Linux).
