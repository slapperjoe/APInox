# Feature Backlog

This document tracks planned features for APInox, ordered by priority.

**Last Updated**: 2026-04-23

---

## 📋 Remaining Work

### OpenAPI/REST — Response Validation
- [ ] Response validation against OpenAPI schema

### Request Chaining — Optional Enhancements
- [ ] Header extractors (HTTP response headers as variables)
- [ ] Test data sets (parameterized testing with CSV/JSON input)

---

## ✅ Completed Features

### Mock Server
Return canned responses for operations — define per-operation mocks, match by URL/XPath/regex, latency simulation, passthrough for unmatched requests.

### Environment Variables
Visual editor for Dev/Test/Prod environments; qny of thoseuick switcher; AES-256-GCM encrypted secrets; `{{variable}}` resolution in requests; import/export.

### Performance Metrics
Response time graphs, load testing (concurrent requests), SLA indicators, CSV/JSON export, historical comparison.

### Request Chaining / Workflows
Variable extraction (XPath, JSONPath, Regex), inject into subsequent requests, conditional execution, loops, workflow summary view, variable autocomplete, drag & drop workflow builder.

### OpenAPI/REST Support
REST + GraphQL request editor; OpenAPI/Swagger import with auto-generated requests; query/path params; REST auth (Basic, Bearer, API Key).

### Standalone Desktop Build (Tauri)
Single native Rust/Tauri binary — no separate backend process, zero runtime dependencies, cross-platform (Windows/macOS/Linux).
