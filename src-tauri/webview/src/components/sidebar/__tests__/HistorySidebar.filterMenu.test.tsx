/**
 * History filter menu regression test.
 *
 * The "Advanced Filters" flow was an inline expandable section (a full-width
 * toggle row + an inline filter block that pushed the entry list down). It is
 * now a hamburger-style popout menu launched from the History header row: a
 * compact search field + a menu button on the right; the filters live in a
 * position:fixed panel clamped to the viewport. These tests pin the new
 * shape: no inline filter section, the menu open/close cycle, viewport-clamped
 * placement math, and outside-click/Escape dismissal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import HistorySidebar from '../HistorySidebar';
import { RequestHistoryEntry } from '@shared/models';

// ── fixtures ─────────────────────────────────────────────────────────────────
const makeEntry = (index: number): RequestHistoryEntry => ({
    id: `hist-${index}`,
    timestamp: Date.now() - index * 60_000,
    projectName: 'CountryInfo',
    interfaceName: 'CountryInfoService',
    operationName: 'GetCurrencyRate',
    requestName: `HistoryRequest ${index}`,
    endpoint: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso',
    requestBody: '<GetCurrencyRate/>',
    headers: { 'Content-Type': 'text/xml' },
    statusCode: 200,
    success: true,
    starred: false,
});

const baseProps = {
    onReplay: vi.fn(),
    onToggleStar: vi.fn(),
    onDelete: vi.fn(),
};

// jsdom has no layout engine: stub getBoundingClientRect on the trigger so the
// menu placement math is deterministic (trigger 120x24 at x=10, y=200).
const TRIGGER_RECT = { x: 10, y: 200, width: 120, height: 24, bottom: 224 };
const stubTriggerRect = (el: Element) => {
    el.getBoundingClientRect = () => ({
        x: TRIGGER_RECT.x,
        y: TRIGGER_RECT.y,
        top: TRIGGER_RECT.y,
        left: TRIGGER_RECT.x,
        right: TRIGGER_RECT.x + TRIGGER_RECT.width,
        bottom: TRIGGER_RECT.bottom,
        toJSON: () => ({}),
    } as DOMRect);
};

const renderHistory = (entries: RequestHistoryEntry[] = [makeEntry(1), makeEntry(2)]) => {
    const utils = render(
        <HistorySidebar history={entries} {...baseProps} />,
    );
    const trigger = utils.getByLabelText('Advanced Filters');
    stubTriggerRect(trigger);
    return { ...utils, trigger };
};

beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    // Deterministic viewport for the clamped placement math.
    window.innerWidth = 1280;
    window.innerHeight = 800;
});

// ── shape ────────────────────────────────────────────────────────────────────
describe('HistorySidebar — header row shape', () => {
    it('renders a compact search field and the hamburger trigger, with no inline filter section', () => {
        renderHistory();
        expect(screen.getByPlaceholderText('Search history...')).toBeInTheDocument();
        expect(screen.getByLabelText('Advanced Filters')).toBeInTheDocument();
        // The former inline "Advanced Filters" toggle row is gone — the label
        // appears only as the trigger's accessible name (no visible text node).
        expect(screen.queryByText('Advanced Filters')).not.toBeInTheDocument();
        // The inline filter block content is not rendered by default.
        expect(screen.queryByText('Date Range:')).not.toBeInTheDocument();
        expect(screen.queryByText('Clear All Filters')).not.toBeInTheDocument();
        // The entry list is visible (the row layout no longer pushes it out).
        expect(screen.getByText('HistoryRequest 1')).toBeInTheDocument();
    });

    it('shows the empty state when there are no entries', () => {
        render(<HistorySidebar history={[]} {...baseProps} />);
        expect(screen.getByText('No request history yet')).toBeInTheDocument();
    });
});

// ── menu open/close ──────────────────────────────────────────────────────────
describe('HistorySidebar — filter menu', () => {
    it('opens the menu on trigger click, revealing the filter controls', () => {
        const { trigger } = renderHistory();
        fireEvent.click(trigger);
        expect(screen.getByText('Date Range:')).toBeInTheDocument();
        expect(screen.getByText('Status:')).toBeInTheDocument();
        expect(screen.getByText('Duration (ms):')).toBeInTheDocument();
        // No active filters yet → no Clear button.
        expect(screen.queryByText('Clear All Filters')).not.toBeInTheDocument();
    });

    it('closes the menu when the trigger is clicked again', () => {
        const { trigger } = renderHistory();
        fireEvent.click(trigger);
        expect(screen.getByText('Date Range:')).toBeInTheDocument();
        fireEvent.click(trigger);
        expect(screen.queryByText('Date Range:')).not.toBeInTheDocument();
    });

    it('positions the menu below the trigger, right-aligned to it', () => {
        const { trigger } = renderHistory();
        fireEvent.click(trigger);
        const panel = screen.getByText('Date Range:').closest('[style*="top"]');
        expect(panel).not.toBeNull();
        const style = (panel as HTMLElement).style;
        // top = trigger.bottom + 4 (200 + 24 + 4); left = trigger.right - 260
        // (130 - 260 = -130 → clamped to trigger.left = 10).
        expect(style.top).toBe(`${TRIGGER_RECT.bottom + 4}px`);
        expect(style.left).toBe(`${TRIGGER_RECT.x}px`);
        // maxHeight clamps the panel to the remaining viewport height.
        expect(style.maxHeight).toBe(`${window.innerHeight - (TRIGGER_RECT.bottom + 4) - 8}px`);
    });

    it('positions the menu above the trigger when there is no room below', () => {
        // Trigger near the bottom of the viewport: opening below would
        // overflow, so the menu flips above the trigger.
        const rectOverride = { x: 10, y: 700, width: 120, height: 24 };
        const utils = render(<HistorySidebar history={[makeEntry(1)]} {...baseProps} />);
        const trigger = utils.getByLabelText('Advanced Filters');
        trigger.getBoundingClientRect = () => ({
            x: rectOverride.x,
            y: rectOverride.y,
            top: rectOverride.y,
            left: rectOverride.x,
            right: rectOverride.x + rectOverride.width,
            bottom: rectOverride.y + rectOverride.height,
            toJSON: () => ({}),
        } as DOMRect);
        fireEvent.click(trigger);
        const panel = screen.getByText('Date Range:').closest('[style*="top"]') as HTMLElement;
        // height = min(340, 700 - 8) = 340 → top = 700 - 340 - 4 = 356.
        expect(panel.style.top).toBe('356px');
    });

    it('dismissing via outside click hides the menu again', () => {
        const { trigger } = renderHistory();
        fireEvent.click(trigger);
        expect(screen.getByText('Date Range:')).toBeInTheDocument();
        const overlay = document.querySelector('div[style*="inset: 0"]') as HTMLElement;
        expect(overlay).not.toBeNull();
        fireEvent.click(overlay);
        expect(screen.queryByText('Date Range:')).not.toBeInTheDocument();
    });

    it('Escape closes the menu', () => {
        const { trigger } = renderHistory();
        fireEvent.click(trigger);
        expect(screen.getByText('Date Range:')).toBeInTheDocument();
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
        expect(screen.queryByText('Date Range:')).not.toBeInTheDocument();
    });

    it('filter selections apply to the list and the trigger reflects active filters', () => {
        const { trigger } = renderHistory();
        fireEvent.click(trigger);
        // Status filter 5xx: no fixture row matches → the list shows none.
        fireEvent.change(screen.getByDisplayValue('All'), { target: { value: '5' } });
        expect(screen.queryByText('HistoryRequest 1')).not.toBeInTheDocument();
        // An active filter reveals the Clear button; the trigger stays marked
        // active ($active) and expanded while the menu is open.
        expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
        expect((trigger as HTMLElement).getAttribute('aria-expanded')).toBe('true');
        // Clearing the filters restores the full list.
        fireEvent.click(screen.getByText('Clear All Filters'));
        expect(screen.getByText('HistoryRequest 1')).toBeInTheDocument();
        expect(screen.queryByText('Clear All Filters')).not.toBeInTheDocument();
    });
});
