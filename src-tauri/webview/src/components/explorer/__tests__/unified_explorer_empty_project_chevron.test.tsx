import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { UnifiedExplorerSidebar } from '../UnifiedExplorerSidebar';
import { UnifiedProject } from '@shared/models';

/**
 * A tree row only shows its expand/collapse chevron when it has visible
 * children. An EMPTY project (zero operations — e.g. a project imported
 * from a workspace export that carried no operations) must render without
 * a chevron: there is nothing to expand or collapse.
 */

const makeProject = (name: string, operations: UnifiedProject['operations'] = []): UnifiedProject => ({
    name,
    source: 'wsdl',
    sourceUrl: 'http://example.com/service?WSDL',
    parsedAt: new Date().toISOString(),
    soapVersion: '1.1',
    operations,
});

const OP: UnifiedProject['operations'][number] = {
    id: 'op-1',
    name: 'GetCurrencyRate',
    action: 'http://example.com/GetCurrencyRate',
    targetNamespace: 'http://example.com/',
    originalEndpoint: 'http://example.com/service',
    requests: [],
};

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

describe('UnifiedExplorerSidebar empty-project chevron', () => {
    it('renders NO chevron for a project with zero operations', () => {
        render(<UnifiedExplorerSidebar {...baseProps} projects={[makeProject('EmptySvc')]} />);

        expect(screen.getByText('EmptySvc')).toBeInTheDocument();
        expect(screen.queryByTestId('tree-chevron')).not.toBeInTheDocument();
    });

    it('renders a chevron for a project that has operations', () => {
        render(<UnifiedExplorerSidebar {...baseProps} projects={[makeProject('FullSvc', [OP])]} />);

        expect(screen.getByText('FullSvc')).toBeInTheDocument();
        expect(screen.getByTestId('tree-chevron')).toBeInTheDocument();
    });

    it('renders a chevron only on the populated project when mixed with an empty one', () => {
        render(
            <UnifiedExplorerSidebar
                {...baseProps}
                projects={[makeProject('EmptySvc'), makeProject('FullSvc', [OP])]}
            />,
        );

        expect(screen.getByText('EmptySvc')).toBeInTheDocument();
        expect(screen.getByText('FullSvc')).toBeInTheDocument();
        // The empty project's chevron is gone; the populated project keeps its
        // project-level chevron (it is collapsed, so its operation row — and
        // its chevron — is not rendered yet).
        expect(screen.getAllByTestId('tree-chevron')).toHaveLength(1);
    });

    it('renders NO chevron for an operation that has no visible requests', () => {
        const opNoRequests: UnifiedProject['operations'][number] = {
            ...OP,
            requests: [],
        };
        const opSamplesOnly: UnifiedProject['operations'][number] = {
            ...OP,
            name: 'SampleOnly',
            requests: [{ name: 'sample_request', request: '' } as UnifiedProject['operations'][number]['requests'][number]],
        };
        const opWithRequest: UnifiedProject['operations'][number] = {
            ...OP,
            name: 'WithReq',
            requests: [{ name: 'RealReq', request: '<x/>' } as UnifiedProject['operations'][number]['requests'][number]],
        };
        render(
            <UnifiedExplorerSidebar
                {...baseProps}
                projects={[
                    makeProject('NoReqSvc', [opNoRequests, opSamplesOnly]),
                    makeProject('WithReqSvc', [opWithRequest]),
                ]}
            />,
        );

        // Expand both projects so their operation rows are visible.
        screen.getAllByTestId('tree-chevron').forEach(c => fireEvent.click(c));

        expect(screen.getByText('GetCurrencyRate')).toBeInTheDocument(); // opNoRequests (name reused from OP)
        expect(screen.getByText('SampleOnly')).toBeInTheDocument();
        expect(screen.getByText('WithReq')).toBeInTheDocument();
        // Only the project-level chevron (NowReq/WithReq projects) plus the
        // WithReq operation chevron remain — the two empty ops show none.
        // After expanding, the two project chevrons + the one op chevron = 3.
        expect(screen.getAllByTestId('tree-chevron')).toHaveLength(3);
    });
});
