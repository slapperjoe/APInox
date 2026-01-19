# Debug Screen Implementation Task List

## Overview
Implement a production-ready debug screen accessible via `Ctrl+Shift+D` for diagnosing issues in Tauri releases where console logging is unavailable. The screen should provide comprehensive health checks, log viewing, and communication flow testing.

---

## Phase 1: Core Debug Screen Infrastructure

### Task 1.1: Create Debug Screen UI Component
- [ ] Create `webview/src/components/DebugScreen.tsx`
- [ ] Design layout with tabbed interface:
  - Health Check tab
  - Logs tab
  - Communication Tests tab
  - System Info tab
- [ ] Style using existing VS Code theme variables
- [ ] Add close button and Escape key handler
- [ ] Make it a modal overlay with semi-transparent backdrop
- [ ] Implement copy-to-clipboard functionality for all sections

### Task 1.2: Keyboard Shortcut Handler
- [ ] Add global keyboard listener in `webview/src/App.tsx`
- [ ] Detect `Ctrl+Shift+D` (or `Cmd+Shift+D` on macOS)
- [ ] Toggle debug screen visibility state
- [ ] Prevent shortcut from triggering when typing in input fields
- [ ] Add shortcut to VS Code keybindings (`package.json` contributes)

### Task 1.3: Extension-Side Debug API
- [ ] Create `src/services/DebugService.ts`
- [ ] Implement message handlers for debug commands:
  - `getHealthStatus`
  - `getExtensionLogs`
  - `testCommunication`
  - `getSystemInfo`

---

## Phase 2: Health Check System

### Task 2.1: Health Check Interface
- [ ] Design health check result structure:
  ```typescript
  interface HealthCheckResult {
    component: string;
    status: 'healthy' | 'warning' | 'error';
    message: string;
    details?: any;
    timestamp: Date;
  }
  ```

### Task 2.2: Extension Host Health Checks
- [ ] Check SOAP client initialization status
- [ ] Verify active webview panel exists
- [ ] Test message passing (echo test)
- [ ] Check workspace folder access
- [ ] Verify configuration loading
- [ ] Test file system permissions

### Task 2.3: Sidecar Health Checks (if applicable)
- [ ] Check if sidecar process is running
- [ ] Verify sidecar port accessibility
- [ ] Test sidecar communication endpoint
- [ ] Check sidecar version compatibility

### Task 2.4: Proxy/Mock Server Health Checks
- [ ] Verify ProxyService status and port
- [ ] Verify MockServerService status and port
- [ ] Check rule loading success
- [ ] Test rule file read/write permissions

### Task 2.5: Health Check UI
- [ ] Display all health checks in a list/table
- [ ] Color-code by status (green/yellow/red)
- [ ] Add "Refresh" button
- [ ] Show last check timestamp
- [ ] Add "Copy All" button for entire health report

---

## Phase 3: Log Viewing System

### Task 3.1: Frontend Log Capture
- [ ] Override `console.log`, `console.warn`, `console.error` in webview
- [ ] Store logs in circular buffer (max 1000 entries)
- [ ] Include timestamp, level, and stack trace for errors
- [ ] Preserve original console functionality

### Task 3.2: Backend Log Capture
- [ ] Create `src/utils/Logger.ts` singleton
- [ ] Replace all `console.log` calls with `Logger.info()`
- [ ] Store logs in memory buffer
- [ ] Add log levels: DEBUG, INFO, WARN, ERROR
- [ ] Include source file/function in log entries

### Task 3.3: Sidecar Log Capture
- [ ] Capture stdout/stderr from sidecar process
- [ ] Store in separate buffer
- [ ] Parse structured logs if sidecar outputs JSON

### Task 3.4: Log Viewer UI
- [ ] Create searchable/filterable log viewer component
- [ ] Filter by:
  - Log level
  - Source (frontend/backend/sidecar)
  - Time range
  - Text search
- [ ] Syntax highlighting for log messages
- [ ] Auto-scroll toggle
- [ ] "Copy Logs" button (filtered results)
- [ ] "Clear Logs" button
- [ ] "Export Logs" button (save to file)

---

## Phase 4: Communication Flow Testing

### Task 4.1: Test Suite Definition
- [ ] Define test scenarios:
  - Extension → Webview message passing
  - Webview → Extension message passing
  - Extension → SOAP endpoint (basic request)
  - Extension → Proxy server communication
  - Extension → Mock server communication
  - Sidecar ↔ Extension communication (if applicable)

### Task 4.2: Test Execution Engine
- [ ] Create `src/diagnostics/CommunicationTester.ts`
- [ ] Implement each test scenario with timeout handling
- [ ] Return structured test results:
  ```typescript
  interface TestResult {
    testName: string;
    passed: boolean;
    duration: number;
    error?: string;
    details?: any;
  }
  ```

### Task 4.3: Test UI
- [ ] Display test buttons in Communication Tests tab
- [ ] Show progress indicator during test execution
- [ ] Display results with pass/fail indicators
- [ ] Show timing information
- [ ] Add "Run All Tests" button
- [ ] Add "Copy Results" button

---

## Phase 5: System Information Display

### Task 5.1: Collect System Info
- [ ] VS Code version
- [ ] Extension version
- [ ] Node.js version
- [ ] Operating system and version
- [ ] Available memory
- [ ] Workspace folder path
- [ ] Active configuration summary
- [ ] Loaded WSDL count
- [ ] Active proxy/mock server status

### Task 5.2: System Info UI
- [ ] Display system info in table format
- [ ] Add "Copy System Info" button
- [ ] Include diagnostic URLs (if any)
- [ ] Show extension storage locations

---

## Phase 6: Error Log Export & Management

### Task 6.1: Export Functionality
- [ ] Create export format (JSON or structured text)
- [ ] Include all logs, health checks, and system info
- [ ] Add timestamp to export filename
- [ ] Trigger download in webview context
- [ ] Save to VS Code workspace or user home directory

### Task 6.2: Copy-Paste Optimization
- [ ] Format logs for easy reading when pasted
- [ ] Include markdown formatting for GitHub issues
- [ ] Add template for bug reports
- [ ] Single-click "Copy Bug Report" that includes:
  - System info
  - Health check results
  - Recent error logs (last 50)
  - Active configuration

---

## Phase 7: Production Safety & Performance

### Task 7.1: Performance Optimization
- [ ] Implement log buffer size limits
- [ ] Use circular buffers to prevent memory leaks
- [ ] Lazy-load debug screen UI (don't render until opened)
- [ ] Debounce log updates in UI

### Task 7.2: Security Considerations
- [ ] Sanitize sensitive data from logs (passwords, tokens)
- [ ] Add warning when copying logs that may contain sensitive info
- [ ] Option to redact specific fields

### Task 7.3: Tauri-Specific Considerations
- [ ] Test in Tauri production build (not just dev mode)
- [ ] Verify shortcut works in Tauri window
- [ ] Ensure log capture works without dev console
- [ ] Test file export in sandboxed Tauri environment

---

## Phase 8: Testing & Documentation

### Task 8.1: Testing
- [ ] Test debug screen in VS Code Extension Host
- [ ] Test debug screen in Tauri production build
- [ ] Verify keyboard shortcut on Windows, macOS, Linux
- [ ] Test with various error scenarios
- [ ] Verify log export functionality
- [ ] Test memory usage with prolonged operation

### Task 8.2: Documentation
- [ ] Add debug screen usage to README.md
- [ ] Document keyboard shortcut
- [ ] Create troubleshooting guide using debug screen
- [ ] Add screenshots to documentation
- [ ] Document log structure for developers

---

## Implementation Notes

### Recommended File Structure
```
src/
├── services/
│   └── DebugService.ts          # Main debug API
├── diagnostics/
│   ├── HealthChecker.ts         # Health check implementations
│   ├── CommunicationTester.ts   # Communication flow tests
│   └── SystemInfoCollector.ts   # System info gathering
└── utils/
    └── Logger.ts                # Centralized logging

webview/src/
├── components/
│   ├── DebugScreen/
│   │   ├── DebugScreen.tsx      # Main debug screen
│   │   ├── HealthCheckTab.tsx   # Health check UI
│   │   ├── LogViewerTab.tsx     # Log viewer UI
│   │   ├── CommTestTab.tsx      # Communication tests UI
│   │   └── SystemInfoTab.tsx    # System info UI
│   └── ...
└── hooks/
    └── useDebugScreen.ts        # Debug screen state management
```

### Key Dependencies
- No additional npm packages required (use built-in APIs)
- Use existing `styled-components` for styling
- Leverage VS Code API for file operations
- Use existing message passing infrastructure

### Priority Features (MVP)
1. Basic debug screen UI with keyboard shortcut
2. Frontend + Backend log viewing
3. Health check for core services
4. Copy-to-clipboard for logs
5. System information display

### Future Enhancements
- Network request inspector (like browser DevTools)
- Performance profiling
- Memory usage visualization
- Remote debugging capability
- Export to GitHub Gist
- Search across all logs with regex support

---

## Acceptance Criteria

- [ ] Debug screen opens/closes with Ctrl+Shift+D
- [ ] All health checks execute and display results
- [ ] Frontend and backend logs are captured and viewable
- [ ] Logs can be filtered and searched
- [ ] Single click to copy all diagnostics to clipboard
- [ ] Works in Tauri production build without console
- [ ] No performance impact when debug screen is closed
- [ ] Sensitive data is sanitized from logs
- [ ] Documentation updated with usage instructions
