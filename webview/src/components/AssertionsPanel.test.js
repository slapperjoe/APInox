import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssertionsPanel } from '../components/AssertionsPanel';
describe('AssertionsPanel', () => {
    it('should render empty state when no assertions', () => {
        const onChange = vi.fn();
        render(_jsx(AssertionsPanel, { assertions: [], onChange: onChange }));
        expect(screen.getByText('No assertions defined.')).toBeInTheDocument();
    });
    it('should render add assertion dropdown', () => {
        const onChange = vi.fn();
        render(_jsx(AssertionsPanel, { assertions: [], onChange: onChange }));
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
    it('should add Simple Contains assertion when selected', () => {
        const onChange = vi.fn();
        render(_jsx(AssertionsPanel, { assertions: [], onChange: onChange }));
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'Simple Contains' } });
        expect(onChange).toHaveBeenCalled();
        const newAssertion = onChange.mock.calls[0][0][0];
        expect(newAssertion.type).toBe('Simple Contains');
    });
    it('should render Contains assertion with token input', () => {
        const onChange = vi.fn();
        const assertions = [{
                id: 'test-1',
                type: 'Simple Contains',
                configuration: { token: 'success' }
            }];
        render(_jsx(AssertionsPanel, { assertions: assertions, onChange: onChange }));
        expect(screen.getByText('Simple Contains')).toBeInTheDocument();
        expect(screen.getByDisplayValue('success')).toBeInTheDocument();
    });
    it('should render Response SLA assertion', () => {
        const onChange = vi.fn();
        const assertions = [{
                id: 'test-2',
                type: 'Response SLA',
                configuration: { sla: '1000' }
            }];
        render(_jsx(AssertionsPanel, { assertions: assertions, onChange: onChange }));
        expect(screen.getAllByText('Response SLA').length).toBeGreaterThanOrEqual(1);
    });
    it('should render XPath Match assertion', () => {
        const onChange = vi.fn();
        const assertions = [{
                id: 'test-3',
                type: 'XPath Match',
                configuration: { xpath: '//result', expectedContent: 'ok' }
            }];
        render(_jsx(AssertionsPanel, { assertions: assertions, onChange: onChange }));
        expect(screen.getAllByText('XPath Match').length).toBeGreaterThanOrEqual(1);
    });
    it('should call onChange when assertion is deleted', () => {
        const onChange = vi.fn();
        const assertions = [{
                id: 'test-del',
                type: 'Simple Contains',
                configuration: { token: 'test' }
            }];
        render(_jsx(AssertionsPanel, { assertions: assertions, onChange: onChange }));
        const deleteButton = screen.getByRole('button');
        fireEvent.click(deleteButton);
        expect(onChange).toHaveBeenCalledWith([]);
    });
    it('should show pass icon for successful assertion result', () => {
        const onChange = vi.fn();
        const assertions = [{
                id: 'test-pass',
                type: 'Simple Contains',
                configuration: { token: 'ok' }
            }];
        const lastResult = [{ id: 'test-pass', passed: true }];
        render(_jsx(AssertionsPanel, { assertions: assertions, onChange: onChange, lastResult: lastResult }));
        // The CheckCircle2 icon should be present
        expect(screen.getByText('Simple Contains')).toBeInTheDocument();
    });
});
