/**
 * Navigation + direct-URL (deep-link) regression test for the unified explorer
 * as the entry point (t_1340c643).
 *
 * The legacy EXPLORER (WSDL) rail view was retired in Phase 6 and the legacy
 * PROJECTS ("Workspace") rail entry was removed in Phase A (t_762df439). The
 * unified explorer is now the entry point. These tests pin the navigation
 * resolution so they FAIL if the workspace/explorer tab reappears or the entry
 * points stop resolving to the unified explorer:
 *
 *   1. Every user (returning or first-run) starts on UNIFIED_EXPLORER. The
 *      former version-bump "welcome" (HOME) flow was removed with the
 *      changelog page — there is no welcome screen to route to anymore.
 *   2. The `SwitchToView` deep-link ("direct URL access") for the legacy
 *      `'explorer'` alias and `'unified_explorer'` both resolve to
 *      UNIFIED_EXPLORER — the old WSDL-explorer entry point now lands on the
 *      unified explorer.
 *   3. `'projects'` redirects to UNIFIED_EXPLORER (Phase B t_86c34d38 EXPLICIT
 *      DECISION: the PROJECTS view + enum member are deleted; the legacy
 *      deep-link key is retained for backward compat and resolves to the
 *      sole project surface — see audit §5/§6). This pins the redirect so a
 *      future change to it is deliberate.
 *   4. Other views (tests) are unaffected.
 *
 * This exercises the REAL NavigationProvider message handler + viewMap (no
 * context mocking), driving the same `window` `message` events the production
 * bridge posts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';
import { NavigationProvider, useNavigation } from '../NavigationContext';
import { SidebarView } from '@shared/models';
import { BackendCommand } from '@shared/messages';

/** Reads the live activeView and surfaces it for assertions. */
const Probe: React.FC = () => {
    const { activeView, sidebarExpanded } = useNavigation();
    return (
        <div
            data-testid="probe"
            data-active={activeView}
            data-expanded={sidebarExpanded ? '1' : '0'}
        >
            {activeView}
        </div>
    );
};

/** Reset localStorage so startup view resolution is deterministic. */
const seedClean = () => {
    localStorage.clear();
};

/** Post a SwitchToView deep-link through the same window message channel. */
const dispatchSwitchToView = (view: string) =>
    act(async () => {
        // jsdom's `window.postMessage` requires a targetOrigin ('*').
        window.postMessage({ command: BackendCommand.SwitchToView, view }, '*');
        // `postMessage` dispatches the `message` event as a task; let it flush.
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));
    });

beforeEach(() => {
    vi.clearAllMocks();
});

describe('NavigationContext — unified explorer entry point (deep-link / direct-URL)', () => {
    it('starts a returning user on the unified explorer (not the legacy workspace)', () => {
        seedClean();
        render(
            <NavigationProvider>
                <Probe />
            </NavigationProvider>,
        );

        expect(screen.getByTestId('probe')).toHaveAttribute('data-active', SidebarView.UNIFIED_EXPLORER);
    });

    it('starts a first-run user on the unified explorer (no welcome screen anymore)', () => {
        seedClean();
        render(
            <NavigationProvider>
                <Probe />
            </NavigationProvider>,
        );

        // The version-bump "welcome" (HOME) flow was removed with the
        // changelog page — a fresh install boots straight into the explorer.
        expect(screen.getByTestId('probe')).toHaveAttribute('data-active', SidebarView.UNIFIED_EXPLORER);
    });

    it('redirects the legacy "explorer" deep-link to the unified explorer', async () => {
        seedClean();
        render(
            <NavigationProvider>
                <Probe />
            </NavigationProvider>,
        );

        await dispatchSwitchToView('explorer');

        await waitFor(() =>
            expect(screen.getByTestId('probe')).toHaveAttribute('data-active', SidebarView.UNIFIED_EXPLORER),
        );
    });

    it('resolves the "unified_explorer" deep-link to the unified explorer', async () => {
        seedClean();
        render(
            <NavigationProvider>
                <Probe />
            </NavigationProvider>,
        );

        await dispatchSwitchToView('unified_explorer');

        await waitFor(() =>
            expect(screen.getByTestId('probe')).toHaveAttribute('data-active', SidebarView.UNIFIED_EXPLORER),
        );
    });

    it('redirects the legacy "projects" deep-link to the unified explorer (Phase B)', async () => {
        seedClean();
        render(
            <NavigationProvider>
                <Probe />
            </NavigationProvider>,
        );

        // Phase B (t_86c34d38) EXPLICIT DECISION: the PROJECTS view is deleted
        // (the SidebarView.PROJECTS enum member is gone). The legacy 'projects'
        // deep-link key is retained for backward compat and now resolves to
        // the unified explorer — the sole project surface. Pinned so a future
        // change to the redirect target is deliberate (audit §5/§6 — Phase B).
        await dispatchSwitchToView('projects');

        await waitFor(() =>
            expect(screen.getByTestId('probe')).toHaveAttribute('data-active', SidebarView.UNIFIED_EXPLORER),
        );
    });

    it('leaves other views (tests) unaffected', async () => {
        seedClean();
        render(
            <NavigationProvider>
                <Probe />
            </NavigationProvider>,
        );

        await dispatchSwitchToView('tests');

        await waitFor(() => expect(screen.getByTestId('probe')).toHaveAttribute('data-active', SidebarView.TESTS));
    });
});
