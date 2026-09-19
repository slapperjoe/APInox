# UI Consistency Audit — Decisions

Audit date: 2026-09-19. Scope: `src-tauri/webview/src` (+ `shared/src/styles/themes.ts`, `index.css`, `tokens.ts`).
Each item below lists the chosen resolution. Items are ordered by the audit list; the suggested implementation order is at the bottom.

## Decisions

### 1. Undefined CSS variables (orphan vars)
**Hybrid.** Re-point most orphan vars at the existing theme palette
(`--apinox-primary`→`--apinox-focusBorder`, `--apinox-border`→`--apinox-panel-border`,
`--apinox-card-background`→`--apinox-editor-background`, etc.). Genuinely new semantic
tokens (accent, error-border/background, tooltip-*, tab-active-border) get added to
`shared/src/styles/themes.ts` for all 6 themes.

### 2. Theme coverage gap
**Fill all 5 non-dark themes** with the ~37 vars the dark theme has (inputValidation-*,
notifications-*, progressBar-background, statusBar-background, editorError/Info/Warning-*,
symbolIcon-*, diffEditor-*, editor line-number, activityBar-*) with theme-appropriate
values. Verify solarized/zed/dankshell sets match after the change.

### 3. Conflicting var() fallbacks
**Normalize every fallback to the canonical theme/index.css value.** One value per var;
fallbacks are safety nets only. Includes the 3 `var(--color-surface)` sites (undefined,
resolves to transparent) → `--apinox-sideBar-background`.

### 4. Status color families
**`tokens.status` is the single status palette** (#22c55e / #f59e0b / #ef4444). Sweep all
other status-family hex (#4caf50, #89d185, #73c991, #3FB950, #f48771, #f44336, #f28b82,
#ddb165, #cca700, #D29922…). `tokens.httpStatus` (semantic 2xx/3xx/4xx/5xx) may keep its
own values for HTTP-code display only. Delete the duplicate `STATUS_COLORS` from
`styles/colors.ts`.

### 5. Legacy `--vscode-*` references
**Convert to `--apinox-*` equivalents** (direct counterparts exist); drop or normalize
the fallbacks per item 3.

### 6. Raw hex in 33 files
**Full sweep.** Replace every hardcoded color with `var()` (new semantic var where needed,
per items 1/2) or a `tokens.*` reference. No raw hex in component styling afterwards.

### 7. Font-size tokens
**Migrate the dominant raw sizes to the fs tokens:** 12px→`--apinox-fs-md`,
11px→`--apinox-fs-sm`, 13px→`--apinox-fs-base`, 10px→`--apinox-fs-xs`. Raw px stays only
for non-scale sizes (9/14/15/16/18/20/24/32) — codify the ones that recur as md/lg/xl
tokens in `tokens.fontSize`. First fix the index.css vs tokens.ts disagreement
(xs 10px vs 11px, sm 11px vs 12px) and make one scale canonical (index.css wins; update
`tokens.fontSize` mappings and `docs/FONT_SIZE_TOKENS.md` to match).

### 8. Section-title / uppercase labels
**One shared `SectionLabel`** (CSS class or small component) built on
`tokens.sectionTitle` (11px/700/uppercase/0.3px, `--apinox-sideBarTitle-foreground`).
Delete the 30+ inline copies and the dead `.section-header-label` rule. At most 2–3
sanctioned variants (sidebar / panel / inline).

### 9. Font-family
**Fira Code wins.** Remove the Segoe UI `--apinox-font-family` override from the 6 shared
themes (or set them to the Fira Code stack); ThemeContext must stop clobbering the
index.css value; `tokens.ts` uses the var instead of its own `-apple-system` stack.

### 10. Font-weight
**Introduce font-weight tokens** `--fw-regular`/`--fw-medium`/`--fw-semibold`/`--fw-bold`
(400/500/600/700), used via `var()` everywhere. Replace every `bold` with the bold token.

### 11. Spacing
**One scale: `styles/spacing.ts` is the single TS source.** Re-derive the `--space-*` CSS
vars to the same values (4/8/12/16/20/24/32). Delete `tokens.space`. Migrate 6px and 10px
sites to the nearest step (6→8, 10→8 or 12).

### 12. Border weights
**1px standard.** Structural borders and separators are 1px (separators use a
subtle/translucent color, not a thinner width). Migrate 0.5/0.75/0.85/0.9/0.95/1.1/1.4/1.5/1.6px
sites to 1px. 2px only for emphasis (focus, selected outline).

### 13. Border radius
**Two-value system: 2px buttons, 4px surfaces.** All Button family variants (Primary/
Secondary/Danger/IconButton/HeaderButton/RunButton/ToggleButton) → 2px; cards/inputs/
panels/modals → 4px; 50% chips/badges unchanged. Migrate the 3px button and 5/6/8/10px
strays.

### 14. Modal padding
**Move `MODAL_DEFAULTS` onto the unified spacing scale:** header/footer `8px 12px`,
body 12px or 16px (from `SPACING_*`), gap 8px. Remove 15px from `DEPRECATED_SPACING`
once unused.

### 15. Icon sizes
**5-step scale: 12 / 14 / 16 / 18 / 20.** 12 = meta/inline-dense, 14 = dense rows +
default rail, 16 = buttons/headers/inputs, 18 = larger controls, 20 = rail active /
empty states. Migrate strays: 10→12, 13→14, 15→16; the 32px outliers → 20 (or 24 only
for empty-state art).

### 16+17. Buttons
**Migrate all ad-hoc `styled.button` definitions to the shared Button family:** TitleBar (3),
WorkflowBuilderModal (3), ContextHelpButton, HelpModal, TrafficDetails, EnvironmentsTab,
NotesContextToolbar, proxy `btnStyle` consts → PrimaryButton/SecondaryButton/IconButton/
HeaderButton (parameterize the shared component where they add a distinct style, e.g.
full-width). Also fix the zero-usage `DangerButton`/`ToggleButton` exports (either wire
them into the migrated sites or delete them).

### 18. Spinners
**One shared `<Spinner>`** in `components/common/` (lucide `Loader2` + CSS keyframes,
`size`/`className` props). Replace all 4+ ad-hoc implementations (border-ring div in
UnifiedExplorerSidebar, styled(Loader2) in IntegrationsTab/UpdatesTab/TestCaseView,
@keyframes spin in AddToDevOpsModal).

### 19. Tooltips
**Shared `Tooltip` primitive** (themed via the new `--apinox-tooltip-*` vars from item 1).
Use on high-traffic icon buttons (rail, panel headers, tree rows); native `title=`
stays acceptable for one-off text-only affordances.

### 20. Empty states
**Shared `EmptyState` everywhere.** Replace the ~10 ad-hoc "No X yet" blocks
(BreakpointsPage, ConditionStepEditor, PerformanceSuiteEditor, WelcomePanel,
RequestStepEditor, …) with `<EmptyState title description action>`.

### 21. Brand gradient
**Brand-accent token.** Define `--apinox-brand-gradient` (or brand/brand2 colors) in the
shared themes; TitleBar + mobile header consume the token. The gradient stays as the one
sanctioned brand accent, with theme variants.

### 22. Focus states
**Global `:focus-visible` rule** in index.css:
`:focus-visible { outline: 2px solid var(--apinox-focusBorder); outline-offset: 2px; }`.
`outline: none` stays only where a component draws its own focus ring; add focus rings
to the shared icon-button components.

### 23. Mobile/iOS machinery
**Remove the dead mobile/iOS machinery** from index.css + Sidebar.tsx: `.mobile-header`,
`.sidebar-drawer`, `.content-row`, `data-platform="ios"/"android"` rules, safe-area
insets, 44px touch-target floor. Keep only what the desktop TitleBar needs (the 32px
narrow-desktop hamburger + its padding offsets).

### 24. Modal ARIA
**Add `role="dialog"` + `aria-modal="true"` + `aria-labelledby` to the shared Modal**
(one place in Modal.tsx). This also revives the (currently dead) global `[role="dialog"]`
responsive rule in index.css, which then governs sizing.

## Implementation order (suggested)

1. **Themes foundation** — items 1, 2, 9, 10 (shared themes.ts + index.css + tokens.ts).
2. **Color sweep** — items 3, 4, 5, 6 (now safe because the token surface is complete).
3. **Typography/geometry** — items 7, 8, 11, 12, 13, 14, 15.
4. **Components** — items 16+17, 18, 19, 20, 24.
5. **Brand + a11y + cleanup** — items 21, 22, 23.

Verify per group: `cd src-tauri/webview && npx tsc --noEmit`, `npm test` at root.
Commit per group (logical groups, not one wip commit).
