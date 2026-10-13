/**
 * Loop step editor panel-resize regression tests.
 *
 * The Loop step editor's config panel (left, fixed 300px) is drag-resizable
 * via a vertical divider, with the width persisted to localStorage (px) and
 * the right-hand editor absorbing the delta. These tests pin:
 *   - the divider handle renders with a stable testid,
 *   - the panel width is applied via the styled-components class (read back
 *     from the injected stylesheet, the same technique as
 *     components/__tests__/Sidebar.resize.test.tsx),
 *   - the width seeds from the persisted px value,
 *   - a drag clamps to the band and persists the final value on mouseup.
 *
 * (The WorkflowEditor's embedded Steps panel was removed — steps now live only
 * in the app sidebar — so its resize tests are gone.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { LoopStepEditor } from '../LoopStepEditor';
import { WorkflowStep } from '@shared/models';

// ── styled-components width readback ─────────────────────────────────────────
/**
 * jsdom does not lay out styled-components, so the panel's `flex: 0 0 Npx`
 * is resolved by matching the panel's generated class against the injected
 * stylesheet and reading the `flex` declaration back.
 */
const panelFlexPx = (element: HTMLElement): number => {
    const classes = element.className.split(/\s+/);
    for (const sheet of document.styleSheets) {
        let rules: CSSRule[] = [];
        try {
            rules = Array.from(sheet.cssRules);
        } catch {
            continue;
        }
        for (const rule of rules) {
            if (
                rule instanceof CSSStyleRule &&
                rule.selectorText &&
                classes.some(c => c && rule.selectorText!.includes('.' + c))
            ) {
                const flex = rule.style.getPropertyValue('flex');
                // jsdom returns the shorthand value ("0 0 350px"), not the
                // "flex:" prefix.
                const m = flex.match(/^0 0 (\d+(?:\.\d+)?)px/);
                if (m) return parseFloat(m[1]);
            }
        }
    }
    throw new Error('panel flex-width rule not found in stylesheets');
};

// ── fixtures ─────────────────────────────────────────────────────────────────
const makeLoopStep = (): WorkflowStep => ({
    id: 'step-loop',
    name: 'Loop Step',
    type: 'loop',
    order: 0,
    extractors: [],
    loop: { type: 'count', count: 3, maxIterations: 10, iteratorVariable: 'i' },
    loopSteps: [],
});

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

beforeEach(() => {
    window.localStorage.clear();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
});

// ── Loop step editor ─────────────────────────────────────────────────────────
describe('LoopStepEditor config panel resize', () => {
    it('renders the divider handle', () => {
        render(<LoopStepEditor step={makeLoopStep()} onUpdate={vi.fn()} />);
        expect(screen.getByTestId('loop-panel-resize-handle')).not.toBeNull();
    });

    it('applies the default 300px width', () => {
        render(<LoopStepEditor step={makeLoopStep()} onUpdate={vi.fn()} />);
        const handle = screen.getByTestId('loop-panel-resize-handle');
        const panel = handle.previousElementSibling as HTMLElement;
        expect(panelFlexPx(panel)).toBe(300);
    });

    it('seeds the width from the persisted px value', () => {
        window.localStorage.setItem('apinox_loop_panel_width_px', '400');
        render(<LoopStepEditor step={makeLoopStep()} onUpdate={vi.fn()} />);
        const handle = screen.getByTestId('loop-panel-resize-handle');
        const panel = handle.previousElementSibling as HTMLElement;
        expect(panelFlexPx(panel)).toBe(400);
    });

    it('clamps a drag to the max bound and persists it', () => {
        render(<LoopStepEditor step={makeLoopStep()} onUpdate={vi.fn()} />);
        const handle = screen.getByTestId('loop-panel-resize-handle');
        dragTo(handle, 300, 300 + 1000);
        const panel = handle.previousElementSibling as HTMLElement;
        expect(panelFlexPx(panel)).toBe(520);
        expect(window.localStorage.getItem('apinox_loop_panel_width_px')).toBe('520');
    });
});
