/**
 * History search field — embedded filter trigger regression test.
 *
 * The History sub-window header used to render the search field and the
 * "Advanced Filters" hamburger as two SIBLING elements, which caused them to
 * half-overlap. The trigger is now EMBEDDED inside the search field (a child
 * of the bordered field container, absolutely positioned in its right edge),
 * so the two read as one control with a single border. This test pins the
 * DOM nesting: the trigger must be a descendant of the element that wraps the
 * search input, never a sibling of it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import HistorySidebar from '../HistorySidebar';
import { RequestHistoryEntry } from '@shared/models';

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

const renderHistory = () =>
    render(<HistorySidebar history={[makeEntry(1), makeEntry(2)]} {...baseProps} />);

beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
});

describe('HistorySidebar — embedded filter trigger', () => {
    it('renders the search field and the embedded trigger as a single control', () => {
        renderHistory();
        const input = screen.getByPlaceholderText('Search history...');
        const trigger = screen.getByLabelText('Advanced Filters');
        // The trigger lives INSIDE the bordered search field: it is a
        // descendant of the input's wrapper (same border box), not a separate
        // sibling element sitting outside the field (the old overlap). The old
        // layout had the trigger as a sibling of the search wrapper; here the
        // trigger is contained by the very element that wraps the input.
        const field = input.parentElement as HTMLElement;
        expect(field).not.toBeNull();
        expect(field.contains(trigger)).toBe(true);
        // The field is the single shared container: input and trigger share
        // one parent (the bordered control), they are not on separate rows.
        expect(trigger.parentElement).toBe(field);
    });
});
