# GitHub Copilot Instructions for APInox

## Development Priorities

### 1. Platform: Tauri Desktop Application
**IMPORTANT**: This is a Tauri standalone desktop application, NOT a VS Code extension.

- **Tauri** (`src-tauri/`, Rust + Tauri APIs) is the only platform
- **Rust Backend** (`src-tauri/src/`) provides backend services
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

**Build Errors and Warnings Policy — fix all errors and warnings, regardless of origin.**

- After any code change, run `cargo build` (Rust) and `npm run build` or `npm run build:skip-check` (webview) and check for errors and warnings
- Fix every error and warning visible in the build output, even if it pre-dates your change
- In Rust: address `unused import`, `dead_code`, `unused variable`, `deprecated`, and clippy lints
- In TypeScript/React: address type errors, unused variable, unreachable code, and missing dependency warnings
- Do not use `#[allow(...)]` or `// @ts-ignore` to suppress errors/warnings unless genuinely justified and accompanied by an explanatory comment
- A clean build (zero errors, zero warnings) is the expected baseline state

### 3. Logging: Use Logger Mechanism
**ALWAYS** send important changes and errors through the logging mechanism, never use `console.log` for production code.

- Use the logger for all important events, state changes, and errors
- In Rust (Tauri): Use `log::info!()`, `log::warn!()`, `log::error!()`, `log::debug!()`
- In React (Webview): Use the existing backend logging pathways and Tauri bridge helpers instead of ad hoc console-only logging
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
- **Direct file saves**: Use `saveProject()` to write directly to disk via the Rust backend
- **No backend commands for simple updates**: State changes do not need extra backend commands
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
│   │   └── lib.rs          # Command registration and shared app logic
│   ├── webview/            # React frontend
│   │   ├── src/
│   │   │   ├── components/ # React components
│   │   │   ├── App.tsx     # Main React app
│   │   │   └── main.tsx    # Entry point
│   │   └── vite.config.ts  # Vite build config
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── shared/                 # Shared TypeScript models
│   └── src/
│       └── models.ts       # Type definitions
└── packages/               # Reusable frontend packages
```


### Communication Architecture
```
React Webview (Frontend)
    ↕ bridge.sendMessage() / Tauri invoke
Rust Backend (Tauri Commands)
    ↕ File System / Network / OS APIs
```


### Rust Backend Structure
```
src-tauri/src/
├── lib.rs                  # Command registration and app wiring
├── http/                   # HTTP client + commands
├── soap/                   # SOAP client, envelope builder, WS-Security
├── parsers/                # WSDL and schema parsing
├── testing/                # Test runner and assertions
├── project_storage.rs      # Project persistence
└── workspace_export.rs     # Workspace export/import
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
// Frontend (React) → Rust backend
bridge.sendMessage({ 
    command: 'executeRequest', 
    request: { /* request data */ }
});

// Backend → Frontend (via bridge listener)
bridge.addListener((message) => {
    const { command, data } = message;
    if (command === BackendCommand.Response) {
        // Handle response
    }
});

// Direct Tauri events (streaming / one-shot)
import { listen } from '@tauri-apps/api/event';
const unlisten = await listen('proxy-event', (event) => {
    // Handle event.payload
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

## Common Commands
```bash
# Tauri Development
npm run tauri:dev          # Run in development mode
npm run tauri:build        # Build for production

# Webview
npm run compile-webview    # Build webview
cd src-tauri/webview && npm run dev  # Webview dev mode

# Testing
npm test                   # Run all tests

# Linting
npm run lint               # Run ESLint
```

## Additional Context
- See [AGENTS.md](../AGENTS.md) for architecture overview
- See [CODE_ANALYSIS.md](../CODE_ANALYSIS.md) for technical debt
- See [README.md](../README.md) for user-facing documentation
