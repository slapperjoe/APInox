---
description: Architecture overview and development guidelines
---

# Architecture Documentation

For the complete architecture documentation, see:

**→ [AGENTS.md](../AGENTS.md)** - Main architecture document

This file contains:
- Project overview and structure
- Tauri application architecture
- Sidecar backend structure  
- Webview (React) structure
- Communication architecture (Bridge pattern)
- Key technical considerations
- Local-first persistence patterns
- Build and development workflow

## Quick Architecture Summary

This is a **Tauri Desktop Application** with:

1. **React Webview** (`src-tauri/webview/`) - UI layer
2. **Sidecar Process** (`sidecar/`) - Node.js backend (bundled binary)
3. **Tauri Core** (`src-tauri/`) - Rust + native features

### Communication Flow
```
React Webview ←→ bridge.sendMessage() ←→ Sidecar Backend
```

### Local-First Pattern
- Frontend manages project state
- Direct file saves via sidecar
- No backend commands for simple updates
- Use sidecar only for WSDL parsing, HTTP requests, servers

For complete details, **read [AGENTS.md](../AGENTS.md)**.
