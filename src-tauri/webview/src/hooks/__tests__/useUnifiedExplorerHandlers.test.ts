/**
 * @vitest-environment jsdom
 */

/**
 * Tests for the unified-explorer handler hook, extracted from MainContent.tsx.
 *
 * The extraction itself is mechanical, so these pin the behaviours that a move
 * could silently break: selection cleanup after a delete, and the
 * `registerUnifiedExecute` thunk — which is documented as a trap (passing the
 * function directly makes React invoke it as an updater, executing a phantom
 * request on every re-registration).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnifiedExplorerHandlers } from '../useUnifiedExplorerHandlers';

const invokeMock = vi.fn();

// ── hermetic context mocks ──────────────────────────────────────────────────
// vi.mock specifiers resolve relative to THIS test file (hooks/__tests__/),
// so the contexts at src/contexts are '../../contexts/...'.
let state: {
    projects: any[];
    selectedNode: { type: string; id: string } | null;
} = { projects: [], selectedNode: null };

const setProjectsMock = vi.fn((updater: any) => {
    state.projects = typeof updater === 'function' ? updater(state.projects) : updater;
});
const setSelectedNodeMock = vi.fn((updater: any) => {
    state.selectedNode = typeof updater === 'function' ? updater(state.selectedNode) : updater;
});
const updateProjectMock = vi.fn(async (_name: string, updater: any) => {
    const project = updater(state.projects[0]);
    state.projects = [project];
    return project;
});

vi.mock('../../contexts/UnifiedProjectContext', () => ({
    useUnifiedProjects: () => ({
        projects: state.projects,
        setProjects: setProjectsMock,
        saveProject: vi.fn(async () => {}),
        refresh: vi.fn(async () => {}),
        selectedNode: state.selectedNode,
        setSelectedNode: setSelectedNodeMock,
        ensureProjectFull: vi.fn(async () => null),
        updateProject: updateProjectMock,
    }),
}));

const scrapbook = {
    scrapbookRequests: [] as any[],
    selectedScrapbookRequest: null as any,
    loading: false,
    createRequest: vi.fn(async () => null),
    selectRequest: vi.fn(),
    deleteRequest: vi.fn(async () => {}),
    updateRequest: vi.fn(async () => {}),
};

vi.mock('../../contexts/ScrapbookContext', () => ({
    useScrapbook: () => scrapbook,
}));

vi.mock('../../utils/bridge', () => ({
    bridge: {
        invokeTauriCommand: (...args: any[]) => invokeMock(...args),
        isTauri: () => false,
        sendMessage: vi.fn(),
        sendMessageAsync: vi.fn(async () => ({})),
        emit: vi.fn(),
    },
}));

const op = (id: string, name: string, requestIds: string[] = []) => ({
    id,
    name,
    action: '',
    originalEndpoint: '',
    targetNamespace: '',
    fullSchema: null,
    requests: requestIds.map(rid => ({ id: rid, name: rid, request: '<x/>' })),
    expanded: true,
});

beforeEach(() => {
    state = {
        projects: [{ name: 'Svc', operations: [op('op1', 'Op1', ['r1']), op('op2', 'Op2')] }],
        selectedNode: null,
    };
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    setProjectsMock.mockClear();
    setSelectedNodeMock.mockClear();
});

describe('useUnifiedExplorerHandlers', () => {
    it('clears the selection when the deleted operation holds it', async () => {
        state.selectedNode = { type: 'request', id: 'r1' };
        const { result } = renderHook(() => useUnifiedExplorerHandlers());

        await act(async () => { result.current.handleUnifiedDeleteOperation('Svc', 'Op1'); });

        expect(setSelectedNodeMock).toHaveBeenCalledWith(null);
    });

    it('leaves the selection alone when it is outside the deleted subtree', async () => {
        state.selectedNode = { type: 'request', id: 'r1' };
        const { result } = renderHook(() => useUnifiedExplorerHandlers());

        await act(async () => { result.current.handleUnifiedDeleteOperation('Svc', 'Op2'); });

        expect(setSelectedNodeMock).not.toHaveBeenCalled();
    });

    it('clears the selection when the whole project is deleted', async () => {
        state.selectedNode = { type: 'project', id: 'Svc' };
        const { result } = renderHook(() => useUnifiedExplorerHandlers());

        await act(async () => { result.current.handleUnifiedDeleteProject('Svc'); });

        expect(setSelectedNodeMock).toHaveBeenCalledWith(null);
    });

    it('stores the registered execute function rather than calling it', async () => {
        // The documented trap: `setUnifiedExecuteFn(execute)` would make React
        // treat `execute` as an updater and INVOKE it, running a phantom request
        // on every re-registration. The hook must store the function itself.
        const executed = vi.fn(async () => {});
        const { result } = renderHook(() => useUnifiedExplorerHandlers());

        act(() => { result.current.registerUnifiedExecute(executed); });

        expect(executed).not.toHaveBeenCalled();

        await act(async () => {
            result.current.handleUnifiedScrapbookExecute({ id: 'q1', name: 'Quick', request: '<x/>' } as any);
        });

        expect(executed).toHaveBeenCalledTimes(1);
    });
});
