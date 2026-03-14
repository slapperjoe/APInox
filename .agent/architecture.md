---
description: Architecture overview and development guidelines
---

# Architecture Documentation

For the complete architecture documentation, see:

**→ [AGENTS.md](../AGENTS.md)** - Main architecture document

This file contains:
- Project overview and structure
- Tauri application architecture
- Rust backend structure  
- Webview (React) structure
- Communication architecture (Bridge pattern)
- Key technical considerations
- Local-first persistence patterns
- Build and development workflow

## Quick Architecture Summary

This is a **Tauri Desktop Application** with:

1. **React Webview** (`src-tauri/webview/`) - UI layer
2. **Rust Backend** (`src-tauri/src/`) - Tauri commands, HTTP/SOAP logic, storage, and native integrations
3. **Tauri Core** (`src-tauri/`) - Rust + native features

### Communication Flow
```
React Webview ←→ bridge.sendMessage()/invoke() ←→ Tauri Rust Backend
```

### Local-First Pattern
- Frontend manages project state
- Direct file saves via the Rust backend
- No backend commands for simple updates
- Use backend commands only for WSDL parsing, HTTP requests, proxy/mock services, and other native work

For complete details, **read [AGENTS.md](../AGENTS.md)**.
