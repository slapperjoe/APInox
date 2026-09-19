/**
 * Accordion sections regression test.
 *
 * The unified explorer sidebar is divided into three accordion sections — the
 * project tree ("Projects"), History and Quick Requests. Each section header
 * carries a chevron that collapses the body down to the header row; the per-
 * section flags persist to localStorage. Collapsing hides the section body
 * (and its resize handle); the Quick Requests "+" action stays available on
 * the header even while collapsed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
    UnifiedExplorerSidebar,
    SECTION_COLLAPSED_STORAGE_KEY,
    DEFAULT_SECTION_COLLAPSED,
    loadSectionCollapsed,
    saveSectionCollapsed,
    clampHistoryHeight,
    clampQuickRequestsHeight,
    HISTORY_DEFAULT_HEIGHT,
    QUICK_REQUESTS_DEFAULT_HEIGHT,
} from '../UnifiedExplorerSidebar';
import { UnifiedProject, ScrapbookRequest, RequestHistoryEntry } from '@shared/models';

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

const makeScrapbookProps = () => ({
    requests: [
        {
            id: 'quick-1',
            name: 'Quick Rate Check',
            request: '<Quick/>',
            requestType: 'soap',
            method: 'POST',
            bodyType: 'xml',
            contentType: 'text/xml',
            headers: { 'Content-Type': 'text/xml' },
            endpoint: 'http://example.com/soap',
            createdAt: '2026-01-01T00:00:00.000Z',
            lastModified: '2026-01-02T00:00:00.000Z',
        },
    ],
    selectedRequest: null as ScrapbookRequest | null,
    loading: false,
    onCreateRequest: vi.fn(),
    onSelectRequest: vi.fn(),
    onDeleteRequest: vi.fn(),
    onExecuteRequest: vi.fn(),
});

const makeHistoryProps = () => ({
    entries: [
        {
            id: 'hist-1',
            timestamp: Date.now(),
            projectName: 'CountryInfo',
            interfaceName: 'CountryInfoService',
            operationName: 'GetCurrencyRate',
            requestName: 'HistoryRequest 1',
            endpoint: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso',
            requestBody: '<GetCurrencyRate/>',
            headers: { 'Content-Type': 'text/xml' },
            statusCode: 200,
            success: true,
            starred: false,
        },
    ],
    onReplay: vi.fn(),
    onToggleStar: vi.fn(),
    onDelete: vi.fn(),
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

const renderSidebar = () =>
    render(
        <UnifiedExplorerSidebar
            {...baseProps}
            projects={[makeProject()]}
            scrapbook={makeScrapbookProps()}
            history={makeHistoryProps()}
        />,
    );

beforeEach(() => {
    vi.clearAllMocks();
    // No persisted layout by default: every section starts expanded.
    window.localStorage.clear();
});

// ── persistence helpers ──────────────────────────────────────────────────────
describe('section-collapsed persistence', () => {
    it('defaults to everything expanded', () => {
        expect(loadSectionCollapsed()).toEqual(DEFAULT_SECTION_COLLAPSED);
    });

    it('round-trips a saved collapsed state', () => {
        saveSectionCollapsed({ tree: true, history: false, quickRequests: true });
        expect(loadSectionCollapsed()).toEqual({ tree: true, history: false, quickRequests: true });
    });

    it('falls back to the default for malformed storage', () => {
        window.localStorage.setItem(SECTION_COLLAPSED_STORAGE_KEY, '{not json');
        expect(loadSectionCollapsed()).toEqual(DEFAULT_SECTION_COLLAPSED);
    });
});

// ── accordion behaviour ──────────────────────────────────────────────────────
describe('UnifiedExplorerSidebar — accordion sections', () => {
    it('renders all three section headers with chevrons', () => {
        renderSidebar();
        expect(screen.getByTestId('unified-tree-section-header')).toBeInTheDocument();
        expect(screen.getByTestId('unified-history-section-header')).toBeInTheDocument();
        expect(screen.getByTestId('unified-quick-requests-section-header')).toBeInTheDocument();

        // Expanded sections: bodies + resize handles are present.
        expect(screen.getByText('CountryInfo')).toBeInTheDocument();
        expect(screen.getByTestId('unified-history')).toBeInTheDocument();
        expect(screen.getByTestId('unified-history-resize-handle')).toBeInTheDocument();
        expect(screen.getByTestId('unified-quick-requests')).toBeInTheDocument();
        expect(screen.getByTestId('unified-quick-requests-resize-handle')).toBeInTheDocument();

        // aria-expanded reflects the expanded state.
        const treeHeaderBtn = screen.getByTestId('unified-tree-section-header').querySelector('button')!;
        expect(treeHeaderBtn.getAttribute('aria-expanded')).toBe('true');
    });

    it('collapses the project tree to its header row and back', () => {
        renderSidebar();
        const header = screen.getByTestId('unified-tree-section-header');
        const toggle = () => fireEvent.click(header.querySelector('button')!);

        toggle();
        expect(screen.queryByText('CountryInfo')).not.toBeInTheDocument();
        expect(header.querySelector('button')!.getAttribute('aria-expanded')).toBe('false');
        // Toggling again restores the tree.
        toggle();
        expect(screen.getByText('CountryInfo')).toBeInTheDocument();
        expect(header.querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
    });

    it('collapses History to its header row (body + resize handle hidden)', () => {
        renderSidebar();
        const header = screen.getByTestId('unified-history-section-header');
        fireEvent.click(header.querySelector('button')!);
        expect(screen.queryByTestId('unified-history')).not.toBeInTheDocument();
        expect(screen.queryByTestId('unified-history-resize-handle')).not.toBeInTheDocument();
        // The header itself remains (title + chevron).
        expect(header).toBeInTheDocument();
        expect(header).toHaveTextContent('History');
    });

    it('collapses Quick Requests to its header row and keeps the "+" create action', () => {
        const scrapbook = makeScrapbookProps();
        render(
            <UnifiedExplorerSidebar
                {...baseProps}
                projects={[makeProject()]}
                scrapbook={scrapbook}
                history={makeHistoryProps()}
            />,
        );
        const header = screen.getByTestId('unified-quick-requests-section-header');
        fireEvent.click(header.querySelector('button')!);
        expect(screen.queryByTestId('unified-quick-requests')).not.toBeInTheDocument();
        expect(screen.queryByTestId('unified-quick-requests-resize-handle')).not.toBeInTheDocument();

        // The "+" action lives on the accordion header, so it still works
        // while the section is collapsed.
        const createBtn = header.querySelector('button[aria-label="Create New Request"]')!;
        fireEvent.click(createBtn);
        expect(scrapbook.onCreateRequest).toHaveBeenCalledTimes(1);
    });

    it('persists a section toggle to localStorage', () => {
        renderSidebar();
        const header = screen.getByTestId('unified-history-section-header');
        fireEvent.click(header.querySelector('button')!);
        const saved = JSON.parse(window.localStorage.getItem(SECTION_COLLAPSED_STORAGE_KEY)!);
        expect(saved).toEqual({ tree: false, history: true, quickRequests: false });
    });

    it('restores a persisted collapsed layout on mount', () => {
        window.localStorage.setItem(
            SECTION_COLLAPSED_STORAGE_KEY,
            JSON.stringify({ tree: true, history: false, quickRequests: true }),
        );
        renderSidebar();
        // Tree and Quick Requests restore collapsed; History stays expanded.
        expect(screen.queryByText('CountryInfo')).not.toBeInTheDocument();
        expect(screen.queryByTestId('unified-quick-requests')).not.toBeInTheDocument();
        expect(screen.getByTestId('unified-history')).toBeInTheDocument();
    });

    it('keeps each section independent — collapsing one does not affect the others', () => {
        renderSidebar();
        fireEvent.click(screen.getByTestId('unified-tree-section-header').querySelector('button')!);
        // Collapsing the tree leaves History and Quick Requests fully intact.
        expect(screen.queryByText('CountryInfo')).not.toBeInTheDocument();
        expect(screen.getByTestId('unified-history')).toBeInTheDocument();
        expect(screen.getByTestId('unified-quick-requests')).toBeInTheDocument();
    });
});

// ── clamps are still exported for the resize tests ───────────────────────────
describe('height clamps (regression guard)', () => {
    it('history clamp', () => {
        expect(clampHistoryHeight(0)).toBe(64);
        expect(clampHistoryHeight(5000)).toBe(600);
        expect(clampHistoryHeight(Number.NaN)).toBe(HISTORY_DEFAULT_HEIGHT);
    });
    it('quick requests clamp', () => {
        expect(clampQuickRequestsHeight(0)).toBe(64);
        expect(clampQuickRequestsHeight(5000)).toBe(600);
        expect(clampQuickRequestsHeight(Number.NaN)).toBe(QUICK_REQUESTS_DEFAULT_HEIGHT);
    });
});
