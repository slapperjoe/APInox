import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequestTypeSelector } from '../../../request-editor';

describe('RequestTypeSelector', () => {
    const defaultProps = {
        onRequestTypeChange: vi.fn(),
        onBodyTypeChange: vi.fn(),
        onMethodChange: vi.fn(),
        onContentTypeChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render SOAP options correctly by default', () => {
        render(<RequestTypeSelector {...defaultProps} requestType="soap" />);

        // Request Type Selector
        expect(screen.getByTitle('Request Type')).toHaveValue('soap');

        // Method Selector (SOAP only allows GET/POST)
        const methodSelect = screen.getByTitle('HTTP Method');
        expect(methodSelect).toBeInTheDocument();
        expect(methodSelect.children).toHaveLength(2); // GET, POST

        // Content Type Selector (SOAP specific) — compact trigger button
        expect(screen.getByRole('button', { name: 'Content Type' })).toBeInTheDocument();

        // Body Type should NOT be present for SOAP
        expect(screen.queryByTitle('Body Type')).not.toBeInTheDocument();
    });

    it('should render REST options correctly', () => {
        render(<RequestTypeSelector {...defaultProps} requestType="rest" />);

        expect(screen.getByTitle('Request Type')).toHaveValue('rest');

        // Method Selector (REST allows all)
        const methodSelect = screen.getByTitle('HTTP Method');
        expect(methodSelect.children.length).toBeGreaterThan(2);

        // Body Type Selector (REST specific)
        expect(screen.getByTitle('Body Type')).toBeInTheDocument();

        // Content Type should NOT be present for REST
        expect(screen.queryByRole('button', { name: 'Content Type' })).not.toBeInTheDocument();
    });

    it('should trigger handlers on change', () => {
        render(<RequestTypeSelector {...defaultProps} requestType="soap" />);

        // Change Request Type
        fireEvent.change(screen.getByTitle('Request Type'), { target: { value: 'rest' } });
        expect(defaultProps.onRequestTypeChange).toHaveBeenCalledWith('rest');

        // Change Method
        fireEvent.change(screen.getByTitle('HTTP Method'), { target: { value: 'GET' } });
        expect(defaultProps.onMethodChange).toHaveBeenCalledWith('GET');

        // Change Content Type — the custom dropdown: open the trigger, pick the option
        fireEvent.click(screen.getByRole('button', { name: 'Content Type' }));
        fireEvent.click(screen.getByRole('option', { name: 'text/xml' }));
        expect(defaultProps.onContentTypeChange).toHaveBeenCalledWith('text/xml');
    });

    it('should trigger body type change for REST', () => {
        render(<RequestTypeSelector {...defaultProps} requestType="rest" />);

        fireEvent.change(screen.getByTitle('Body Type'), { target: { value: 'json' } });
        expect(defaultProps.onBodyTypeChange).toHaveBeenCalledWith('json');
    });
});
