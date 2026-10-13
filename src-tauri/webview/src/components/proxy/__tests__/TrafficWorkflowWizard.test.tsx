import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TrafficWorkflowWizard } from '../TrafficWorkflowWizard';

// hermetic mocks (mirror file_watcher_panel_resize.test.tsx)
vi.mock('@apinox/request-editor/monaco', () => ({
    MonacoRequestEditorWithToolbar: () => <textarea data-testid="mock-monaco" />,
    MonacoResponseViewer: () => <pre data-testid="mock-monaco-viewer" />,
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(vi.fn()) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn().mockRejectedValue(new Error('no')) }));
vi.mock('../../../utils/bridge', () => ({
    invokeTauriCommand: vi.fn().mockResolvedValue([]),
    bridge: { sendMessage: vi.fn(), listen: vi.fn() },
    isTauri: () => false,
}));

function twoLogs() {
    return [
        { id: 'a', timestamp: 1, method: 'POST', url: 'http://x/login',
          requestBody: '<B><User>mark</User></B>', responseHeaders: {},
          responseBody: '<R><SessionToken>TKN-999</SessionToken></R>' },
        { id: 'b', timestamp: 2, method: 'POST', url: 'http://x/next',
          requestBody: '<B><Auth>TKN-999</Auth></B>', requestHeaders: {} },
    ];
}

describe('TrafficWorkflowWizard', () => {
    beforeEach(() => vi.clearAllMocks());

    function gotoStep2() {
        fireEvent.change(screen.getByPlaceholderText(/workflow name/i), { target: { value: 'Login' } });
        fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    }

    it('requires a name + at least one step before Continue', () => {
        render(<TrafficWorkflowWizard logs={twoLogs()} onDone={vi.fn()} onCancel={vi.fn()} />);
        const cont = screen.getByRole('button', { name: /continue/i });
        fireEvent.click(cont); // no name -> nothing advances
        expect(screen.getByPlaceholderText(/workflow name/i)).toBeInTheDocument();
    });

    it('advances through the 3 steps and emits a Workflow on Create', () => {
        const onDone = vi.fn();
        render(<TrafficWorkflowWizard logs={twoLogs()} onDone={onDone} onCancel={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText(/workflow name/i), { target: { value: 'Login' } });
        fireEvent.click(screen.getByRole('button', { name: /continue/i }));       // -> step 2
        fireEvent.click(screen.getByRole('button', { name: /continue/i }));       // -> step 3
        fireEvent.click(screen.getByRole('button', { name: /create workflow/i }));// -> onDone
        expect(onDone).toHaveBeenCalledTimes(1);
        const wf = onDone.mock.calls[0][0];
        expect(wf.name).toBe('Login');
        expect(wf.steps).toHaveLength(2);
        expect(wf.steps[0].extractors?.some(e => e.variable === 'sessionToken')).toBe(true);
    });

    it('defaults each chain variable to its source element name', () => {
        render(<TrafficWorkflowWizard logs={twoLogs()} onDone={vi.fn()} onCancel={vi.fn()} />);
        gotoStep2();
        const nameInput = screen.getByTestId('wf-varname-TKN-999');
        expect(nameInput).toHaveValue('sessionToken');
    });

    it('lets the user rename a chain variable; the rename flows through to the extractor', () => {
        const onDone = vi.fn();
        render(<TrafficWorkflowWizard logs={twoLogs()} onDone={onDone} onCancel={vi.fn()} />);
        gotoStep2();
        fireEvent.change(screen.getByTestId('wf-varname-TKN-999'), { target: { value: 'myToken' } });
        fireEvent.click(screen.getByRole('button', { name: /continue/i }));       // -> step 3
        fireEvent.click(screen.getByRole('button', { name: /create workflow/i }));
        const wf = onDone.mock.calls[0][0];
        expect(wf.steps[0].extractors?.some(e => e.variable === 'myToken')).toBe(true);
        expect(wf.steps[0].extractors?.some(e => e.variable === 'sessionToken')).toBe(false);
    });

    it('shows every captured request/response as a collapsible accordion, first expanded by default', () => {
        render(<TrafficWorkflowWizard logs={twoLogs()} onDone={vi.fn()} onCancel={vi.fn()} />);
        gotoStep2();
        // Header rows for BOTH logs are present.
        expect(screen.getByTestId('wf-acc-a')).toBeInTheDocument();
        expect(screen.getByTestId('wf-acc-b')).toBeInTheDocument();
        // First log (a) is expanded by default: its bodies are visible.
        expect(screen.getByTestId('wf-body-a')).toBeInTheDocument();
        // Second log (b) is collapsed.
        expect(screen.queryByTestId('wf-body-b')).not.toBeInTheDocument();
        // Clicking b's header expands it and collapses a (one open at a time).
        fireEvent.click(screen.getByTestId('wf-acc-b'));
        expect(screen.queryByTestId('wf-body-a')).not.toBeInTheDocument();
        expect(screen.getByTestId('wf-body-b')).toBeInTheDocument();
    });

    it('formats the source request/response XML the same way the app formats XML', () => {
        render(<TrafficWorkflowWizard logs={twoLogs()} onDone={vi.fn()} onCancel={vi.fn()} />);
        gotoStep2();
        // The source response body (first expanded log a) is pretty-printed
        // (multi-line) — not the raw single-line capture.
        const resBody = screen.getByTestId('wf-resbody-a');
        expect(resBody.textContent).toContain('\n');
        // The captured value is still highlighted within the formatted body.
        const mark = screen.getByTestId('wf-highlight-TKN-999');
        expect(mark).toHaveTextContent('TKN-999');
    });

    it('lets the user make a manual variable from a highlighted part of the source request', () => {
        const onDone = vi.fn();
        render(<TrafficWorkflowWizard logs={twoLogs()} onDone={onDone} onCancel={vi.fn()} />);
        gotoStep2();
        fireEvent.click(screen.getByTestId('wf-varpart-mark'));
        fireEvent.click(screen.getByRole('button', { name: /use as manual variable/i }));
        fireEvent.click(screen.getByRole('button', { name: /continue/i }));       // -> step 3
        fireEvent.click(screen.getByRole('button', { name: /create workflow/i }));
        const wf = onDone.mock.calls[0][0];
        expect(wf.variables).toEqual({ user: 'mark' });
    });

    it('shows manually added variables on the review screen', () => {
        render(<TrafficWorkflowWizard logs={twoLogs()} onDone={vi.fn()} onCancel={vi.fn()} />);
        gotoStep2();
        fireEvent.click(screen.getByTestId('wf-varpart-mark'));
        fireEvent.click(screen.getByRole('button', { name: /use as manual variable/i }));
        fireEvent.click(screen.getByRole('button', { name: /continue/i }));       // -> step 3
        // The manual variable's name shows up in the Variables section as {{user}}.
        expect(screen.getByText('{{user}}')).toBeInTheDocument();
    });

    it('excludes unchecked steps from the saved workflow', () => {
        const onDone = vi.fn();
        render(<TrafficWorkflowWizard logs={twoLogs()} onDone={onDone} onCancel={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText(/workflow name/i), { target: { value: 'X' } });
        const rowB = screen.getByTestId('wf-step-b');
        fireEvent.click(rowB.querySelector('input[type="checkbox"]')!);
        fireEvent.click(screen.getByRole('button', { name: /continue/i }));
        fireEvent.click(screen.getByRole('button', { name: /continue/i }));
        fireEvent.click(screen.getByRole('button', { name: /create workflow/i }));
        const wf = onDone.mock.calls[0][0];
        expect(wf.steps).toHaveLength(1);
        expect(wf.steps[0].endpoint).toBe('http://x/login');
    });

    it('shows an empty state when there is no traffic', () => {
        render(<TrafficWorkflowWizard logs={[]} onDone={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByText(/no traffic captured/i)).toBeInTheDocument();
    });
});
