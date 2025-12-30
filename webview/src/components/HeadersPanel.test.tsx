import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeadersPanel } from '../components/HeadersPanel';

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

describe('HeadersPanel', () => {
    it('should render empty state when no headers', () => {
        const onChange = vi.fn();
        render(<HeadersPanel headers={{}} onChange={onChange} />);

        expect(screen.getByText('No custom headers defined.')).toBeInTheDocument();
    });

    it('should render headers', () => {
        const onChange = vi.fn();
        const headers = { 'Content-Type': 'application/xml' };
        render(<HeadersPanel headers={headers} onChange={onChange} />);

        const nameInput = screen.getByDisplayValue('Content-Type');
        expect(nameInput).toBeInTheDocument();

        const valueInput = screen.getByDisplayValue('application/xml');
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
});
