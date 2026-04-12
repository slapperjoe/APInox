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

## Non-Standard / Locally-Defined Buttons

These buttons were defined outside of `common/Button.tsx` and had inconsistent sizing.

### `components/modals/Modal.tsx` — `Button` (exported)
- **Before**: `padding: 4px 12px` (used `SPACING_XS`/`SPACING_MD` constants), `font-size: unset`, `font-weight: unset`, `border-radius: 2px` → **~24px height**
- **After**: `padding: 6px 14px`, `font-size: 13px`, `font-weight: 500`, `border-radius: 2px` → **~28px height**
- CSS vars: `--apinox-button-background`, `--apinox-button-foreground`, `--apinox-button-hoverBackground`

### `components/SaveErrorDialog.tsx` — `Button` (variant prop)
- **Before**: `padding: 8px 16px`, `font-size: 13px`, `font-weight: unset`, `border-radius: 4px` → **~32px height**
- **After**: `padding: 6px 14px`, `font-size: 13px`, `font-weight: 500`, `border-radius: 2px` → **~28px height**
- CSS vars: `--apinox-button-background`, `--apinox-button-foreground`, `--apinox-button-secondaryBackground`, `--apinox-button-secondaryForeground`, `--apinox-errorForeground`

### `components/modals/ScriptPlaygroundModal.tsx` — `RunButton` / `ApplyButton`
- **Before**: `padding: 8px 16px`, `font-weight: 600`, `border-radius: 2px` → **~32px height**
- **After**: `padding: 6px 14px`, `font-weight: 500/400`, `border-radius: 2px` → **~28px height**
- CSS vars: `--apinox-button-background`, `--apinox-button-foreground`, `--apinox-button-secondaryBackground`

### `components/ImportTestCaseModal.tsx` — `CancelButton`
- **Before**: `padding: 8px 16px`, `font-size: unset`, `border-radius: 4px` → **~32px height**
- **After**: `padding: 6px 14px`, `font-size: 13px`, `font-weight: 400`, `border-radius: 2px` → **~28px height**
- CSS vars: `--apinox-button-secondaryBackground`, `--apinox-button-secondaryForeground`

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
2. **`src/components/modals/Modal.tsx`** — Fixed exported `Button` padding to `6px 14px`, added `font-size: 13px` and `font-weight: 500`
3. **`src/components/SaveErrorDialog.tsx`** — Fixed `Button` padding to `6px 14px`, border-radius to `2px`, added consistent `font-weight`
4. **`src/components/modals/ScriptPlaygroundModal.tsx`** — Fixed `RunButton` and `ApplyButton` padding to `6px 14px`, aligned font-weight with common library
5. **`src/components/ImportTestCaseModal.tsx`** — Fixed `CancelButton` padding to `6px 14px`, border-radius to `2px`, added `font-size: 13px` and `font-weight: 400`

**Result**: All primary action buttons (Primary, Secondary, Danger) now render at a consistent **~28px height** on desktop.
