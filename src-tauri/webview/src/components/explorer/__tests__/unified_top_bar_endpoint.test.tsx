import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedExplorerMain, UnifiedExplorerMainProps } from '../UnifiedExplorerMain';
import { UnifiedProject } from '@shared/models';

// ── hermetic mocks (same shape as unified_explorer_execute.test.tsx) ─────────
vi.mock('@apinox/request-editor/monaco', () => ({
    MonacoRequestEditorWithToolbar: ({ value }: { value: string }) => (
        <textarea data-testid="mock-monaco-editor" value={value} readOnly />
    ),
    MonacoResponseViewer: ({ value }: { value: string }) => (
        <div data-testid="mock-response-viewer">{value}</div>
    ),
    HeadersPanel: () => null,
    AssertionsPanel: () => null,
    ExtractorsPanel: () => null,
}));

const invokeMock = vi.fn();
const emitMock = vi.fn();
vi.mock('../../../utils/bridge', () => ({
    invokeTauriCommand: (...args: any[]) => invokeMock(...args),
    bridge: { sendMessage: vi.fn(), onMessage: vi.fn(), emit: (...args: any[]) => emitMock(...args) },
    isVsCode: () => false,
}));

const EP = 'http://soap.example.com/service';

const makeProject = (): UnifiedProject => ({
    name: 'TestService',
    source: 'wsdl',
    sourceUrl: 'http://soap.example.com/service?wsdl',
    parsedAt: new Date(),
    soapVersion: '1.1',
    operations: [
        {
            id: 'op-1',
            name: 'GetFoo',
            action: 'http://soap.example.com/GetFoo',
            targetNamespace: 'http://soap.example.com/',
            originalEndpoint: EP,
            input: { name: 'GetFoo', children: [{ name: 'x', type: 'string' }] },
            fullSchema: { name: 'GetFoo', type: 'complex', children: [{ name: 'x', type: 'string' }] },
            requests: [{ id: 'req-1', name: 'req-1', request: '<foo/>', endpoint: EP, contentType: 'text/xml' }],
        },
    ],
});

const baseProps: Omit<UnifiedExplorerMainProps, 'projects' | 'selectedNode'> = {
    onSelectNode: vi.fn(),
    onRefreshProject: vi.fn(),
    onLoadWsdl: vi.fn(),
    onNewRequest: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockImplementation(async (cmd: string) => {
        if (cmd === 'get_settings') return {};
        if (cmd === 'execute_soap_request') return { success: true, statusCode: 200, headers: [], rawXml: '<ok/>' };
        return {};
    });
});

describe('UnifiedExplorerMain top-bar endpoint (F-14)', () => {
    it('shows the request endpoint when a request is selected', () => {
        render(
            <UnifiedExplorerMain {...baseProps} projects={[makeProject()]}
                selectedNode={{ type: 'request', id: 'req-1' }} />,
        );
        const input = screen.getByTestId('unified-endpoint-input') as HTMLInputElement;
        expect(input.value).toBe(EP);
        expect(screen.queryByPlaceholderText('Enter WSDL URL and press Load')).not.toBeInTheDocument();
    });

    it('shows the operation endpoint when an operation is selected', () => {
        render(
            <UnifiedExplorerMain {...baseProps} projects={[makeProject()]}
                selectedNode={{ type: 'operation', id: 'op-1' }} />,
        );
        const input = screen.getByTestId('unified-endpoint-input') as HTMLInputElement;
        expect(input.value).toBe(EP);
    });

    it('keeps the WSDL loader when nothing is selected', () => {
        render(
            <UnifiedExplorerMain {...baseProps} projects={[makeProject()]} selectedNode={null} />,
        );
        expect(screen.getByPlaceholderText('Enter WSDL URL and press Load')).toBeInTheDocument();
        expect(screen.queryByTestId('unified-endpoint-input')).not.toBeInTheDocument();
    });

    it('sends the edited endpoint from the bar on Run (SOAP override)', async () => {
        render(
            <UnifiedExplorerMain {...baseProps} projects={[makeProject()]}
                selectedNode={{ type: 'request', id: 'req-1' }} />,
        );
        const input = screen.getByTestId('unified-endpoint-input');
        fireEvent.change(input, { target: { value: 'http://override.example.com/svc' } });
        fireEvent.click(screen.getByRole('button', { name: /run/i }));

        await waitFor(() => {
            const calls = invokeMock.mock.calls.filter((c: any[]) => c[0] === 'execute_soap_request');
            expect(calls.length).toBe(1);
        });
        const call = invokeMock.mock.calls.find((c: any[]) => c[0] === 'execute_soap_request')!;
        expect(call[1].request.endpoint).toBe('http://override.example.com/svc');
    });
});
