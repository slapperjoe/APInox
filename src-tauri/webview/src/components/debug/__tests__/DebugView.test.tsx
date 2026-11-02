/**
 * DebugView guard.
 *
 * The Debug console was a 900px modal with a max height, so its tall content areas could not
 * reach the last section — the reader saw a heading with nothing under it. It is a full
 * work-area view now (like Settings), with the tab bar pinned and the body scrolling.
 *
 * It is deliberately not on the rail: the title-bar logo double-click is the only way in, so
 * the view carries its own Return control, which needs the navigation context.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { DebugView } from '../DebugView';
import { NavigationProvider, useNavigation } from '../../../contexts/NavigationContext';
import { SidebarView } from '@shared/models';

const renderView = () => {
    let nav: ReturnType<typeof useNavigation> | undefined;
    const Capture = () => {
        nav = useNavigation();
        return null;
    };
    const utils = render(
        <NavigationProvider>
            <Capture />
            <DebugView />
        </NavigationProvider>,
    );
    return { nav, ...utils };
};

describe('DebugView', () => {
    it('renders as a work-area view with its two tabs', () => {
        renderView();

        expect(screen.getByText(/Logs & System Info/)).toBeInTheDocument();
        expect(screen.getByText(/Certificate & Proxy/)).toBeInTheDocument();

        // The tab bar is pinned; the body is the scroll area.
        const body = screen.getByTestId('scroll-area');
        expect(body.style.overflow).toBe('auto');
        expect(body.style.minHeight).toBe('0');
    });

    it('returns to the view the user came from', async () => {
        // Debug has no rail entry, so the double-click is the only way in; the view has to
        // provide the way back, otherwise the user is stuck in it.
        let nav: ReturnType<typeof useNavigation> | undefined;
        const Probe = () => {
            nav = useNavigation();
            return <span data-testid="probe">{nav.activeView}</span>;
        };
        render(
            <NavigationProvider>
                <Probe />
                <DebugView />
            </NavigationProvider>,
        );

        // Enter it the way the title bar does, from Tests. `setActiveView` wraps the update in
        // startTransition, so the flush has to be awaited.
        await act(async () => { nav!.setActiveView(SidebarView.TESTS); });
        await act(async () => { nav!.setActiveView(SidebarView.DEBUG); });
        expect(screen.getByTestId('probe').textContent).toBe(SidebarView.DEBUG);
        expect(nav!.previousView).toBe(SidebarView.TESTS);

        fireEvent.click(screen.getByTestId('debug-close'));
        expect(screen.getByTestId('probe').textContent).toBe(SidebarView.TESTS);
    });

    it('shows the diagnostics panel — the checks that had no backend', () => {
        renderView();
        fireEvent.click(screen.getByText(/Certificate & Proxy/));

        // Every check in this panel previously threw
        // "Command 'checkCertificateStore' not implemented"; the commands exist now.
        expect(screen.getByText('Run Certificate Check')).toBeInTheDocument();
        expect(screen.getByText('Run Proxy Check')).toBeInTheDocument();
    });
});
