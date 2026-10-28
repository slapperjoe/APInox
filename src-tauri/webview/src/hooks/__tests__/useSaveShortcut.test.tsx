/**
 * Ctrl/Cmd+S dispatch — one handler, not two.
 *
 * The notes editor used to have a React `onKeyDown` on its pane root while
 * `useAppLifecycle` had a window-level listener. With focus inside the pane the
 * event bubbled to `window`, so Cmd+S saved the note AND every dirty project.
 * These tests pin the single-dispatch behaviour: the focused container's handler
 * runs, and the app-wide project save is skipped when it does.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSaveShortcut, focusedSaveHandler, clearSaveShortcuts } from '../useSaveShortcut';
import { useAppLifecycle } from '../useAppLifecycle';

const bridgeMock = {
    setState: vi.fn(),
    getState: vi.fn(() => null),
    emit: vi.fn(),
    invokeTauriCommand: vi.fn(async () => []),
};
vi.mock('../../utils/bridge', () => ({
    bridge: {
        setState: (...args: any[]) => bridgeMock.setState(...args),
        getState: () => bridgeMock.getState(),
        emit: (...args: any[]) => bridgeMock.emit(...args),
        invokeTauriCommand: (...args: any[]) => bridgeMock.invokeTauriCommand(...args),
    },
    isTauri: () => false,
}));

const project = {
    name: 'CountryInfo',
    dirty: true,
    readOnly: false,
} as any;

function pressCmdS() {
    act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    });
}

beforeEach(() => {
    clearSaveShortcuts();
    bridgeMock.setState.mockReset();
});

afterEach(() => {
    clearSaveShortcuts();
});

describe('useSaveShortcut registry', () => {
    it('resolves the handler for the container that holds focus', () => {
        const container = document.createElement('div');
        const input = document.createElement('input');
        container.appendChild(input);
        document.body.appendChild(container);
        input.focus();

        const ref = { current: container };
        const handler = vi.fn();
        renderHook(() => useSaveShortcut(ref, handler));

        expect(focusedSaveHandler()).toBe(handler);

        document.body.removeChild(container);
    });

    it('returns null when focus is outside every registered container', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const ref = { current: container };
        renderHook(() => useSaveShortcut(ref, vi.fn()));

        // Focus is on <body>, which the container does not contain.
        expect(document.activeElement).toBe(document.body);
        expect(focusedSaveHandler()).toBeNull();

        document.body.removeChild(container);
    });

    it('unregisters on unmount', () => {
        const container = document.createElement('div');
        const input = document.createElement('input');
        container.appendChild(input);
        document.body.appendChild(container);
        input.focus();

        const ref = { current: container };
        const { unmount } = renderHook(() => useSaveShortcut(ref, vi.fn()));
        expect(focusedSaveHandler()).not.toBeNull();

        unmount();
        expect(focusedSaveHandler()).toBeNull();

        document.body.removeChild(container);
    });
});

describe('the dispatcher runs exactly one save', () => {
    it('runs the focused handler and skips the project save', () => {
        const container = document.createElement('div');
        const input = document.createElement('input');
        container.appendChild(input);
        document.body.appendChild(container);
        input.focus();

        const noteSave = vi.fn();
        const projectSave = vi.fn();

        renderHook(() => {
            useSaveShortcut({ current: container }, noteSave);
            useAppLifecycle({
                projects: [project],
                selectedProjectName: 'CountryInfo',
                saveProject: projectSave,
                setSelectedProjectName: vi.fn(),
                setRequestHistory: vi.fn(),
            });
        });

        pressCmdS();

        expect(noteSave).toHaveBeenCalledTimes(1);
        expect(projectSave).not.toHaveBeenCalled();

        document.body.removeChild(container);
    });

    it('falls back to the project save when nothing scoped has focus', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const noteSave = vi.fn();
        const projectSave = vi.fn();

        renderHook(() => {
            useSaveShortcut({ current: container }, noteSave);
            useAppLifecycle({
                projects: [project],
                selectedProjectName: 'CountryInfo',
                saveProject: projectSave,
                setSelectedProjectName: vi.fn(),
                setRequestHistory: vi.fn(),
            });
        });

        pressCmdS();

        expect(noteSave).not.toHaveBeenCalled();
        expect(projectSave).toHaveBeenCalledTimes(1);

        document.body.removeChild(container);
    });
});
