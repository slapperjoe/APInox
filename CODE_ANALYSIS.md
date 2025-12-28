# Code Analysis & Simplification Recommendations

This document outlines observations and actionable recommendations for simplifying and improving the Dirty SOAP codebase.

---

## Executive Summary

The codebase is functional but has accumulated technical debt. Key issues include:
- **Monolithic React components** (~3,000+ lines in two files)
- **Duplicate type definitions** (src/models.ts vs webview/src/models.ts with drift)
- **Dead code and backup files**
- **Missing automated tests**

---

## 🔴 Critical Issues

### 1. Monolithic Components

| File | Lines | Size | Severity |
|------|-------|------|----------|
| `webview/src/App.tsx` | 2,190 | 105KB | 🔴 High |
| `webview/src/components/WorkspaceLayout.tsx` | 946 | 55KB | 🔴 High |
| `webview/src/components/modals/SettingsEditorModal.tsx` | ~700 | 30KB | 🟠 Medium |

**Problem**: These files violate single responsibility, making maintenance difficult and introducing coupling between unrelated features.

**Recommendation**: Extract into smaller, focused components:
- `App.tsx` → Split message handling into `hooks/useMessageHandler.ts`
- `App.tsx` → Extract state management into context or reducer hooks
- `App.tsx` → Move styled-components to separate files
- `WorkspaceLayout.tsx` → Extract toolbar, editor, and response panels into separate components

---

### 2. Duplicate Type Definitions with Drift

**Files**:
- `src/models.ts` (137 lines)
- `webview/src/models.ts` (201 lines)

**Problem**: These files define the same interfaces but have diverged:
- Webview adds `WatcherEvent`, `SidebarView`, `DirtySoapConfig`
- Webview's `SoapUIOperation` has extra fields: `targetNamespace`, `originalEndpoint`
- Different extractor types: `SoapRequestExtractor` vs `SoapTestExtractor`
- Webview's `SoapUIProject` has `dirty?: boolean`

**Recommendation**:
1. Create a shared `types/` package or directory
2. Use a monorepo tool (e.g., npm workspaces) to share types
3. Alternatively, generate types from a single source of truth

---

### 3. Dead/Backup Files

| File | Issue |
|------|-------|
| `src/services/ProxyService.ts.original` | Backup file committed to repo |
| `webview/src/main.js` + `.map` | Stale JavaScript files (TypeScript project) |

**Recommendation**: Delete these files. Use git history if rollback is needed.

---

## 🟠 Medium Priority Issues

### 4. Stale Comments in bridge.ts

```typescript
// Note: We keep some Tauri imports if the codebase has strict checks...
// Since we removed @tauri-apps/cli/api from package.json? Wait, webview package.json might have it.
// We should check webview/package.json too.
```

**Problem**: Historical comments reference a Tauri migration that appears complete. Creates confusion.

**Recommendation**: Remove outdated comments. The code now only supports VS Code.

---

### 5. Outdated agent_docs Directory

The `agent_docs/` directory contains old planning artifacts:
- `implementation_plan.md` - Original project setup plan (now complete)
- `task.md` - Initial development tasks (92% complete)

**Recommendation**: 
- Move to `docs/archive/` or delete
- Keep `AGENTS.md` at root (well-maintained)

---

### 6. Two Storage Classes with Unclear Relationship

| Class | Purpose | Lines |
|-------|---------|-------|
| `ProjectStorage` | XML format persistence (SOAP-UI compatible) | 379 |
| `FolderProjectStorage` | Folder-based JSON persistence | 283 |

**Problem**: Unclear when to use which. The command pattern dispatches to both.

**Recommendation**: Document the distinction in `AGENTS.md` or consolidate if one is deprecated.

---

## 🟢 Minor Improvements

### 7. No Automated Tests

**Observation**: The `package.json` references `./out/test/runTest.js` but no test files exist in `src/`. The `TestRunnerService.ts` is for SOAP API testing (feature), not unit tests.

**Recommendation**: Add at least:
- Unit tests for `WsdlParser.ts` (critical parsing logic)
- Unit tests for `WildcardProcessor.ts` (complex replacer logic)
- Integration tests for command handlers

---

### 8. Inconsistent Error Handling

Many async functions lack try/catch blocks or have inconsistent error reporting.

**Recommendation**: Create a standardized error handling utility.

---

### 9. Magic Strings

Message commands are string literals throughout:
```typescript
bridge.sendMessage({ command: 'loadWsdl', ... });
// Later:
if (message.command === 'loadWsdl') { ... }
```

**Recommendation**: Create a `MessageCommands` enum or const object for type safety.

---

## Quick Wins (Safe to Implement Now)

1. ✅ **Delete** `src/services/ProxyService.ts.original`
2. ✅ **Delete** `webview/src/main.js` and `webview/src/main.js.map`
3. ✅ **Clean** stale comments from `webview/src/utils/bridge.ts`
4. ✅ **Update** `AGENTS.md` with storage class documentation
5. ✅ **Archive** or delete `agent_docs/` directory

---

## Suggested Refactoring Roadmap

### Phase 1: Cleanup (Low Risk)
- [ ] Remove dead files and stale comments
- [ ] Document storage class distinction
- [ ] Consolidate or document models.ts differences

### Phase 2: Component Extraction (Medium Risk)
- [ ] Extract `useMessageHandler` hook from App.tsx
- [ ] Extract `useProjectState` hook from App.tsx
- [ ] Split WorkspaceLayout into sub-components

### Phase 3: Testing (Foundation)
- [ ] Add Jest/Vitest configuration
- [ ] Write tests for WsdlParser and WildcardProcessor
- [ ] Add CI pipeline

---

## Appendix: File Size Summary

```
Top 10 Largest Source Files:
1. webview/src/App.tsx                    105KB  2190 lines
2. webview/src/components/WorkspaceLayout.tsx  55KB   946 lines
3. webview/src/components/modals/SettingsEditorModal.tsx  30KB   ~700 lines
4. src/ProjectStorage.ts                   19KB   379 lines
5. src/services/ProxyService.ts            17KB   ~400 lines
6. webview/src/components/Sidebar.tsx      14KB   ~350 lines
7. webview/src/components/sidebar/ProxyUi.tsx  14KB   ~350 lines
8. src/FolderProjectStorage.ts             12KB   283 lines
```

---

*Generated: 2025-12-29*
