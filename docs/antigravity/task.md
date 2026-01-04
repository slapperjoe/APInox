# Performance Metrics Testing - Phase 1: Core Infrastructure

## Data Models ✅
- [x] Add `PerformanceSuite` interface to `src/models.ts`
- [x] Add `PerformanceRequest` interface
- [x] Add `PerformanceRun` interface
- [x] Add `PerformanceResult` and `PerformanceStats` interfaces
- [x] Add to webview `models.ts` (mirror)

## Backend Service ✅
- [x] Create `src/services/PerformanceService.ts`
- [x] Implement suite CRUD operations
- [x] Implement sequential execution
- [x] Implement parallel execution with concurrency limit
- [x] Calculate statistics (avg, min, max, percentiles)
- [x] Run history management (keep 5, auto-export older)

## Commands ✅
- [x] Create `src/commands/PerformanceCommands.ts`
- [x] Wire up in WebviewController
- [x] Add PerformanceService to SoapPanel

## Interoperability ✅
- [x] Import Test Suite → Performance Suite converter

## Persistence ✅
- [x] Add updatePerformanceSuites to SettingsManager
- [x] Add updatePerformanceHistory to SettingsManager

---

# Phase 2: UI - Suite Management (In Progress)
- [x] Add "Performance" sidebar tab
- [x] Create `PerformanceUi.tsx` sidebar component
- [x] Create `PerformanceSuiteEditor` workspace component
- [x] Request sequencing with drag/drop reorder

---

# Phase 3: Execution & Results (In Progress)
- [x] Progress indicator during run
- [x] Results table with stats calculation
- [x] Variable extraction between requests (already in backend)
- [x] Live status updates via message handlers

---

# Phase 4: Export & Visualization (In Progress)
- [x] CSV export for results
- [x] Charts for response time visualization
- [x] Summary report generation (markdown)

---

# Phase 4b: Polish & Advanced Features
- [x] Active suite highlighting in sidebar
- [x] Import requests from workspace explorer
- [ ] Run comparison (compare two runs side-by-side)
- [ ] Implement Script and Property Transfer execution in TestRunner
- [x] Loading spinner during execution
- [x] Project selector dialog for WSDL explorer (+)
- [x] Reset Configuration Command (Hard Reset)

---

# Phase 5: CLI & Distributed Workers (In Progress)

## Phase 5a: CLI Foundation
- [x] Set up CLI with commander.js
- [x] Implement `run-suite` command
- [x] Add JSON/table output formatters
- [ ] Build standalone binary (deferred - pkg bundling issues)

## Phase 5b: Worker Mode
- [x] WebSocket client in CLI
- [x] `worker` command with connection
- [x] Result streaming

## Phase 5c: Coordinator Mode
- [x] WebSocket server in extension
- [x] Work distribution algorithm
- [x] Headless `coordinator` CLI command

## Phase 5d: AI/Agent Polish
- [x] Machine-parseable JSON output
- [x] `--quiet` mode (already implemented)
- [x] CLI documentation for LLMs

---

# Phase 6: Scheduling (In Progress)
- [x] Add schedule data model (cron expression, enabled, lastRun)
- [x] Create ScheduleService for managing scheduled runs
- [ ] Add schedule CLI command
- [x] UI: Schedule button in Performance tab
- [x] UI: List scheduled runs with enable/disable
- [x] Background scheduler using node-cron

---

# Phase 7: Backport & Polish
- [x] Reorganize tests into dedicated folder
- [x] Drag-drop reordering → Mock rules (ServerTab)
- [x] Export to CSV → Watcher events
- [x] WSDL URL history dropdown with public SOAP services
- [x] Response time charts → Performance history
- [x] Unit tests for frontend/backend state sync



