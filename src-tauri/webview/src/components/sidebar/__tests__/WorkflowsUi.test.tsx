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

// ── active workflow/step highlight ─────────────────────────────────────────
// `selectedWorkflowStep` drives the $active highlight in the sidebar: the
// workflow row is highlighted whenever its workflow is open in the editor,
// and the step row when a specific step is open. `step: null` is the
// first-class "workflow open, no step" state (clicking the workflow row or
// its Run button sets it) — it must not throw and still highlights the
// workflow row.

/** The active-selection CSS var used by the $active row styles. */
const ACTIVE_BG_VAR = 'var(--apinox-list-activeSelectionBackground)';

/** True when any injected styled-components rule targeting the element's
    classes sets the active-selection background (the $active styling). */
const hasActiveSelectionBg = (el: HTMLElement): boolean => {
    const classes = (el.className || '').split(/\s+/);
    for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRule[];
        try {
            rules = Array.from(sheet.cssRules);
        } catch {
            continue;
        }
        for (const rule of rules) {
            if (
                rule instanceof CSSStyleRule &&
                rule.selectorText &&
                classes.some(c => c && rule.selectorText.includes('.' + c)) &&
                rule.style.getPropertyValue('background-color') === ACTIVE_BG_VAR
            ) {
                return true;
            }
        }
    }
    return false;
};

describe('WorkflowsUi (active workflow/step highlight)', () => {
    it('does not throw when the selected workflow has no open step (step: null)', () => {
        const wf = makeWorkflow('wf-1', 'Checkout Flow', [
            makeStep('s1', 'Step 1'),
            makeStep('s2', 'Step 2'),
        ]);
        // Rendering with step: null used to throw on
        // `selectedWorkflowStep.step.id` during the step-row map.
        render(
            <WorkflowsUi
                workflows={[wf]}
                {...baseProps}
                selectedWorkflowStep={{ workflow: wf, step: null }}
            />
        );
        // Every row still renders.
        expect(screen.getByText('Checkout Flow')).toBeInTheDocument();
        expect(screen.getByText('Step 1')).toBeInTheDocument();
        expect(screen.getByText('Step 2')).toBeInTheDocument();
    });

    it('highlights the workflow row (and no step row) when no step is open', () => {
        const wf = makeWorkflow('wf-1', 'Checkout Flow', [
            makeStep('s1', 'Step 1'),
            makeStep('s2', 'Step 2'),
        ]);
        render(
            <WorkflowsUi
                workflows={[wf]}
                {...baseProps}
                selectedWorkflowStep={{ workflow: wf, step: null }}
            />
        );
        const workflowRow = screen.getByText('Checkout Flow').parentElement as HTMLElement;
        expect(hasActiveSelectionBg(workflowRow)).toBe(true);
        const stepRow = screen.getByText('Step 1').parentElement as HTMLElement;
        expect(hasActiveSelectionBg(stepRow)).toBe(false);
    });

    it('highlights the open step row and auto-expands its workflow', () => {
        const wf = makeWorkflow('wf-1', 'Checkout Flow', [
            makeStep('s1', 'Step 1'),
            makeStep('s2', 'Step 2'),
        ]);
        render(
            <WorkflowsUi
                workflows={[wf]}
                {...baseProps}
                selectedWorkflowStep={{ workflow: wf, step: wf.steps[1] }}
            />
        );
        // effectiveExpanded: the workflow expands on its own so the
        // highlighted step stays visible (no click needed).
        expect(screen.getByText('Step 1')).toBeInTheDocument();
        expect(screen.getByText('Step 2')).toBeInTheDocument();
        const activeRow = screen.getByText('Step 2').parentElement as HTMLElement;
        const siblingRow = screen.getByText('Step 1').parentElement as HTMLElement;
        expect(hasActiveSelectionBg(activeRow)).toBe(true);
        expect(hasActiveSelectionBg(siblingRow)).toBe(false);
    });
});
