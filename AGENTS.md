# APInox - Agent Context

## Project Overview
This is a **Tauri Desktop Application** (with legacy VS Code Extension support) for exploring SOAP Web Services (WSDL). It mimics the UI/UX of tools like Bruno or Postman but for SOAP.

## Architecture

**PRIMARY PLATFORM**: Tauri standalone desktop application
**LEGACY SUPPORT**: VS Code extension (backward compatibility only)

The project has two deployment modes:
1. **Tauri App** (Primary): Standalone desktop application using Tauri + React
2. **VS Code Extension** (Legacy): VSIX extension for VS Code

### Tauri Application Architecture (PRIMARY)

```
┌─────────────────────────────────────────────────────────┐
│                   Tauri Desktop App                      │
├─────────────────────────────────────────────────────────┤
│  React Webview (src-tauri/webview/)                     │
│  - UI Components (React + styled-components)            │
│  - State Management (React hooks)                        │
│  - Bridge Communication (postMessage)                    │
├─────────────────────────────────────────────────────────┤
│  Sidecar Process (sidecar/)                             │
│  - Node.js Backend (TypeScript)                          │
│  - SOAP Client (node-soap)                               │
│  - HTTP/HTTPS Proxy & Mock Servers                       │
│  - File I/O & Project Storage                            │
│  - Command Router (bridge message handler)               │
├─────────────────────────────────────────────────────────┤
│  Tauri Core (src-tauri/)                                │
│  - Rust + Tauri Framework                                │
│  - Window Management                                     │
│  - File System Access                                    │
│  - Cross-platform native features                        │
└─────────────────────────────────────────────────────────┘
```

### Communication Architecture

**Webview ←→ Sidecar** (Primary communication path):
- **Direction**: Bidirectional message passing
- **Protocol**: JSON messages via bridge
- **Implementation**: 
  - Frontend: `bridge.sendMessage({ command, ...data })`
  - Backend: `sidecar/src/router.ts` command handlers
- **Pattern**: Request/Response + Event Streaming

**Key Difference from VS Code Extension**:
- No extension host process
- Direct file I/O via sidecar (no need for VS Code file APIs)
- Local-first persistence (save directly to disk)
- No backend commands needed for simple state updates

### 1. Sidecar Backend (`sidecar/`)
-   **Runtime**: Node.js (bundled as standalone binary)
-   **Key Libraries**: `soap` (node-soap), `axios`
-   **Responsibilities**:
    -   Parsing WSDLs (`SoapClient.ts`).
    -   Executing HTTP/SOAP Requests.
    -   Running Proxy & Mock Servers.
    -   File I/O (project storage, config management).
    -   Logging to console (captured by Tauri).
    -   Command routing (`router.ts`).

### 2. React Webview (`src-tauri/webview/`)
-   **Runtime**: Browser (Chromium) within Tauri window
-   **Framework**: React + Vite
-   **Styling**: `styled-components` + CSS Variables
-   **State Management**: React hooks + local state
-   **Communication**: `bridge.sendMessage()` ←→ sidecar command handlers

### 3. Tauri Core (`src-tauri/`)
-   **Runtime**: Rust
-   **Framework**: Tauri v2
-   **Responsibilities**:
    -   Window management
    -   Native file dialogs
    -   Sidecar process lifecycle
    -   Cross-platform packaging

## Key Files & Logic

-   **`sidecar/src/SoapClient.ts`** (Sidecar backend):
    -   `parseWsdl(url)`: Parses WSDL using `soap.createClientAsync`. **CRITICAL**: Extracts `targetNamespace` from `client.wsdl.definitions.targetNamespace` (or `$targetNamespace`) to pass to the UI.
    -   `executeRequest(...)`:
        -   If `args` is an XML string, delegates to `executeRawRequest`.
    -   `executeRawRequest(...)`:
        -   Manually finds endpoint/SOAPAction from `client.wsdl.definitions`.
        -   Uses **Axios** to send the raw XML POST request (bypassing `node-soap`'s object generation which can filter out custom XML).

-   **`src-tauri/webview/src/components/RequestEditor.tsx`**:
    -   Generates default XML based on `operation.input`.
    -   **Important**: Uses a recursive helper `generateXmlBody` to create XML tags based on the input schema, instead of `JSON.stringify`.
    -   **Revert Logic**: Resets state to the memoized `defaultXml`.

-   **`sidecar/src/router.ts`** (Command routing):
    -   Central message handler for all frontend commands
    -   Maps `FrontendCommand` enum to handler functions
    -   Coordinates service calls and returns responses
    -   Handles streaming responses for long-running operations

## Data Flow (Tauri Application)

1.  **Load WSDL**: User enters URL → Webview sends `loadWsdl` via bridge → Sidecar parses → Sidecar sends `wsdlParsed` with Services/Operations → Webview updates Sidebar.
2.  **Select Operation**: Webview generates default XML locally using `targetNamespace` from the parsed model.
3.  **Execute**: User clicks Run → Webview sends `executeRequest` with **edited XML** → Sidecar uses `axios` to POST → Sidecar sends `response` → Webview displays in `ResponseViewer`.
4.  **Save Project**: User makes changes → Webview updates local state → Webview calls `saveProject()` → Saves directly to disk via `FolderProjectStorage`.

## Architecture Patterns

### Local-First Persistence
- **Frontend manages state**: Projects, test cases, workflows stored in React state
- **Immediate saves**: Changes trigger `saveProject()` which writes to disk
- **No backend commands needed**: Simple updates don't go through sidecar
- **Example**: Updating test step config saves locally, no `updateTestStep` command

### When to Use Backend Commands
✅ **Use sidecar commands for**:
- WSDL parsing (requires node-soap)
- HTTP/SOAP requests (avoids CORS)
- Proxy/Mock server operations (needs Node.js HTTP server)
- File watching (OS-level notifications)
- Heavy computation

❌ **Don't use sidecar commands for**:
- Simple state updates (workflow step config changes)
- UI state persistence (layout mode, panel sizes)
- Local project modifications (use direct file saves)

### Command Streaming Pattern
For long-running operations (test suites, performance tests):
```typescript
// Frontend requests with streaming flag
bridge.sendMessage({ command: 'runTestCase', testCase, stream: true });

// Backend creates run ID and updates array
const runId = `run-${Date.now()}`;
testRunStore.set(runId, { updates: [], done: false });

// Frontend polls for updates
bridge.sendMessage({ command: 'getTestRunUpdates', runId, fromIndex: 0 });
```

## Known Quirks / Decisions

1.  **Raw XML Execution**: We allow users to edit the request body freely. To support this, we bypass `node-soap`'s method calling (which expects JS Objects) and use `axios` to send the raw XML string. This ensures 100% fidelity to what the user sees/edits.
2.  **Tauri Window Management**: Single window application, uses overlays/modals instead of multiple windows.
3.  **Namespace Issues**: WSDL parsers can sometimes bury the namespace. We specifically look for `$targetNamespace` in `soapClient.ts` as a fallback.
4.  **Sidecar Binary**: Node.js backend is bundled into standalone binary using `pkg`, launched as Tauri sidecar process.

## Dirty Proxy

The Dirty Proxy intercepts HTTP/HTTPS traffic for debugging and testing.

### Key Files
-   **`src/services/ProxyService.ts`**: HTTP/HTTPS proxy server using `http.createServer` + `axios` for forwarding.
-   **`src/utils/ReplaceRuleApplier.ts`**: Applies XPath-scoped text replacement to request/response XML.

### Replace Rules

Rules are stored in `~/.apinox/config.jsonc` under `replaceRules`:

```jsonc
{
  "replaceRules": [
    {
      "id": "uuid",
      "name": "Mask SSN",
      "xpath": "//Customer/SSN",
      "matchText": "\\d{3}-\\d{2}-\\d{4}",
      "replaceWith": "XXX-XX-XXXX",
      "target": "response",  // "request" | "response" | "both"
      "enabled": true,
      "isRegex": true
    }
  ]
}
```

**How it works:**
1. Rules synced to `ProxyService` on config load/save.
2. Before forwarding request → applies rules with `target = "request"` or `"both"`.
3. Before forwarding response → applies rules with `target = "response"` or `"both"`.
4. XPath-scoped: Only replaces text within elements matching the XPath's target element name.

## Mock Server

The Mock Server returns predefined responses without hitting the real backend.

### Key Files
-   **`src/services/MockServerService.ts`**: HTTP server that matches requests against mock rules.
-   **`src/commands/MockCommands.ts`**: Command handlers for start/stop and rule management.

### Mock Rules

Rules are stored in `~/.apinox/mock-rules.jsonc`:

```jsonc
[
  {
    "id": "uuid",
    "name": "GetUser Success",
    "enabled": true,
    "conditions": [
      { "type": "url", "pattern": "/api/user", "isRegex": false }
    ],
    "statusCode": 200,
    "responseBody": "<Response>...</Response>",
    "delayMs": 100
  }
]
```

**Matching**:
- `url`: Match against request URL path
- `xpath`: Match against request body XML content
- `regex`: Advanced pattern matching

**Unified Server Tab**:
The webview provides a unified `Server` tab with mode toggle (Off, Mock, Proxy, Both).

## Setup Instructions (Tauri Application)

If you are an agent or developer setting this up from scratch:

1.  **Install Dependencies**:
    ```bash
    npm install
    cd sidecar && npm install && cd ..
    cd src-tauri/webview && npm install && cd ../..
    ```

2.  **Build Sidecar Binary**:
    The sidecar must be built and bundled before Tauri can launch it.
    ```bash
    npm run prepare:sidecar
    ```

3.  **Run Tauri Application**:
    ```bash
    npm run tauri:dev
    ```

4.  **Build for Production**:
    ```bash
    npm run tauri:build
    ```
    Output: Installers in `src-tauri/target/release/bundle/`

5.  **Verification**:
    -   Launch the application
    -   Create or open a project
    -   Load a WSDL (e.g. `http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL`).
    -   Select an operation and click **Run**.

## Storage Classes

The extension has two storage mechanisms for projects:

| Class | Format | Use Case |
|-------|--------|----------|
| `ProjectStorage` | Single XML file (SOAP-UI compatible) | Import/export for compatibility with SOAP-UI |
| `FolderProjectStorage` | Folder structure with JSON/XML files | Native format, git-friendly, human-readable |

**FolderProjectStorage** is the primary format. Projects saved with this format have the structure:
```
MyProject/
├── properties.json        # Project metadata
├── interfaces/
│   └── MyService/
│       ├── interface.json # Binding info
│       └── MyOperation/
│           ├── operation.json
│           ├── Request1.xml   # Request body
│           └── Request1.json  # Request metadata
└── tests/
    └── MySuite/
        └── MyTestCase/
            └── 01_step.json
```

## Known Technical Debt

See [CODE_ANALYSIS.md](./CODE_ANALYSIS.md) for a detailed analysis of simplification opportunities.
