# Code Analysis & Simplification Recommendations

This document outlines observations and actionable recommendations for simplifying and improving the APInox codebase.

**Last Updated**: 2026-01-01

---

## Executive Summary

The codebase has been significantly improved. Key accomplishments:
- ✅ **App.tsx reduced** from 2,190 → ~1,100 lines via hooks extraction
- ✅ **Dead files removed** (ProxyService.ts.original, main.js)
- ✅ **Stale comments cleaned** (Tauri references removed from bridge.ts)
- ✅ **Storage classes documented** in AGENTS.md
- ✅ **Mock Server implemented** with unified Server tab
- ✅ **Settings modal refactored** with SettingsTab enum

**Remaining work**:
- 🔲 Consolidate duplicate models.ts files
- 🔲 Split WorkspaceLayout.tsx into sub-components
- 🔲 Add more automated tests

---

## ✅ Completed Items

### 1. App.tsx Refactoring (DONE)

| Metric | Before | After |
|--------|--------|-------|
| App.tsx Lines | 2,190 | 941 |
| Hooks Extracted | 0 | 10 |

**Extracted hooks**:
- `useMessageHandler.ts` - Backend message handling
- `useRequestHandlers.ts` - Request execution
- `useRequestExecution.ts` - Alternative request handler
- `useContextMenu.ts` - Context menu actions
- `useSidebarCallbacks.ts` - Sidebar interactions
- `useTestCaseHandlers.ts` - Test case management
- `useWorkspaceCallbacks.ts` - Workspace operations
- `useExplorer.ts` - WSDL explorer state
- `useWatcherProxy.ts` - File watcher/proxy state
- `useWildcardDecorations.ts` - Monaco decorations

### 2. Dead Files Removed (DONE)
- ✅ `src/services/ProxyService.ts.original` - Deleted
- ✅ `webview/src/main.js` + `.map` - Deleted

### 3. Stale Comments Cleaned (DONE)
- ✅ Tauri migration comments removed from `bridge.ts`

### 4. Storage Classes Documented (DONE)
- ✅ AGENTS.md updated with table explaining ProjectStorage vs FolderProjectStorage

---

## 🔲 Remaining Work

### 1. Duplicate Type Definitions with Drift

**Files**:
- `src/models.ts` (137 lines)
- `webview/src/models.ts` (201 lines)

**Differences**:
- Webview adds: `WatcherEvent`, `SidebarView`, `DirtySoapConfig`
- Webview's `SoapUIOperation` has: `targetNamespace`, `originalEndpoint`
- Webview's `SoapUIProject` has: `dirty?: boolean`

**Recommendation**: Consolidate by copying webview version to src/ (superset).

---

### 2. WorkspaceLayout.tsx Still Large

| File | Lines | Status |
|------|-------|--------|
| `webview/src/components/WorkspaceLayout.tsx` | 925 | 🔲 Not split |

**Recommendation**: Extract toolbar, editor, and response panels into separate components.

---

### 3. No Automated Tests

**Recommendation**: Add at least:
- Unit tests for `WsdlParser.ts`
- Unit tests for `WildcardProcessor.ts`
- Integration tests for command handlers

---

## Quick Wins Status

1. ✅ **Delete** `src/services/ProxyService.ts.original`
2. ✅ **Delete** `webview/src/main.js` and `webview/src/main.js.map`
3. ✅ **Clean** stale comments from `webview/src/utils/bridge.ts`
4. ✅ **Update** `AGENTS.md` with storage class documentation
5. ✅ **Archive** or delete `agent_docs/` directory

---

## Suggested Refactoring Roadmap

### Phase 1: Cleanup (Low Risk) ✅ COMPLETE
- [x] Remove dead files and stale comments
- [x] Document storage class distinction
- [x] Extract hooks from App.tsx

### Phase 2: Consolidation (Low Risk)
- [ ] Consolidate models.ts files
- [ ] Split WorkspaceLayout into sub-components

### Phase 3: Testing (Foundation)
- [ ] Add Jest/Vitest configuration
- [ ] Write tests for WsdlParser and WildcardProcessor
- [ ] Add CI pipeline

---

## Appendix: Current File Size Summary

```
Top Source Files (Updated 2026-01-01):
1. webview/src/components/WorkspaceLayout.tsx   ~925 lines
2. webview/src/App.tsx                          ~1,100 lines
3. webview/src/components/settings/SettingsView.tsx  ~570 lines (full work-area view, was modals/SettingsEditorModal.tsx)
4. webview/src/components/sidebar/ServerUi.tsx  ~400 lines
5. src/services/ProxyService.ts                 ~400 lines
```

