import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ProjectProvider, useProject } from '../ProjectContext';

/**
 * Two things this pins down:
 *
 * 1. The payload key. Tauri resolves command arguments by name, so the Rust
 *    `delete_project(name: String)` requires `{ name }`. Before this, the Rust
 *    command took a `params` blob and the frontend sent `{ dirPath }` — the
 *    command was rejected at the IPC layer before its body could run, so
 *    deleting a project's files from disk never worked.
 *
 * 2. The kind. A `not-found` rejection means the folder was already gone; the
 *    workspace entry is removed regardless, so alerting is noise rather than
 *    information.
 */
const invokeMock = vi.fn();
const alertMock = vi.fn();
const askMock = vi.fn(async () => true);

vi.mock('../../utils/bridge', () => {
    const commandErrorText = (error: unknown): string => {
        if (typeof error === 'string') return error;
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message;
            if (typeof message === 'string' && message.length > 0) return message;
        }
        return String(error);
    };
    const commandErrorKind = (error: unknown): string | null => {
        if (error && typeof error === 'object') {
            const kind = (error as { kind?: unknown }).kind;
            if (typeof kind === 'string') return kind;
        }
        return null;
    };

    return {
        isTauri: () => true,
        bridge: {
            isTauri: () => true,
            invokeTauriCommand: (...args: any[]) => invokeMock(...args),
            sendMessage: vi.fn(),
            sendMessageAsync: vi.fn(async () => ({})),
            onMessage: () => () => {},
        },
        commandErrorText,
        commandErrorKind,
    };
});

vi.mock('@tauri-apps/plugin-dialog', () => ({
    ask: (...args: any[]) => askMock(...args),
}));

describe('ProjectContext delete_project', () => {
    beforeEach(() => {
        invokeMock.mockReset();
        alertMock.mockReset();
        askMock.mockReset();
        askMock.mockResolvedValue(true);
        vi.stubGlobal('alert', alertMock);
    });

    const project = {
        name: 'DeleteMe',
        fileName: '/tmp/apinox-delete-test/DeleteMe',
        interfaces: [],
    } as any;

    async function runDelete() {
        const { result } = renderHook(() => useProject(), {
            wrapper: ({ children }: any) => <ProjectProvider initialProjects={[project]}>{children}</ProjectProvider>,
        });

        // Double-click-to-confirm: first call arms, second performs.
        await act(async () => { result.current.closeProject('DeleteMe'); });
        await act(async () => { result.current.closeProject('DeleteMe'); });
        await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    }

    it('sends the argument name the Rust command declares', async () => {
        invokeMock.mockImplementation(async () => undefined);

        await runDelete();

        expect(invokeMock).toHaveBeenCalledWith('delete_project', { name: 'DeleteMe' });
    });

    it('does not alert when the folder is already gone', async () => {
        invokeMock.mockImplementation(async () => {
            throw { kind: 'not-found', message: 'Project directory does not exist: DeleteMe' };
        });

        await runDelete();

        expect(alertMock).not.toHaveBeenCalled();
    });

    it('still alerts, with the actual cause, for a real failure', async () => {
        invokeMock.mockImplementation(async () => {
            throw { kind: 'permission', message: 'Failed to delete project: permission denied' };
        });

        await runDelete();

        expect(alertMock).toHaveBeenCalledWith(
            'Failed to delete project files: Failed to delete project: permission denied'
        );
    });

    it('shows the cause for a plain string rejection (unmigrated commands)', async () => {
        invokeMock.mockImplementation(async () => {
            throw 'Failed to delete project: permission denied';
        });

        await runDelete();

        expect(alertMock).toHaveBeenCalledWith(
            'Failed to delete project files: Failed to delete project: permission denied'
        );
    });
});
