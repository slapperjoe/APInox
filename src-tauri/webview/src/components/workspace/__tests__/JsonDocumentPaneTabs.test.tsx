/**
 * The JSON tab on a test case and a test suite.
 *
 * The raw editor used to be a modal, which meant you could not keep it open and could not see
 * the entity you were editing. As a tab it sits in the same place the structured view does, so
 * the entity context stays visible and the document survives navigating away and back.
 *
 * These guard the two things that make it a tab rather than a dialog: the strip renders only
 * when the wiring exists (isolated component tests pass no handlers), and the pane replaces the
 * structured content only for the entity the strip is showing.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TestCaseView } from '../TestCaseView';
import { TestSuiteSummary } from '../TestSuiteSummary';

vi.mock('../../ContextHelpButton', () => ({ ContextHelpButton: () => null }));

// The pane pulls in Monaco, which cannot run in jsdom. Stub it so these tests assert the tab
// behaviour, not the editor.
vi.mock('../JsonDocumentPane', () => ({
    JsonDocumentPane: (props: {
        entityLabel: string;
        expectedId: string;
        onSave: (doc: any) => void;
    }) => (
        <div data-testid="pane">
            {props.entityLabel}:{props.expectedId}
            <button onClick={() => props.onSave({ id: props.expectedId })}>stub-save</button>
        </div>
    ),
}));

const testCase = { id: 'c1', name: 'Case', steps: [{ id: 's1', name: 'Step', type: 'request' as const, config: {} }] };
const suite = { id: 's1', name: 'Suite', testCases: [testCase] };

describe('the case view', () => {
    it('shows no tab strip when the JSON wiring is absent', () => {
        render(<TestCaseView testCase={testCase} />);
        expect(screen.queryByText('JSON')).not.toBeInTheDocument();
        // The structured view is unchanged: the steps list still renders.
        expect(screen.getByText('Step')).toBeInTheDocument();
    });

    it('renders the strip and switches to the pane', () => {
        const onOpen = vi.fn();
        render(
            <TestCaseView
                testCase={testCase}
                json={{ active: false, onOpen, onClose: vi.fn(), onSave: vi.fn() }}
            />,
        );

        fireEvent.click(screen.getByText('JSON'));
        expect(onOpen).toHaveBeenCalled();
        expect(screen.queryByTestId('pane')).not.toBeInTheDocument();
    });

    it('replaces the steps list when the tab is active', () => {
        render(
            <TestCaseView
                testCase={testCase}
                json={{ active: true, onOpen: vi.fn(), onClose: vi.fn(), onSave: vi.fn() }}
            />,
        );

        expect(screen.getByTestId('pane')).toHaveTextContent('test case:c1');
        expect(screen.queryByText('Step')).not.toBeInTheDocument();
    });
});

describe('the suite summary', () => {
    it('shows no tab strip when the JSON wiring is absent', () => {
        render(<TestSuiteSummary suite={suite} />);
        expect(screen.queryByText('JSON')).not.toBeInTheDocument();
        expect(screen.queryByText('Overview')).not.toBeInTheDocument();
        // The structured view is unchanged: the case list still renders.
        expect(screen.getByText('Case')).toBeInTheDocument();
    });

    it('replaces the overview with the pane when the tab is active', () => {
        render(
            <TestSuiteSummary
                suite={suite}
                json={{ active: true, onOpen: vi.fn(), onClose: vi.fn(), onSave: vi.fn() }}
            />,
        );

        expect(screen.getByTestId('pane')).toHaveTextContent('test suite:s1');
        expect(screen.queryByText('Test Cases')).not.toBeInTheDocument();
    });

    it('the pane writes through the same save path as the structured view', () => {
        const onSave = vi.fn();
        render(
            <TestSuiteSummary
                suite={suite}
                json={{ active: true, onOpen: vi.fn(), onClose: vi.fn(), onSave }}
            />,
        );

        fireEvent.click(screen.getByText('stub-save'));
        // The callback is the store's own update path, so the pane does not write anywhere else.
        expect(onSave).toHaveBeenCalledWith({ id: 's1' });
    });
});
