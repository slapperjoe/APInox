/**
 * useResizableWidth regression test.
 *
 * The hook implements the horizontal (left-to-right) panel resize contract
 * shared by the Workflow editor steps panel, the Loop step config panel, and
 * the File Watcher Watch/Pair panels:
 *   - seeds the width from a persisted/default value,
 *   - clamps a dragged width to [minPx, maxPx],
 *   - persists the final width exactly once per gesture (on mouseup),
 *   - releases the pointer affordance on mouseup,
 *   - persists the reached width on window blur (off-window mouseup).
 *
 * The drag math is exercised with a minimal harness component that renders a
 * handle bound to `startResize` and reports `width` to the test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { useResizableWidth } from '../useResizableWidth';

interface HarnessProps {
    minPx?: number;
    maxPx?: number;
    defaultPx?: number;
    onPersist?: (width: number) => void;
    startWidth?: number; // width at the moment mousedown begins (for determinism)
}

const Harness: React.FC<HarnessProps> = ({
    minPx = 100,
    maxPx = 600,
    defaultPx,
    onPersist,
    startWidth,
}) => {
    const { width, startResize } = useResizableWidth(minPx, maxPx, defaultPx ?? minPx, onPersist);
    return (
        <div>
            <div data-testid="harness-width">{width}</div>
            <div
                data-testid="harness-handle"
                onMouseDown={(e) => {
                    // If the test wants a deterministic start position, remap
                    // the clientX so the drag math uses it.
                    if (startWidth !== undefined) {
                        e.nativeEvent.clientX = startWidth;
                    }
                    startResize(e);
                }}
            />
        </div>
    );
};

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
});

const widthValue = (): number =>
    Number((screen.getByTestId('harness-width') as HTMLElement).textContent);

const dragTo = (handle: HTMLElement, startX: number, endX: number) => {
    act(() => {
        fireEvent.mouseDown(handle, { clientX: startX });
    });
    act(() => {
        fireEvent.mouseMove(document, { clientX: endX });
    });
    act(() => {
        fireEvent.mouseUp(document);
    });
};

describe('useResizableWidth', () => {
    it('seeds the width from the default when nothing is persisted', () => {
        render(<Harness defaultPx={300} />);
        expect(widthValue()).toBe(300);
    });

    it('grows the width by the pointer delta', () => {
        render(<Harness defaultPx={300} />);
        const handle = screen.getByTestId('harness-handle');
        // Start at 300px of window; drag +100 → 400.
        dragTo(handle, 300, 400);
        expect(widthValue()).toBe(400);
    });

    it('clamps a drag past the max bound to maxPx', () => {
        render(<Harness minPx={100} maxPx={600} defaultPx={300} />);
        const handle = screen.getByTestId('harness-handle');
        dragTo(handle, 300, 300 + 1000);
        expect(widthValue()).toBe(600);
    });

    it('clamps a drag past the min bound to minPx', () => {
        render(<Harness minPx={100} maxPx={600} defaultPx={300} />);
        const handle = screen.getByTestId('harness-handle');
        dragTo(handle, 300, 300 - 1000);
        expect(widthValue()).toBe(100);
    });

    it('persists the final clamped width exactly once on mouseup', () => {
        const onPersist = vi.fn();
        render(<Harness minPx={100} maxPx={600} defaultPx={300} onPersist={onPersist} />);
        const handle = screen.getByTestId('harness-handle');
        dragTo(handle, 300, 500);
        expect(onPersist).toHaveBeenCalledTimes(1);
        expect(onPersist).toHaveBeenCalledWith(500);
    });

    it('persists the clamped value, not the raw drag, at the max bound', () => {
        const onPersist = vi.fn();
        render(<Harness minPx={100} maxPx={600} defaultPx={300} onPersist={onPersist} />);
        const handle = screen.getByTestId('harness-handle');
        dragTo(handle, 300, 300 + 1000);
        expect(onPersist).toHaveBeenCalledTimes(1);
        expect(onPersist).toHaveBeenCalledWith(600);
    });

    it('releases the pointer affordance on mouseup', () => {
        render(<Harness defaultPx={300} />);
        const handle = screen.getByTestId('harness-handle');
        dragTo(handle, 300, 350);
        expect(document.body.style.userSelect).toBe('');
        expect(document.body.style.cursor).toBe('');
    });

    it('sets the pointer affordance while resizing', () => {
        render(<Harness defaultPx={300} />);
        const handle = screen.getByTestId('harness-handle');
        act(() => {
            fireEvent.mouseDown(handle, { clientX: 300 });
        });
        expect(document.body.style.userSelect).toBe('none');
        expect(document.body.style.cursor).toBe('col-resize');
        act(() => {
            fireEvent.mouseUp(document);
        });
    });

    it('persists the reached width on window blur (off-window mouseup)', () => {
        const onPersist = vi.fn();
        render(<Harness minPx={100} maxPx={600} defaultPx={300} onPersist={onPersist} />);
        const handle = screen.getByTestId('harness-handle');
        act(() => {
            fireEvent.mouseDown(handle, { clientX: 300 });
        });
        act(() => {
            fireEvent.mouseMove(document, { clientX: 450 });
        });
        // Blur the window instead of releasing the mouse.
        act(() => {
            window.dispatchEvent(new Event('blur'));
        });
        expect(onPersist).toHaveBeenCalledTimes(1);
        expect(onPersist).toHaveBeenCalledWith(450);
        expect(document.body.style.userSelect).toBe('');
        expect(document.body.style.cursor).toBe('');
    });

    it('persists exactly once when a drag ends via blur instead of mouseup', () => {
        const onPersist = vi.fn();
        render(<Harness minPx={100} maxPx={600} defaultPx={300} onPersist={onPersist} />);
        const handle = screen.getByTestId('harness-handle');
        act(() => fireEvent.mouseDown(handle, { clientX: 300 }));
        act(() => fireEvent.mouseMove(document, { clientX: 400 }));
        act(() => window.dispatchEvent(new Event('blur')));
        expect(onPersist).toHaveBeenCalledTimes(1);
        expect(onPersist).toHaveBeenLastCalledWith(400);
    });
});
