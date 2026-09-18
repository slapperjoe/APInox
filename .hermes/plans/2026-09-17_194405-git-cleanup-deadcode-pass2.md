# APInox: Git Cleanup + Dead-Code Review Pass 2 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Bring the working tree to a clean, synced state on v0.46.363 (GitHub main), commit the one piece of real local work (traffic-light proxy icon), then run a second dead-code sweep that removes what GitHub's Tier 0/1 pass missed.

**Architecture:** Two phases. Phase A is mechanical git hygiene: discard auto-bumped version drift, fast-forward `main` to `origin/main` (clean ancestor, zero conflicts), commit the icon, prune merged worktrees/stashes, push to the local mirror only. Phase B is a verification-gated deletion sweep: every candidate was pre-verified against `origin/main` with whole-word reference counts (facts below); each removal is followed by the three gates (tsc, webview vitest, cargo test) before committing.

**Tech Stack:** Tauri v2 + React/Vite webview (`src-tauri/webview/`), shared TS (`shared/src`, `packages/request-editor`), Rust backend (`src-tauri/src`). Gates: `npx tsc --noEmit` (webview), `npx vitest run` (webview), `cargo test` (src-tauri).

---

## Current context / assumptions

Verified facts (all checked read-only against `origin/main` = `451b772`, v0.46.363):

### Git state
- Local `main` (`5a40190`, v0.45.356) is a **clean ancestor** of `origin/main` (`451b772`, v0.46.363) → pull is a fast-forward, no merge conflicts possible.
- `origin/main` already contains a large dead-code pass (Tier 0 + Tier 1a–e, ~4.6MB bundle trim): 120 files, +1,492/−5,889. Many obvious candidates are **already deleted upstream** — do NOT re-plan for them: `SaveErrorDialog.tsx`, `ResponseTimeChart.tsx`, `useDragAndDrop.ts`, `csvExport.ts`, `ServiceTree.tsx`, `InterfaceSummary/OperationSummary/ProjectSummary.tsx`, `packages/request-editor/src/hooks/useMonaco.ts`, `FormattingToolbar.tsx`, `SchemaViewer.tsx`.
- Dirty tree: 8 modified files. 7 are version-file drift (356→359, auto-bumped by the dev loop; GitHub is at 363) → discard. 1 is real work: `SidebarRail.tsx` + untracked `TrafficLightIcon.tsx` (hand-drawn lucide-style icon because pinned lucide-react@0.263.1 has no traffic-light glyph).
- Untracked junk: root `dist` symlink → `.worktrees/hermes-port/packages/request-editor/dist` (target gone; broken). `packages/request-editor/dist.bak-root/` (37MB build backup, unreferenced, not ignored).
- Worktree `.worktrees/t_aafaf92b` (branch `wt/t_aafaf92b` @ `63a009c`): clean, and `63a009c` is patch-id-identical to `5d259fe` which is already on main → fully merged. Remove.
- Worktree `.worktrees/t_9e350f06` (branch `wt/t_9e350f06` @ `5d259fe`): uncommitted WIP — Quick Requests resizable subwindow (F-02), 3 files (+366/−77) plus an untracked test file. **User decision: commit it on `wt/t_9e350f06`, keep the branch, remove the worktree.** Note: origin/main already landed a *different* F-02 implementation (bottom-pinned resize, `clampQuickRequestsHeight(h)` single-arg) and a different version of that test file — the WIP is an older variant (top-anchored, two-arg clamp). It must NOT be force-overwritten onto main now; it lives on its branch for later reconciliation.
- Stashes: `{0}` lockfile drift (noise), `{1}` 1-line Cargo.lock bump (noise) → drop. `{2}` (Aug 29 Monaco lag WIP, 9 files) → **inspected and superseded**: 7 of 9 files byte-identical to origin/main; the only code diff is a 1-line import change (`import React, {` → `import {`) that would BREAK origin/main's `React.memo` usage at `MonacoSingleLineInput.tsx:273`; the lock diff is dependency pinning drift. Drop.
- Push target: **local mirror only** (`local` = `/home/mark/apinox-remote.git`). Hold GitHub.
- Commit identity: repo config is `APInox Agent <dev@apinox.local>` (matches recent history). Use `GIT_AUTHOR_NAME="Mark R" GIT_AUTHOR_EMAIL=... GIT_COMMITTER_NAME="Mark R" GIT_COMMITTER_EMAIL=...` per house convention if a personal author is required; otherwise match existing agent identity. (Confirm with user at execution start.)

### Pre-verified dead-code findings (against origin/main)

**TS — verified zero references outside own file (safe deletes):**
| File | Evidence |
|---|---|
| `src-tauri/webview/src/utils/workspaceSearch.ts` | `searchWorkspace` (its only public fn besides `searchProjects`/`searchTests`) has 0 refs anywhere; `searchProjects`/`searchTests` ARE used by `SearchContext.tsx` — so delete ONLY the `searchWorkspace` function + its `SearchResultData`/`SearchResultView` types if unused after removal; KEEP the rest of the file |
| `src-tauri/webview/src/utils/fontLoader.ts` | `loadUIFont` has 0 external refs; `UI_FONTS`, `applyUIFont`, `UIFontValue` ARE used (App.tsx, GeneralTab.tsx, ThemeContext.tsx) — delete only `loadUIFont` |
| `src-tauri/webview/src/components/common/Button.tsx` | `StopButton` and `TextButton` styled-components have 0 external refs (keep the other exports in the file) |

**Rust — registered in `generate_handler!` but never invoked from any TS (zero occurrences across all TS):** 32 commands. Classification:
- **Truly unreachable (delete command fn + registration line):** `clear_history`, `clear_history_older_than`, `get_starred_history`, `get_history_config`, `update_history_config` (history UI uses `get_history`/`add_history_entry`/`toggle_star_history` via bridge branches — verify each against `bridge.ts` before deleting), `get_raw_settings`, `save_raw_settings`, `get_config_dir_path`, `get_config_file_path`, `get_global_variables`, `update_active_environment`, `update_open_projects`, `update_workflows`, `is_secret_ref`, `list_secret_keys`, `resolve_secret_value` (settings/secrets go through `get_settings`/`store_secret` etc.), `execute_http_request` (REST goes through `execute_rest_request`), `build_soap_envelope` (re-exported from `soap/mod.rs` but no consumer imports it).
- **FALSE POSITIVES — name collision with methods/re-exports, DO NOT DELETE:** `list_certificates`/`save_certificate`/`load_certificate`/`generate_certificate` (collides with `CertificateManager::list_certificates` method + tests in `certificate_manager.rs`; the *command* fns in `cert_commands.rs` need individual checking), `refresh_unified_project` (re-exported via `parsers/mod.rs:16` — check whether anything imports it via that path; the command itself has 0 TS refs), `new_unified_request` (has Rust unit tests calling it directly — keep the fn, only the registration is suspect), `save_mock_rules` (collides with `RuleStorage::save_mock_rules` method), `start_mock`/`stop_mock`/`set_mock_record_mode`/`get_mock_status` (mock server is driven via the unified Server tab → `start_proxy`/`stop_proxy` with mode; verify `MockRulesPage.tsx` doesn't call these — grep says 0 TS refs, so the *commands* are dead even though the storage methods live on), `set_breakpoint_rules` (breakpoints use `add/update/delete_breakpoint_rule` individually — verify), `get_replacer_rule_errors`, `get_watcher_events`, `sniff_file_type`-adjacent ones.
- **RULE FOR THE IMPLEMENTER:** For every Rust candidate, delete ONLY if ALL of: (a) zero whole-word occurrences in all TS under `src-tauri/webview/src`, `packages/request-editor/src`, `shared/src`; (b) zero non-test Rust callers (grep excluding the fn definition, `#[tauri::command]` attr, registration line, and `#[cfg(test)]` blocks); (c) removing the registration line keeps `cargo test` green. If (b) fails because of a same-named struct method or a `pub use` re-export, the command may still be dead — check the *command fn specifically* (in `*_commands.rs` / `mod.rs` command sections), not the method. When in doubt, leave it and note it in the report.

**FrontendCommand enum (`shared/src/messages.ts`)** — 28 members with zero `FrontendCommand.X` references AND zero literal `command: '...'` dispatches: `AddSchedule, BulkImportWsdls, CancelWsdlLoad, ClearHistory, ClearSidecarLogs, ClipboardAction, DeleteHistoryEntry, DeleteProjectFiles, DeleteSchedule, DownloadWsdl, ExportPerformanceResults, GetAutosave, GetLocalWsdls, GetPerformanceHistory, GetPerformanceSuites, GetSchedules, GetSidecarLogs, ImportTestSuiteToPerformance, OpenFile, OpenWorkspace, SelectConfigFile, SelectLocalWsdl, ToggleSchedule, ToggleStarHistory, UpdateActiveEnvironment, UpdateHistoryConfig, UpdateSchedule, UpdateTestStep`. Delete the enum member lines only after confirming no `tryRustCommand` branch matches their string values either (check `bridge.ts` for the camelCase string forms). `bridgeParity.test.ts` `DEFERRED_COMMANDS` allowlist entries that become orphaned should be trimmed in the same commit.

**NOT dead (verified live — do not touch):** coordinator commands (`start_coordinator`/`stop_coordinator`/`get_coordinator_status` are invoked from `bridge.ts` tryRustCommand branches driven by `PerformanceContext.tsx`; they're in the parity allowlist as known-deferred — the Rust side genuinely lacks them, that's tracked debt, not dead code), `applyUIFont`/`UI_FONTS`, `searchProjects`/`searchTests`, everything in the "referenced in TS" list above.

### Gate baselines (recorded on dirty tree; re-record after Phase A)
- Root `npm test`: 14 files / 109 tests passing.
- Webview `npx vitest run`: 46 files / 320 tests passing.
- Webview `npx tsc --noEmit`: exit 0.
- `cargo test` baseline: record fresh in Task A7 (expected ~164 tests per last known-good commit; if lower, record actual).

---

## Phase A — Git cleanup

### Task A1: Discard version drift

**Objective:** Revert the 7 auto-bumped version files so the tree carries only the icon work.

**Steps:**
1. Run:
   ```bash
   cd /home/mark/code/apinox
   git checkout -- Cargo.lock package.json scripts/version.js src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/webview/package-lock.json src-tauri/webview/package.json
   git status --short
   ```
   Expected output: exactly 2 lines — ` M src-tauri/webview/src/components/sidebar/SidebarRail.tsx` and `?? packages/request-editor/dist.bak-root/` + `?? src-tauri/webview/src/components/common/TrafficLightIcon.tsx`.

### Task A2: Shelve the icon work, then fast-forward main

**Objective:** Move `main` to v0.46.363 without losing the icon WIP.

**Steps:**
1. ```bash
   git stash push -u -m "wip: traffic-light proxy icon" \
     src-tauri/webview/src/components/sidebar/SidebarRail.tsx \
     src-tauri/webview/src/components/common/TrafficLightIcon.tsx
   git status --short   # expected: only dist.bak-root untracked
   ```
2. ```bash
   git pull --ff-only origin main
   git log --oneline -1   # expected: 451b772 chore: bump version to v0.46.363
   node -e "console.log(require('./package.json').version)"   # expected: 0.46.363
   ```
   If `pull` refuses (non-ff), STOP and report — do not force.
3. ```bash
   git stash pop
   git status --short   # expected: SidebarRail.tsx modified + TrafficLightIcon.tsx untracked again
   ```
   If the pop conflicts (it shouldn't — origin moved the Notes NavItem block in the same file region), resolve by taking the union: keep origin's bottom-of-rail Notes placement AND the `Shuffle` → `TrafficLightIcon` swap. Verify with `git diff` that the final file imports `TrafficLightIcon` and does NOT import `Shuffle`.

### Task A3: Gate + commit the icon

**Objective:** Prove the icon compiles and passes tests on the new base, then commit it.

**Steps:**
1. ```bash
   cd src-tauri/webview && npx tsc --noEmit && npx vitest run 2>&1 | tail -4
   ```
   Expected: tsc exit 0; vitest `Test Files  46 passed` / `Tests  320 passed` (counts may shift ±few vs origin's own baseline — compare against origin's numbers recorded in A7, not the stale-tree numbers).
2. Back at repo root:
   ```bash
   git add src-tauri/webview/src/components/sidebar/SidebarRail.tsx src-tauri/webview/src/components/common/TrafficLightIcon.tsx
   git commit -m "feat(ui): hand-drawn traffic-light icon for Proxy rail item (lucide 0.263.1 has no glyph)"
   git log --oneline -1
   ```

### Task A4: Remove junk artifacts

**Objective:** Delete the broken symlink and the 37MB backup dir.

**Steps:**
1. ```bash
   rm dist
   rm -rf packages/request-editor/dist.bak-root
   git status --short   # expected: empty (clean tree)
   ```
   Note: `dist` is a broken symlink to a removed worktree; nothing builds from it (Vite builds into `src-tauri/webview/dist/` and `packages/request-editor/dist/`). If any script referenced the root `dist`, tsc/vitest in A3 would have failed.

### Task A5: Commit the worktree WIP onto wt/t_9e350f06, then remove that worktree

**Objective:** Preserve the older F-02 variant on its branch (user decision), free the worktree.

**Steps:**
1. ```bash
   cd .worktrees/t_9e350f06
   git add -A
   git commit -m "wip(explorer): F-02 quick-requests resize (top-anchored variant, pre-rebase)"
   git log --oneline -2
   ```
2. Sanity gate inside the worktree (this branch predates origin's changes; expect possible failures — record, don't fix):
   ```bash
   cd src-tauri/webview && npx tsc --noEmit 2>&1 | tail -3
   ```
3. Back at root:
   ```bash
   cd /home/mark/code/apinox
   git worktree remove .worktrees/t_9e350f06
   git worktree list   # expected: only /home/mark/code/apinox [main]
   ```

### Task A6: Remove the merged worktree + prune branches + drop stashes

**Objective:** Clean up fully-merged artifacts.

**Steps:**
1. ```bash
   git worktree remove .worktrees/t_aafaf92b
   git branch -d wt/t_aafaf92b      # safe: -d refuses if unmerged; 63a009c is patch-id-identical to merged 5d259fe
   git worktree list                # expected: only main
   ```
   Keep `wt/t_9e350f06` (now holds the committed WIP from A5).
2. ```bash
   git stash drop 'stash@{0}'
   git stash drop 'stash@{0}'       # old stash@{1} becomes @{0} after first drop
   git stash drop 'stash@{0}'       # old stash@{2} — verified superseded (see context)
   git stash list                   # expected: empty
   ```
   Before dropping the last one, re-confirm: `git stash show --stat 'stash@{0}' | head -3` shows the 9-file Monaco set. If it shows something else, STOP and report.

### Task A7: Record post-cleanup gate baselines

**Objective:** Fresh baselines on v0.46.363 for Phase B comparison.

**Steps:**
1. ```bash
   npm test 2>&1 | tail -4                          # root vitest
   cd src-tauri/webview && npx tsc --noEmit && echo TSC_OK && npx vitest run 2>&1 | tail -4
   cd ../.. && cd src-tauri && cargo test 2>&1 | grep -E '^test result' | head -5
   ```
   Record all four numbers (root tests, tsc, webview tests, cargo results) in the final report. These are the Phase B "before" numbers.

### Task A8: Push to local mirror only

**Objective:** Sync the mirror; hold GitHub per user decision.

**Steps:**
1. ```bash
   git push local main
   git rev-list --left-right --count main...local/main   # expected: 0 0
   git ls-remote origin refs/heads/main                  # unchanged: 451b772...
   ```

---

## Phase B — Dead-code sweep (post-sync tree, v0.46.363)

Method per item: delete → run the three gates → commit. One commit per logical group. Gates after EVERY deletion group:
```bash
cd src-tauri/webview && npx tsc --noEmit && npx vitest run 2>&1 | tail -3
cd ../.. && cd src-tauri && cargo test 2>&1 | grep -E '^test result' | head -3
```
Expected: tsc exit 0; webview vitest count == A7 baseline (or −tests only if a deleted file had its own test file); cargo test count == A7 baseline (or −N where N = tests deleted with the fn).

### Task B1: TS deletions (verified zero-ref)

**Objective:** Remove the three verified-dead TS items.

**Steps:**
1. In `src-tauri/webview/src/utils/fontLoader.ts`: delete the `loadUIFont` function (the `export function loadUIFont(...)` block, ~lines 19–40). Keep `UI_FONTS`, `UIFontValue`, `applyUIFont`.
2. In `src-tauri/webview/src/utils/workspaceSearch.ts`: delete the `searchWorkspace` function and, if now unreferenced (verify with `grep -rn 'SearchResultData\|SearchResultView' src-tauri/webview/src | grep -v workspaceSearch.ts` → must be empty), the `SearchResultData` and `SearchResultView` type exports. Keep `searchProjects`, `searchTests`, `SearchOptions`, `SearchResult`, `SearchResultType`.
3. In `src-tauri/webview/src/components/common/Button.tsx`: delete the `StopButton` and `TextButton` styled-component exports (each is a self-contained `styled.button` block with its doc comment).
4. Gates (as above). Expected: all green, counts unchanged.
5. ```bash
   git add -A src-tauri/webview/src
   git commit -m "chore(dead-code): remove loadUIFont, searchWorkspace, StopButton/TextButton (zero refs)"
   ```

### Task B2: FrontendCommand enum pruning

**Objective:** Remove the 28 verified-unused enum members + orphaned parity allowlist entries.

**Steps:**
1. For EACH of the 28 members listed in context, verify BOTH:
   ```bash
   grep -rn "FrontendCommand\.MEMBER" src-tauri/webview/src packages/request-editor/src shared/src   # must be empty
   grep -rn "'memberString'" src-tauri/webview/src/utils/bridge.ts                                    # must be empty (camelCase value)
   ```
   (Replace MEMBER / memberString with e.g. `ClearHistory` / `clearHistory`.) Any member failing either check stays and gets noted in the report.
2. Delete the surviving members' lines from `enum FrontendCommand` in `shared/src/messages.ts`.
3. In `src-tauri/webview/src/__tests__/bridgeParity.test.ts`: remove any `DEFERRED_COMMANDS` entries whose only reason for existing was a pruned member (an entry is orphaned when neither a `FrontendCommand.X` dispatch nor a `tryRustCommand` branch references its string anymore).
4. Gates. Expected: green; webview vitest count unchanged (parity test adapts automatically).
5. ```bash
   git add shared/src/messages.ts src-tauri/webview/src/__tests__/bridgeParity.test.ts
   git commit -m "chore(dead-code): prune 28 unused FrontendCommand members + orphaned parity allowlist entries"
   ```

### Task B3: Rust command pruning (careful, per-command)

**Objective:** Delete the verified-unreachable `#[tauri::command]` fns and their `generate_handler!` registration lines.

**Candidate list (32, from context).** For EACH candidate C:
1. Verify zero TS refs:
   ```bash
   grep -rwn C src-tauri/webview/src packages/request-editor/src shared/src    # must be empty
   ```
2. Find the command fn definition:
   ```bash
   grep -rn -B2 "fn C(" src-tauri/src | grep -A2 'tauri::command'
   ```
3. Check for non-test Rust callers of the COMMAND FN (not same-named methods):
   ```bash
   grep -rnw C src-tauri/src | grep -v 'fn C(' | grep -v '#\[tauri::command\]' | grep -v 'generate_handler' 
   ```
   - Hits inside `#[cfg(test)]` modules or `mod tests` → OK to delete (tests die with the fn).
   - Hits that are struct-method definitions (`pub fn C(&self...)`) or `pub use` re-exports of a DIFFERENT symbol → false positive; judge the command fn only.
   - Hits that call the command fn from production Rust code → KEEP the command, note in report.
4. If dead: delete the fn (including its doc comments and any `#[cfg(test)]` tests attached to it) AND its line in `generate_handler![...]` in `src-tauri/src/lib.rs`. Also delete any now-unused `use` imports in the affected module.
5. After each batch of ~5 commands: `cargo test 2>&1 | grep -E '^test result'` — count must equal A7 baseline minus deleted tests.

**Priority order (highest confidence first):**
- Batch 1 (settings/secrets plumbing, 9): `get_raw_settings`, `save_raw_settings`, `get_config_dir_path`, `get_config_file_path`, `get_global_variables`, `update_active_environment`, `update_open_projects`, `update_workflows`, `is_secret_ref`, `list_secret_keys`, `resolve_secret_value`
- Batch 2 (history, 5): `clear_history`, `clear_history_older_than`, `get_starred_history`, `get_history_config`, `update_history_config`
- Batch 3 (mock/proxy/watcher, 8): `start_mock`, `stop_mock`, `set_mock_record_mode`, `get_mock_status`, `save_mock_rules`, `set_breakpoint_rules`, `get_replacer_rule_errors`, `get_watcher_events`
- Batch 4 (misc, 4): `execute_http_request`, `build_soap_envelope` (+ its `pub use` in `soap/mod.rs` if no importer), `new_unified_request` (KEEP the fn if its unit tests exercise behavior worth keeping — then only drop the registration line and note "registered-but-untested-via-IPC"; prefer keeping both and noting), `refresh_unified_project` (check `parsers/mod.rs:16` re-export consumers first)

Commit after each batch:
```bash
git add -A src-tauri/src
git commit -m "chore(dead-code): remove N unreachable Tauri commands (batch X: <theme>)"
```
Every kept candidate MUST appear in the final report with the reason.

### Task B4: Final report + full gate run

**Objective:** Document everything removed/kept; prove the tree is green.

**Steps:**
1. Full gates:
   ```bash
   npm test 2>&1 | tail -3
   cd src-tauri/webview && npx tsc --noEmit && echo TSC_OK && npx vitest run 2>&1 | tail -3
   cd ../.. && cd src-tauri && cargo test 2>&1 | grep -E '^test result'
   ```
2. Write `docs/DEAD_CODE_REVIEW_PASS2.md` with: date, base commit, per-item table (item / action taken / evidence command + result / gate delta), kept-with-reason section, and the `wt/t_9e350f06` reconciliation note (older F-02 variant needs rebase-or-drop decision against origin's bottom-pinned implementation).
3. ```bash
   git add docs/DEAD_CODE_REVIEW_PASS2.md
   git commit -m "docs: dead-code review pass 2 report"
   git push local main
   ```

---

## Tests / validation

No new feature code is written, so there is no TDD cycle in the classic sense; the discipline here is **gate-before-commit** instead:
- Every deletion group is followed by: `tsc --noEmit` (exit 0), webview `vitest run` (count == baseline), `cargo test` (count == baseline − deleted tests).
- The `bridgeParity.test.ts` suite is the key regression guard for Phase B2/B3: it fails if a pruned enum member or command was actually dispatched/routed.
- Baselines are recorded in Task A7 and compared numerically, not eyeballed.
- Manual smoke (optional, if time): `npm run tauri:dev`, click through Proxy rail (icon renders), open Settings → General (font dropdown works — guards `applyUIFont`), run one saved request (guards execute paths).

## Risks, tradeoffs, and open questions

1. **False-positive risk on Rust names** (mitigated): several candidates collide with struct methods (`CertificateManager::list_certificates`, `RuleStorage::save_mock_rules`) or re-exports. The per-command rule in B3 exists for this; worst case is a kept command documented in the report, never a broken build.
2. **`new_unified_request` has valuable unit tests** (scenario tests at `unified_explorer_commands.rs:2115+`). Deleting the fn kills them. Recommendation: keep fn + tests, drop only the registration line, document. Implementer discretion within that guidance.
3. **Coordinator commands** look dead from the Rust side (no `#[tauri::command]` fns exist) but are actively dispatched from `PerformanceContext.tsx` and allowlisted in the parity test as known deferred debt. Do NOT "fix" by adding Rust commands or by deleting the TS dispatch — out of scope.
4. **`wt/t_9e350f06` holds a divergent F-02 implementation.** Committing it (A5) preserves it safely; reconciling with origin's bottom-pinned variant is a separate future task (rebase, port the better parts, or drop). Not done in this plan.
5. **Version bumps during execution:** any `npm run tauri:dev`-style command will re-bump version files mid-sweep. Phase B uses only `tsc`/`vitest`/`cargo test` (no version bumps). If a stray bump appears in `git status` before a commit, `git checkout --` the version files first.
6. **Open question for user:** commit author identity — repo default `APInox Agent <dev@apinox.local>` (matches all recent commits) vs personal Mark R identity via env vars. Default to repo identity unless told otherwise.
7. **GitHub remains 1 commit behind local main** after A8 (the icon commit) plus Phase B commits — intentional per "hold GitHub". Mirror is the sync point until the user pushes to origin.
