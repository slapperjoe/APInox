import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateTestCaseFromTrafficModal } from './CreateTestCaseFromTrafficModal';
import type { TestSuite } from '@shared/models';
import type { TrafficLog } from '../proxy/TrafficViewer';

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

const renderModal = (props: Partial<Parameters<typeof CreateTestCaseFromTrafficModal>[0]> = {}) => {
    const onCreate = props.onCreate ?? vi.fn();
    const utils = render(
        <CreateTestCaseFromTrafficModal
            logs={logs}
            anchorLogId="log-a"
            testSuites={[suite]}
            onClose={props.onClose ?? vi.fn()}
            onCreate={onCreate}
        />
    );
    return { ...utils, onCreate };
};

describe('CreateTestCaseFromTrafficModal', () => {
    it('renders the title, all suites, and all captured requests with the anchor pre-selected', () => {
        renderModal();
        expect(screen.getByText('Create Test Case from Traffic')).toBeInTheDocument();
        expect(screen.getByText('Smoke Suite')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'POST login' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'GET profile' })).not.toBeChecked();
    });

    it('disables Create until a suite is selected, then submits with the default case name', () => {
        const { onCreate } = renderModal();
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
        const { onCreate } = renderModal();
        fireEvent.click(screen.getByText('Smoke Suite'));

        // Check the second log.
        fireEvent.click(screen.getByRole('checkbox', { name: 'GET profile' }));

        fireEvent.click(screen.getByText('Create Test Case').closest('button') as HTMLButtonElement);
        expect(onCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                selectedLogs: [logs[0], logs[1]],
            })
        );
    });

    it('supports select-all / select-none via the header checkbox', () => {
        const { onCreate } = renderModal();
        fireEvent.click(screen.getByText('Smoke Suite'));

        // Currently one of two selected → check select-all to include both.
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select all requests' }));
        expect(screen.getByRole('checkbox', { name: 'POST login' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'GET profile' })).toBeChecked();

        // Now all selected → unchecking clears everything and disables Create.
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select all requests' }));
        const createBtn = screen.getByText('Create Test Case').closest('button') as HTMLButtonElement;
        expect(createBtn.disabled).toBe(true);
        expect(onCreate).not.toHaveBeenCalled();
    });

    it('can create a new suite: name required before Create is enabled', () => {
        const { onCreate } = renderModal();
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
        const { onCreate } = renderModal();
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
        const { onCreate } = renderModal();
        fireEvent.click(screen.getByText('Smoke Suite'));

        fireEvent.click(screen.getByRole('checkbox', { name: 'POST login' }));
        const createBtn = screen.getByText('Create Test Case').closest('button') as HTMLButtonElement;
        expect(createBtn.disabled).toBe(true);
        expect(onCreate).not.toHaveBeenCalled();
    });
});
