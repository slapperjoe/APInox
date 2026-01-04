# Performance Suite - Code Review & Gap Analysis

## Executive Summary
The current Performance Suite implementation is functional as a **High-Concurrency Request Looper** but differs significantly from a full **Functional Test Runner**. The "read-only/invisible" state of requests reported by the user is a confirmed bug caused by a property mismatch in the data models.

## 1. Request Handling Implementation
**Current State:**
Requests in the Performance Suite are **Snapshots**, not **Links**.
- When you import a request, the system copies its current state (Body, Headers, Endpoint) into a new `PerformanceRequest` object.
- **Why?** This prevents changes in the main project (which might be experimental) from breaking stable load tests.
- **Consequence:** They appear "cut down" because they are stripped of project metadata (like original WSDL links) to be lightweight for high-concurrency loops.

## 2. Gap Analysis

### 2.1 The "Invisible Request" Issue (Bug)
**Symptom:** Users cannot view the content of a request in the suite (read-only/blank).
**Root Cause:** Data Model Mismatch.
- The default **Request Editor** component expects an object with a `request` property (Text).
- The **Performance Suite** stores the body in a `requestBody` property.
- **Result:** When you click a performance request, the editor receives the object, looks for `.request`, finds `undefined`, and typically renders nothing or fails to update.

### 2.2 Missing "Delays and Scripts"
**Symptom:** User expected to import entire Test Cases (including scripts, delays, transfers) but only got Requests.
**Architecture:**
- The current `PerformanceRunner.ts` is designed as a **Request Iterator**. It loops through a list of HTTP/SOAP requests.
- It was **not designed** to execute arbitrary *Test Steps* (like Groovy scripts or Property Transfers) in the high-concurrency loop.
- **Global Delay:** There is a *global* `delayBetweenRequests` setting for the suite, but individual "Delay Steps" from a test case are ignored during import.

### 2.3 Read-Only State
**Symptom:** Requests cannot be edited once imported.
**Cause:** The `PerformanceSuiteEditor` currently has no "Edit Request" modal/view implemented. The `onSelectRequest` handler exists but seemingly connects to a view that doesn't support the data format (as per 2.1).

## 3. Recommendations

### Immediate Fixes
1.  **Fix Visibility:** Update `handleSelectPerformanceRequest` in `App.tsx` to **adapt** the `PerformanceRequest` before setting it as the selected item.
    ```typescript
    // Pseudo-code adapter
    const adaptedReq = {
        ...perfReq,
        request: perfReq.requestBody // Map requestBody to request
    };
    setSelectedRequest(adaptedReq);
    ```
2.  **Enable Editing:** Allow the Request Editor to save changes back to the `PerformanceRequest` (updating `requestBody` instead of `request`).

### Architectural Decisions Required
1.  **Scope of Performance Suite:**
    *   **Option A (Current Path):** Keep it as a "Load Generator" (pure requests). It's faster and simpler for high load (1000+ users).
    *   **Option B (Functional Load):** Refactor to support full `TestStep` execution. This allows Scripts/Delays but significantly increases complexity and CPU overhead per virtual user (running JS sandboxes per request).

## 4. Conclusion
The current "cut down" look is intentional for the "Snapshot" logic, but the **inability to view/edit** them is a defect. The lack of scripts/delays is an architectural choice favoring raw throughput over functional complexity.
