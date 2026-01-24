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

### Priority 4: Performance Metrics (Feature #10)
Response time tracking and load testing.
- Response time graphs over multiple runs
- Simple load testing (concurrent requests)
- SLA monitoring (visual indicators)
- Export metrics to CSV/JSON
- Historical comparison (charts show multiple runs)

---

## 🔄 In Progress

### Priority 2: Environment Variables UI (Feature #5)
Visual editor for environments (Dev/Test/Prod).

**Completed:**
- Visual editor for environments (Settings → Environments tab)
- Quick environment switcher in toolbar
- Active environment indicator in Settings
- Environment indicator badge in sidebar
- Import/export environments

**Remaining:**
- [ ] Encrypted secrets support

---

## 📋 Not Started

### Priority 3: Request Chaining (Feature #6)
Property transfers between requests for complex test scenarios.

**Planned Capabilities:**
- [ ] Visual workflow builder
- [ ] Variable extraction from responses (XPath, JSONPath)
- [ ] Inject variables into subsequent requests
- [ ] Conditional execution
- [ ] Loop support

---

### Priority 5: OpenAPI/REST Support (Feature #8)
Extend beyond SOAP to REST APIs.

**Planned Capabilities:**
- [ ] Import OpenAPI/Swagger specs
- [ ] REST request editor (JSON body)
- [ ] Auto-generate REST requests from spec
- [ ] Response validation against schema
