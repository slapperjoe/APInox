/**
 * History sub-window regression test.
 *
 * Request history was a top-level rail view (SidebarView.HISTORY, rendered in
 * Sidebar.tsx). It was folded into the unified explorer as a bottom sub-window
 * — a sibling of Quick Requests — stacked ABOVE Quick Requests (which stays
 * bottom-most so its pinned drag math is unchanged). These tests pin the new
 * placement, the vertical-resize handle, and the independent clamp math.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
    UnifiedExplorerSidebar,
    HISTORY_DEFAULT_HEIGHT,
    HISTORY_MIN_HEIGHT,
    QUICK_REQUESTS_DEFAULT_HEIGHT,
    clampHistoryHeight,
} from '../UnifiedExplorerSidebar';
import { UnifiedProject, RequestHistoryEntry } from '@shared/models';

// ── fixtures ─────────────────────────────────────────────────────────────────
const makeProject = (): UnifiedProject => ({
    name: 'CountryInfo',
    source: 'wsdl',
    sourceUrl: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL',
    parsedAt: new Date().toISOString(),
    soapVersion: '1.1',
    operations: [
        {
            id: 'op-1',
            name: 'GetCurrencyRate',
            action: 'http://www.oorsprong.org/websamples.countryinfo/GetCurrencyRate',
            targetNamespace: 'http://www.oorsprong.org/websamples.countryinfo/',
            originalEndpoint: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso',
            requests: [
                {
                    id: 'req-1',
                    name: 'MyRateRequest',
                    request: '<GetCurrencyRate/>',
                    endpoint: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso',
                },
            ],
        },
    ],
});

const makeHistoryEntry = (index: number): RequestHistoryEntry => ({
    id: `hist-${index}`,
    timestamp: Date.now() - index * 60_000,
    projectName: 'CountryInfo',
    interfaceName: 'CountryInfoService',
    operationName: 'GetCurrencyRate',
    requestName: `HistoryRequest ${index}`,
    endpoint: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso',
    requestBody: `<GetCurrencyRate/>`,
    headers: { 'Content-Type': 'text/xml' },
    statusCode: 200,
    success: true,
    starred: false,
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

const makeHistoryProps = (entries: RequestHistoryEntry[] = [makeHistoryEntry(1)]) => ({
    entries,
    onReplay: vi.fn(),
    onToggleStar: vi.fn(),
    onDelete: vi.fn(),
});

// jsdom has no layout engine: stub getBoundingClientRect on a given element so
// the drag handler's measurements are deterministic.
const stubRect = (el: Element, rect: { top?: number; height?: number }) => {
    el.getBoundingClientRect = () => ({
        x: 0,
        y: rect.top ?? 0,
        top: rect.top ?? 0,
        left: 0,
        right: 0,
        bottom: (rect.top ?? 0) + (rect.height ?? 0),
        width: 240,
        height: rect.height ?? 0,
        toJSON: () => ({}),
    } as DOMRect);
};

const renderSidebar = (historyEntries: RequestHistoryEntry[] = [makeHistoryEntry(1)]) => {
    const utils = render(
        <UnifiedExplorerSidebar
            {...baseProps}
            projects={[makeProject()]}
            history={makeHistoryProps(historyEntries)}
        />,
    );
    const root = utils.container.firstChild as HTMLElement;
    return { ...utils, root };
};

beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
});

// ── clamp helper ─────────────────────────────────────────────────────────────
describe('clampHistoryHeight', () => {
    it('clamps below-minimum values to the minimum (header + one row)', () => {
        expect(HISTORY_MIN_HEIGHT).toBeGreaterThanOrEqual(60);
        expect(clampHistoryHeight(10)).toBe(HISTORY_MIN_HEIGHT);
        expect(clampHistoryHeight(0)).toBe(HISTORY_MIN_HEIGHT);
    });

    it('clamps above-maximum values to the maximum', () => {
        expect(clampHistoryHeight(5000)).toBe(600);
    });

    it('falls back to the default for non-finite values and rounds fractions', () => {
        expect(clampHistoryHeight(Number.NaN)).toBe(HISTORY_DEFAULT_HEIGHT);
        expect(clampHistoryHeight(Number.POSITIVE_INFINITY)).toBe(HISTORY_DEFAULT_HEIGHT);
        expect(clampHistoryHeight(200.6)).toBe(201);
        expect(clampHistoryHeight(200.4)).toBe(200);
    });

    it('passes in-range values through unchanged', () => {
        expect(clampHistoryHeight(HISTORY_DEFAULT_HEIGHT)).toBe(HISTORY_DEFAULT_HEIGHT);
    });
});

// ── resizable sub-window UI ──────────────────────────────────────────────────
describe('UnifiedExplorerSidebar — History resizable sub-window', () => {
    it('renders a vertical resize handle above the sub-window at the default height', () => {
        renderSidebar();
        const handle = screen.getByTestId('unified-history-resize-handle');
        expect(handle).toBeInTheDocument();
        expect(handle.style.cursor).toBe('row-resize');
        // The handle is a visible line at rest — not transparent until hover.
        expect(handle.style.background).not.toBe('transparent');

        const section = screen.getByTestId('unified-history');
        expect(section.style.height).toBe(`${HISTORY_DEFAULT_HEIGHT}px`);
        expect(section.style.minHeight).toBe(`${HISTORY_MIN_HEIGHT}px`);
    });

    it('renders the History section above the Quick Requests section in document order', () => {
        render(
            <UnifiedExplorerSidebar
                {...baseProps}
                projects={[makeProject()]}
                history={makeHistoryProps()}
                scrapbook={{
                    requests: [],
                    selectedRequest: null,
                    loading: false,
                    onCreateRequest: vi.fn(),
                    onSelectRequest: vi.fn(),
                    onDeleteRequest: vi.fn(),
                    onExecuteRequest: vi.fn(),
                }}
            />,
        );
        const historySection = screen.getByTestId('unified-history');
        const qrSection = screen.getByTestId('unified-quick-requests');
        // History is stacked ABOVE Quick Requests (QR stays bottom-most).
        expect(historySection.compareDocumentPosition(qrSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('dragging the handle changes the sub-window height (pointer travel from the handle top)', () => {
        const { root } = renderSidebar();
        // Sidebar root (the measured container) is 500px tall at the top of the
        // document; the History handle's top edge sits 300px down.
        stubRect(root, { top: 0, height: 500 });
        const handle = screen.getByTestId('unified-history-resize-handle');
        stubRect(handle, { top: 300, height: 4 });

        const section = screen.getByTestId('unified-history');

        fireEvent.mouseDown(handle);
        // History is NOT bottom-pinned: its height is the pointer's travel below
        // the handle's top edge. clientY 400, handle top 300 → 100px.
        fireEvent.mouseMove(document, { clientY: 400 });
        expect(section.style.height).toBe('100px');
        // Drag the pointer up toward the handle: 40px pre-clamp → clamps to the
        // minimum (History keeps its header + a full row).
        fireEvent.mouseMove(document, { clientY: 340 });
        expect(section.style.height).toBe(`${HISTORY_MIN_HEIGHT}px`);
        fireEvent.mouseUp(document);
    });

    it('respects the minimum height while dragging', () => {
        const { root } = renderSidebar();
        stubRect(root, { top: 0, height: 500 });
        const handle = screen.getByTestId('unified-history-resize-handle');
        stubRect(handle, { top: 300, height: 4 });

        const section = screen.getByTestId('unified-history');

        fireEvent.mouseDown(handle);
        // Pointer just below the handle top: the sub-window would be ~2px, so
        // it clamps to the minimum.
        fireEvent.mouseMove(document, { clientY: 302 });
        expect(section.style.height).toBe(`${HISTORY_MIN_HEIGHT}px`);
        fireEvent.mouseUp(document);
    });

    it('respects the maximum height (the project tree keeps at least the tree minimum)', () => {
        const { root } = renderSidebar();
        stubRect(root, { top: 0, height: 300 });
        const handle = screen.getByTestId('unified-history-resize-handle');
        stubRect(handle, { top: 10, height: 4 });

        const section = screen.getByTestId('unified-history');

        fireEvent.mouseDown(handle);
        // Drag far past the bottom: the sub-window caps at container - tree
        // minimum (300 - 64 = 236).
        fireEvent.mouseMove(document, { clientY: 1000 });
        expect(section.style.height).toBe(`${300 - 64}px`);
        fireEvent.mouseUp(document);
    });

    it('keeps the Quick Requests height unchanged while History is dragged', () => {
        const utils = render(
            <UnifiedExplorerSidebar
                {...baseProps}
                projects={[makeProject()]}
                history={makeHistoryProps()}
                scrapbook={{
                    requests: [],
                    selectedRequest: null,
                    loading: false,
                    onCreateRequest: vi.fn(),
                    onSelectRequest: vi.fn(),
                    onDeleteRequest: vi.fn(),
                    onExecuteRequest: vi.fn(),
                }}
            />,
        );
        const root = utils.container.firstChild as HTMLElement;
        stubRect(root, { top: 0, height: 500 });
        const historyHandle = screen.getByTestId('unified-history-resize-handle');
        stubRect(historyHandle, { top: 200, height: 4 });

        const historySection = screen.getByTestId('unified-history');
        const qrSection = screen.getByTestId('unified-quick-requests');
        const qrBefore = qrSection.style.height;

        fireEvent.mouseDown(historyHandle);
        fireEvent.mouseMove(document, { clientY: 400 });
        expect(historySection.style.height).toBe('200px');
        // Quick Requests is pinned to its own (unchanged) height.
        expect(qrSection.style.height).toBe(qrBefore);
        fireEvent.mouseUp(document);
    });

    it('renders every history entry inside the sub-window when enlarged', () => {
        const { root } = renderSidebar(Array.from({ length: 6 }, (_, i) => makeHistoryEntry(i + 1)));
        stubRect(root, { top: 0, height: 500 });

        const section = screen.getByTestId('unified-history');
        for (let i = 1; i <= 6; i++) {
            const row = screen.getByText(`HistoryRequest ${i}`);
            expect(section.contains(row)).toBe(true);
        }
    });

    it('does not render the handle when no history prop is given (back-compat)', () => {
        render(
            <UnifiedExplorerSidebar {...baseProps} projects={[makeProject()]} />,
        );
        expect(screen.queryByTestId('unified-history-resize-handle')).not.toBeInTheDocument();
        expect(screen.queryByTestId('unified-history')).not.toBeInTheDocument();
        expect(screen.getByText('CountryInfo')).toBeInTheDocument();
    });
});
