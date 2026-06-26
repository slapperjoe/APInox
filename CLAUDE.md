# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
# First-time setup — installs all npm + Rust dependencies
npm run tauri:init

# Development (increment version, compile webview, launch Tauri dev)
npm run tauri:dev

# Tests (vitest, with @shared path alias to ./shared/src)
npm test                # single run
npm run test:watch      # watch mode
npm run test:coverage   # with coverage

# Rust-only tests
cargo test --manifest-path src-tauri/Cargo.toml

# Lint
npx eslint . --ext .ts,.tsx

# Just build the webview (frontend) without launching Tauri
npm run compile-webview

# Production build (installers in src-tauri/target/release/bundle/)
npm run tauri:build

# Bump version (patch/minor/major) and sync across package.json, Cargo.toml, tauri.conf.json
npm run version-bump-patch
```

Tauri dev supports hot reload for the webview (`src-tauri/webview/src/*`). Rust changes (`src-tauri/src/*.rs`) require a restart / re-run of `npm run tauri:dev`.

## Architecture

APInox is a **Tauri v2 desktop app** — Rust backend + React webview frontend — for SOAP/REST/GraphQL API testing.

### Workspace layout

```
Cargo.toml (workspace root)
├── src-tauri/             # Tauri desktop app (Rust + webview)
│   ├── src/               # Rust backend — Tauri commands + business logic
│   ├── webview/           # React frontend (Vite)
│   └── Cargo.toml
├── packages/
│   ├── wsdl-parser/       # Standalone Rust lib — WSDL 1.1 parsing (no Tauri dep)
│   └── request-editor/    # Shared React package — Monaco-based request editor components
└── shared/src/            # TypeScript models + utils shared between webview and packages
```

### Rust backend (`src-tauri/src/`)

Key modules (each registered as Tauri commands in `lib.rs`):

| Module | Purpose |
|--------|---------|
| `parsers/` | WSDL parsing (`wsdl_commands.rs`), OpenAPI parsing, unified explorer CRUD |
| `soap/` | SOAP envelope building, SOAP request execution, WS-Security, cert management |
| `http/` | Generic HTTP/REST request execution |
| `testing/` | Test case/suite execution, assertion runner, variable extraction (XPath/regex/JSONPath) |
| `workflow/` | Workflow engine — sequential/parallel steps, conditions, loops, retry |
| `performance/` | Load testing — concurrent requests, SLA monitoring, metric export |
| `proxy/` | HTTP/HTTPS forward proxy server |
| `mock/` | Mock server — rule-based response matching |
| `replacer/` | In-flight XML/JSON replace rules (XPath-scoped) |
| `breakpoint/` | Traffic interception — pause, inspect, modify, continue/drop |
| `filewatcher/` | File watching with SOAP request/response XML pairing engine |
| `certificates/` | CA certificate generation for HTTPS interception |
| `project_storage.rs` | JSON folder-based project persistence |
| `secret_storage.rs` | AES-256-GCM encrypted secrets at `~/.apinox/secrets.enc` |
| `settings_manager.rs` | JSONC config at `~/.apinox/config.jsonc` |

All stateful services (proxy, mock, replacer, breakpoint, filewatcher, certs) are lazily initialized via `ensure_proxy_state()` and held in `ProxyAppState`. They share a common `RulesStorage` backed by `~/.apinox/`.

### Frontend webview (`src-tauri/webview/src/`)

React + Vite + styled-components. No global state library — state lives in `App.tsx` (the "monolith") and is passed via props. Key component areas:

- **`components/sidebar/`** — Left sidebar: `ProjectList`, `ApiExplorerSidebar`, `ServiceTree` (recursive tree), `WatcherPanel`, `ProxyUi`, `HistorySidebar`
- **`components/workspace/`** — Main content: `TestCaseView`, `WorkflowEditor`, `PerformanceSuiteEditor`, step editors (Request, Condition, Loop, Script, Delay)
- **`components/proxy/`** — Proxy/mock/replace/breakpoint tab content
- **`components/modals/`** — Debug modal (Ctrl+Shift+D), settings, import/export
- **`hooks/`** — Custom hooks for drag-and-drop, context menus, request execution, workflow handling, etc.

`packages/request-editor/` is a separate npm package with Monaco-based editors (headers, assertions, extractors, form-data panels) that the webview depends on. When modifying it, run `npm run build:packages` for the webview to pick up changes.

### Communication

Frontend → Backend: `window.__TAURI__.core.invoke('command_name', { request: {...} })` or through the `bridge` utility.

Backend → Frontend: Tauri events emitted from Rust, listened to via `listen()` in the webview.

### Project persistence format

Projects are stored as folder hierarchies (primary format):

```
MyProject/
├── properties.json          # Project metadata
├── interfaces/
│   └── MyService/
│       ├── interface.json   # Binding info, soapVersion, definition URL
│       └── MyOperation/
│           ├── operation.json  # originalEndpoint, targetNamespace, fullSchema, action
│           └── Request1.json   # Request body + metadata
└── tests/                   # Test suites/cases
```

### Coding conventions

- **TypeScript/JS/JSON/CSS/MD**: double quotes, 2-space indentation, spaces not tabs
- **Rust**: `rustfmt` defaults, 4-space indentation
- `.editorconfig` at repo root enforces this for editors that support it
