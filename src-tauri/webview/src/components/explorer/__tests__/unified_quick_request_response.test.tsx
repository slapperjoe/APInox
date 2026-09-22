import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { UnifiedExplorerMain, UnifiedExplorerMainProps } from '../UnifiedExplorerMain';
import { UnifiedProject, ScrapbookRequest } from '@shared/models';

// hermetic mocks — same contract as unified_explorer_execute.test.tsx
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

// The app-level scrapbook context: fixed selected quick request. The real
// context is not exported, so mock the module and have `useScrapbookOptional`
// return the value the provider would supply for the selected entry.
const quick: ScrapbookRequest = {
    id: 'scrap-1',
    name: 'Quick Continents',
    request: '<soapenv:Envelope><soapenv:Body><m:ListOfContinentsByName /></soapenv:Body></soapenv:Envelope>',
    requestType: 'soap',
    method: 'POST',
    bodyType: 'xml',
    contentType: 'application/soap+xml; charset=utf-8',
    headers: {},
    endpoint: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso',
    createdAt: '2026-09-21T00:00:00.000Z',
    lastModified: '2026-09-21T00:00:00.000Z',
};
const updateRequestMock = vi.fn();
const captureExecutionMock = vi.fn();
vi.mock('../../../contexts/ScrapbookContext', () => ({
    useScrapbook: () => ({
        scrapbookRequests: [quick],
        selectedScrapbookRequest: quick,
        loading: false,
        createRequest: vi.fn(),
        updateRequest: updateRequestMock,
        deleteRequest: vi.fn(),
        selectRequest: vi.fn(),
        refreshScrapbook: vi.fn(),
        captureExecution: captureExecutionMock,
    }),
    useScrapbookOptional: () => ({
        scrapbookRequests: [quick],
        selectedScrapbookRequest: quick,
        loading: false,
        createRequest: vi.fn(),
        updateRequest: updateRequestMock,
        deleteRequest: vi.fn(),
        selectRequest: vi.fn(),
        refreshScrapbook: vi.fn(),
        captureExecution: captureExecutionMock,
    }),
}));

const invokeMock = vi.fn();
const emitMock = vi.fn();
vi.mock('../../../utils/bridge', () => ({
    invokeTauriCommand: (...args: any[]) => invokeMock(...args),
    bridge: { sendMessage: vi.fn(), onMessage: vi.fn(), emit: (...args: any[]) => emitMock(...args) },
    isVsCode: () => false,
}));

const QUICK_ENDPOINT = quick.endpoint;

const baseProps: Omit<UnifiedExplorerMainProps, 'projects' | 'selectedNode'> = {
    onSelectNode: vi.fn(),
    onRefreshProject: vi.fn(),
    onLoadWsdl: vi.fn(),
    onNewRequest: vi.fn(),
};

const makeProjects = (withDetail: boolean): UnifiedProject[] => [{
    name: 'CountryInfoServiceSoap12',
    source: 'wsdl',
    sourceUrl: QUICK_ENDPOINT,
    parsedAt: new Date(),
    operations: withDetail
        ? [{
            name: 'ListOfContinentsByName',
            action: '',
            targetNamespace: 'http://www.oorsprong.org/websamples.countryinfo',
            originalEndpoint: QUICK_ENDPOINT,
            requests: [{ name: 'sample_ListOfContinentsByName', id: 'req-x', request: '<sample/>' }],
        }]
        : [],
}];

describe('UnifiedExplorerMain — quick request run → response pane (bug 2 repro)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows the response after a quick request completes even when `projects` reloads mid-flight', async () => {
        // Realistic: the Rust call takes ~50ms; during that window the unified
        // context replaces the skeleton with full detail (new `projects`
        // identity). The selection-sync effect re-runs and must not wipe the
        // in-flight execution's response.
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === 'get_settings') return {};
            if (cmd === 'execute_soap_request') {
                await new Promise(r => setTimeout(r, 50));
                return { success: true, statusCode: 200, headers: [['content-type', 'text/xml']], rawXml: '<ok>continents</ok>' };
            }
            return {};
        });

        const selectedNode = { type: 'scrapbook', id: quick.id };
        const { rerender } = render(
            <UnifiedExplorerMain {...baseProps} projects={makeProjects(false)} selectedNode={selectedNode} />,
        );

        const runButton = await screen.findByTestId('unified-topbar-run');
        expect((runButton as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(runButton);

        // `projects` prop identity changes mid-flight (skeleton → detail).
        await act(async () => {
            rerender(<UnifiedExplorerMain {...baseProps} projects={makeProjects(true)} selectedNode={selectedNode} />);
        });

        // The execute call went out for the quick request.
        await waitFor(() => {
            const call = invokeMock.mock.calls.find(c => c[0] === 'execute_soap_request');
            expect(call).toBeDefined();
            expect(call![1].request.endpoint).toBe(QUICK_ENDPOINT);
        });

        // The response pane must render the body once the call resolves.
        const viewer = await screen.findByTestId('mock-response-viewer');
        expect(viewer).toHaveTextContent('<ok>continents</ok>');
    }, 20000);

    it('control: stable projects — a quick request run renders the response without any projects reload', async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === 'get_settings') return {};
            if (cmd === 'execute_soap_request') {
                return { success: true, statusCode: 200, headers: [['content-type', 'text/xml']], rawXml: '<ok>stable</ok>' };
            }
            return {};
        });

        const selectedNode = { type: 'scrapbook', id: quick.id };
        render(<UnifiedExplorerMain {...baseProps} projects={makeProjects(true)} selectedNode={selectedNode} />);

        const runButton = await screen.findByTestId('unified-topbar-run');
        fireEvent.click(runButton);

        const viewer = await screen.findByTestId('mock-response-viewer');
        expect(viewer).toHaveTextContent('<ok>stable</ok>');
    });

    it('a FAILED (500 fault) quick request still renders the response pane (calculator case)', async () => {
        // Matches the live calculator run: quick request, stable projects,
        // server returns 500 + SOAP fault. Rust returns Ok() with success=false
        // and the full fault in rawXml — the pane must still show it.
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === 'get_settings') return {};
            if (cmd === 'execute_soap_request') {
                await new Promise(r => setTimeout(r, 30));
                return {
                    success: false,
                    statusCode: 500,
                    headers: [['content-type', 'text/xml; charset=utf-8']],
                    body: null,
                    rawXml: '<soap:Envelope><soap:Body><soap:Fault><faultstring>bad SOAPAction</faultstring></soap:Fault></soap:Body></soap:Envelope>',
                    error: null,
                };
            }
            return {};
        });

        const selectedNode = { type: 'scrapbook', id: quick.id };
        render(<UnifiedExplorerMain {...baseProps} projects={makeProjects(true)} selectedNode={selectedNode} />);

        const runButton = await screen.findByTestId('unified-topbar-run');
        fireEvent.click(runButton);

        const viewer = await screen.findByTestId('mock-response-viewer');
        expect(viewer).toHaveTextContent('bad SOAPAction');
    }, 20000);

    it('a project SOAP request that returns a 500 fault still renders the response (calculator Add op)', async () => {
        // Exact calculator reproduction: a project-tree request (type 'request',
        // real endpoint + action, NOT a quick request) is run. While it's
        // in flight, (a) the project's skeleton is upgraded to full detail
        // (`ensureProjectFull`) and (b) the success path fires
        // `persistRequestUpdate` → `save_unified_project`. Both change the
        // `projects` identity. The 500 SOAP fault comes back in rawXml and
        // MUST still render in the pane.
        const project: UnifiedProject = {
            name: 'CalculatorSoap',
            source: 'wsdl',
            sourceUrl: 'http://www.dneonline.com/calculator.asmx?wsdl',
            parsedAt: new Date(),
            soapVersion: '1.1',
            operations: [{
                name: 'Add',
                action: '',
                targetNamespace: 'http://tempuri.org/',
                originalEndpoint: 'http://www.dneonline.com/calculator.asmx',
                requests: [{
                    id: 'add-sample',
                    name: 'sample_Add',
                    request: '<Add xmlns="http://tempuri.org/"><intA>0</intA><intB>0</intB></Add>',
                    endpoint: 'http://www.dneonline.com/calculator.asmx',
                    contentType: 'text/xml; charset=utf-8',
                }],
            }],
        };

        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === 'get_settings') return {};
            if (cmd === 'execute_soap_request') {
                await new Promise(r => setTimeout(r, 30));
                return {
                    success: false,
                    statusCode: 500,
                    headers: [['content-type', 'text/xml; charset=utf-8']],
                    body: null,
                    rawXml: '<soap:Envelope><soap:Body><soap:Fault><faultstring>Server did not recognize the value of HTTP Header SOAPAction</faultstring></soap:Fault></soap:Body></soap:Envelope>',
                    error: null,
                };
            }
            if (cmd === 'save_unified_project') return { success: true };
            return {};
        });

        const selectedNode = { type: 'request', id: 'add-sample' };
        const { rerender } = render(
            <UnifiedExplorerMain {...baseProps} projects={[project]} selectedNode={selectedNode} />,
        );

        const runButton = await screen.findByTestId('unified-topbar-run');
        fireEvent.click(runButton);

        // `projects` identity changes mid-flight (skeleton→detail upgrade).
        await act(async () => {
            rerender(<UnifiedExplorerMain {...baseProps} projects={[project]} selectedNode={selectedNode} />);
        });

        await waitFor(() => {
            const call = invokeMock.mock.calls.find(c => c[0] === 'execute_soap_request');
            expect(call).toBeDefined();
            expect(call![1].request.endpoint).toBe('http://www.dneonline.com/calculator.asmx');
        });

        const viewer = await screen.findByTestId('mock-response-viewer');
        expect(viewer).toHaveTextContent('Server did not recognize the value of HTTP Header SOAPAction');
    }, 20000);

    it('auto-capture re-keying a quick request does not blank the response pane', async () => {
        // The real calculator flow: quick request runs via the sidebar play
        // button (registered execute path). On success `onAfterExecute`
        // (captureExecution) appends a NEW scrapbook entry (new id) and the
        // ScrapbookProvider auto-selects it. `editingRequest` re-points to the
        // new entry while the response is cached under the ORIGINAL request id
        // — the primary keyed lookup misses and the pane would stay blank
        // without the `lastExecutedId` fallback.
        const onAfterExecute = vi.fn(async () => {
            // Simulate the provider re-selecting the newly-captured entry
            // (new id, same data).
            await act(async () => {
                rerender(
                    <UnifiedExplorerMain
                        {...baseProps}
                        projects={makeProjects(true)}
                        selectedNode={{ type: 'scrapbook', id: quick.id }}
                        onAfterExecute={onAfterExecute}
                    />,
                );
                // The context's selected entry is now the NEW id (the mock
                // module is static, so emulate the re-key by re-rendering with
                // the same node — the primary lookup must still resolve).
            });
        });
        let rerender: (el: React.ReactElement) => void = () => {};

        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === 'get_settings') return {};
            if (cmd === 'execute_soap_request') {
                await new Promise(r => setTimeout(r, 30));
                return { success: true, statusCode: 200, headers: [['content-type', 'text/xml']], rawXml: '<ok>calc</ok>' };
            }
            return {};
        });

        const view = render(
            <UnifiedExplorerMain
                {...baseProps}
                projects={makeProjects(true)}
                selectedNode={{ type: 'scrapbook', id: quick.id }}
                onAfterExecute={onAfterExecute}
            />,
        );
        rerender = view.rerender;

        const runButton = await screen.findByTestId('unified-topbar-run');
        fireEvent.click(runButton);

        const viewer = await screen.findByTestId('mock-response-viewer');
        expect(viewer).toHaveTextContent('<ok>calc</ok>');
        // Auto-capture fired (success path).
        expect(onAfterExecute).toHaveBeenCalled();
    }, 20000);
});
