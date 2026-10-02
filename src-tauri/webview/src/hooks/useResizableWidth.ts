import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type MouseEvent as ReactMouseEvent,
} from 'react';

/**
 * Horizontal (left-to-right) panel resize for a flex row: the panel is the
 * flex item and the right-hand neighbour absorbs the delta. The dragged
 * quantity is a pixel WIDTH with clamped min/max — the same pointer-drag
 * contract as the sidebar (components/Sidebar.tsx) and the unified explorer's
 * sub-window resizes: listeners are attached to `document` on mousedown,
 * the live width is read back through `widthRef` so the end-of-drag persist
 * never runs against a stale closure, and the persist call fires exactly
 * once per gesture on mouseup (a single write needs no debounce).
 *
 * Window-resize safety: the clamp band is in absolute px, so a window resize
 * mid-drag cannot push the width out of bounds — the drag stays clamped.
 *
 * @param minPx   lower clamp (also the default when nothing is persisted)
 * @param maxPx   upper clamp
 * @param defaultPx initial width before the first persisted value (minPx
 *                  when omitted)
 * @param onPersist called with the final clamped width once per gesture, at
 *                  mouseup (and on window blur mid-drag, so an off-window
 *                  release doesn't lose the last resize)
 */
export function useResizableWidth(
    minPx: number,
    maxPx: number,
    defaultPx: number = minPx,
    onPersist?: (width: number) => void,
) {
    const [width, setWidth] = useState(defaultPx);
    const widthRef = useRef(width);

    const clamp = useCallback(
        (w: number) => Math.min(maxPx, Math.max(minPx, w)),
        [minPx, maxPx],
    );

    const isResizing = useRef(false);

    const startResize = useCallback(
        (e: ReactMouseEvent<HTMLElement>) => {
            e.preventDefault();
            isResizing.current = true;
            const startX = e.clientX;
            const startWidth = widthRef.current;

            const handleMove = (ev: MouseEvent) => {
                if (!isResizing.current) return;
                const next = clamp(startWidth + (ev.clientX - startX));
                widthRef.current = next;
                setWidth(next);
            };

            const finish = () => {
                if (!isResizing.current) return;
                isResizing.current = false;
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', finish);
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                onPersist?.(widthRef.current);
            };

            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', finish);
        },
        [clamp, onPersist],
    );

    // A mouseup that happens off-window (or a window blur mid-drag) never
    // reaches the document mouseup listener — persist the reached width and
    // reset the affordance so the drag doesn't stick. Both handlers read the
    // live values through refs, so the bound listener stays correct without
    // re-binding.
    const onPersistRef = useRef(onPersist);
    onPersistRef.current = onPersist;

    const resetOnBlur = useCallback(() => {
        if (!isResizing.current) return;
        isResizing.current = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        onPersistRef.current?.(widthRef.current);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.addEventListener('blur', resetOnBlur);
        return () => window.removeEventListener('blur', resetOnBlur);
    }, [resetOnBlur]);

    return { width, widthRef, isResizing, startResize, clamp };
}
