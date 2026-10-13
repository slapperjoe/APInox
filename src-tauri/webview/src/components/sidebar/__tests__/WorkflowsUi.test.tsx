import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { WorkflowsUi } from '../WorkflowsUi';
import { Workflow, WorkflowStep } from '@shared/models';

// ── fixtures ─────────────────────────────────────────────────────────────────
const makeStep = (id: string, name: string): WorkflowStep => ({
    id,
    name,
    type: 'request',
    order: 0,
});

const makeWorkflow = (id: string, name: string, steps: WorkflowStep[] = []): Workflow => ({
    id,
    name,
    steps,
    variables: {},
});

const baseProps = {
    onEdit: vi.fn(),
    onRun: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onSelect: vi.fn(),
    onSelectStep: vi.fn(),
    onDeleteStep: vi.fn(),
    onMoveStep: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('WorkflowsUi (right-click context menu + double-click confirm delete)', () => {
    it('renders the workflow list and its step count', () => {
        const wf = makeWorkflow('wf-1', 'Checkout Flow', [
            makeStep('s1', 'Step 1'),
            makeStep('s2', 'Step 2'),
        ]);
        render(<WorkflowsUi workflows={[wf]} {...baseProps} />);
        expect(screen.getByText('Checkout Flow')).toBeInTheDocument();
        expect(screen.getByText('2 steps')).toBeInTheDocument();
    });

    it('right-clicking a workflow offers run/edit/duplicate/delete, with double-click confirm delete', () => {
        const wf = makeWorkflow('wf-1', 'Checkout Flow', [makeStep('s1', 'Step 1')]);
        render(<WorkflowsUi workflows={[wf]} {...baseProps} />);
        // Right-click the workflow row to open its context menu.
        fireEvent.contextMenu(screen.getByText('Checkout Flow'));
        // All four actions render.
        expect(screen.getByText('Run Workflow')).toBeInTheDocument();
        expect(screen.getByText('Edit Workflow')).toBeInTheDocument();
        expect(screen.getByText('Duplicate Workflow')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
        // Click 1 arms the Delete item — the label swaps to the confirm prompt.
        fireEvent.click(screen.getByText('Delete'));
        expect(baseProps.onDelete).not.toHaveBeenCalled();
        expect(screen.getByText('Click again to delete')).toBeInTheDocument();
        // Click 2 (while armed) actually deletes and closes the menu.
        fireEvent.click(screen.getByText('Click again to delete'));
        expect(baseProps.onDelete).toHaveBeenCalledTimes(1);
        expect(baseProps.onDelete).toHaveBeenCalledWith(wf);
    });

    it('right-clicking the empty content area offers load-from-file', () => {
        const onLoadFromFile = vi.fn();
        const wf = makeWorkflow('wf-1', 'Checkout Flow', []);
        render(<WorkflowsUi workflows={[wf]} {...baseProps} onLoadFromFile={onLoadFromFile} />);
        // Right-click the scrollable content area (not a row) to open the list menu.
        fireEvent.contextMenu(screen.getByTestId('workflows-content'));
        expect(screen.getByText('Load workflow from file')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Load workflow from file'));
        expect(onLoadFromFile).toHaveBeenCalledTimes(1);
    });

    it('right-clicking a step offers move up/down + double-click confirm delete', () => {
        const wf = makeWorkflow('wf-1', 'Checkout Flow', [
            makeStep('s1', 'First Step'),
            makeStep('s2', 'Second Step'),
        ]);
        render(<WorkflowsUi workflows={[wf]} {...baseProps} />);
        // Steps render only when the workflow is expanded — click the row to expand.
        fireEvent.click(screen.getByText('Checkout Flow'));
        fireEvent.contextMenu(screen.getByText('Second Step'));
        expect(screen.getByText('Move up')).toBeInTheDocument();
        expect(screen.getByText('Move down')).toBeInTheDocument();
        expect(screen.getByText('Delete step')).toBeInTheDocument();
        // Click 1 arms, click 2 fires.
        fireEvent.click(screen.getByText('Delete step'));
        expect(baseProps.onDeleteStep).not.toHaveBeenCalled();
        expect(screen.getByText('Click again to delete')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Click again to delete'));
        expect(baseProps.onDeleteStep).toHaveBeenCalledTimes(1);
        expect(baseProps.onDeleteStep).toHaveBeenCalledWith(wf, 's2');
    });
});
