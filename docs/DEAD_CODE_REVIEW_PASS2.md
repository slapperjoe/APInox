# Dead Code Review — Pass 2

**Date:** 2026-09-17
**Base:** `451b772` (v0.46.363, GitHub main — after the Tier 0/1 cleanup pass)
**Method:** Whole-word reference counts across all TS (`src-tauri/webview/src`,
`packages/request-editor/src`, `shared/src`) and all Rust (`src-tauri/src`).
A symbol is dead only when it has zero references outside its own definition
file (TS) or zero production callers + zero frontend invocations (Rust).

## Removed

### TS (commit `b72f629`)
| Item | File | Evidence |
|---|---|---|
| `searchWorkspace()` fn | `src-tauri/webview/src/utils/workspaceSearch.ts` | 0 refs repo-wide. Kept `searchProjects`/`searchTests` (used by `SearchContext.tsx`), and `SearchResultData`/`SearchResultView` types (used by `SearchResult`/`SearchOptions`) |
| `TextButton`, `StopButton` styled buttons | `src-tauri/webview/src/components/common/Button.tsx` | 0 refs repo-wide |

### FrontendCommand enum (commit `2752a7a`)
28 members removed from `shared/src/messages.ts` — each verified to have zero
`FrontendCommand.X` references AND zero `command: '<value>'` literal
dispatches AND zero `tryRustCommand` branch references:

`AddSchedule, BulkImportWsdls, CancelWsdlLoad, ClearHistory, ClearSidecarLogs,
ClipboardAction, DeleteHistoryEntry, DeleteProjectFiles, DeleteSchedule,
DownloadWsdl, ExportPerformanceResults, GetAutosave, GetLocalWsdls,
GetPerformanceHistory, GetPerformanceSuites, GetSchedules, GetSidecarLogs,
ImportTestSuiteToPerformance, OpenFile, OpenWorkspace, SelectConfigFile,
SelectLocalWsdl, ToggleSchedule, ToggleStarHistory, UpdateActiveEnvironment,
UpdateHistoryConfig, UpdateSchedule, UpdateTestStep`

`bridgeParity.test.ts` `DEFERRED_COMMANDS` allowlist checked: no entries
orphaned by this pruning (all 16 entries still correspond to live
dispatches/branches).

### Rust (commit `2dde345`)
27 `#[tauri::command]` fns removed (fn body + `generate_handler!` line):

| Group | Commands |
|---|---|
| Settings | `get_raw_settings`, `save_raw_settings`, `get_config_dir_path`, `get_config_file_path`, `get_global_variables`, `update_active_environment`, `update_open_projects`, `update_workflows` |
| History | `clear_history`, `get_starred_history`, `clear_history_older_than`, `update_history_config`, `get_history_config` |
| Secrets | `is_secret_ref`, `list_secret_keys` |
| HTTP | `execute_http_request` (superseded by `execute_rest_request`) |
| SOAP | `build_soap_envelope` + `BuildEnvelopeRequest`/`BuildEnvelopeResponse` structs + its test |
| Certificates | whole `soap/cert_commands.rs` module: `generate_certificate`, `save_certificate`, `list_certificates`, `load_certificate` (zero refs; the proxy-CA flow uses `commands/certificates_server.rs` + `soap/certificate_manager.rs`, both live) |
| Mock server | `start_mock`, `stop_mock`, `get_mock_status`, `set_mock_record_mode`, `save_mock_rules` (+ orphaned `MockStatus` struct + `run_mock` import). The mock server is driven via the unified Server tab's `start_proxy`/`stop_proxy` with a mode flag; rule CRUD goes through the individual `add/update/delete_mock_rule` commands which persist internally via `RuleStorage::save_mock_rules` |
| Replacer | `get_replacer_rule_errors` |
| File watcher | `get_watcher_events` (its own doc comment said "Kept for backward compatibility but returns empty") |
| Breakpoints | `set_breakpoint_rules` (bulk-set; UI uses individual `add/update/delete_breakpoint_rule`) |

Registration-only removals (function kept — internal Rust callers):

| Command | Kept because |
|---|---|
| `resolve_secret_value` | called by `settings_manager::get_resolved_environment` (live, invoked from `UnifiedExplorerMain.tsx`) |
| `refresh_unified_project` | called by `refresh_project_wsdl` (live). Dead `parsers/mod.rs` re-export line also removed |
| `new_unified_request` | unit tests in `unified_explorer_commands.rs` exercise real behavior (content-type inheritance scenarios) |

`#[tauri::command]` attribute stripped from the three kept fns (no longer IPC
entry points); their registration lines were dropped.

## Kept with reason (looked dead, verified live)

| Item | Reason |
|---|---|
| `loadUIFont` (fontLoader.ts) | called internally by `applyUIFont`; `applyUIFont`/`UI_FONTS`/`UIFontValue` used by App.tsx, GeneralTab.tsx, ThemeContext.tsx |
| `searchProjects` / `searchTests` (workspaceSearch.ts) | imported by `SearchContext.tsx` |
| `SearchResultData` / `SearchResultView` types | used by `SearchResult.data` and `SearchOptions.views` |
| Coordinator commands (`startCoordinator`/`stopCoordinator`/`getCoordinatorStatus` + `PerformanceContext.tsx` wiring) | live dispatch; Rust side genuinely lacks the commands — tracked debt in `bridgeParity.test.ts` allowlist, out of scope |
| `get_ca_certificate_info` / `trust_ca_certificate` / `untrust_ca_certificate` | invoked from `ServerControl.tsx`/`CertificateManager.tsx` (different file than the dead cert_commands module) |
| `certificate_manager.rs` (`CertificateManager`, `CertificateWithKey`) | used by the live proxy-CA flow (`certificates_server.rs`) |
| `RuleStorage::save_mock_rules` method + its tests | called by live mock rule CRUD persistence |
| `CertificateManager::list_certificates` / `save_certificate` methods | live (proxy CA); the dead items were the `#[tauri::command]` wrappers of the same names |

## Gate results

| Gate | Baseline (v0.46.363) | After |
|---|---|---|
| Root `npm test` | 14 files / 109 tests | 14 files / 109 tests |
| Webview `tsc --noEmit` | clean | clean |
| Webview `vitest run` | 43 files / 294 tests | 43 files / 294 tests |
| `cargo test` (src-tauri) | 176 passed / 0 failed | 175 passed / 0 failed (−1: deleted `build_soap_envelope` test) |

## Outstanding (out of scope, noted for future passes)

1. **`wt/t_9e350f06` branch** holds an older top-anchored F-02 quick-requests
   resize variant (commit `3d50e0d`); origin/main landed a different
   bottom-pinned variant. Needs rebase-or-drop reconciliation.
2. **144 root-owned files** remain in `packages/request-editor/dist.bak-root/`
   (created by a root process 2026-09-11; agent has no sudo). Requires:
   `sudo rm -rf /home/mark/code/apinox/packages/request-editor/dist.bak-root`
3. **`shared/src/models.ts`** carries a long tail of type-only exports with no
   TS references (`MockServerConfig`, `TrafficEvent`, `ScrapbookState`,
   `WorkflowExecutionResult`, theme objects in `shared/src/styles/themes.ts`,
   etc.) — type-level dead code is low-risk but was out of scope for this pass.
4. **`src-tauri/src/mock/server.rs`** — CONFIRMED dead (top follow-up for pass
   3): with `start_mock`/`stop_mock` gone, nothing calls `run_mock` anymore.
   The unified proxy handles mocking **inline** — `proxy/server.rs:280` uses
   `crate::mock::server::find_matching_rule` directly, and `mock/state` is
   embedded in the proxy state (`lib.rs:72,464`). So the standalone mock HTTP
   server chain is orphaned: `run_mock` + `handle_mock_request` +
   `passthrough` + `record_response` (~300 lines, `mock/server.rs:22-321`).
   KEEP in this pass: `find_matching_rule` / `all_conditions_match` /
   `condition_matches` / `plain_response` + the tests module — all live via
   the inline proxy path. Deferred because it deletes real HTTP-forwarding /
   rule-recording server logic intertwined with the proxy traffic path; needs
   its own commit + gates + confirmation that the inline path fully covers
   passthrough recording.
5. GitHub `origin/main` is now behind local main by 5 commits (icon + this
   pass); local mirror is synced. Push to origin when ready.
