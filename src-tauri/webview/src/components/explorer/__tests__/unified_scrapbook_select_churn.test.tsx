import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnifiedExplorerMain, UnifiedExplorerMainProps } from '../UnifiedExplorerMain';
import { ScrapbookProvider, useScrapbook } from '../../../contexts/ScrapbookContext';
import { FrontendCommand } from '@shared/messages';
import { ScrapbookRequest } from '@shared/models';

/**
 * Repro guard for the reported Quick Requests selection loop: selecting an
 * entry stored as "Request1.xml" (endpoint + charset Content-Type header)
 * made the main-area editor redraw its XML continuously. The three rows
 * (history/favorites/quick-requests) share the scrapbook sync effects, so
 * this harness mounts the REAL ScrapbookContext + UnifiedExplorerMain with a
 * fake in-memory scrapbook store and asserts that selection settles instead
 * of churning renders/saves.
 */

vi.mock('@apinox/request-editor/monaco', () => ({
    // Records the value prop at every commit so the test can assert the
    // editor never flashes BLANK between two non-empty entries (the stale
    // useState mirror of the context selection made the sync effect run its
    // clear-branch for one commit and re-seed the next — visible as an XML
    // redraw on every selection switch).
    MonacoRequestEditorWithToolbar: ({ value }: { value: string }) => {
        ((globalThis as any).__editorVals ||= []).push(value || '');
        return <textarea data-testid="mock-monaco-editor" value={value} readOnly />;
    },
    MonacoResponseViewer: ({ value }: { value: string }) => (
        <div data-testid="mock-response-viewer">{value}</div>
    ),
    HeadersPanel: () => null,
    AssertionsPanel: () => null,
    ExtractorsPanel: () => null,
}));

const SOAP_BODY =
    '<?xml version="1.0" encoding="UTF-8"?>\n<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><FamilyName /></soap:Body></soap:Envelope>';
const SOAP_BODY2 =
    '<?xml version="1.0" encoding="UTF-8"?>\n<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ListOfContinentByName><CountryName>Australia</CountryName></ListOfContinentByName></soap:Body></soap:Envelope>';
const ENDPOINT = 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso';

const makeEntry = (over: Partial<ScrapbookRequest>): ScrapbookRequest => ({
    id: 'e7e3273f-5ecb-469c-91ef-0e0e665e409b',
    name: 'Request1.xml',
    request: SOAP_BODY,
    requestType: 'soap',
    method: 'POST',
    bodyType: 'xml',
    contentType: 'application/soap+xml',
    headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
    endpoint: ENDPOINT,
    createdAt: '2026-10-01T22:03:25.530Z',
    lastModified: '2026-10-01T22:03:25.532Z',
    ...over,
});

const BAD = makeEntry({});
const GOOD = makeEntry({ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'Request', endpoint: '', request: SOAP_BODY2 });

// ── fake bridge + in-memory scrapbook store ─────────────────────────────────
let store: ScrapbookRequest[];
const sendMessageAsyncMock = vi.fn();
const updateCallCount = () =>
    sendMessageAsyncMock.mock.calls.filter(
        c => c[0]?.command === FrontendCommand.UpdateScrapbookRequest
    ).length;

vi.mock('../../../utils/bridge', () => ({
    invokeTauriCommand: vi.fn(async () => ({})),
    bridge: {
        sendMessage: vi.fn(),
        onMessage: vi.fn(),
        sendMessageAsync: (...args: any[]) => sendMessageAsyncMock(...args),
        // mirror the real event plumbing: emit dispatches a window message
        emit: (msg: any) => {
            window.dispatchEvent(new MessageEvent('message', { data: msg }));
        },
    },
    isVsCode: () => false,
}));

const baseProps: Omit<UnifiedExplorerMainProps, 'projects' | 'selectedNode'> = {
    onSelectNode: vi.fn(),
    onRefreshProject: vi.fn(),
    onLoadWsdl: vi.fn(),
    onNewRequest: vi.fn(),
};

/** Counts provider subtree renders — a render loop makes this climb without
    bound even when nothing persists. */
let probeRenders = 0;
const RenderProbe: React.FC = () => {
    useScrapbook();
    probeRenders++;
    return null;
};

const Select: React.FC<{ req: ScrapbookRequest }> = ({ req }) => {
    const { selectRequest } = useScrapbook();
    useEffect(() => {
        selectRequest(req);
    }, [req.id]);
    return null;
};

const Host: React.FC<{ req: ScrapbookRequest; id: string }> = ({ req, id }) => (
    <React.StrictMode>
        <ScrapbookProvider>
            <RenderProbe />
            <Select req={req} />
            <UnifiedExplorerMain {...baseProps} projects={[]} selectedNode={{ type: 'scrapbook', id }} />
        </ScrapbookProvider>
    </React.StrictMode>
);

beforeEach(() => {
    sendMessageAsyncMock.mockReset();
    probeRenders = 0;
    store = [BAD, GOOD];
    sendMessageAsyncMock.mockImplementation(async (msg: any) => {
        switch (msg?.command) {
            case FrontendCommand.GetScrapbook:
                return { state: { requests: store.map(r => ({ ...r })) } };
            case FrontendCommand.UpdateScrapbookRequest: {
                const i = store.findIndex(r => r.id === msg.id);
                if (i >= 0) store[i] = { ...store[i], ...msg.updates, lastModified: new Date().toISOString() };
                return { state: { requests: store.map(r => ({ ...r })) } };
            }
            case FrontendCommand.AddScrapbookRequest:
                store = [...store, msg.request];
                return { state: { requests: store.map(r => ({ ...r })) } };
            default:
                return { state: { requests: store.map(r => ({ ...r })) } };
        }
    });
});

async function settle() {
    // let any pending state-update cascade flush; a live loop keeps firing
    await new Promise(r => setTimeout(r, 150));
    await new Promise(r => setTimeout(r, 150));
}

describe('quick-request selection settles (no editor redraw loop)', () => {
    it.each([
        { label: 'Request1.xml (charset Content-Type, endpoint)', entry: BAD },
        { label: 'Request (blank endpoint)', entry: GOOD },
    ])('selecting %s does not churn renders or saves', async ({ entry }) => {
        render(<Host req={entry} id={entry.id} />);

        await screen.findByTestId('mock-monaco-editor');
        const rendersAfterMount = probeRenders;
        await settle();

        const saves = updateCallCount();
        const churn = probeRenders - rendersAfterMount;
        // A settle is a handful of cascade renders at most; a runaway loop is
        // hundreds-to-thousands within the 300ms window.
        expect({ saves, churn, rendersAfterMount }).toEqual(
            expect.objectContaining({ saves: expect.any(Number), churn: expect.any(Number) })
        );
        expect(saves).toBeLessThanOrEqual(2);
        expect(churn).toBeLessThan(30);
    });

    it('switching between quick requests never blanks the editor (no redraw flash)', async () => {
        (globalThis as any).__editorVals = [];
        // Faithful to a real sidebar row click: the provider select AND the
        // parent node update happen in ONE batched event handler, so the
        // editor must transition body→body with no blank commit between.
        const InteractiveHost: React.FC = () => {
            const { selectRequest } = useScrapbook();
            const [node, setNode] = React.useState<{ type: 'scrapbook'; id: string }>({
                type: 'scrapbook',
                id: BAD.id,
            });
            return (
                <>
                    <button onClick={() => { selectRequest(GOOD); setNode({ type: 'scrapbook', id: GOOD.id }); }}>
                        switch-good
                    </button>
                    <button onClick={() => { selectRequest(BAD); setNode({ type: 'scrapbook', id: BAD.id }); }}>
                        switch-bad
                    </button>
                    <UnifiedExplorerMain {...baseProps} projects={[]} selectedNode={node} />
                </>
            );
        };
        render(
            <React.StrictMode>
                <ScrapbookProvider>
                    <RenderProbe />
                    <InteractiveHost />
                </ScrapbookProvider>
            </React.StrictMode>
        );

        await userEvent.click(screen.getByText('switch-good'));
        await settle();
        expect((screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement).value).toBe(GOOD.request);

        await userEvent.click(screen.getByText('switch-bad'));
        await settle();
        expect((screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement).value).toBe(BAD.request);

        const vals: string[] = (globalThis as any).__editorVals;
        // Once the editor has held a non-empty body, every subsequent commit
        // must hold a non-empty body: the old stale-mirror clear flashed ''
        // for one commit and re-seeded the next — the visible XML redraw.
        const firstSeeded = vals.findIndex(v => v.length > 0);
        expect(firstSeeded).toBeGreaterThanOrEqual(0);
        const blanksAfterSeed = vals.slice(firstSeeded).filter(v => v.length === 0).length;
        expect({ blanksAfterSeed, commits: vals.length }).toEqual({ blanksAfterSeed: 0, commits: expect.any(Number) });
    });
});
