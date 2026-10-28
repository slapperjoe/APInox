import { useEffect } from 'react';
import type { RefObject } from 'react';

type SaveHandler = () => void | Promise<void>;

/**
 * Central Ctrl/Cmd+S dispatch.
 *
 * Two handlers used to coexist: a React `onKeyDown` on the notes pane root, and a
 * window-level listener in `useAppLifecycle`. With focus inside the notes pane the
 * event bubbled from the pane to `window`, so Cmd+S saved the note AND every dirty
 * project. It also only saved the note when focus happened to be inside the pane —
 * pressing it anywhere else silently skipped the note.
 *
 * One dispatcher now: a component registers a handler scoped to its container, and
 * the dispatcher runs the handler for the container that currently holds focus.
 * With nothing scoped focused it falls back to the app-wide project save.
 */
const scopedHandlers = new Map<RefObject<HTMLElement | null>, SaveHandler>();

/** Register a Ctrl/Cmd+S handler for a container element. */
export function useSaveShortcut(
    containerRef: RefObject<HTMLElement | null>,
    handler: SaveHandler,
): void {
    useEffect(() => {
        scopedHandlers.set(containerRef, handler);
        return () => {
            scopedHandlers.delete(containerRef);
        };
    }, [containerRef, handler]);
}

/**
 * The handler for whichever registered container holds focus, or null when none
 * does. Called by the central dispatcher in `useAppLifecycle`.
 */
export function focusedSaveHandler(): SaveHandler | null {
    const active = document.activeElement;
    if (!active) return null;
    for (const [ref, handler] of scopedHandlers) {
        if (ref.current?.contains(active)) return handler;
    }
    return null;
}

/** Test seam: clear the registry between cases. */
export function clearSaveShortcuts(): void {
    scopedHandlers.clear();
}
