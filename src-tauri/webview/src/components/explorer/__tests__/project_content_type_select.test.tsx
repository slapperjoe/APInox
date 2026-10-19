import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectContentTypeSelect } from '../UnifiedExplorerMain';

vi.mock('../../../request-editor/monaco', () => ({
    MonacoRequestEditorWithToolbar: () => null,
    MonacoResponseViewer: () => null,
    HeadersPanel: () => null,
    AssertionsPanel: () => null,
    ExtractorsPanel: () => null,
}));

/**
 * Project overview Content-Type override picker: the trigger must stay a
 * fixed narrow width (the stored override can be a long `application/soap+xml;
 * action="urn:..."` string from a cloned SOAP 1.2 request) while the open
 * list grows to fit its content instead of clipping.
 */

const LONG_VALUE = 'application/soap+xml; charset=utf-8; action="urn:http://example.com/svc/DoThing"';

describe('ProjectContentTypeSelect', () => {
    it('shows the SOAP-version default label when there is no override', () => {
        render(<ProjectContentTypeSelect value="" soapVersion="1.2" onChange={() => {}} />);
        expect(screen.getByRole('button', { name: 'Content-Type override' })).toHaveTextContent(
            'SOAP default (application/soap+xml; charset=utf-8)'
        );
    });

    it('keeps the trigger at a fixed narrow width', () => {
        render(<ProjectContentTypeSelect value="" soapVersion="1.1" onChange={() => {}} />);
        const trigger = screen.getByRole('button', { name: 'Content-Type override' });
        expect(trigger.parentElement!.style.width).toBe('160px');
    });

    it('carries a long override value in the trigger title instead of stretching the trigger', () => {
        render(<ProjectContentTypeSelect value={LONG_VALUE} soapVersion="1.2" onChange={() => {}} />);
        expect(screen.getByRole('button', { name: 'Content-Type override' }).getAttribute('title')).toBe(LONG_VALUE);
    });

    it('opens a listbox with the standard options and reports selections', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<ProjectContentTypeSelect value="" soapVersion="1.1" onChange={onChange} />);

        expect(screen.queryByRole('listbox')).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Content-Type override' }));

        const listbox = screen.getByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        expect(options.map(o => o.textContent)).toEqual([
            'SOAP default (text/xml; charset=utf-8)',
            'text/xml',
            'application/soap+xml',
            'application/xml',
        ]);

        await user.click(within(listbox).getByRole('option', { name: 'text/xml' }));
        expect(onChange).toHaveBeenCalledWith('text/xml');
        expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('represents a non-standard (long, action-carrying) value as a selectable option', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<ProjectContentTypeSelect value={LONG_VALUE} soapVersion="1.2" onChange={onChange} />);

        const trigger = screen.getByRole('button', { name: 'Content-Type override' });
        expect(trigger).toHaveTextContent(LONG_VALUE);

        await user.click(trigger);
        const listbox = screen.getByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        // The long current value is appended to the standard options so the
        // open list (which grows to fit its content) can display it in full.
        expect(options.map(o => o.textContent)).toEqual([
            'SOAP default (application/soap+xml; charset=utf-8)',
            'text/xml',
            'application/soap+xml',
            'application/xml',
            LONG_VALUE,
        ]);
        expect(within(listbox).getAllByRole('option', { name: LONG_VALUE })[0].getAttribute('aria-selected')).toBe('true');

        // The open list is at least the trigger width but may grow beyond it
        // (capped, window-safely) — the long option is not clipped to 160px.
        expect(listbox.style.minWidth).toBe('100%');
        expect(listbox.style.maxWidth).toContain('90vw');
    });

    it('does not open when disabled', async () => {
        const user = userEvent.setup();
        render(<ProjectContentTypeSelect value="" soapVersion="1.1" disabled onChange={() => {}} />);
        const trigger = screen.getByRole('button', { name: 'Content-Type override' });
        expect(trigger).toBeDisabled();
        await user.click(trigger);
        expect(screen.queryByRole('listbox')).toBeNull();
    });
});
