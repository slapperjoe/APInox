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
    const createBtn = () => screen.getByText('Create Test Case').closest('button') as HTMLButtonElement;

    it('renders the title, all suites, and every captured request selected by default', () => {
        renderWizard();
        expect(screen.getByText('Create Test Case from Traffic')).toBeInTheDocument();
        expect(screen.getByText('Smoke Suite')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'POST /login' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'GET /users/profile' })).toBeChecked();
    });

    it('highlights the right-clicked capture — it is selected like the others, so it is marked by colour', () => {
        renderWizard();
        const anchor = screen.getByRole('checkbox', { name: 'POST /login' }).closest('label') as HTMLElement;
        expect(anchor.title).toContain('right-clicked capture');
        expect(anchor.style.border).toContain('var(--apinox-focusBorder');
    });

    it('disables Create until a suite is selected, then submits with the default case name', () => {
        const { onCreate } = renderWizard();
        const createBtn = screen.getByText('Create Test Case').closest('button') as HTMLButtonElement;

        // Requests are already selected — the suite is the only missing piece.
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
            selectedLogs: [logs[0], logs[1]], // the full default set, in capture order
        });
    });

    it('prunes an unwanted capture from the default all-selected set', () => {
        const { onCreate } = renderWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));

        fireEvent.click(screen.getByRole('checkbox', { name: 'GET /users/profile' }));

        fireEvent.click(createBtn());
        expect(onCreate).toHaveBeenCalledWith(
            expect.objectContaining({ selectedLogs: [logs[0]] })
        );
    });

    it('supports select-all / select-none via the header checkbox', () => {
        const { onCreate } = renderWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));

        // All selected by default → unchecking the header clears everything and
        // disables Create.
        const selectAll = screen.getByRole('checkbox', { name: 'Select all requests' });
        expect(selectAll).toBeChecked();
        fireEvent.click(selectAll);
        expect(screen.getByRole('checkbox', { name: 'POST /login' })).not.toBeChecked();
        const createBtn = screen.getByText('Create Test Case').closest('button') as HTMLButtonElement;
        expect(createBtn.disabled).toBe(true);
        expect(onCreate).not.toHaveBeenCalled();

        // Re-checking restores the full set.
        fireEvent.click(selectAll);
        expect(screen.getByRole('checkbox', { name: 'POST /login' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'GET /users/profile' })).toBeChecked();
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
            selectedLogs: [logs[0], logs[1]],
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
        fireEvent.click(screen.getByRole('checkbox', { name: 'GET /users/profile' }));
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

const btn = (text: string) => screen.getByText(text).closest('button') as HTMLButtonElement;
const pickCheckbox = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
const bulkControl = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;

describe('CreateTestCaseFromTrafficWizard chain capture', () => {
    it('offers the detected reused value NOT accepted by default, with the element tag as variable name', () => {
        renderChainedWizard();
        expect(screen.getByText(/Captured & reused values \(0\/1\)/)).toBeInTheDocument();
        // The suggestion row: value + raw source line + from/used-in labels.
        expect(screen.getByText('TKN-999')).toBeInTheDocument();
        expect(screen.getByText('<Token>TKN-999</Token>')).toBeInTheDocument();
        expect(screen.getByText('from POST /login (<Token>)')).toBeInTheDocument();
        expect(screen.getByText('used in GET /users/profile?token=TKN-999 (url)')).toBeInTheDocument();
        // Not accepted by default; the name shown is the detector's default.
        expect(pickCheckbox('tc-chain-0')).not.toBeChecked();
        expect(screen.getByLabelText('Variable name for TKN-999')).toHaveValue('token');
    });

    it('emits an extractor on the source step and a substitution once the value is accepted', () => {
        const { onCreate } = renderChainedWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));

        fireEvent.click(pickCheckbox('tc-chain-0'));
        fireEvent.click(btn('Create Test Case'));

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
        fireEvent.click(pickCheckbox('tc-chain-0'));
        fireEvent.change(screen.getByLabelText('Variable name for TKN-999'), { target: { value: 'sess' } });
        fireEvent.click(btn('Create Test Case'));

        const arg = onCreate.mock.calls[0][0];
        expect(arg.valueSubstitutions).toEqual([{ value: 'TKN-999', variable: 'sess' }]);
        expect(arg.extractors).toEqual({
            'log-a': [expect.objectContaining({ variable: 'sess' })],
        });
    });

    it('drops the pick when the user unchecks it again', () => {
        const { onCreate } = renderChainedWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));
        fireEvent.click(pickCheckbox('tc-chain-0'));
        fireEvent.click(pickCheckbox('tc-chain-0'));
        fireEvent.click(btn('Create Test Case'));

        const arg = onCreate.mock.calls[0][0];
        expect(arg.valueSubstitutions).toBeUndefined();
        expect(arg.extractors).toBeUndefined();
    });

    it('skips the pick when its source step is excluded from the case', () => {
        const { onCreate } = renderChainedWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));
        fireEvent.click(pickCheckbox('tc-chain-0'));
        // Requests are all selected by default — drop the SOURCE step.
        fireEvent.click(screen.getByRole('checkbox', { name: 'POST /login' }));
        fireEvent.click(btn('Create Test Case'));

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

    it('Remove all clears every accepted value, Add all restores the defaults', () => {
        const { onCreate } = renderChainedWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));

        const addAll = bulkControl('variables-add-all');
        const removeAll = bulkControl('variables-remove-all');

        // Nothing accepted by default → Remove all is a no-op, Add all works.
        expect(addAll.disabled).toBe(false);
        expect(removeAll.disabled).toBe(true);

        fireEvent.click(addAll);
        expect(pickCheckbox('tc-chain-0')).toBeChecked();
        expect(screen.getByText(/Captured & reused values \(1\/1\)/)).toBeInTheDocument();
        expect(addAll.disabled).toBe(true);
        expect(removeAll.disabled).toBe(false);

        fireEvent.click(removeAll);
        expect(pickCheckbox('tc-chain-0')).not.toBeChecked();

        fireEvent.click(btn('Create Test Case'));
        const arg = onCreate.mock.calls[0][0];
        expect(arg.valueSubstitutions).toBeUndefined();
    });

    it('keeps a typed variable name across Remove all / Add all', () => {
        const { onCreate } = renderChainedWizard();
        fireEvent.click(screen.getByText('Smoke Suite'));

        // The name is editable before the pick is accepted, and it survives
        // being un-accepted and re-accepted.
        fireEvent.change(screen.getByLabelText('Variable name for TKN-999'), { target: { value: 'sess' } });
        fireEvent.click(bulkControl('variables-add-all'));
        fireEvent.click(bulkControl('variables-remove-all'));
        expect(pickCheckbox('tc-chain-0')).not.toBeChecked();
        expect(screen.getByLabelText('Variable name for TKN-999')).toHaveValue('sess');

        fireEvent.click(bulkControl('variables-add-all'));
        fireEvent.click(btn('Create Test Case'));
        expect(onCreate.mock.calls[0][0].valueSubstitutions).toEqual([{ value: 'TKN-999', variable: 'sess' }]);
    });

    it('renders no bulk controls when nothing was detected', () => {
        renderWizard();
        expect(bulkControl('variables-add-all')).not.toBeInTheDocument();
        expect(bulkControl('variables-remove-all')).not.toBeInTheDocument();
    });
});
