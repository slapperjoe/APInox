import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

const ctSelect = (container: HTMLElement) =>
    container.querySelector('select[title="Content Type"]') as HTMLSelectElement;

describe('RequestTypeSelector - SOAP Content-Type dropdown', () => {
    it('offers the fixed content-type options for a plain SOAP request', () => {
        render(<RequestTypeSelector {...baseProps} contentType="application/soap+xml" />);
        expect(screen.getByRole('option', { name: 'application/soap+xml' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'text/xml' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'application/xml' })).toBeInTheDocument();
    });

    it('renders the exact captured string (with action) as its own option and as the selected value', () => {
        const rawCT = 'application/soap+xml; charset=utf-8; action="urn:demo:login"';
        const { container } = render(<RequestTypeSelector {...baseProps} contentType={rawCT} />);

        // The captured value is a real option carrying the exact string...
        const option = screen.getByRole('option', { name: rawCT }) as HTMLOptionElement;
        expect(option.value).toBe(rawCT);

        // ...and the select reports it as the selected value (a native
        // <select> would silently fall back to the first option otherwise).
        expect(ctSelect(container).value).toBe(rawCT);
    });

    it('does not duplicate the option when the value is one of the fixed ones', () => {
        render(<RequestTypeSelector {...baseProps} contentType="text/xml" />);
        const textXml = screen.getAllByRole('option').filter(o => o.value === 'text/xml');
        expect(textXml).toHaveLength(1);
    });

    it('fires onContentTypeChange with the exact value when the captured option is picked', () => {
        const rawCT = 'text/xml; charset=utf-8; action="urn:x"';
        const onContentTypeChange = vi.fn();

        // The app re-renders the selector with the newly captured value
        // (as it does after creating a traffic step); picking it back must
        // emit the exact string.
        const { container } = render(<RequestTypeSelector {...baseProps} contentType={rawCT} onContentTypeChange={onContentTypeChange} />);
        fireEvent.change(ctSelect(container), { target: { value: rawCT } });
        expect(onContentTypeChange).toHaveBeenCalledWith(rawCT);
    });
});
