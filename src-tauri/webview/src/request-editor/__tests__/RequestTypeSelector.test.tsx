import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { RequestTypeSelector } from '../components/RequestTypeSelector';

const baseProps = {
    requestType: 'soap' as const,
    method: 'POST',
    onRequestTypeChange: vi.fn(),
    onBodyTypeChange: vi.fn(),
    onMethodChange: vi.fn(),
    onContentTypeChange: vi.fn(),
    compact: true,
};

const ctTrigger = () => screen.getByRole('button', { name: 'Content Type' });
const openDropdown = () => {
    fireEvent.click(ctTrigger());
    return screen.getByRole('listbox', { name: 'Content Type' });
};

describe('RequestTypeSelector - SOAP Content-Type dropdown', () => {
    it('keeps a fixed narrow trigger and offers the fixed content-type options when opened', () => {
        render(<RequestTypeSelector {...baseProps} contentType="application/soap+xml" />);
        const trigger = ctTrigger();
        expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        const listbox = openDropdown();
        expect(within(listbox).getByRole('option', { name: 'application/soap+xml' })).toBeInTheDocument();
        expect(within(listbox).getByRole('option', { name: 'text/xml' })).toBeInTheDocument();
        expect(within(listbox).getByRole('option', { name: 'application/xml' })).toBeInTheDocument();
    });

    it('renders the exact captured string (with action) as its own selected option, with the full value in the trigger tooltip', () => {
        const rawCT = 'application/soap+xml; charset=utf-8; action="urn:demo:login"';
        render(<RequestTypeSelector {...baseProps} contentType={rawCT} />);

        // The full value is carried in the tooltip — the trigger itself is a
        // fixed narrow width and ellipsizes the label.
        expect(ctTrigger().getAttribute('title')).toBe(rawCT);

        const listbox = openDropdown();
        const option = within(listbox).getByRole('option', { name: rawCT });
        expect(option.getAttribute('aria-selected')).toBe('true');
    });

    it('does not duplicate the option when the value is one of the fixed ones', () => {
        render(<RequestTypeSelector {...baseProps} contentType="text/xml" />);
        const listbox = openDropdown();
        const textXml = within(listbox).getAllByRole('option').filter(o => o.textContent === 'text/xml');
        expect(textXml).toHaveLength(1);
    });

    it('fires onContentTypeChange with the exact value when the captured option is picked, then closes', () => {
        const rawCT = 'text/xml; charset=utf-8; action="urn:x"';
        const onContentTypeChange = vi.fn();

        // The app re-renders the selector with the newly captured value
        // (as it does after creating a traffic step); picking it back must
        // emit the exact string.
        render(<RequestTypeSelector {...baseProps} contentType={rawCT} onContentTypeChange={onContentTypeChange} />);
        const listbox = openDropdown();
        fireEvent.click(within(listbox).getByRole('option', { name: rawCT }));
        expect(onContentTypeChange).toHaveBeenCalledWith(rawCT);
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('fires onContentTypeChange with "" when the SOAP default row is picked', () => {
        const onContentTypeChange = vi.fn();
        render(<RequestTypeSelector {...baseProps} contentType="text/xml" onContentTypeChange={onContentTypeChange} />);
        const listbox = openDropdown();
        fireEvent.click(within(listbox).getByRole('option', { name: 'SOAP default' }));
        expect(onContentTypeChange).toHaveBeenCalledWith('');
    });
});
