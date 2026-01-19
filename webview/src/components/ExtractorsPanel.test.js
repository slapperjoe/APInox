import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExtractorsPanel } from '../components/ExtractorsPanel';
// Mock the xpathEvaluator
vi.mock('../utils/xpathEvaluator', () => ({
    CustomXPathEvaluator: {
        evaluate: vi.fn(() => 'mocked-value')
    }
}));
describe('ExtractorsPanel', () => {
    it('should render empty state when no extractors', () => {
        const onChange = vi.fn();
        render(_jsx(ExtractorsPanel, { extractors: [], onChange: onChange }));
        expect(screen.getByText(/No extractors defined/i)).toBeInTheDocument();
    });
    it('should render extractor with variable name', () => {
        const onChange = vi.fn();
        const extractors = [{
                id: 'ext-1',
                type: 'XPath',
                source: 'body',
                path: '//result',
                variable: 'myVar'
            }];
        render(_jsx(ExtractorsPanel, { extractors: extractors, onChange: onChange }));
        expect(screen.getByText('myVar')).toBeInTheDocument();
        expect(screen.getByText('//result')).toBeInTheDocument();
    });
    it('should show source type', () => {
        const onChange = vi.fn();
        const extractors = [{
                id: 'ext-2',
                type: 'XPath',
                source: 'body',
                path: '//data',
                variable: 'testVar'
            }];
        render(_jsx(ExtractorsPanel, { extractors: extractors, onChange: onChange }));
        expect(screen.getByText('body')).toBeInTheDocument();
    });
    it('should call onChange when delete button is clicked', () => {
        const onChange = vi.fn();
        const extractors = [{
                id: 'ext-3',
                type: 'XPath',
                source: 'body',
                path: '//test',
                variable: 'deleteMe'
            }];
        render(_jsx(ExtractorsPanel, { extractors: extractors, onChange: onChange }));
        const deleteButton = screen.getByTitle('Delete Extractor');
        fireEvent.click(deleteButton);
        expect(onChange).toHaveBeenCalledWith([]);
    });
    it('should show preview when rawResponse is provided', () => {
        const onChange = vi.fn();
        const extractors = [{
                id: 'ext-4',
                type: 'XPath',
                source: 'body',
                path: '//value',
                variable: 'previewVar'
            }];
        const rawResponse = '<root><value>test</value></root>';
        render(_jsx(ExtractorsPanel, { extractors: extractors, onChange: onChange, rawResponse: rawResponse }));
        expect(screen.getByText('Preview:')).toBeInTheDocument();
    });
    it('should render multiple extractors', () => {
        const onChange = vi.fn();
        const extractors = [
            { id: 'ext-a', type: 'XPath', source: 'body', path: '//a', variable: 'varA' },
            { id: 'ext-b', type: 'XPath', source: 'body', path: '//b', variable: 'varB' }
        ];
        render(_jsx(ExtractorsPanel, { extractors: extractors, onChange: onChange }));
        expect(screen.getByText('varA')).toBeInTheDocument();
        expect(screen.getByText('varB')).toBeInTheDocument();
    });
    it('should render header text', () => {
        const onChange = vi.fn();
        render(_jsx(ExtractorsPanel, { extractors: [], onChange: onChange }));
        expect(screen.getByText(/Context Variables extracted/i)).toBeInTheDocument();
    });
});
