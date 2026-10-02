/**
 * Sidebar width-resize regression test.
 *
 * The sidebar (`.sidebar-drawer`) is resizable by dragging the divider on its
 * right edge. It must:
 *   - render a visible drag handle (`sidebar-resize-handle`),
 *   - size the panel as a PERCENT of the window width (so it tracks window
 *     resizes), seeded from localStorage and defaulting to 15%,
 *   - clamp the dragged width to the 5–25% band,
 *   - persist the final percentage on mouseup.
 *
 * The width is set via a styled-components class (not an inline style) and
 * jsdom does not lay it out, so `panelWidthPct` resolves the generated class
 * on the panel and reads the `width` value from the injected stylesheet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { Sidebar } from '../Sidebar';
import { SidebarContext } from '../../contexts/SidebarContext';
import { SidebarView } from '@shared/models';

const STORAGE_KEY = 'apinox_sidebar_width_pct';

// Minimal context value — only the fields Sidebar reads. Cast away the
// prop-group exhaustiveness; Sidebar never touches them in the UNIFIED view
// with no unifiedProps (the content pane is hidden).
const contextValue: any = {
    testsProps: { projects: [], deleteConfirm: null },
    activeView: SidebarView.UNIFIED_EXPLORER,
    onChangeView: vi.fn(),
    sidebarExpanded: true,
    backendConnected: false,
};

const renderSidebar = (initialPct?: number) => {
    if (initialPct !== undefined) {
        window.localStorage.setItem(STORAGE_KEY, String(initialPct));
    }
    return render(
        <SidebarContext.Provider value={contextValue}>
            <Sidebar />
        </SidebarContext.Provider>,
    );
};

/** The panel is the top-level div (the .sidebar-drawer). */
const panelOf = (container: HTMLElement): HTMLElement =>
    container.querySelector('.sidebar-drawer') as HTMLElement;

/**
 * Resolve the panel's width as a percentage. The width is declared in a
 * styled-components class on the panel (e.g. `.sc-xxx { width: 15% }`), not an
 * inline style, so read it back from the injected stylesheet by matching the
 * panel's generated class name.
 */
const panelWidthPct = (container: HTMLElement): number => {
    const panel = panelOf(container);
    const classes = panel.className.split(/\s+/);
    for (const sheet of document.styleSheets) {
        let rules: CSSRule[] = [];
        try {
            rules = Array.from(sheet.cssRules);
        } catch {
            continue;
        }
        for (const rule of rules) {
            if (
                rule instanceof CSSStyleRule &&
                rule.selectorText &&
                classes.some(c => c && rule.selectorText!.includes('.' + c))
            ) {
                const w = rule.style.getPropertyValue('width');
                if (w && w.endsWith('%')) {
                    return parseFloat(w);
                }
            }
        }
    }
    throw new Error('panel width rule not found in stylesheets');
};

beforeEach(() => {
    window.localStorage.clear();
    // Deterministic viewport for the percent/px math.
    window.innerWidth = 1000;
});

describe('Sidebar width resize', () => {
    it('sizes the panel as a percentage of the window (default 15%)', () => {
        const { container } = renderSidebar();
        expect(panelWidthPct(container)).toBe(15);
    });

    it('seeds the width from the persisted percentage', () => {
        const { container } = renderSidebar(22);
        expect(panelWidthPct(container)).toBe(22);
    });

    it('clamps an out-of-band persisted value back into the band', () => {
        // A stored 40% (from an older build or a corrupt value) must clamp to
        // the 25% ceiling on load.
        const { container } = renderSidebar(40);
        expect(panelWidthPct(container)).toBe(25);
    });

    it('renders a drag handle', () => {
        renderSidebar();
        expect(screen.getByTestId('sidebar-resize-handle')).not.toBeNull();
    });

    it('clamps a drag past the right bound to 25% and persists it', () => {
        const { container } = renderSidebar(15);
        const handle = screen.getByTestId('sidebar-resize-handle');
        act(() => {
            fireEvent.mouseDown(handle, { clientX: 150 });
        });
        // 15% of 1000px = 150px start; +1000px → far past the 25% bound.
        act(() => {
            fireEvent.mouseMove(document, { clientX: 1150 });
        });
        act(() => {
            fireEvent.mouseUp(document);
        });
        expect(panelWidthPct(container)).toBe(25);
        expect(window.localStorage.getItem(STORAGE_KEY)).toBe('25');
    });

    it('clamps a drag past the left bound to 5% and persists it', () => {
        const { container } = renderSidebar(15);
        const handle = screen.getByTestId('sidebar-resize-handle');
        act(() => {
            fireEvent.mouseDown(handle, { clientX: 150 });
        });
        // 150px start − 1000px → far below the 5% bound.
        act(() => {
            fireEvent.mouseMove(document, { clientX: -850 });
        });
        act(() => {
            fireEvent.mouseUp(document);
        });
        expect(panelWidthPct(container)).toBe(5);
        expect(window.localStorage.getItem(STORAGE_KEY)).toBe('5');
    });

    it('tracks an in-band drag to the resulting percentage', () => {
        const { container } = renderSidebar(15);
        const handle = screen.getByTestId('sidebar-resize-handle');
        act(() => {
            fireEvent.mouseDown(handle, { clientX: 150 });
        });
        // +100px → 150 + 100 = 250px → 25% of 1000.
        act(() => {
            fireEvent.mouseMove(document, { clientX: 250 });
        });
        act(() => {
            fireEvent.mouseUp(document);
        });
        expect(panelWidthPct(container)).toBe(25);
        expect(window.localStorage.getItem(STORAGE_KEY)).toBe('25');
    });
});
