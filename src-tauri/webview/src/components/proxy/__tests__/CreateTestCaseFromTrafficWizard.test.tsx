import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateTestCaseFromTrafficWizard } from '../CreateTestCaseFromTrafficWizard';
import type { TestSuite } from '@shared/models';
import type { TrafficLog } from '../TrafficViewer';

const logs: TrafficLog[] = [
    {
        id: 'log-a',
        timestamp: 1,
        method: 'POST',
        url: 'http://127.0.0.1:9092/login',
        requestHeaders: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
        requestBody: '<Login/>',
        status: 200,
    },
    {
        id: 'log-b',
        timestamp: 2,
        method: 'GET',
        url: 'http://127.0.0.1:9092/users/profile',
        requestHeaders: {},
        status: 200,
    },
];

const suite: TestSuite = {
    id: 'suite-1',
    name: 'Smoke Suite',
    testCases: [{ id: 'tc-1', name: 'Case 1', steps: [] }],
};

const renderWizard = (props: Partial<Parameters<typeof CreateTestCaseFromTrafficWizard>[0]> = {}) => {
    const onCreate = props.onCreate ?? vi.fn();
    const utils = render(
        <CreateTestCaseFromTrafficWizard
            logs={logs}
            anchorLogId="log-a"
            testSuites={[suite]}
            onCancel={props.onCancel ?? vi.fn()}
            onCreate={onCreate}
        />
    );
    return { ...utils, onCreate };
};

describe('CreateTestCaseFromTrafficWizard', () => {
    it('renders the title, all suites, and all captured requests with the anchor pre-selected', () => {
        renderWizard();
        expect(screen.getByText('Create Test Case from Traffic')).toBeInTheDocument();
        expect(screen.getByText('Smoke Suite')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'POST /login' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'GET /users/profile' })).not.toBeChecked();
    });

    it('disables Create until a suite is selected, then submits with the default case name', () => {
        const { onCreate } = renderWizard();
        const createBtn = screen.getByText('Create Test Case').closest('button') as HTMLButtonElement;

        // No suite selected yet — the right-clicked log is pre-checked but that
        // alone is not enough.
        expect(createBtn.disabled).toBe(true);

        fireEvent.click(screen.getByText('Smoke Suite'));
        expect(createBtn.disabled).toBe(false);

        // The suite already has one case, so the default name is `TestCase 2`.
        expect(screen.getByLabelText('Test case name')).toHaveValue('TestCase 2');

        fireEvent.click(createBtn);
        expect(onCreate).toHaveBeenCalledTimes(1);
        expect(onCreate).toHaveBeenCalledWith({
            suite: { kind: 'existing', suiteId: 'suite-1' },
            caseName: 'TestCase 2',
            selectedLogs: [logs[0]], // only the anchor, in capture order
        });
    });

    it('includes every checked request, in capture order', () => {
        const { onCreate } = renderWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));

        // Check the second log.
        fireEvent.click(screen.getByRole('checkbox', { name: 'GET /users/profile' }));

        fireEvent.click(screen.getByText('Create Test Case').closest('button') as HTMLButtonElement);
        expect(onCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                selectedLogs: [logs[0], logs[1]],
            })
        );
    });

    it('supports select-all / select-none via the header checkbox', () => {
        const { onCreate } = renderWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));

        // Currently one of two selected → check select-all to include both.
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select all requests' }));
        expect(screen.getByRole('checkbox', { name: 'POST /login' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'GET /users/profile' })).toBeChecked();

        // Now all selected → unchecking clears everything and disables Create.
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select all requests' }));
        const createBtn = screen.getByText('Create Test Case').closest('button') as HTMLButtonElement;
        expect(createBtn.disabled).toBe(true);
        expect(onCreate).not.toHaveBeenCalled();
    });

    it('can create a new suite: name required before Create is enabled', () => {
        const { onCreate } = renderWizard();
        const createBtn = screen.getByText('Create Test Case').closest('button') as HTMLButtonElement;

        fireEvent.click(screen.getByText('New Suite…'));
        // New suite without a name → still disabled.
        expect(createBtn.disabled).toBe(true);

        fireEvent.change(screen.getByLabelText('New suite name'), { target: { value: 'Regression' } });
        expect(createBtn.disabled).toBe(false);

        fireEvent.click(createBtn);
        expect(onCreate).toHaveBeenCalledWith({
            suite: { kind: 'new', name: 'Regression' },
            caseName: 'TestCase 1',
            selectedLogs: [logs[0]],
        });
    });

    it('keeps the user-edited case name across suite switches and submits it', () => {
        const { onCreate } = renderWizard();
        const nameInput = screen.getByLabelText('Test case name');

        // Edit the name first.
        fireEvent.change(nameInput, { target: { value: 'My Login Flow' } });

        // Switching the target suite must NOT clobber the edited name.
        fireEvent.click(screen.getByText('Smoke Suite'));
        expect(nameInput).toHaveValue('My Login Flow');

        fireEvent.click(screen.getByText('Create Test Case').closest('button') as HTMLButtonElement);
        expect(onCreate).toHaveBeenCalledWith(
            expect.objectContaining({ caseName: 'My Login Flow' })
        );
    });

    it('unchecking the last selected request disables Create', () => {
        const { onCreate } = renderWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));

        fireEvent.click(screen.getByRole('checkbox', { name: 'POST /login' }));
        const createBtn = screen.getByText('Create Test Case').closest('button') as HTMLButtonElement;
        expect(createBtn.disabled).toBe(true);
        expect(onCreate).not.toHaveBeenCalled();
    });
});

// ── chain capture (captured & reused values) ───────────────────────────────
const chainedLogs: TrafficLog[] = [
    {
        id: 'log-a',
        timestamp: 1,
        method: 'POST',
        url: 'http://127.0.0.1:9092/login',
        requestHeaders: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
        requestBody: '<Login/>',
        responseBody: '<Session><Token>TKN-999</Token></Session>',
        responseHeaders: {},
        status: 200,
    },
    {
        id: 'log-b',
        timestamp: 2,
        method: 'GET',
        url: 'http://127.0.0.1:9092/users/profile?token=TKN-999',
        requestHeaders: {},
        status: 200,
    },
];

const renderChainedWizard = (props: Partial<Parameters<typeof CreateTestCaseFromTrafficWizard>[0]> = {}) => {
    const onCreate = props.onCreate ?? vi.fn();
    const utils = render(
        <CreateTestCaseFromTrafficWizard
            logs={chainedLogs}
            anchorLogId="log-a"
            testSuites={[suite]}
            onCancel={props.onCancel ?? vi.fn()}
            onCreate={onCreate}
        />
    );
    return { ...utils, onCreate };
};

describe('CreateTestCaseFromTrafficWizard chain capture', () => {
    it('offers the detected reused value, accepted by default with the element tag as variable name', () => {
        const { container } = renderChainedWizard();
        expect(screen.getByText('Captured & reused values')).toBeInTheDocument();
        // The suggestion row: value + raw source line + from/used-in labels.
        expect(screen.getByText('TKN-999')).toBeInTheDocument();
        expect(screen.getByText('<Token>TKN-999</Token>')).toBeInTheDocument();
        expect(screen.getByText('from POST /login (<Token>)')).toBeInTheDocument();
        expect(screen.getByText('used in GET /users/profile?token=TKN-999 (url)')).toBeInTheDocument();
        // Accepted by default, variable name defaults to the element tag.
        const pick = container.querySelector('[data-testid="tc-chain-0"]') as HTMLInputElement;
        expect(pick.checked).toBe(true);
        expect(screen.getByLabelText('Variable name for TKN-999')).toHaveValue('token');
    });

    it('emits an extractor on the source step and a substitution for the consumed value', () => {
        const { onCreate } = renderChainedWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));
        // Include the consuming step too.
        fireEvent.click(screen.getByRole('checkbox', { name: 'GET /users/profile?token=TKN-999' }));
        fireEvent.click(screen.getByText('Create Test Case').closest('button') as HTMLButtonElement);

        expect(onCreate).toHaveBeenCalledTimes(1);
        const arg = onCreate.mock.calls[0][0];
        expect(arg.valueSubstitutions).toEqual([{ value: 'TKN-999', variable: 'token' }]);
        expect(arg.extractors).toEqual({
            'log-a': [expect.objectContaining({
                variable: 'token',
                type: 'XPath',
                source: 'body',
                path: '//Token/text()',
            })],
        });
    });

    it('honours a renamed variable', () => {
        const { onCreate } = renderChainedWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));
        fireEvent.change(screen.getByLabelText('Variable name for TKN-999'), { target: { value: 'sess' } });
        fireEvent.click(screen.getByText('Create Test Case').closest('button') as HTMLButtonElement);

        const arg = onCreate.mock.calls[0][0];
        expect(arg.valueSubstitutions).toEqual([{ value: 'TKN-999', variable: 'sess' }]);
        expect(arg.extractors).toEqual({
            'log-a': [expect.objectContaining({ variable: 'sess' })],
        });
    });

    it('drops the pick when the user unchecks it', () => {
        const { onCreate, container } = renderChainedWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));
        fireEvent.click(container.querySelector('[data-testid="tc-chain-0"]') as HTMLInputElement);
        fireEvent.click(screen.getByText('Create Test Case').closest('button') as HTMLButtonElement);

        const arg = onCreate.mock.calls[0][0];
        expect(arg.valueSubstitutions).toBeUndefined();
        expect(arg.extractors).toBeUndefined();
    });

    it('skips the pick when its source step is excluded from the case', () => {
        const { onCreate } = renderChainedWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));
        // Include only the CONSUMING step (log-b); the source (log-a) stays out.
        fireEvent.click(screen.getByRole('checkbox', { name: 'POST /login' })); // uncheck the anchor
        fireEvent.click(screen.getByRole('checkbox', { name: 'GET /users/profile?token=TKN-999' }));
        fireEvent.click(screen.getByText('Create Test Case').closest('button') as HTMLButtonElement);

        const arg = onCreate.mock.calls[0][0];
        expect(arg.selectedLogs).toEqual([chainedLogs[1]]);
        // No extractor (nothing re-captures the value) and no substitution —
        // the case stays a verbatim copy.
        expect(arg.valueSubstitutions).toBeUndefined();
        expect(arg.extractors).toBeUndefined();
    });

    it('shows the empty hint when no response values are reused', () => {
        // The default fixture has no responses → nothing detected.
        renderWizard();
        expect(screen.getByText('No response values were detected being reused in later requests.')).toBeInTheDocument();
    });
});
