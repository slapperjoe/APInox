---
description: Index of agent-specific documentation and where to find technical documentation
---

# Agent Documentation Index

This document serves as a navigation guide for AI agents and developers working on APInox.

## Agent Workflows (This Directory)

The `.agent/workflows/` directory contains **coding patterns and conventions** that should be followed when making changes:

- `auto-save-pattern.md` - Global auto-save implementation guidelines
- `create-backend-test.md` - How to write backend tests
- `create-frontend-test.md` - How to write frontend tests  
- `delete-pattern.md` - Proper deletion patterns
- `updating-test-step-state.md` - Test state management patterns

## Architecture Documentation (Root)

**Essential reading for understanding the codebase:**

- `../AGENTS.md` - **READ THIS FIRST** - Complete architecture overview, Tauri structure, data flow
- `../README.md` - User-facing documentation, features, installation
- `../TODO.md` - Current priorities and planned features

## Technical Documentation (docs/)

**Implementation details and troubleshooting guides:**

### Build & Deployment
- `../docs/BUILD_INSTRUCTIONS.md` - Build process and requirements
- `../docs/TAURI_BUNDLING.md` - Tauri bundling configuration
- `../docs/STANDALONE_SIDECAR.md` - Standalone binary architecture

### Security & Certificates
- `../docs/CERTIFICATE_RESTORATION.md` - Certificate feature implementation
- `../docs/CERT_INSTALL_TROUBLESHOOTING.md` - Certificate troubleshooting
- `../docs/PROXY_CERTIFICATE_SETUP.md` - Proxy certificate setup
- `../docs/TLS_FIX_GUIDE.md` - TLS/HTTPS debugging

### Development Guides
- `../docs/CODE_ANALYSIS.md` - **Code quality analysis** - Refactoring opportunities, technical debt
- `../docs/OUTSTANDING_WORK.md` - **Detailed task breakdown** - All features, completion status
- `../docs/SIDECAR_DIAGNOSTICS.md` - Debugging sidecar issues
- `../docs/WCF_DEBUGGING.md` - WCF service debugging

### Testing & Quality
- `../docs/TEST_REQUEST_RENAME.md` - Request rename testing
- `../docs/SAVE_ERROR_HANDLING.md` - Error handling patterns

### Feature Documentation
- `../docs/WORKFLOW_FIX.md` - Workflow feature implementation
- `../docs/WORKFLOW_UI_IMPROVEMENTS.md` - Workflow UI enhancements
- `../docs/LOCAL_XSD_FIX.md` - XSD schema handling

## Quick Reference for Common Tasks

### Making Code Changes
1. Read `../AGENTS.md` for architecture overview
2. Check `.agent/workflows/` for relevant patterns
3. Follow the build priority (production AND debug)
4. Use logging mechanism (not console.log)
5. Consider cross-platform support (Windows/macOS/Linux)

### Understanding Features
- **Current status**: `../TODO.md`
- **Detailed breakdown**: `../docs/OUTSTANDING_WORK.md`
- **Technical debt**: `../docs/CODE_ANALYSIS.md`

### Troubleshooting
- **Build issues**: `../docs/BUILD_INSTRUCTIONS.md`
- **Certificate errors**: `../docs/CERT_INSTALL_TROUBLESHOOTING.md`
- **TLS problems**: `../docs/TLS_FIX_GUIDE.md`
- **Sidecar issues**: `../docs/SIDECAR_DIAGNOSTICS.md`

### Testing
- **Backend tests**: `.agent/workflows/create-backend-test.md`
- **Frontend tests**: `.agent/workflows/create-frontend-test.md`
- **Test patterns**: `../docs/TEST_REQUEST_RENAME.md`

## Documentation Philosophy

**Keep in .agent/workflows/**: Reusable coding patterns, conventions, "how to do X" guides

**Keep in root**: Essential architecture and user documentation (AGENTS.md, README.md, TODO.md)

**Keep in docs/**: Technical implementation details, troubleshooting, completed feature summaries

**Remove**: Session notes, completed implementation summaries, outdated status documents
