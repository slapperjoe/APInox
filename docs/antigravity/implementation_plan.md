# Performance Metrics Testing Feature

A new feature for SLA/performance testing with configurable request sequences, timing analysis, and result visualization.

## Viability Assessment: **HIGH** ✅

**Why this is very achievable:**
- Existing test runner infrastructure (extractors, variable passing) already works
- SoapClient handles request timing via `duration` field
- Settings persistence pattern established for saving configs
- Chart libraries readily available (Chart.js, Recharts)
- Excel export straightforward with xlsx library

**Estimated effort:** Medium-Large (3-4 implementation phases)

---

## Core Concepts

### Performance Suite
A collection of requests to run with timing constraints and SLA thresholds. Similar to TestSuite but focused on metrics.

### Performance Run
An execution of a suite, storing timing results for each request iteration.

---

## Proposed Data Models

```typescript
interface PerformanceSuite {
    id: string;
    name: string;
    requests: PerformanceRequest[];
    iterations: number;           // How many times to run the full sequence
    delayBetweenRequests: number; // ms delay between requests
    warmupRuns: number;           // Runs to discard before measuring
}

interface PerformanceRequest {
    id: string;
    name: string;
    endpoint: string;
    soapAction?: string;
    requestBody: string;
    extractors: Extractor[];      // Reuse existing extractor model
    slaThreshold?: number;        // Expected max response time (ms)
}

interface PerformanceRun {
    id: string;
    suiteId: string;
    suiteName: string;
    startTime: number;
    endTime: number;
    results: PerformanceResult[];
    summary: PerformanceStats;
}

interface PerformanceResult {
    requestId: string;
    requestName: string;
    iteration: number;
    duration: number;             // Response time in ms
    status: number;
    success: boolean;
    slaBreached: boolean;
    extractedValues?: Record<string, string>;
}

interface PerformanceStats {
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    p50: number;                  // Median
    p95: number;                  // 95th percentile
    p99: number;                  // 99th percentile
    slaBreachCount: number;
}
```

---

## UI Components

### New Sidebar Tab: "Performance"
- List of Performance Suites
- Run/Stop buttons
- Quick stats display

### Workspace Panel (when Performance selected)
- **Suite Editor**: Add/edit requests, set delays, iterations, SLAs
- **Results Tab**: Table of run results with sorting/filtering
- **Charts Tab**: Visualizations
  - Response time line chart over iterations
  - Box plot of response time distribution
  - SLA breach bar chart
  - Comparison across requests

### Results Export
- Export to CSV/Excel (.xlsx)
- Export to JSON for programmatic use
- Copy summary to clipboard

---

## Phased Implementation

### Phase 1: Core Infrastructure
- [ ] Add data models to `models.ts`
- [ ] Create `PerformanceService.ts` (backend runner)
- [ ] Add `PerformanceCommands.ts` (command handlers)
- [ ] Basic suite CRUD and persistence

### Phase 2: UI - Suite Management
- [x] Add "Performance" sidebar tab
- [x] Create `PerformanceUi.tsx` sidebar component
- [x] Create `PerformanceSuiteEditor` workspace component
- [x] Request sequencing with drag/drop reorder

### Phase 3: Execution & Results
- [ ] Implement sequential request execution with delays
- [ ] Variable extraction between requests
- [ ] Progress indicator during run
- [ ] Results table with stats calculation

### Phase 4: Export & Visualization
- [x] Add CSS bar chart for visualizations
- [x] CSV export via vscode save dialog
- [ ] Summary report generation (optional)

---

## Technical Notes

### Reuse from Existing Code
- `Extractor` model from test cases
- `SoapClient.sendRequest()` for execution
- `SettingsManager` patterns for persistence
- Sidebar tab switching logic

### New Dependencies Needed
```json
{
  "xlsx": "^0.18.x",           // Excel export
  "chart.js": "^4.x",          // Charts (or recharts)
  "react-chartjs-2": "^5.x"    // React wrapper for Chart.js
}
```

---

## User Decisions

| Question | Decision |
|----------|----------|
| History Retention | **5 runs locally**, older auto-exported as report-only |
| Parallel Requests | **Yes** - Parallel execution + distributed workers |
| Environment Variables | **Reuse existing** environment system |
| Scheduling | **Yes** but lower priority (Phase 6) |

---

## Parallel & Distributed Execution

### Local Parallel Requests
- Configurable concurrency level (e.g., 10 concurrent requests)
- Thread pool pattern using Promise.all with chunking
- Per-request timing still tracked individually

### Distributed Worker Pool (Phase 5 - Advanced)
```
┌─────────────────┐
│  Coordinator    │  (Primary Dirty SOAP instance)
│  • Distributes  │
│  • Aggregates   │
└────────┬────────┘
         │ WebSocket / HTTP
    ┌────┴────┬────────┬────────┐
    ▼         ▼        ▼        ▼
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│Worker│  │Worker│  │Worker│  │Worker│
│ Node │  │ Node │  │ Node │  │ Node │
└──────┘  └──────┘  └──────┘  └──────┘
```

**Coordinator responsibilities:**
- Divide work among connected workers
- Collect and aggregate results
- Calculate combined statistics

**Worker mode:**
- Light mode: Just executes requests, sends results to coordinator
- Connect via WebSocket or HTTP polling

> [!NOTE]  
> Distributed workers is a Phase 5 feature - requires additional infrastructure. Phase 3 focuses on local parallel execution first.

---

## Updated Phases

### Phase 1: Core Infrastructure
- Data models, PerformanceService, basic persistence

### Phase 2: UI - Suite Management  
- Sidebar tab, suite editor, request sequencing

### Phase 3: Execution & Results
- Sequential + **parallel local execution**
- Variable extraction, results table with stats

### Phase 4: Export & Visualization
- Charts, Excel/CSV export, auto-export for runs >5

### Phase 5: Distributed Workers (Future)
- WebSocket coordinator/worker architecture
- Worker discovery and registration
- Cross-machine result aggregation
