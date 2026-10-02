/**
 * File Watcher panel-resize regression test.
 *
 * The File Watcher page (src/components/proxy/FileWatcherPage.tsx) has TWO
 * independent left-hand panels — the Watch list (fixed 240px) and the Pair
 * list (fixed 280px) — each now drag-resizable via a vertical divider, with
 * the width persisted to localStorage (px) and the right-hand area absorbing
 * the delta. These tests pin, per panel:
 *   - the divider handle renders with a stable testid,
 *   - the panel width is applied via the styled-components class (read back
 *     from the injected stylesheet, same technique as the sidebar test),
 *   - the width seeds from the persisted px value,
 *   - a drag clamps to the 180–420px band and persists the final value.
 *
 * Hermetic mocks (mirrors the explorer tests): the monaco sub-panel package,
 * the Tauri event/dialog APIs, and the bridge (which would otherwise run
 * module-load side effects and hit a non-existent Tauri runtime).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { FileWatcherPage } from '../FileWatcherPage';

// ── hermetic mocks ───────────────────────────────────────────────────────────
vi.mock('@apinox/request-editor/monaco', () => ({
    MonacoRequestEditorWithToolbar: ({ value }: { value?: string }) => (
        <textarea data-testid="mock-monaco-editor" value={value} readOnly />
    ),
    MonacoResponseViewer: ({ value }: { value?: string }) => (
        <pre data-testid="mock-monaco-viewer">{value}</pre>
    ),
}));

vi.mock('@tauri-apps/api/event', () => ({
    listen: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: vi.fn().mockRejectedValue(new Error('dialog disabled in tests')),
}));

// The bridge module has top-level side effects (ensureTauriInitialized) and a
// runtime Tauri dependency — mock the whole module. The list commands
// (get_file_watches / get_soap_pairs) resolve to empty arrays so the page
// renders its empty states without a backend.
vi.mock('../../../utils/bridge', () => ({
    invokeTauriCommand: vi.fn().mockResolvedValue([]),
    bridge: { sendMessage: vi.fn(), listen: vi.fn() },
    isTauri: () => false,
}));

// ── styled-components width readback ─────────────────────────────────────────
/**
 * jsdom does not lay out styled-components, so the panel's `width: Npx` is
 * resolved by matching the panel's generated class against the injected
 * stylesheet and reading the `width` declaration back.
 */
const panelWidthPx = (element: HTMLElement): number => {
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
                const width = rule.style.getPropertyValue('width');
                const m = width.match(/^(\d+(?:\.\d+)?)px$/);
                if (m) return parseFloat(m[1]);
            }
        }
    }
    throw new Error('panel width rule not found in stylesheets');
};

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

const renderPage = () => render(<FileWatcherPage />);

beforeEach(() => {
    window.localStorage.clear();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
});

describe('FileWatcherPage Watch panel resize', () => {
    it('renders the divider handle', () => {
        renderPage();
        expect(screen.getByTestId('watcher-watch-resize-handle')).not.toBeNull();
    });

    it('applies the default 240px width', () => {
        renderPage();
        const handle = screen.getByTestId('watcher-watch-resize-handle');
        const panel = handle.previousElementSibling as HTMLElement;
        expect(panelWidthPx(panel)).toBe(240);
    });

    it('seeds the width from the persisted px value', () => {
        window.localStorage.setItem('apinox_watcher_watch_panel_width_px', '330');
        renderPage();
        const handle = screen.getByTestId('watcher-watch-resize-handle');
        const panel = handle.previousElementSibling as HTMLElement;
        expect(panelWidthPx(panel)).toBe(330);
    });

    it('clamps a drag past the max bound to 420px and persists it', () => {
        renderPage();
        const handle = screen.getByTestId('watcher-watch-resize-handle');
        dragTo(handle, 240, 240 + 1000);
        const panel = handle.previousElementSibling as HTMLElement;
        expect(panelWidthPx(panel)).toBe(420);
        expect(window.localStorage.getItem('apinox_watcher_watch_panel_width_px')).toBe('420');
    });

    it('clamps a drag past the min bound to 180px and persists it', () => {
        renderPage();
        const handle = screen.getByTestId('watcher-watch-resize-handle');
        dragTo(handle, 240, 240 - 1000);
        const panel = handle.previousElementSibling as HTMLElement;
        expect(panelWidthPx(panel)).toBe(180);
        expect(window.localStorage.getItem('apinox_watcher_watch_panel_width_px')).toBe('180');
    });
});

describe('FileWatcherPage Pair panel resize', () => {
    it('renders the divider handle', () => {
        renderPage();
        expect(screen.getByTestId('watcher-pair-resize-handle')).not.toBeNull();
    });

    it('applies the default 280px width', () => {
        renderPage();
        const handle = screen.getByTestId('watcher-pair-resize-handle');
        const panel = handle.previousElementSibling as HTMLElement;
        expect(panelWidthPx(panel)).toBe(280);
    });

    it('seeds the width from the persisted px value', () => {
        window.localStorage.setItem('apinox_watcher_pair_panel_width_px', '360');
        renderPage();
        const handle = screen.getByTestId('watcher-pair-resize-handle');
        const panel = handle.previousElementSibling as HTMLElement;
        expect(panelWidthPx(panel)).toBe(360);
    });

    it('clamps a drag to the max bound and persists it', () => {
        renderPage();
        const handle = screen.getByTestId('watcher-pair-resize-handle');
        dragTo(handle, 280, 280 + 1000);
        const panel = handle.previousElementSibling as HTMLElement;
        expect(panelWidthPx(panel)).toBe(420);
        expect(window.localStorage.getItem('apinox_watcher_pair_panel_width_px')).toBe('420');
    });

    it('does not couple to the Watch panel width', () => {
        // Dragging the pair panel must leave the watch panel width untouched —
        // the two panels are independently resizable.
        window.localStorage.setItem('apinox_watcher_watch_panel_width_px', '300');
        renderPage();
        const pairHandle = screen.getByTestId('watcher-pair-resize-handle');
        const watchHandle = screen.getByTestId('watcher-watch-resize-handle');
        dragTo(pairHandle, 280, 280 + 100);
        expect(panelWidthPx(pairHandle.previousElementSibling as HTMLElement)).toBe(380);
        expect(panelWidthPx(watchHandle.previousElementSibling as HTMLElement)).toBe(300);
    });
});
