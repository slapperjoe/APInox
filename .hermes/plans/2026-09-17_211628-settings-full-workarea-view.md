# Settings as a full work-area view (replace the modal)

**Date:** 2026-09-17 · **Branch base:** `main` @ `1860946` (v0.46.363 + dead-code pass + sidebar import menu)
**Gates (run from repo root unless noted):** `cd src-tauri/webview && npx tsc --noEmit` → no output; `npx vitest run` → `Test Files 44 passed (44)` / `Tests 301 passed (301)` BEFORE this change — after, expect **45 files / 306 tests**. No Rust changes → `cargo test` not needed.

## Goal

Open Settings into the entire work area (like Proxy/Mock/Notes) instead of a modal overlay, with the same tabs and auto-save behavior.

## Current context / assumptions

- One entry point exists: the rail **Settings** item (`src-tauri/webview/src/components/sidebar/SidebarRail.tsx:204`, `NavItem icon={Settings} onClick={onOpenSettings}`). `onOpenSettings` is wired at `MainContent.tsx:1798` to `() => setShowSettings(true)`. There are **zero** `openSettings(tab)` deep-link callers anywhere (verified by grep), so the tab-targeting API can be deleted outright.
- Modal state lives in `UIContext` (`src-tauri/webview/src/contexts/UIContext.tsx`): `showSettings`, `setShowSettings`, `initialSettingsTab`, `setInitialSettingsTab`, `openSettings`. `MainContent` destructures all five (lines ~678–682).
- The modal renders in `MainContent.tsx` inside a `<Suspense fallback={null}>` block (~line 1962): `{ showSettings && (<SettingsEditorModal rawConfig={rawConfig} onClose={...} onSave={...} initialTab={initialSettingsTab} />) }`. Its `onSave` body (Tauri `SaveSettings`+`GetSettings`+`SettingsUpdate` emit, browser `saveSettings` fallback) moves verbatim into a new callback.
- The work area switches views on `activeView` (`SidebarView` enum, `shared/src/models.ts:578`) via `useNavigation()` (`NavigationContext`). Full-area precedent: PROXY/MOCK/WATCHER/NOTES each render their own panel when `activeView === X`; everything else falls through to `WorkspaceLayout` under one big negative condition at `MainContent.tsx:1919`.
- `activeView` is **not persisted** (NavigationContext always boots to UNIFIED_EXPLORER or HOME for welcome; `handleSaveUiState` only saves `config.ui`) — so no boot-into-settings risk, no persistence work.
- `Sidebar.tsx:97-99`: `hideContent = !sidebarExpanded || activeView === HOME || proxyFullPanelView || historyEmpty` — the rail stays visible and content panels hide for full-panel views. Adding SETTINGS to `proxyFullPanelView` gives the same behavior (rail-only, wide work area).
- `handleSetActiveViewWrapper` (`src-tauri/webview/src/hooks/useLayoutHandler.ts:96`) already clears `selectedRequest` on any view switch — correct for settings too. It has no per-view branch that needs updating.
- The modal component `modals/SettingsEditorModal.tsx` (567 lines) wraps its tabs in `<Modal isOpen onClose title="Settings" size="large">`. Its JSON tab uses Monaco `height="min(60vh, 480px)"` because the modal height was content-driven — in a flex-filled work area the editor should fill the remaining space instead.
- `modals/settings/` (tab components + `SettingsTypes.ts` + `index.ts`) is imported ONLY by `SettingsEditorModal.tsx` (verified). Moving it to `components/settings/` touches exactly two existing test files' import paths.
- `tsconfig.json`: `strict: true`, `noUnusedLocals: false`, `noUnusedParameters: true` — leftover unused context members won't fail the build, but we delete them anyway.
- Test conventions: jsdom + Testing Library; monaco mocked via `vi.mock('@apinox/request-editor/monaco', ...)` returning a stub (see `explorer/__tests__/unified_explorer_entry_content.test.tsx:27`); bridge mocked similarly. `@shared` and `@apinox/request-editor/*` aliases resolve in vitest config.
- Docs mention the old path in `packages/request-editor/COMPONENT_INVENTORY.md:92` and `docs/CODE_ANALYSIS.md:129` — update both.

## Architecture / proposed approach

Make Settings a first-class `SidebarView.SETTINGS` rendered full-width in the work area, following the exact pattern of NOTES/PROXY. Convert `SettingsEditorModal` into `SettingsView` (drop the `Modal` wrapper, keep every tab/handler/auto-save byte-for-byte otherwise), move `modals/settings/` to `components/settings/`, and replace the UIContext modal-state trio with view switching. Auto-save-on-tab-switch/close semantics are preserved by running the same persist logic in an unmount effect (the view unmounts when you leave it — same moment the modal used to close).

## Step-by-step tasks

### T1 — `SidebarView.SETTINGS` member (+ deep-link map)

File: `shared/src/models.ts` (~line 578). Add after `NOTES = 'notes',`:

```ts
    NOTES = 'notes',     // Notes / markdown scratchpad
    SETTINGS = 'settings', // Settings (full work-area view, was a modal)
}
```

File: `src-tauri/webview/src/contexts/NavigationContext.tsx` — in the `viewMap` object (~line 69), add `'settings': SidebarView.SETTINGS,` alongside the other entries (so any backend deep-link works).

Verify: `cd src-tauri/webview && npx tsc --noEmit` → no output. (Nothing consumes the new member yet.)

Commit: `git add shared/src/models.ts src-tauri/webview/src/contexts/NavigationContext.tsx && git commit -m "feat(nav): add SETTINGS sidebar view member + deep-link key"`

### T2 — Move `modals/settings/` → `components/settings/tabs/`

The subfolder is renamed `settings` → `tabs` so the new `SettingsView.tsx` can sit at `components/settings/SettingsView.tsx` and import `from './tabs'` (a sibling folder named `settings` inside `settings/` would be a confusing `./settings` import).

```bash
cd /home/mark/code/apinox
git mv src-tauri/webview/src/components/modals/settings src-tauri/webview/src/components/_settings_tmp
mkdir -p src-tauri/webview/src/components/settings
git mv src-tauri/webview/src/components/_settings_tmp src-tauri/webview/src/components/settings/tabs
```

Fix the one relative import that crosses the new depth (verified: `tabs/index.ts` re-exports everything; the two test files are the only external importers):
- `src-tauri/webview/src/components/settings/tabs/__tests__/GeneralTab.themeDropdown.test.tsx` (~line 26): `import { UIProvider } from '../../../../contexts/UIContext';` → `'../../../../../contexts/UIContext'` (two extra levels: `modals/settings/__tests__` → `components/settings/tabs/__tests__`).
- `src-tauri/webview/src/components/settings/tabs/__tests__/UpdatesTab.stopProxy.test.tsx`: its imports are `../UpdatesTab` (intra-folder, unaffected) — verify by reading the import block; fix any cross-folder relative path the same way (+2 levels).

No other importer exists (verified: only `modals/SettingsEditorModal.tsx` imported `./settings`; it is rewritten in T3).

Verify (expect a transient red from the not-yet-updated `SettingsEditorModal` import — T3 fixes it): `cd src-tauri/webview && npx vitest run src/components/settings` → the 2 moved test files pass; `npx tsc --noEmit` → the only error is `modals/SettingsEditorModal.tsx` importing a missing `./settings` (resolved by T3).

Commit: `git add -A && git commit -m "refactor(settings): move settings tab components out of modals/ to settings/tabs/"`

### T3 — Convert `SettingsEditorModal` → `SettingsView`

Create `src-tauri/webview/src/components/settings/SettingsView.tsx` as a copy of `modals/SettingsEditorModal.tsx` with EXACTLY these changes (everything else byte-identical):

1. Tab import (old line 5): `from './settings'` → `from './tabs'`.

2. Delete `import { Modal } from './Modal';` (becomes unused) and the styled `ModalWrapper` const (its flex-column rules move onto the root div below).
3. Props interface:
   ```ts
   interface SettingsViewProps {
       rawConfig: string;
       /** Persisted by the parent (MainContent) — same contract as the old modal onSave. */
       onSave: (content: string, config?: any) => void;
       /** Initial tab (e.g. deep-linked). Defaults to GUI. */
       initialTab?: string | null;
   }
   export const SettingsView: React.FC<SettingsViewProps> = ({ rawConfig, onSave, initialTab }) => {
   ```
   (`onClose` removed — leaving the view is the parent's job.)
4. Replace `handleClose` with an unmount-time persist (same code, fires when the user navigates away — the moment the modal used to close):
   ```ts
   // Persist pending edits when the view unmounts (leaving the view == closing
   // the old modal). Runs once on unmount with the latest refs/state via a
   // ref-mirror effect.
   const guiConfigRef = useRef(guiConfig);
   const activeTabRef = useRef(activeTab);
   useEffect(() => { guiConfigRef.current = guiConfig; }, [guiConfig]);
   useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
   useEffect(() => () => {
       if (activeTabRef.current === SettingsTab.JSON) {
           tryPersistJson();
       } else {
           persistGuiConfig(guiConfigRef.current);
       }
   }, []); // eslint-disable-line react-hooks/exhaustive-deps
   ```
   Keep `tryPersistJson`/`persistGuiConfig` as-is (they're stable closures over state setters + `onSave`; the unmount effect intentionally reads refs).
5. Root JSX: replace the whole `<Modal ...>...</Modal>` wrapper with:
   ```tsx
   return (
       <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
           {/* TabContainer + ContentContainer unchanged */}
           ...
       </div>
   );
   ```
   (Drop `title="Settings"` — the rail shows the gear; optionally add a small header row later, YAGNI.)
6. JSON tab Monaco: `height="min(60vh, 480px)"` → `height="100%"` (work area is flex-filled now; the comment above that prop explaining the modal constraint must be replaced with: `// Fills the remaining work-area height (the old modal used a vh cap because its height was content-driven).`).
7. (Sanity check, not a new edit) Confirm the file no longer references `Modal` or `ModalWrapper` anywhere (one import + one styled const, both removed in step 2); `ContentContainer`/`TabContainer`/`Tab` styled consts remain.

Then delete the old file: `git rm src-tauri/webview/src/components/modals/SettingsEditorModal.tsx`

Verify: `npx tsc --noEmit` clean.

Commit: `git add -A && git commit -m "refactor(settings): SettingsEditorModal -> SettingsView (full-area, no Modal wrapper)"`

### T4 — MainContent: render the view, wire save, drop modal state

File: `src-tauri/webview/src/components/MainContent.tsx`:

1. Lazy import (line ~77): 
   ```ts
   const SettingsView = React.lazy(() =>
       import('./settings/SettingsView').then(module => ({ default: module.SettingsView }))
   );
   ```
2. New save callback (place next to `handleUnifiedExport`, ~line 505). Body = the current inline `onSave` from the modal render site (lines ~1969–1990), extracted verbatim:
   ```ts
   const handleSettingsSave = useCallback(async (content: string, config?: any) => {
       if (isTauri()) {
           try {
               await bridge.sendMessageAsync({
                   command: FrontendCommand.SaveSettings,
                   raw: !config,
                   content,
                   config
               });
               const data: any = await bridge.sendMessageAsync({
                   command: FrontendCommand.GetSettings
               });
               bridge.emit({
                   command: BackendCommand.SettingsUpdate,
                   config: data?.config ?? data ?? null,
                   raw: data?.raw,
                   configDir: data?.configDir,
                   configPath: data?.configPath
               } as any);
           } catch (e) {
               // fallback to fire-and-forget
               bridge.sendMessage({ command: FrontendCommand.SaveSettings, raw: !config, content, config });
           }
           return;
       }
       bridge.sendMessage({ command: 'saveSettings', raw: !config, content, config });
   }, []);
   ```
3. Work-area render — extend the negative condition at line 1919 with `&& activeView !== SidebarView.SETTINGS`, and add (next to the NOTES block, ~line 1942):
   ```tsx
   {activeView === SidebarView.SETTINGS && (
       <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
           <Suspense fallback={<div style={{ flex: 1, background: 'var(--apinox-editor-background)' }} />}>
               <SettingsView rawConfig={rawConfig} onSave={handleSettingsSave} />
           </Suspense>
       </div>
   )}
   ```
4. Delete the entire `showSettings && (<SettingsEditorModal .../>)` block (~lines 1962–1995).
5. Rail wiring (line 1798): `onOpenSettings: () => setShowSettings(true)` → `onOpenSettings: () => handleSetActiveViewWrapper(SidebarView.SETTINGS)`.
6. Remove `showSettings, setShowSettings, initialSettingsTab, setInitialSettingsTab, openSettings` from the `useUI()` destructure (~lines 678–682) AND from the memo deps array (line ~1840: drop `setShowSettings` from `workspaceDirty, handleSaveUiState, setShowSettings, setShowHelp,`).
7. `rawConfig` stays destructured (used by the new view).

File: `src-tauri/webview/src/components/Sidebar.tsx`:
- Line 97: `const proxyFullPanelView = activeView === SidebarView.PROXY || activeView === SidebarView.MOCK || activeView === SidebarView.WATCHER;` → append `|| activeView === SidebarView.SETTINGS` (rename the var to `fullPanelView` while you're there — it's local).
- Keep passing `onOpenSettings` to the rail (now it switches views).

File: `src-tauri/webview/src/components/sidebar/SidebarRail.tsx` (line 204): make the gear highlight like the other nav items:
```tsx
<NavItem
  icon={Settings}
  active={activeView === SidebarView.SETTINGS}
  onClick={onOpenSettings}
  title="Settings"
  showBadge={hasUpdate}
/>
```

File: `src-tauri/webview/src/contexts/UIContext.tsx`:
- Delete `showSettings`, `setShowSettings`, `initialSettingsTab`, `setInitialSettingsTab`, `openSettings` from the interface, the provider state, the `openSettings` callback, and the value object. Update the doc comments ("Settings modal visibility" section disappears; keep Help/DevOps/Debug).

Verify: `npx tsc --noEmit` → no output (this catches any missed reference — there were exactly the call sites listed above).

Commit: `git add -A && git commit -m "feat(settings): render settings as a full work-area view instead of a modal"`

### T5 — Tests

New file `src-tauri/webview/src/components/settings/__tests__/SettingsView.test.tsx` (pattern: mock monaco + bridge like `explorer/__tests__/unified_explorer_entry_content.test.tsx:27-48`):

```tsx
/**
 * SettingsView (was SettingsEditorModal) — full work-area settings.
 *
 * Pins the post-modal conversion: the tab bar renders without a Modal
 * wrapper, tab switching swaps content, and leaving the view persists
 * pending edits (the unmount effect that replaced handleClose).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from '@apinox/request-editor/core';
import { UIProvider } from '../../../contexts/UIContext';

vi.mock('@apinox/request-editor/monaco', () => ({
    MonacoEditorWrapper: ({ value }: { value?: string }) => (
        <textarea data-testid="mock-monaco-json" value={value} onChange={(e) => {}} readOnly />
    ),
    Monaco: {},
}));

vi.mock('../../../utils/bridge', () => ({
    bridge: {
        sendMessage: vi.fn(),
        sendMessageAsync: vi.fn().mockResolvedValue({}),
        emit: vi.fn(),
        isTauri: () => false,
    },
    isTauri: () => false,
}));

import { SettingsView } from '../SettingsView';

const RAW = JSON.stringify({ version: 1, network: { defaultTimeout: 30000 } });

const renderView = (props: Partial<React.ComponentProps<typeof SettingsView>> = {}) => {
    const onSave = vi.fn();
    const utils = render(
        <ThemeProvider standalone={true}>
            <UIProvider>
                <SettingsView rawConfig={RAW} onSave={onSave} {...props} />
            </UIProvider>
        </ThemeProvider>,
    );
    return { onSave, ...utils };
};

describe('SettingsView (full-area settings)', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('renders the tab bar with all seven tabs and no modal chrome', async () => {
        renderView();
        await screen.findByText('General');
        expect(screen.getByText('Environments')).toBeInTheDocument();
        expect(screen.getByText('Globals')).toBeInTheDocument();
        expect(screen.getByText('Integrations')).toBeInTheDocument();
        expect(screen.getByText('Proxy')).toBeInTheDocument();
        expect(screen.getByText('Updates')).toBeInTheDocument();
        expect(screen.getByText('JSON (Advanced)')).toBeInTheDocument();
        // No modal header: the old Modal rendered <ModalTitle>Settings</ModalTitle>
        // (Modal.tsx:227). "Settings" appears nowhere in the view body itself.
        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('switches to the Environments tab on click', async () => {
        renderView();
        fireEvent.click(await screen.findByText('Environments'));
        // EnvironmentsTab renders a "Profiles" list header.
        expect(await screen.findByText('Profiles')).toBeInTheDocument();
    });

    it('persists pending GUI edits on unmount (replaces modal close-save)', async () => {
        const { onSave, unmount } = renderView();
        // Let the initial parse settle (configLoaded flips true after the
        // rawConfig effect runs).
        await screen.findByText('User Interface');
        // Trigger a GUI change through the General tab: find the timeout
        // input and change it. (Label text verified against GeneralTab.)
        const input = document.querySelector('input[type="number"]') as HTMLInputElement;
        expect(input).toBeTruthy();
        fireEvent.change(input, { target: { value: '45000' } });
        // Debounced auto-save (400ms) OR unmount persist must fire onSave
        // with a config object (not raw JSON).
        unmount();
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        const calls = onSave.mock.calls.map((c: any[]) => c[1]).filter(Boolean);
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[calls.length - 1].network.defaultTimeout).toBe(45000);
    });

    it('honors initialTab', async () => {
        renderView({ initialTab: 'globals' });
        expect(await screen.findByText('Variables')).toBeInTheDocument(); // GlobalsTab section header — verify label against GlobalsTab.tsx and adjust if different
    });
});
```

**Before finalizing the test file**, read `GeneralTab.tsx` and `GlobalsTab.tsx` to confirm the exact labels/selectors used above (`User Interface` confirmed at GeneralTab.tsx:61; the number input and the Globals section header need verification — adjust the selectors to what's actually rendered; the test must assert real DOM, not guesses).

Also extend `src-tauri/webview/src/components/sidebar/__tests__/SidebarRail.test.tsx` with one case (append to the existing describe):

```tsx
it('highlights the Settings item when activeView is SETTINGS and routes clicks to onOpenSettings', () => {
    const onOpenSettings = vi.fn();
    const { container } = render(
        <SidebarRail
            activeView={SidebarView.SETTINGS}
            onChangeView={vi.fn()}
            onOpenSettings={onOpenSettings}
        />,
    );
    const settings = container.querySelector('div[title="Settings"]')!;
    expect(settings).toBeTruthy();
    fireEvent.click(settings);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
});
```

Run: `cd src-tauri/webview && npx vitest run src/components/settings src/components/sidebar/__tests__/SidebarRail.test.tsx` → all pass.

Commit: `git add -A && git commit -m "test(settings): SettingsView full-area behavior + rail SETTINGS active state"`

### T6 — Full gates + docs + push

1. `cd src-tauri/webview && npx tsc --noEmit` → no output.
2. `npx vitest run` → `Test Files 45 passed (45)`, `Tests 306 passed (306)` (301 baseline + 4 new SettingsView + 1 new rail).
3. Doc touch-ups (one-liners, same commit or separate `docs:` commit):
   - `packages/request-editor/COMPONENT_INVENTORY.md:92`: `modals/SettingsEditorModal.tsx` → `settings/SettingsView.tsx` (and note it's a work-area view).
   - `docs/CODE_ANALYSIS.md:129`: same path/name update.
4. `git status --short` → only `?? .hermes/` (discard any dev-loop version-file drift first: `git checkout -- package.json scripts/version.js src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/webview/package.json src-tauri/webview/package-lock.json Cargo.lock` IF they show as modified — they drift 363→364 on `tauri:dev` runs).
5. Push to local mirror only (standing policy): `git push local main` → `To /home/mark/apinox-remote.git ... main -> main`, then `git rev-list --left-right --count main...local/main` → `0	0`. GitHub push held.

## Tests / validation summary

| Gate | Command | Expected |
|---|---|---|
| Typecheck | `cd src-tauri/webview && npx tsc --noEmit` | exit 0, no output |
| Unit tests | `cd src-tauri/webview && npx vitest run` | 45 files / 306 tests passed |
| Manual smoke (optional, `npm run tauri:dev`) | Click gear → settings fills work area; switch tabs; edit General timeout → navigate to Explorer → reopen settings, value persisted; JSON tab editor fills height; Esc does nothing (parity: old modal had no Esc handler either) | behaves as described |

TDD note: T5's tests are written against the finished T3/T4 shape (component-extraction refactor — the behavior being pinned is "same as the modal, minus the chrome"). If you prefer strict red-green, write the SettingsView tests first against the renamed-but-still-modal component and watch the "no modal chrome" + "fills height" cases fail before T3's JSX swap.

## Risks, tradeoffs, and open questions

- **Auto-save timing shift (main behavioral risk).** Modal: saved on explicit close (X/overlay) AND debounced mid-edit. View: debounced mid-edit is unchanged; the close-save becomes an unmount effect. Net: leaving the view via the rail persists immediately; a hard app quit mid-edit could lose ≤400ms of unsaved debounce tail (the modal had the same exposure via window-close). Acceptable; the unmount effect closes the gap for normal navigation.
- **Monaco in a flex chain.** `height="100%"` requires the parent chain to have definite heights — the work-area wrapper divs all carry `flex:1; minHeight:0; overflow:hidden` (copied from the NOTES/PROXY blocks), so it resolves. If the JSON editor ever collapses, the fallback is `height="calc(100vh - 140px)"` (the ScriptPlaygroundModal pattern) — but don't preemptively apply it.
- **`initialTab` is now vestigial.** No caller passes a tab today (verified zero `openSettings(tab)` usages). Kept on the props interface for future deep links (cheap, already implemented in the component); deleting it would be equally fine — YAGNI cuts both ways, kept because the prop plumbing already existed.
- **Sidebar content hidden in SETTINGS.** Following the PROXY/MOCK/WATCHER precedent, the unified explorer panel hides (rail stays). That means you can't see your projects while editing settings — consistent with how Proxy behaves today. If Mark wants side-by-side, that's a follow-up (would require NOT adding SETTINGS to `fullPanelView` and giving the work area a split).
- **Mobile drawer.** On mobile the sidebar is a drawer; entering SETTINGS leaves `sidebarExpanded=true` (the wrapper sets it), so the drawer may stay open covering the view. The existing mobile flow auto-closes via backdrop tap; verify during smoke and, if it sticks, add `if (isMobilePlatform) setIsMobileDrawerOpen(false)` to the rail's settings handler. Not pre-empted.
- **Out of scope (YAGNI):** persisting `activeView` across restarts, a Settings entry in the unified sidebar context menu, keyboard shortcut (Cmd+,) — none requested.
- **Docs staleness:** `docs/CODE_ANALYSIS.md` and the inventory md are known-stale snapshots; the one-line updates keep them from actively lying, no deeper refresh attempted.
