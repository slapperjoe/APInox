import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { UnifiedExplorerSidebar } from '../UnifiedExplorerSidebar';
import { UnifiedProject } from '@shared/models';

/**
 * A tree row reserves a fixed-width chevron SLOT on every row (so the icon +
 * text line up across rows), but only renders an actual expand/collapse
 * chevron when the node has visible children. An EMPTY project (zero
 * operations — e.g. a project imported from a workspace export that carried no
 * operations) must therefore keep the slot (alignment) but show no chevron:
 * there is nothing to expand.
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

/** Every tree row reserves the fixed-width chevron slot. */
const slots = () => screen.getAllByTestId('tree-chevron-slot');
/** Rows whose slot actually carries an expand/collapse chevron. */
const expandableSlots = () =>
    screen.getAllByTestId('tree-chevron-slot').filter(s => s.hasAttribute('data-has-chevron'));

describe('UnifiedExplorerSidebar empty-project chevron', () => {
    it('reserves the chevron slot for a project with zero operations, but shows no chevron', () => {
        render(<UnifiedExplorerSidebar {...baseProps} projects={[makeProject('EmptySvc')]} />);

        expect(screen.getByText('EmptySvc')).toBeInTheDocument();
        // Slot present (alignment is preserved)…
        expect(slots()).toHaveLength(1);
        // …but nothing to expand, so the slot carries no chevron.
        expect(expandableSlots()).toHaveLength(0);
    });

    it('shows a chevron for a project that has operations', () => {
        render(<UnifiedExplorerSidebar {...baseProps} projects={[makeProject('FullSvc', [OP])]} />);

        expect(screen.getByText('FullSvc')).toBeInTheDocument();
        expect(slots()).toHaveLength(1);
        expect(expandableSlots()).toHaveLength(1);
    });

    it('keeps every row aligned while hiding the chevron only on the empty project', () => {
        render(
            <UnifiedExplorerSidebar
                {...baseProps}
                projects={[makeProject('EmptySvc'), makeProject('FullSvc', [OP])]}
            />,
        );

        expect(screen.getByText('EmptySvc')).toBeInTheDocument();
        expect(screen.getByText('FullSvc')).toBeInTheDocument();
        // Both rows reserve the slot (icon + text stay inline)…
        expect(slots()).toHaveLength(2);
        // …but only the populated project is expandable.
        expect(expandableSlots()).toHaveLength(1);
    });

    it('reserves the slot but shows no chevron for an operation with no visible requests', () => {
        const opNoRequests: UnifiedProject['operations'][number] = { ...OP, id: 'op-a', requests: [] };
        const opSamplesOnly: UnifiedProject['operations'][number] = {
            ...OP,
            id: 'op-b',
            name: 'SampleOnly',
            requests: [{ name: 'sample_request', request: '' } as UnifiedProject['operations'][number]['requests'][number]],
        };
        const opWithRequest: UnifiedProject['operations'][number] = {
            ...OP,
            id: 'op-c',
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
        expandableSlots().forEach(c => fireEvent.click(c));

        expect(screen.getByText('GetCurrencyRate')).toBeInTheDocument(); // opNoRequests
        expect(screen.getByText('SampleOnly')).toBeInTheDocument();
        expect(screen.getByText('WithReq')).toBeInTheDocument();

        // Visible rows: 2 projects + 3 operations + the 1 real request under
        // WithReq = 6 slots, every one reserved so icon + text stay aligned at
        // their indent level. Only the 2 populated projects + the 1 op with a
        // real request are expandable; the two empty ops and the leaf request
        // show no chevron.
        expect(slots()).toHaveLength(6);
        expect(expandableSlots()).toHaveLength(3);
    });
});
