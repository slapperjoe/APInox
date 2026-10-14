/**
 * Sidebar traffic-wizard lock regression test.
 *
 * While the traffic→workflow wizard is open (MainContent sets
 * `sidebarLocked` on the SidebarContext value) the whole sidebar must be
 * disabled so the ONLY way out of the wizard is its own "Cancel". Disabled
 * here means:
 *   - the panel gets `aria-disabled` + `data-locked` + a hint title, and
 *   - `pointer-events: none` is applied via its stylesheet class, so all
 *     pointer input (rail nav, the explorer tree, the resize handle) is
 *     inert regardless of what any child onClick does.
 *
 * (View-switching is ALSO blocked at the state level in MainContent via
 * guarded onChangeView/onOpenSettings/onOpenHelp — that layer is not
 * testable here since it lives inside the heavy MainContent; this file pins
 * the render-level disable.)
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Sidebar } from '../Sidebar';
import { SidebarContext } from '../../contexts/SidebarContext';
import { SidebarView } from '@shared/models';

const contextValue: any = {
    testsProps: { projects: [], deleteConfirm: null },
    activeView: SidebarView.UNIFIED_EXPLORER,
    onChangeView: vi.fn(),
    sidebarExpanded: true,
    backendConnected: false,
};

const renderSidebar = (sidebarLocked?: boolean) =>
    render(
        <SidebarContext.Provider value={{ ...contextValue, sidebarLocked }}>
            <Sidebar />
        </SidebarContext.Provider>,
    );

const panelOf = (container: HTMLElement): HTMLElement =>
    container.querySelector('.sidebar-drawer') as HTMLElement;

/** True when the panel's injected styled-components rule sets pointer-events: none. */
const panelIgnoresPointer = (container: HTMLElement): boolean => {
    const panel = panelOf(container);
    const classes = panel.className.split(/\s+/);
    for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRule[];
        try {
            rules = Array.from(sheet.cssRules);
        } catch {
            continue;
        }
        for (const rule of rules) {
            if (
                rule instanceof CSSStyleRule &&
                rule.selectorText &&
                classes.some(c => c && rule.selectorText.includes('.' + c)) &&
                rule.style.getPropertyValue('pointer-events') === 'none'
            ) {
                return true;
            }
        }
    }
    return false;
};

describe('Sidebar traffic-wizard lock', () => {
    it('is inert (pointer-events none) and marked disabled while locked', () => {
        const { container } = renderSidebar(true);
        const panel = panelOf(container);
        expect(panel.getAttribute('data-locked')).toBe('true');
        expect(panel.getAttribute('aria-disabled')).toBe('true');
        expect(panel.getAttribute('title')).toMatch(/Cancel/);
        expect(panelIgnoresPointer(container)).toBe(true);
    });

    it('is fully interactive when not locked', () => {
        const { container } = renderSidebar(false);
        const panel = panelOf(container);
        expect(panel.getAttribute('data-locked')).toBeNull();
        expect(panel.getAttribute('aria-disabled')).toBeNull();
        expect(panelIgnoresPointer(container)).toBe(false);
    });

    it('is interactive by default (lock flag absent)', () => {
        const { container } = renderSidebar();
        const panel = panelOf(container);
        expect(panel.getAttribute('aria-disabled')).toBeNull();
        expect(panelIgnoresPointer(container)).toBe(false);
    });
});
