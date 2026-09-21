import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnifiedExplorerSidebar } from '../UnifiedExplorerSidebar';

/**
 * Projects render in alphabetical order (by display name, then name),
 * regardless of the order the backend returns them (filesystem order).
 * Pinned here so a regression to unsorted rendering is caught.
 */
describe('UnifiedExplorerSidebar project alphabetical order', () => {
    const project = (name: string) => ({
        id: name,
        name,
        displayName: name,
        operations: [],
    });

    it('sorts projects A->Z by display name', () => {
        // Deliberately out of order: Z, A, M.
        const projects = [project('Zeta'), project('Alpha'), project('Mid')];
        render(<UnifiedExplorerSidebar projects={projects as any} />);

        const zeta = screen.getByText('Zeta');
        const alpha = screen.getByText('Alpha');
        const mid = screen.getByText('Mid');

        // In DOM order the rows must read Alpha, Mid, Zeta.
        expect(
            alpha.compareDocumentPosition(mid) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy(); // Alpha precedes Mid
        expect(
            mid.compareDocumentPosition(zeta) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy(); // Mid precedes Zeta
    });

    it('is case-insensitive (sensitivity: base)', () => {
        const projects = [project('zebra'), project('Apple')];
        render(<UnifiedExplorerSidebar projects={projects as any} />);

        const apple = screen.getByText('Apple');
        const zebra = screen.getByText('zebra');
        expect(
            apple.compareDocumentPosition(zebra) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy(); // Apple precedes zebra case-insensitively
    });
});
