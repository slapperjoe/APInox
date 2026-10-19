import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { UnifiedExplorerMain, UnifiedExplorerMainProps } from '../UnifiedExplorerMain';
import { UnifiedProject, ApiRequest } from '@shared/models';

// ── hermetic mocks ───────────────────────────────────────────────────────────
// The monaco sub-panel package: stub the editor/viewer so the test exercises
// the execute flow without a real Monaco editor.
vi.mock('../../../request-editor/monaco', async importOriginal => {
    const actual = await importOriginal<typeof import('../../../request-editor/monaco')>();
    return {
        MonacoRequestEditorWithToolbar: ({ value }: { value: string }) => (
            <textarea data-testid="mock-monaco-editor" value={value} readOnly />
        ),
        MonacoResponseViewer: ({ value }: { value: string }) => (
            <div data-testid="mock-response-viewer">{value}</div>
        ),
        HeadersPanel: () => null,
        AssertionsPanel: () => null,
        ExtractorsPanel: () => null,
        // The REAL banner: the error surface is what these tests assert on,
        // so mocking it away would assert on the mock instead.
        ErrorDetailBanner: actual.ErrorDetailBanner,
    };
});

// The Tauri command bridge: capture execute_soap_request invocations.
// NOTE: path is relative to THIS test file (__tests__/), so the component's
// `../../utils/bridge` import resolves to `../../../utils/bridge` from here.
// `bridge.emit` is exercised by the F-13 history write (unifiedHistory.ts)
// after every successful execution.
const invokeMock = vi.fn();
const emitMock = vi.fn();
vi.mock('../../../utils/bridge', () => ({
    invokeTauriCommand: (...args: any[]) => invokeMock(...args),
    bridge: { sendMessage: vi.fn(), onMessage: vi.fn(), emit: (...args: any[]) => emitMock(...args) },
    isVsCode: () => false,
}));

// ── fixtures ─────────────────────────────────────────────────────────────────
const TEST_ENDPOINT = 'http://soap.example.com/service';
const TEST_ACTION = 'http://soap.example.com/GetFoo';
const TEST_TARGET_NS = 'http://soap.example.com/';

const makeRequest = (id: string): ApiRequest => ({
    id,
    name: id,
    request: '<foo/>',
    endpoint: TEST_ENDPOINT,
    contentType: 'text/xml',
});

const makeProject = (requestId: string): UnifiedProject => ({
    name: 'TestService',
    source: 'wsdl',
    sourceUrl: 'http://soap.example.com/service?wsdl',
    parsedAt: new Date(),
    soapVersion: '1.1',
    operations: [
        {
            id: 'op-1',
            name: 'GetFoo',
            action: TEST_ACTION,
            targetNamespace: TEST_TARGET_NS,
            originalEndpoint: TEST_ENDPOINT,
            input: { name: 'GetFoo', children: [{ name: 'x', type: 'string' }] },
            fullSchema: { name: 'GetFoo', type: 'complex', children: [{ name: 'x', type: 'string' }] },
            requests: [makeRequest(requestId)],
        },
    ],
});

const baseProps: Omit<UnifiedExplorerMainProps, 'projects' | 'selectedNode'> = {
    onSelectNode: vi.fn(),
    onRefreshProject: vi.fn(),
    onLoadWsdl: vi.fn(),
    onNewRequest: vi.fn(),
};

/** The multi-line failure report the Rust backend now returns for a transport
 *  failure (`describe_request_failure`): summary line, cause chain, kind. */
const SOAP_FAILURE_REPORT = [
    `error sending request for url (${TEST_ENDPOINT})`,
    'caused by: client error (Connect)',
    'caused by: invalid peer certificate: UnknownIssuer',
    'kind: TLS — the TLS handshake was rejected',
].join('\n');

const setupInvoke = (mode: 'reject' | 'resolve' | 'transport-failure') => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (cmd: string) => {
        if (cmd === 'get_settings') return {};
        if (cmd === 'execute_soap_request') {
            if (mode === 'reject') {
                throw new Error('connection refused');
            }
            if (mode === 'transport-failure') {
                // A send that never reached the server: no body, an error report.
                return {
                    success: false,
                    statusCode: 0,
                    headers: [],
                    rawXml: '',
                    error: SOAP_FAILURE_REPORT,
                };
            }
            return { success: true, statusCode: 200, headers: [], rawXml: '<ok/>' };
        }
        return {};
    });
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('UnifiedExplorerMain execute (R-01 / R-02)', () => {
    it('R-01: a rejected execute_soap_request renders the error surface', async () => {
        setupInvoke('reject');
        render(
            <UnifiedExplorerMain
                {...baseProps}
                projects={[makeProject('req-1')]}
                selectedNode={{ type: 'request', id: 'req-1' }}
            />,
        );

        const runButton = screen.getByRole('button', { name: /run/i });
        fireEvent.click(runButton);

        // The banner (role=alert) appears with the error text.
        const banner = await screen.findByTestId('execute-error-banner');
        expect(banner).toHaveTextContent('connection refused');

        // The success path is unaffected: no response viewer on failure.
        expect(screen.queryByTestId('mock-response-viewer')).not.toBeInTheDocument();

        // Dismiss clears the banner.
        fireEvent.click(screen.getByLabelText('Dismiss error'));
        expect(screen.queryByTestId('execute-error-banner')).not.toBeInTheDocument();
    });

    it('R-01b: a failed SOAP send shows the cause chain behind the banner details', async () => {
        setupInvoke('transport-failure');
        render(
            <UnifiedExplorerMain
                {...baseProps}
                projects={[makeProject('req-1')]}
                selectedNode={{ type: 'request', id: 'req-1' }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /run/i }));

        const banner = await screen.findByTestId('execute-error-banner');
        // Summary only: the reqwest line, and ONLY that line, in the banner —
        // the certificate cause is what the Details toggle reveals.
        expect(banner).toHaveTextContent(`error sending request for url (${TEST_ENDPOINT})`);
        expect(
            within(banner).getByText(/error sending request for url/).textContent,
        ).toBe(`error sending request for url (${TEST_ENDPOINT})`);
        expect(within(banner).queryByText(/invalid peer certificate/)).toBeNull();

        fireEvent.click(screen.getByTestId('execute-error-banner-toggle'));
        const detail = screen.getByTestId('execute-error-banner-detail');
        expect(detail).toHaveTextContent('caused by: invalid peer certificate: UnknownIssuer');
        expect(detail).toHaveTextContent('kind: TLS');
    });

    it('R-02: execute sends the real resolved operation, not the nulled stub', async () => {
        setupInvoke('resolve');
        render(
            <UnifiedExplorerMain
                {...baseProps}
                projects={[makeProject('req-1')]}
                selectedNode={{ type: 'request', id: 'req-1' }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /run/i }));

        await waitFor(() => {
            const executeCall = invokeMock.mock.calls.find(c => c[0] === 'execute_soap_request');
            expect(executeCall).toBeDefined();
            const operation = executeCall![1].request.operation;
            // The resolved owner-operation fields are carried (R-02).
            expect(operation.name).toBe('GetFoo');
            expect(operation.action).toBe(TEST_ACTION);
            expect(operation.targetNamespace).toBe(TEST_TARGET_NS);
            expect(operation.input).toEqual({ name: 'GetFoo', children: [{ name: 'x', type: 'string' }] });
            expect(operation.fullSchema).toEqual({ name: 'GetFoo', type: 'complex', children: [{ name: 'x', type: 'string' }] });
            expect(operation.originalEndpoint).toBe(TEST_ENDPOINT);
            // Body bytes unchanged: rawXml is the editor content.
            expect(executeCall![1].request.rawXml).toBe('<foo/>');
            expect(executeCall![1].request.soapVersion).toBe('1.1');
        });

        // No error surface on the success path.
        expect(screen.queryByTestId('execute-error-banner')).not.toBeInTheDocument();
    });

    it('R-02: the resolved action is not sent when the operation has no action (header stays empty)', async () => {
        setupInvoke('resolve');
        const noActionProject = makeProject('req-2');
        noActionProject.operations[0].action = '';
        render(
            <UnifiedExplorerMain
                {...baseProps}
                projects={[noActionProject]}
                selectedNode={{ type: 'request', id: 'req-2' }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /run/i }));

        await waitFor(() => {
            const executeCall = invokeMock.mock.calls.find(c => c[0] === 'execute_soap_request');
            expect(executeCall).toBeDefined();
            // "" action resolves to null on the wire → SOAP 1.1 header "''",
            // identical to the pre-change stub behavior for actionless ops.
            expect(executeCall![1].request.operation.action).toBeNull();
        });
    });
});

describe('UnifiedExplorerMain history write (F-13 / R-08, phase 2 SOAP path)', () => {
    it('a successful SOAP execute writes add_history_entry with correct fields and emits HistoryUpdate', async () => {
        setupInvoke('resolve');
        render(
            <UnifiedExplorerMain
                {...baseProps}
                projects={[makeProject('req-1')]}
                selectedNode={{ type: 'request', id: 'req-1' }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /run/i }));

        // F-13: the history entry is persisted to the SINGLE global store.
        await waitFor(() => {
            const historyCall = invokeMock.mock.calls.find(c => c[0] === 'add_history_entry');
            expect(historyCall).toBeDefined();
            const entry = historyCall![1].entry;
            expect(entry.id).toBeTruthy();
            expect(typeof entry.timestamp).toBe('number');
            expect(entry.requestName).toBe('req-1');
            expect(entry.endpoint).toBe(TEST_ENDPOINT);
            expect(entry.method).toBe('POST');
            expect(entry.projectName).toBe('TestService');
            expect(entry.interfaceName).toBe('TestService');
            expect(entry.operationName).toBe('GetFoo');
            expect(entry.requestBody).toBe('<foo/>');
            expect(entry.headers).toEqual({});
            expect(entry.status).toBe(200);
            expect(typeof entry.duration).toBe('number');
            expect(entry.responseBody).toBe('<ok/>');
            expect(entry.responseHeaders).toEqual({});
            expect(entry.responseSize).toBe('<ok/>'.length);
            expect(entry.success).toBe(true);
            expect(entry.starred).toBe(false);
        });

        // The live History view is updated via the HistoryUpdate event (same
        // mechanism as the legacy path — useMessageHandler prepends the entry).
        await waitFor(() => {
            const emitCalls = emitMock.mock.calls.filter(c => c[0]?.command === 'historyUpdate');
            expect(emitCalls.length).toBeGreaterThanOrEqual(1);
            expect(emitCalls[emitCalls.length - 1][0].entry.requestName).toBe('req-1');
        });
    });

    it('a failed SOAP execute does NOT write history (legacy parity: history is written from the resolved response only)', async () => {
        setupInvoke('reject');
        render(
            <UnifiedExplorerMain
                {...baseProps}
                projects={[makeProject('req-1')]}
                selectedNode={{ type: 'request', id: 'req-1' }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /run/i }));

        await screen.findByTestId('execute-error-banner');
        // No execution completed → no history entry, no HistoryUpdate event.
        const historyCall = invokeMock.mock.calls.find(c => c[0] === 'add_history_entry');
        expect(historyCall).toBeUndefined();
        const historyUpdate = emitMock.mock.calls.find(c => c[0]?.command === 'historyUpdate');
        expect(historyUpdate).toBeUndefined();
    });
});
