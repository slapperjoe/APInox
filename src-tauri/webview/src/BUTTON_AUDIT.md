# APInox Button Audit Report

Generated to document button height inconsistencies and remediation applied.

---

## Common Button Library (`src/components/common/Button.tsx`)

These are the canonical button variants used across the app.

| Button | Padding | Font Size | Font Weight | Border Radius | Computed Height* | CSS Theme Vars |
|--------|---------|-----------|-------------|---------------|-----------------|----------------|
| `IconButton` | `4px` | `13px` (base) | `400` (base) | `3px` | ~24px | `--apinox-icon-foreground`, `--apinox-toolbar-hoverBackground` |
| `HeaderButton` | `2px` | `13px` (base) | `400` (base) | `3px` | ~20px | `--apinox-toolbar-hoverBackground` |
| `PrimaryButton` | `6px 14px` | `13px` (base) | `500` | `2px` | ~28px | `--apinox-button-background`, `--apinox-button-foreground`, `--apinox-button-hoverBackground` |
| `SecondaryButton` | `6px 14px` | `13px` (base) | `400` | `2px` | ~28px | `--apinox-button-secondaryBackground`, `--apinox-button-secondaryForeground`, `--apinox-button-secondaryHoverBackground`, `--apinox-button-border` |
| `DangerButton` | `6px 14px` | `13px` (base) | `500` | `2px` | ~28px | `--apinox-testing-iconFailed` |
| `TextButton` | `2px 6px` | `13px` (base) | `400` (base) | none | ~20px | `--apinox-textLink-foreground`, `--apinox-textLink-activeForeground` |
| `ToggleButton` | `6px 8px` | `11px` | `500/600` | `4px` | ~25px | `--apinox-button-background`, `--apinox-input-border`, `--apinox-list-hoverBackground` |
| `RunButton` | `4px` | `13px` (base) | `400` (base) | `3px` | ~24px | `--apinox-testing-iconPassed`, `--apinox-toolbar-hoverBackground` |
| `StopButton` | `4px` | `13px` (base) | `400` (base) | `3px` | ~24px | `--apinox-testing-iconFailed`, `--apinox-toolbar-hoverBackground` |

> \*Computed height = top padding + bottom padding + (font-size × ~1.2 line-height). Actual render may vary slightly by browser.

---

## Non-Standard / Locally-Defined Buttons (Resolved)

The following buttons previously re-implemented their own padding, font-size, font-weight, and border-radius rather than using the shared library. They have been refactored to import and extend `common/Button.tsx` components.

### `components/modals/Modal.tsx` — `Button` (exported)
- Local `styled.button` definition removed.
- Now re-exports `PrimaryButton as Button` from `common/Button.tsx` for backward compatibility with all existing consumers.
- Internal `CloseButton` now aliases `IconButton` from `common/Button.tsx`.

### `components/SaveErrorDialog.tsx`
- Local variant-based `Button` (with `$variant` prop) removed.
- JSX updated to use `PrimaryButton`, `SecondaryButton`, `DangerButton` from `common/Button.tsx` directly.
- Local `CloseButton` now aliases `IconButton` from `common/Button.tsx`.

### `components/modals/ScriptPlaygroundModal.tsx` — `RunButton` / `ApplyButton`
- Local `styled.button` definitions removed.
- Now uses `styled(PrimaryButton)` and `styled(SecondaryButton)` with only a `gap: 8px` extension for icon+label layout.

### `components/ImportTestCaseModal.tsx` — `CancelButton`
- Local `styled.button` definition removed.
- `CancelButton` now simply aliases `SecondaryButton` from `common/Button.tsx`.

---

## Intentionally Compact / Specialized Buttons

These buttons are purposely smaller due to their context (toolbar, sidebar, status chips) and were **not changed**:

| Button | File | Padding | Font Size | Height | Reason |
|--------|------|---------|-----------|--------|--------|
| `ViewTab` | `proxy/TrafficDetails.tsx` | `2px 9px` | `11px` | ~17px | Compact tab selector in traffic viewer |
| `Btn` / `PrimaryBtn` / `SecondaryBtn` / `DangerBtn` | `proxy/FileWatcherPage.tsx` | `3px 10px` | `11px` | ~18px | Compact status-chip buttons in file watcher panel |
| `BrowseBtn` | `proxy/FileWatcherPage.tsx` | `4px 10px` | `12px` | ~21px | Inline file-browse button for input fields |
| `AddStepButton` | `modals/WorkflowBuilderModal.tsx` | `8px` | `13px` | ~32px | Full-width workflow step adder |
| `AddNestedStepButton` | `modals/WorkflowBuilderModal.tsx` | `4px 8px` | `11px` | ~21px | Nested step picker |
| `DropdownButton` | `modals/WorkflowBuilderModal.tsx`, `workspace/LoopStepEditor.tsx` | `4px 8px` / `8px 12px` | `11px` / `13px` | varies | Step-type dropdown triggers |
| `AddStepButton` | `workspace/WorkflowEditor.tsx` | `8px` | `13px` | ~32px | Full-width workflow step adder |
| `ClearButton` | `TitleBar.tsx`, `MacOSTitleBarSearch.tsx` | `2px` | `13px` | ~20px | Search field clear icon |
| `LastSearchBreadcrumb` | `TitleBar.tsx` | `4px 10px` | `11px` | ~21px | Recent search breadcrumb chip |
| `WindowButton` | `TitleBar.tsx` | — | — | `height: 100%` | Window traffic-light buttons |
| `FilterButton` | `sidebar/HistorySidebar.tsx` | `2px 8px` | `11px` | `22px` explicit | History sidebar filter chip |
| `ClearFiltersButton` | `sidebar/HistorySidebar.tsx` | `2px 8px` | `11px` | `22px` explicit | Clear filters chip |
| `FilterToggle` | `sidebar/HistorySidebar.tsx` | `4px 8px` | `12px` | ~22px | Filter panel expand toggle |
| `Tab` | `HelpModal.tsx` | `8px 16px` | `13px` | ~28px | Help modal tab selector |
| `SecretToggle` | `modals/settings/EnvironmentsTab.tsx` | `4px 8px` | `11px` | ~21px | Secret show/hide toggle |
| `MiniButton` | `modals/ScriptPlaygroundModal.tsx` | `2px 6px` | `10px` | ~17px | Compact inline action |
| `MenuItem` | `common/DropdownMenu.tsx` | `10px 12px` | `13px` | ~36px | Dropdown menu item |
| `MenuButton` | `common/DropdownMenu.tsx` | `4px` | `13px` | ~24px | Dropdown trigger icon |
| `ToggleButton` | `common/ExpandCollapseToggle.tsx` | `4px` | `13px` | ~24px | Tree expand/collapse |
| `LinkButton` | `modals/ExportWorkspaceModal.tsx` | `0` | `0.9em` | inherit | Inline text link |
| `StyledHelpButton` | `ContextHelpButton.tsx` | `4px` | `13px` | ~24px | Help icon button |
| `CopyButton` | `ErrorBoundary.tsx` | `6px 12px` | `13px` | ~28px | Copy error text |
| `IconButton` (local) | `sidebar/ScrapbookPanel.tsx` | `2px` | `13px` | ~20px | Scrapbook icon action |
| `HeaderButton` (local) | `sidebar/shared/SidebarStyles.tsx` | `2px` | `13px` | ~20px | Sidebar section header action |

---

## Root Cause: Global `min-height: 44px`

The primary visual inconsistency was caused by a global CSS rule in `index.css`:

```css
button, [role="button"], ... {
    min-height: 44px;
}
```

This rule applied a 44px minimum height to **every button** across the entire application, regardless of the button's intended size. It was intended as a mobile touch-target floor (per Apple HIG / Material Design guidelines), but was incorrectly scoped to all screen sizes.

**Fix applied**: The rule was moved inside `@media (max-width: 899px)` so it only applies on mobile/tablet screens. A separate explicit 44px height is kept for `.mobile-hamburger` which must always be touch-sized.

The `.touch-compact` opt-out class remains available for components that need compact sizes even on mobile.

---

## Summary of Changes

1. **`src/index.css`** — Scoped `min-height: 44px` to `@media (max-width: 899px)` only
2. **`src/components/modals/Modal.tsx`** — Removed local `Button` definition; re-exports `PrimaryButton as Button` from `common/Button.tsx`. Local `CloseButton` now aliases `IconButton`.
3. **`src/components/SaveErrorDialog.tsx`** — Removed local variant-based `Button`; imports and uses `PrimaryButton`, `SecondaryButton`, `DangerButton` directly. `CloseButton` aliases `IconButton`.
4. **`src/components/modals/ScriptPlaygroundModal.tsx`** — Removed local `RunButton`/`ApplyButton`; extends `PrimaryButton`/`SecondaryButton` with only `gap: 8px` for icon layout.
5. **`src/components/ImportTestCaseModal.tsx`** — Removed local `CancelButton`; aliases `SecondaryButton`.

**Result**: All primary action buttons (Primary, Secondary, Danger) now render at a consistent **~28px height** on desktop, and all styling (padding, font-size, font-weight, border-radius, colours) lives in one place: `common/Button.tsx`.
