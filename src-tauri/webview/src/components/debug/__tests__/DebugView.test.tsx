/**
 * DebugView guard.
 *
 * The Debug console was a 900px modal with a max height, so its tall content areas could not
 * reach the last section — the reader saw a heading with nothing under it. It is a full
 * work-area view now (like Settings), with the tab bar pinned and the body scrolling.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DebugView } from '../DebugView';

describe('DebugView', () => {
    it('renders as a work-area view with its two tabs', () => {
        render(<DebugView />);

        expect(screen.getByText(/Logs & System Info/)).toBeInTheDocument();
        expect(screen.getByText(/Certificate & Proxy/)).toBeInTheDocument();

        // The tab bar is pinned; the body is the scroll area.
        const body = screen.getByTestId('scroll-area');
        expect(body.style.overflow).toBe('auto');
        expect(body.style.minHeight).toBe('0');
    });

    it('shows the diagnostics panel — the checks that had no backend', () => {
        render(<DebugView />);
        fireEvent.click(screen.getByText(/Certificate & Proxy/));

        // Every check in this panel previously threw
        // "Command 'checkCertificateStore' not implemented"; the commands exist now.
        expect(screen.getByText('Run Certificate Check')).toBeInTheDocument();
        expect(screen.getByText('Run Proxy Check')).toBeInTheDocument();
    });
});
