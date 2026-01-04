# Dirty Soap - Performance Suite Documentation

## 1. Overview & Goals
The **Performance Suite** is a load-testing and performance benchmarking tool integrated directly into Dirty Soap. It allows developers to validate the stability, throughput, and latency of their SOAP services without leaving VS Code.

**Primary Goals:**
- **Ease of Use:** Drag-and-drop or import requests directly from the workspace.
- **Configurable Load:** Support for different load profiles (Constant, Ramping) to simulate real-world traffic.
- **Real-time Feedback:** Live visualization of response times, throughput (RPS), and error rates.
- **Historical Tracking:** Persist run history to track performance regressions over time.
- **CI/CD Integration:** Headless execution via CLI for automated pipelines.

## 2. Architecture

### 2.1 Backend (Extension Host)
- **`PerformanceService.ts`**: The orchestration layer. It manages the collection of `PerformanceSuite` objects, handles persistence (saving/loading from `config.jsonc`), and acts as the bridge between the UI and the Runner.
- **`PerformanceRunner.ts`**: The execution engine.
  - **Loop Loop**: Manages the main execution loop based on duration or iteration count.
  - **Concurrency Control**: Manages a pool of "Virtual Users" (workers) to execute requests in parallel.
  - **Stats Calculation**: Aggregates latency (min, max, avg, p95, p99), throughput, and error rates in real-time.
  - **Throttling**: Respects `rampUp` periods to gradually increase load.

### 2.2 Frontend (Webview)
- **`PerformanceSuiteEditor.tsx`**: The main configuration UI.
  - Allows editing Suite Name, Description, and Load Profile (Virtual Users, Duration, Strategy).
  - Displays the list of requests included in the suite.
  - Provides the "Run" control and real-time progress bar.
- **`PerformanceResultsPanel.tsx`**: The visualization layer.
  - **Summary Cards**: Total Requests, RPS, Avg Response Time, Error Rate.
  - **Response Time Chart**: SVG-based line chart showing Avg, P95, and P99 trends over the last 10 runs.
  - **Detailed Table**: Per-request metrics (Min/Max/Avg/Failures).
  - **Export**: Options to export results as CSV or Markdown reports.
- **`ImportRequestsModal.tsx`**: A modal dialog to bulk-import requests from the Project/WSDL explorer into a suite.

### 2.3 Data Models
- **`PerformanceSuite`**: A container for tests. Includes `id`, `name`, `loadProfile`, and a list of `PerformanceRequest` items.
- **`LoadProfile`**: Defines execution parameters:
  - `virtualUsers`: Number of concurrent connections.
  - `durationSeconds`: How long to run.
  - `strategy`: 'constant' | 'ramping'.
- **`PerformanceRun`**: A record of a single execution. Includes timestamp, `status` (pass/fail), and `PerformanceStats`.
- **`PerformanceStats`**: Aggregated metrics (total requests, failures, bytes, timing breakdown).

## 3. Workflow (How it Works)

1.  **Creation**: User creates a new Performance Suite in the sidebar.
2.  **Configuration**:
    - User selects a **Load Profile** (e.g., 5 Users, 60 Seconds, Constant Load).
    - User **Imports Requests** from their standard SOAP projects.
3.  **Execution**:
    - User clicks **Run**.
    - The `PerformanceService` instantiates a `PerformanceRunner`.
    - The Runner spawns 5 loops (Virtual Users).
    - Each user repeatedly executes the requests in the suite in sequence or random order (currently sequence).
4.  **Monitoring**:
    - The UI receives `performanceProgress` events every ~100ms.
    - Live charts update with current RPS and Response Time.
5.  **Completion**:
    - When `duration` expires, the Runner gracefully stops.
    - A final `PerformanceRun` report is generated and saved to history.
    - User allows **Exporting** the report for documentation.

## 4. Development Log & Key Decisions

The following summarizes the recent development history regarding the Performance Suite.

### Phase 1: Core Implementation
- **Objective**: Establish the data structures and basic execution loop.
- **Actions**:
  - Created `PerformanceService` and `PerformanceRunner`.
  - Implemented the basic `Promise.all` based concurrency model.
  - Wired up `App.tsx` config state to persist suites.

### Phase 2: UI & Real-time Feedback
- **Objective**: Make it usable and visible.
- **Actions**:
  - Built `PerformanceSuiteEditor` with form controls for V-Users and Duration.
  - Added "Live Metrics" to the editor during execution (simple text counters).
  - Refined the "Loading Spinner" to specific suite items to avoid global UI locking.

### Phase 3: Charts & History
- **Objective**: Visualization of trends.
- **Actions**:
  - **Decision**: Used custom SVG components for charts instead of a heavy library like Chart.js to keep bundle size low and maintain VS Code aesthetic.
  - Created `ResponseTimeChart.tsx`: Visualizes P95/P99 latency trends.
  - Added `WsdlUrlHistory`: Small polish to remember frequent WSDLs.

### Phase 4: Reporting & Import (Recent Work)
- **Objective**: Data portability and ease of setup.
- **Actions**:
  - **Markdown Reports**: Created `reportGenerator.ts` to build detailed texts reports (tables, failure logs).
  - **CSV Export**: Added functionality to dump raw metrics to CSV.
  - **Workspace Import**: Implemented `ImportRequestsModal` to allow bulk-adding requests from existing WSDL projects, solving the "tedious manual entry" pain point.

### Phase 5: CLI & Headless (Ongoing)
- **Objective**: CI/CD integration.
- **Actions**:
  - Created `src/cli/index.ts` and `coordinator.ts`.
  - **Architecture**: The CLI spins up a standalone instance of `PerformanceService` (decoupled from the VS Code UI) to run suites defined in `config.jsonc`.
  - **Status**: Basic structure exists, currently refining the build process for a standalone binary (`pkg`).

## 5. Current Status

| Feature | Status | Notes |
| os | :--- | :--- |
| **Suite Creation** | ✅ Complete | |
| **Request Execution** | ✅ Complete | Supports SOAP client logic. |
| **Concurrency** | ✅ Complete | Virtual Users supported. |
| **Charts** | ✅ Complete | SVG-based trend lines. |
| **Reporting** | ✅ Complete | CSV & Markdown export. |
| **Workspace Import** | ✅ Complete | Via tree-view modal. |
| **CLI Runner** | 🚧 In Progress | Command architecture defined; packaging pending. |
| **Run Comparison** | ⬜ Planned | Side-by-side diff of two runs. |

## 6. Future Roadmap
1.  **Run Comparison**: UI to select two historical runs and view relative performance changes (e.g., "Latency increased by 15%").
2.  **Scheduling**: Built-in cron scheduler to run tests nightly (CLI support added, UI pending).
3.  **Detailed Failure Analysis**: Better inspection of *why* specific requests failed during a heavy load test.
