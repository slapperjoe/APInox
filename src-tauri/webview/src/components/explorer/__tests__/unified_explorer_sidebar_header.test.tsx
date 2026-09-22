import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { UnifiedExplorerSidebar } from '../UnifiedExplorerSidebar';
import { UnifiedProject } from '@shared/models';

/**
 * Unified explorer sidebar header.
 *
 * The header renders the "UNIFIED EXPLORER" title only. The former "+" Add
 * button (New Request / Load Definition) was removed: request creation is
 * reachable from the operation right-click menu and the main-area Create
 * Request button, and definition loading from the main-area top bar's URL
 * loader — so the header no longer offers those two-step flows.
 */

// ── fixtures ─────────────────────────────────────────────────────────────────
const makeProject = (name = 'CountryInfo'): UnifiedProject => ({
    name,
    source: 'wsdl',
    sourceUrl: `http://example.org/${name}?WSDL`,
    parsedAt: new Date().toISOString(),
    soapVersion: '1.1',
    operations: [
        {
            id: `${name}-op-1`,
            name: 'GetCurrencyRate',
            action: `http://example.org/${name}/GetCurrencyRate`,
            targetNamespace: `http://example.org/${name}/`,
            originalEndpoint: `http://example.org/${name}`,
            requests: [],
        },
    ],
});

const baseProps: Omit<React.ComponentProps<typeof UnifiedExplorerSidebar>, 'projects'> = {
    selectedNode: null,
    onSelectNode: vi.fn(),
    onRefreshProject: vi.fn(),
    onDeleteProject: vi.fn(),
    onDeleteOperation: vi.fn(),
    onDeleteRequest: vi.fn(),
    onNewRequest: vi.fn(),
    onExportProject: vi.fn(),
    onReorderOperation: vi.fn(),
    onReorderRequest: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('UnifiedExplorerSidebar header', () => {
    it('renders the UNIFIED EXPLORER title', () => {
        render(<UnifiedExplorerSidebar {...baseProps} projects={[makeProject()]} />);

        expect(screen.getByText('Unified Explorer')).toBeInTheDocument();
    });

    it('shows the title even with zero projects', () => {
        render(<UnifiedExplorerSidebar {...baseProps} projects={[]} />);

        expect(screen.getByText('Unified Explorer')).toBeInTheDocument();
    });

    it('no longer renders the "+" Add button', () => {
        render(<UnifiedExplorerSidebar {...baseProps} projects={[makeProject()]} />);

        expect(screen.queryByLabelText('Add')).not.toBeInTheDocument();
    });
});
