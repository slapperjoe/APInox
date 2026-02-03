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

**Status**: ✅ **95% COMPLETE** - Phase 1 UI improvements done!

**Phase 1 (Complete - January 2025):**
- [x] Variable extraction from responses (XPath, JSONPath) - PerformanceService
- [x] Inject variables into subsequent requests - PerformanceService
- [x] Conditional execution - ConditionStepEditor component
- [x] Loop support - LoopStepEditor component
- [x] Workflow summary view - WorkflowSummary component
- [x] **VariablesPanel** - Shows available variables with status ✅ NEW
- [x] **Variable autocomplete** - Monaco completion for `${...}` ✅ NEW
- [x] **Enhanced status visualization** - Better TestCaseView icons ✅ NEW

**Phase 2 (Future - Optional Polish):**
- [ ] Variable usage highlighting
- [ ] Inline value preview on hover
- [ ] Test data sets (parameterized testing)
- [ ] Visual drag & drop workflow builder

**Estimated effort for Phase 2**: 3-5 days

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

### CLI + Sidecar Merge
Merge CLI commands into the sidecar to create a single standalone binary.

**Goal**: 
- Single binary works as Tauri sidecar AND CLI
- Distributed testing with zero dependencies
- Docker FROM scratch possible

**Status**: Planned but not started

**Estimated effort**: 6 days (see CLI_SIDECAR_MERGE.md)

---

## 📝 Documentation Tasks

- [ ] Update README with encrypted secrets feature
- [ ] Document custom variables in user guide
- [ ] Add security best practices section
- [ ] Update CHANGELOG for 0.15.0 release
