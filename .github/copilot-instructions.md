# GitHub Copilot Instructions for APInox

## Development Priorities

### 1. Platform: Tauri Desktop Application
**IMPORTANT**: This is a Tauri standalone desktop application, NOT a VS Code extension.

- **Tauri** (`src-tauri/`, Rust + Tauri APIs) is the only platform
- **Sidecar** (`sidecar/`, Node.js + TypeScript) provides backend services
- **Webview** (`src-tauri/webview/`, React + Vite) provides the UI
- No VS Code extension code - legacy references should be ignored
- Use Tauri's cross-platform capabilities and native performance benefits

### 2. Build Considerations: Production AND Debug
**ALWAYS** ensure both production builds and debug builds are considered when making changes.

- Test changes with `npm run tauri:dev` (debug)
- Test changes with `npm run tauri:build` (production)
- Verify webview compilation with `npm run compile-webview`
- Check that production optimizations don't break functionality
- Consider bundle size and performance impacts in production builds
- Verify sidecar builds with `npm run build:sidecar`

### 3. Logging: Use Logger Mechanism
**ALWAYS** send important changes and errors through the logging mechanism, never use `console.log` for production code.

- Use the logger for all important events, state changes, and errors
- In Rust (Tauri): Use `log::info!()`, `log::warn!()`, `log::error!()`, `log::debug!()`
- In Node.js (Sidecar): Use `console.log()` (captured by Tauri), `log:info`, etc.
- In React (Webview): Send messages to sidecar for logging via `bridge.sendMessage({ command: 'log', ... })`
- Include context and relevant data in log messages
- Log errors with stack traces when available
- Use appropriate log levels (debug, info, warn, error)

### 4. Cross-Platform Support: Windows, macOS, Linux
**ALWAYS** remember this application runs on Windows, macOS, and Linux.

- Avoid platform-specific APIs unless absolutely necessary
- Test file paths work on all platforms (use `path` module, not hardcoded separators)
- Use Tauri's cross-platform plugins for system integration
- Handle platform-specific behavior gracefully (e.g., keyboard shortcuts, file dialogs)
- Consider case-sensitive filesystems (Linux/macOS) vs case-insensitive (Windows)
- Use appropriate path separators and line endings
- Test on multiple platforms when possible

### 5. Architecture Pattern: Local-First Persistence
**ALWAYS** use local-first patterns for state persistence in Tauri applications.

- **Frontend manages project state**: React state is the source of truth
- **Direct file saves**: Use `saveProject()` to write directly to disk via sidecar
- **No backend commands for simple updates**: State changes don't need sidecar commands
- **Use backend only when necessary**: WSDL parsing, HTTP requests, proxy/mock servers
- Examples of local-first:
  - Test step configuration changes → update React state → save project file
  - UI preferences → update local state → save via bridge
  - Project modifications → update state → write to disk

## Architecture Guidelines

### Tauri Application Structure
```
Root/
├── src-tauri/              # Tauri Rust application
│   ├── src/
│   │   ├── main.rs         # Tauri entry point
│   │   └── lib.rs          # Shared library code
│   ├── webview/            # React frontend
│   │   ├── src/
│   │   │   ├── components/ # React components
│   │   │   ├── App.tsx     # Main React app
│   │   │   └── main.tsx    # Entry point
│   │   └── vite.config.ts  # Vite build config
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── sidecar/                # Node.js backend (bundled)
│   ├── src/
│   │   ├── router.ts       # Command routing
│   │   ├── services/       # Business logic
│   │   └── index.ts        # Sidecar entry point
│   └── package.json
└── shared/                 # Shared TypeScript models
    └── src/
        └── models.ts       # Type definitions
```

### Communication Architecture
```
React Webview (Frontend)
    ↕ bridge.sendMessage() / window.addEventListener('message')
Sidecar Process (Node.js Backend)
    ↕ File System / Network / OS APIs
```

### Sidecar Backend Structure
```
sidecar/
├── src/
│   ├── router.ts           # Command routing and handlers
│   ├── services/           # Business logic services
│   │   ├── SoapClient.ts   # WSDL parsing & SOAP execution
│   │   ├── ProxyService.ts # HTTP/HTTPS proxy server
│   │   ├── MockServerService.ts # Mock response server
│   │   └── TestRunnerService.ts # Test execution engine
│   └── storage/            # File persistence layer
│       └── FolderProjectStorage.ts
└── package.json
```

### Webview Structure (React Frontend)
```
src-tauri/webview/
├── src/
│   ├── components/         # React components
│   │   ├── workspace/      # Workspace UI components
│   │   ├── settings/       # Settings modal
│   │   └── MainContent.tsx # Main app layout
│   ├── hooks/              # Custom React hooks
│   │   └── useWorkspaceCallbacks.ts
│   ├── utils/              # Utility functions
│   │   └── bridge.ts       # Bridge communication helper
│   └── App.tsx             # Root component
└── vite.config.ts
```

## Key Technical Considerations

### Logging Best Practices
- Use structured logging with context
- Include timestamps and severity levels
- Log important state transitions
- Log all errors with full context
- Use debug level for verbose development info
- Never log sensitive data (passwords, tokens, etc.)

### Cross-Platform File Handling
```typescript
// Good - cross-platform
const filePath = path.join(baseDir, 'config', 'settings.json');

// Bad - Windows-only
const filePath = baseDir + '\\config\\settings.json';
```

### Bridge Communication Pattern
```typescript
// Frontend (React) → Sidecar
bridge.sendMessage({ 
    command: 'executeRequest', 
    request: { /* request data */ }
});

// Sidecar → Frontend (via event listener)
window.addEventListener('message', (event) => {
    const { command, data } = event.data;
    if (command === 'response') {
        // Handle response
    }
});
```

### Local-First Persistence Pattern
```typescript
// ✅ Good: Update local state and save directly
const handleUpdateStep = (step: TestStep) => {
    setProjects(prev => prev.map(p => {
        // Update project in React state
        return updatedProject;
    }));
    setTimeout(() => saveProject(updatedProject), 0);
};

// ❌ Bad: Don't create backend commands for simple updates
bridge.sendMessage({ command: 'updateTestStep', step, project });
// This adds unnecessary complexity and latency
```

### Streaming Results Pattern
```typescript
// For long-running operations (tests, performance suites)
// 1. Start operation with stream flag
bridge.sendMessage({ command: 'runTestCase', testCase, stream: true });

// 2. Backend creates run ID
const runId = `run-${Date.now()}`;
testRunStore.set(runId, { updates: [], done: false });
return { runId };

// 3. Frontend polls for updates
const pollUpdates = () => {
    bridge.sendMessage({ 
        command: 'getTestRunUpdates', 
        runId, 
        fromIndex: lastIndex 
    });
};
```

## Testing Requirements
- Write tests for new features
- Ensure existing tests pass: `npm test`
- Test Tauri builds: `npm run tauri:build`
- Verify webview functionality
- Test sidecar independently: `cd sidecar && npm test`

## Common Commands
```bash
# Tauri Development
npm run tauri:dev          # Run in development mode
npm run tauri:build        # Build for production

# Sidecar
npm run build:sidecar      # Build sidecar
npm run prepare:sidecar    # Build and bundle sidecar binary

# Webview
npm run compile-webview    # Build webview
cd src-tauri/webview && npm run dev  # Webview dev mode

# Testing
npm test                   # Run all tests
cd sidecar && npm test     # Test sidecar only

# Linting
npm run lint               # Run ESLint
```

## Additional Context
- See [AGENTS.md](../AGENTS.md) for architecture overview
- See [CODE_ANALYSIS.md](../CODE_ANALYSIS.md) for technical debt
- See [README.md](../README.md) for user-facing documentation
