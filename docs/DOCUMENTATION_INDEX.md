# APInox Documentation Index

This document provides an overview of all documentation files and their locations.

## Root Directory Documentation

**Essential Documentation** (kept in root for visibility):
- `README.md` - Main project documentation and getting started guide
- `LICENSE.md` - MIT License
- `CHANGELOG.md` - Version history and release notes
- `TODO.md` - Current tasks and planned features
- `AGENTS.md` - Architecture overview and development guide
- `manual.md` - User manual and feature guide

## Technical Documentation (docs/)

### Build & Deployment
- `BUILD_INSTRUCTIONS.md` - Step-by-step build process
- `TAURI_BUNDLING.md` - Tauri bundling configuration
- `STANDALONE_SIDECAR.md` - Standalone binary architecture

### Certificate & Security
- `CERTIFICATE_RESTORATION.md` - Certificate feature restoration notes
- `CERT_INSTALL_TROUBLESHOOTING.md` - Certificate installation troubleshooting
- `PROXY_CERTIFICATE_SETUP.md` - Proxy certificate setup guide
- `TLS_FIX_GUIDE.md` - TLS/HTTPS troubleshooting

### Debugging & Diagnostics
- `SIDECAR_DIAGNOSTICS.md` - Sidecar debugging guide
- `WCF_DEBUGGING.md` - WCF service debugging tips

### Development
- `CODE_ANALYSIS.md` - Code quality analysis and refactoring opportunities
- `LOCAL_XSD_FIX.md` - XSD schema handling notes
- `OUTSTANDING_WORK.md` - Consolidated outstanding tasks
- `SAVE_ERROR_HANDLING.md` - Error handling patterns
- `TEST_REQUEST_RENAME.md` - Request rename testing guide
- `WORKFLOW_FIX.md` - Workflow feature fixes
- `WORKFLOW_UI_IMPROVEMENTS.md` - Workflow UI enhancement notes

### Marketplace
- `MARKETPLACE_README.md` - VS Code marketplace listing content

## Removed Files (No Longer Needed)

The following files were removed as they documented completed features or contained outdated session notes:

- `BUILD_STATUS.md` - Replaced by build scripts
- `CLI_SIDECAR_MERGE.md` - Future planning document
- `DEBUG_MODAL_INFO.md` - Completed feature documentation
- `DEBUG_SCREEN_IMPLEMENTATION.md` - Completed feature documentation
- `DIAGNOSTIC_COMMANDS_IMPLEMENTATION.md` - Completed feature documentation
- `DRAG_AND_DROP_IMPLEMENTATION.md` - Completed feature summary
- `SESSION_SUMMARY.md` - Old session notes
- `REQUEST_CHAINING_PHASE1_COMPLETE.md` - Completed feature summary
- `REQUEST_CHAINING_UI_GAPS.md` - Completed work
- `STANDALONE_BINARY_COMPLETE.md` - Completed feature summary
- `PROTOCOL_MISMATCH_ERROR.md` - Troubleshooting info (now in docs if needed)
- `copilot-session-*.md` - Old Copilot session files

## Documentation Maintenance

### When to Add New Documentation

**Root Directory** - Only add documentation here if it's:
- Essential for all users (README, LICENSE)
- Frequently referenced (CHANGELOG, TODO)
- Architecture overview (AGENTS)

**docs/ Directory** - Add technical documentation here:
- Implementation guides
- Troubleshooting guides
- Development notes
- Feature specifications
- Build/deployment guides

### When to Remove Documentation

Remove documentation when:
- Feature implementation is complete and details are no longer relevant
- Information is outdated or superseded by newer docs
- Content is session-specific and temporary
- Information has been consolidated elsewhere

### Documentation Review Schedule

Review and clean up documentation:
- After each major release
- When starting a new feature
- Monthly maintenance check
