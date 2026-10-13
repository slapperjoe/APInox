/**
 * TrafficWorkflowWizard tests.
 *
 * Tests the state machine (3 steps) and the save payload, not pixels.
 * Hermetic mocks mirror file_watcher_panel_resize.test.tsx — the wizard itself
 * imports only type-only from TrafficViewer, so these are belt-and-suspenders.
 */
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
          requestBody: '<B>1</B>', responseHeaders: {},
          responseBody: '<R><SessionToken>TKN-999</SessionToken></R>' },
        { id: 'b', timestamp: 2, method: 'POST', url: 'http://x/next',
          requestBody: '<B><Auth>TKN-999</Auth></B>', requestHeaders: {} },
    ];
}

describe('TrafficWorkflowWizard', () => {
    beforeEach(() => vi.clearAllMocks());

    it('requires a name + at least one step before Continue', () => {
        render(<TrafficWorkflowWizard logs={twoLogs()} onDone={vi.fn()} onCancel={vi.fn()} />);
        const cont = screen.getByRole('button', { name: /continue/i });
        fireEvent.click(cont); // no name -> nothing advances
        // still on step 1: the name input is present
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
        // The chained TKN-999 was auto-accepted -> extractor on step 0 (source step).
        // sanitizeVariable lowercases only the first char, so "TKN-999" -> "tKN_999".
        expect(wf.steps[0].extractors?.some(e => e.variable === 'tKN_999')).toBe(true);
    });

    it('excludes unchecked steps from the saved workflow', () => {
        const onDone = vi.fn();
        render(<TrafficWorkflowWizard logs={twoLogs()} onDone={onDone} onCancel={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText(/workflow name/i), { target: { value: 'X' } });
        // uncheck the 2nd step (row "next") via its stable testid
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
