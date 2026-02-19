# Feature Backlog

This document tracks planned features for APInox, ordered by priority.

**Last Updated**: 2026-01-24

---

## ✅ Completed Features

### Priority 1: Mock Server (Feature #7)
Return canned responses for operations. Useful for frontend devs or offline testing.
- Define mock responses per operation
- Match incoming requests by URL, XPath, or regex
- Support for static XML responses
- Record & playback mode
- Latency simulation
- UI panel for managing mocks
- Passthrough for unmatched requests

### Priority 2: Environment Variables UI (Feature #5)
Visual editor for environments (Dev/Test/Prod) with encrypted secrets support.
- Visual editor for environments (Settings → Environments tab)
- Quick environment switcher in toolbar
- Active environment indicator in Settings
- Environment indicator badge in sidebar
- Import/export environments
- Custom variable fields
- **Encrypted secrets** (AES-256-GCM):
  - Mark any field as secret with toggle button
  - Eye icon to show/hide masked values
  - Automatic encryption at rest (~/.apinox/secrets.enc)
  - Variable resolution in requests ({{fieldName}})
  - Export redacts secrets as [REDACTED]
  - Import preserves existing secrets

### Priority 4: Performance Metrics (Feature #10)
Response time tracking and load testing.
- Response time graphs over multiple runs
- Simple load testing (concurrent requests)
- SLA monitoring (visual indicators)
- Export metrics to CSV/JSON
- Historical comparison (charts show multiple runs)

### Standalone Binary (Infrastructure)
Create truly standalone sidecar binary with embedded Node.js runtime.
- Replaced axios with native fetch API
- Bundle with esbuild → `bundle.js` (3.7MB)
- Package with pkg → `apinox-sidecar` (46MB)
- Embedded Node.js v18.5.0
- Zero runtime dependencies (users don't need Node.js)
- Cross-platform ready (Windows/Mac/Linux)

---

## 🔄 In Progress

(None - all active features complete!)

---

## 📋 Not Started

### Priority 3: Request Chaining (Feature #6)
Property transfers between requests for complex test scenarios.

**Status**: ✅ **COMPLETE** - All phases finished!

**Phase 1 (Complete):**
- [x] Variable extraction from responses (XPath, JSONPath, Regex)
- [x] Regex extractors for JSON/HTML/plain text
- [x] Inject variables into subsequent requests
- [x] Conditional execution
- [x] Loop support
- [x] Workflow summary view
- [x] VariablesPanel - Shows available variables with status
- [x] Variable autocomplete - Monaco completion for `${...}`
- [x] Enhanced status visualization

**Phase 2 (Complete):**
- [x] Variable usage highlighting
- [x] Enhanced hover tooltips with detailed context
- [x] Documentation with workflow examples
- [x] Integration with wildcard system
- [x] Regex extraction backend (RegexExtractor utility)
- [x] Extractor type dropdown UI (XPath/Regex/JSONPath/Header)
- [x] Common regex pattern library

**Optional Future Enhancements:**
- [ ] JSONPath extractors (JSON responses)
- [ ] Header extractors (HTTP headers)
- [ ] Test data sets (parameterized testing with CSV/JSON)
- [ ] Visual drag & drop workflow builder

**Estimated effort for optional features**: 1-5 days

---

### Priority 5: OpenAPI/REST Support (Feature #8)
Extend beyond SOAP to REST APIs.

**Status**: ✅ **80% COMPLETE** - Core REST/GraphQL working, missing OpenAPI import

**Completed:**
- [x] REST request editor (JSON body) - MonacoRequestEditor with JSON mode
- [x] REST execution with HttpClient
- [x] GraphQL support
- [x] Query params, path params, REST auth (Basic, Bearer, API Key)
- [x] GraphQL variables panel

**Remaining:**
- [ ] Import OpenAPI/Swagger specs
- [ ] Auto-generate REST requests from spec
- [ ] Response validation against schema

**Estimated effort**: 3-5 days for OpenAPI import

---

## 🚧 Infrastructure Backlog

### CLI + Sidecar → APIprox (COMPLETED)
CLI functionality has been split into a separate project: **[APIprox](https://github.com/yourusername/apiprox)**

**APIprox provides**:
- CLI commands for distributed testing
- Coordinator/Worker architecture  
- HTTP/HTTPS proxy with traffic interception
- Mock server functionality
- Standalone binary with zero dependencies

**APInox focus**: Desktop UI for SOAP testing only

### Future: Migrate Sidecar to Rust
Consider migrating Node.js sidecar backend logic into Tauri Rust commands for single-binary distribution.

**Benefits**:
- Single executable (no separate sidecar process)
- Better performance
- Smaller distribution size
- Simpler deployment

**Estimated effort**: 8-10 days

---

## 📝 Documentation Tasks

- [x] Update README with encrypted secrets feature
- [x] Document custom variables in user guide
- [x] Add security best practices section
- [x] Update CHANGELOG for 0.15.0 release
