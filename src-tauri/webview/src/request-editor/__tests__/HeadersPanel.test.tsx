import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeadersPanel } from '../components/HeadersPanel';
import { CONTENT_TYPE_OPTIONS } from '../utils/contentType';

// Mock MonacoSingleLineInput since it requires Monaco
vi.mock('../components/MonacoSingleLineInput', () => ({
    MonacoSingleLineInput: ({ value, onChange, placeholder }: any) => (
        <input
            data-testid={`input-${placeholder}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
        />
    )
}));

const ctSelect = () => screen.getByLabelText('Content-Type');

describe('HeadersPanel', () => {
    it('should render empty state when no headers', () => {
        const onChange = vi.fn();
        render(<HeadersPanel headers={{}} onChange={onChange} />);

        expect(screen.getByText('No custom headers defined.')).toBeInTheDocument();
    });

    it('should render headers', () => {
        const onChange = vi.fn();
        const headers = { 'Authorization': 'Bearer token123' };
        render(<HeadersPanel headers={headers} onChange={onChange} />);

        const nameInput = screen.getByDisplayValue('Authorization');
        expect(nameInput).toBeInTheDocument();

        const valueInput = screen.getByDisplayValue('Bearer token123');
        expect(valueInput).toBeInTheDocument();
    });

    it('should call onChange when Add button is clicked', () => {
        const onChange = vi.fn();
        render(<HeadersPanel headers={{}} onChange={onChange} />);

        const addButton = screen.getByTitle('Add Header');
        fireEvent.click(addButton);

        expect(onChange).toHaveBeenCalledWith({ 'Header1': '' });
    });

    it('should call onChange with unique key when adding to existing headers', () => {
        const onChange = vi.fn();
        const headers = { 'Header1': 'value1' };
        render(<HeadersPanel headers={headers} onChange={onChange} />);

        const addButton = screen.getByTitle('Add Header');
        fireEvent.click(addButton);

        expect(onChange).toHaveBeenCalledWith({ 'Header1': 'value1', 'Header2': '' });
    });

    it('should call onChange when header is deleted', () => {
        const onChange = vi.fn();
        const headers = { 'Authorization': 'Bearer token' };
        render(<HeadersPanel headers={headers} onChange={onChange} />);

        const deleteButton = screen.getByTitle('Delete Header');
        fireEvent.click(deleteButton);

        expect(onChange).toHaveBeenCalledWith({});
    });

    it('should call onChange when header value is updated', () => {
        const onChange = vi.fn();
        const headers = { 'X-Custom': 'old-value' };
        render(<HeadersPanel headers={headers} onChange={onChange} />);

        const valueInput = screen.getByDisplayValue('old-value');
        fireEvent.change(valueInput, { target: { value: 'new-value' } });

        expect(onChange).toHaveBeenCalledWith({ 'X-Custom': 'new-value' });
    });

    it('should call onChange when header name is updated', () => {
        const onChange = vi.fn();
        const headers = { 'Old-Name': 'value' };
        render(<HeadersPanel headers={headers} onChange={onChange} />);

        const nameInput = screen.getByDisplayValue('Old-Name');
        fireEvent.change(nameInput, { target: { value: 'New-Name' } });

        expect(onChange).toHaveBeenCalledWith({ 'New-Name': 'value' });
    });

    it('should render multiple headers', () => {
        const onChange = vi.fn();
        const headers = {
            'Header1': 'value1',
            'Header2': 'value2',
            'Header3': 'value3'
        };
        render(<HeadersPanel headers={headers} onChange={onChange} />);

        expect(screen.getByDisplayValue('value1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('value2')).toBeInTheDocument();
        expect(screen.getByDisplayValue('value3')).toBeInTheDocument();
    });

    it('should not allow a second Content-Type row in the editable table', () => {
        const onChange = vi.fn();
        const headers = { 'Content-Type': 'text/xml', 'Authorization': 'Bearer token' };
        render(<HeadersPanel headers={headers} onChange={onChange} />);

        // Authorization is an ordinary editable row
        expect(screen.getByDisplayValue('Authorization')).toBeInTheDocument();

        // Content-Type is the dropdown row, not a table row
        expect(screen.queryByDisplayValue('Content-Type')).not.toBeInTheDocument();

        // Renaming a row to Content-Type is ignored (it would duplicate the row above)
        fireEvent.change(screen.getByDisplayValue('Authorization'), { target: { value: 'Content-Type' } });
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('HeadersPanel - Content-Type dropdown', () => {
    it('renders the fixed options plus "Other…", selecting the stored header', () => {
        const onChange = vi.fn();
        render(<HeadersPanel headers={{ 'Content-Type': 'application/json' }} onChange={onChange} />);

        const select = ctSelect();
        expect(select).toHaveValue('application/json');
        const options = Array.from(select.querySelectorAll('option'));
        expect(options.map(o => o.value)).toEqual([...CONTENT_TYPE_OPTIONS, '__other__']);
    });

    it('falls back to the passed default when the request has no Content-Type header', () => {
        const onChange = vi.fn();
        render(<HeadersPanel headers={{}} onChange={onChange} contentType="application/xml" />);

        expect(ctSelect()).toHaveValue('application/xml');
    });

    it('writes the picked option into the headers record', () => {
        const onChange = vi.fn();
        render(<HeadersPanel headers={{ 'Authorization': 'Bearer x' }} onChange={onChange} />);

        fireEvent.change(ctSelect(), { target: { value: 'text/xml' } });
        expect(onChange).toHaveBeenCalledWith({
            'Authorization': 'Bearer x',
            'Content-Type': 'text/xml',
        });
    });

    it('normalises a case-variant header key to the canonical Content-Type key', () => {
        const onChange = vi.fn();
        render(<HeadersPanel headers={{ 'content-type': 'text/xml' }} onChange={onChange} />);

        fireEvent.change(ctSelect(), { target: { value: 'application/json' } });
        expect(onChange).toHaveBeenCalledWith({ 'Content-Type': 'application/json' });
    });

    it('opens in custom mode for a stored value outside the fixed options, verbatim', () => {
        const rawCT = 'application/soap+xml; charset=utf-8; action="urn:demo:login"';
        const onChange = vi.fn();
        render(<HeadersPanel headers={{ 'Content-Type': rawCT }} onChange={onChange} />);

        // The dropdown cannot represent a value it does not list, so it shows
        // "Other…" and the value itself is editable text.
        expect(ctSelect()).toHaveValue('__other__');
        const custom = screen.getByDisplayValue(rawCT);
        expect(custom).toBeInTheDocument();

        fireEvent.change(custom, { target: { value: 'text/plain' } });
        expect(onChange).toHaveBeenCalledWith({ 'Content-Type': 'text/plain' });
    });

    it('"Other…" switches the row to a free-text input', () => {
        const onChange = vi.fn();
        render(<HeadersPanel headers={{ 'Content-Type': 'application/json' }} onChange={onChange} />);

        fireEvent.change(ctSelect(), { target: { value: '__other__' } });
        expect(ctSelect()).toHaveValue('__other__');
        expect(
            document.querySelector(`input[data-testid="input-Custom Content-Type"]`)
        ).toBeInTheDocument();
        // Nothing written yet — choosing the mode is not a value change
        expect(onChange).not.toHaveBeenCalled();
    });

    it('goes back to the plain dropdown when the value becomes a standard one', () => {
        const onChange = vi.fn();
        const custom = 'application/soap+xml; action="urn:demo:login"';
        const { rerender } = render(<HeadersPanel headers={{ 'Content-Type': custom }} onChange={onChange} />);
        expect(ctSelect()).toHaveValue('__other__');

        // Selecting a different request whose header is a standard option must
        // not leave the row stuck in Other mode.
        rerender(<HeadersPanel headers={{ 'Content-Type': 'text/plain' }} onChange={onChange} />);
        expect(ctSelect()).toHaveValue('text/plain');
        expect(
            document.querySelector(`input[data-testid="input-Custom Content-Type"]`)
        ).not.toBeInTheDocument();
    });
});
