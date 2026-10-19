import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React, { memo, useCallback, useState, useMemo, createContext } from 'react';

/**
 * Render-count benchmark for the performance review items.
 *
 * Each case renders a NAIVE pattern (the pre-optimization behaviour) and an
 * OPTIMIZED pattern (what the code now does), triggers a single change, and
 * counts how many times the subtree re-renders / recomputes. The optimized
 * path must be strictly lower. Counts are printed as a summary table.
 */

const results: Array<{ item: string; naive: number; optimized: number }> = [];

// ---------------------------------------------------------------------------
// Item 3 — memoized rows + stable handlers (panel list re-render)
// ---------------------------------------------------------------------------
describe('Item 3: panel row render counts', () => {
    const ROWS = 20;
    const initial = Object.fromEntries(Array.from({ length: ROWS }, (_, i) => [`h${i}`, `v${i}`]));

    let naiveRowRenders = 0;
    let memoRowRenders = 0;

    // Both rows are memoized. The difference is the handler identity:
    // naive passes a fresh inline arrow each render (unstable -> all rows
    // re-render); optimized passes a stable useCallback handler (unchanged
    // rows skip).
    const NaiveRow = memo(function NaiveRow({ name, value, onChange }: any) {
        naiveRowRenders++;
        return <input data-testid={`naive-${name}`} value={value} onChange={(e) => onChange(name, e.target.value)} />;
    });
    const MemoRow = memo(function MemoRow({ name, value, onChange }: any) {
        memoRowRenders++;
        return <input data-testid={`memo-${name}`} value={value} onChange={(e) => onChange(name, e.target.value)} />;
    });

    function NaivePanel({ entries, update }: any) {
        return <div>{Object.entries(entries).map(([k, v]) => (
            <NaiveRow key={k} name={k} value={v} onChange={(n: string, val: string) => update(n, val)} />
        ))}</div>;
    }
    function MemoPanel({ entries, update }: any) {
        return <div>{Object.entries(entries).map(([k, v]) => (
            <MemoRow key={k} name={k} value={v} onChange={update} />
        ))}</div>;
    }

    function Harness({ Panel }: any) {
        const [entries, setEntries] = useState(initial);
        const update = useCallback((name: string, value: string) => {
            setEntries((prev) => ({ ...prev, [name]: value }));
        }, []);
        return <Panel entries={entries} update={update} />;
    }

    it('unchanged rows skip re-render when one row changes', () => {
        const n = render(<Harness Panel={NaivePanel} />);
        naiveRowRenders = 0; // ignore the initial mount
        const naiveInput = n.container.querySelector('input')!;
        for (let i = 0; i < 5; i++) {
            fireEvent.change(naiveInput, { target: { value: `new${i}` } });
        }

        const m = render(<Harness Panel={MemoPanel} />);
        memoRowRenders = 0;
        const memoInput = m.container.querySelector('input')!;
        for (let i = 0; i < 5; i++) {
            fireEvent.change(memoInput, { target: { value: `new${i}` } });
        }

        results.push({ item: 'Item 3 (row renders over a 5-key burst)', naive: naiveRowRenders, optimized: memoRowRenders });
        console.log(`Item 3 naive rows=${naiveRowRenders}, memo rows=${memoRowRenders}`);
        // Naive: every row re-renders per keystroke (unstable handler).
        // Optimized: only the edited row re-renders (stable handler).
        expect(naiveRowRenders).toBe(5 * ROWS);
        expect(memoRowRenders).toBe(5);
    });
});

// ---------------------------------------------------------------------------
// Item 2 — memoized response formatting
// ---------------------------------------------------------------------------
describe('Item 2: response format compute counts', () => {
    const response = '<Envelope><Body>data</Body></Envelope>';
    let naiveCalls = 0;
    let memoCalls = 0;
    const fakeFormat = (s: string) => s.toUpperCase();

    function NaiveParent() {
        const [tick, setTick] = useState(0);
        naiveCalls++; // formatContent runs on every render
        return <div><span>{tick}</span><div>{fakeFormat(response)}</div><button onClick={() => setTick(t => t + 1)}>go</button></div>;
    }
    function MemoParent() {
        const [tick, setTick] = useState(0);
        const formatted = useMemo(() => { memoCalls++; return fakeFormat(response); }, []); // `response` is a module constant, not a reactive dep
        return <div><span>{tick}</span><div>{formatted}</div><button onClick={() => setTick(t => t + 1)}>go</button></div>;
    }

    it('unrelated re-render does not re-format the response', () => {
        naiveCalls = 0;
        const n = render(<NaiveParent />);
        fireEvent.click(n.container.querySelector('button')!);

        memoCalls = 0;
        const m = render(<MemoParent />);
        fireEvent.click(m.container.querySelector('button')!);

        results.push({ item: 'Item 2 (format calls per unrelated re-render)', naive: naiveCalls, optimized: memoCalls });
        expect(naiveCalls).toBe(2); // mount + re-render
        expect(memoCalls).toBe(1);  // mount only
    });
});

// ---------------------------------------------------------------------------
// Item 4 — memoized extractor XPath previews
// ---------------------------------------------------------------------------
describe('Item 4: extractor evaluation counts', () => {
    const raw = '<r><a>1</a></r>';
    const extractors = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, variable: `v${i}`, path: '/r/a', source: 'body', type: 'XPath' }));
    let naiveEvals = 0;
    let memoEvals = 0;
    const fakeEval = (s: string, p: string) => { return `${s}:${p}`; };

    function NaivePanel() {
        const [tick, setTick] = useState(0);
        extractors.forEach((ex) => { naiveEvals++; fakeEval(raw, ex.path); });
        return <div><span>{tick}</span><button onClick={() => setTick(t => t + 1)}>go</button></div>;
    }
    function MemoPanel() {
        const [tick, setTick] = useState(0);
        useMemo(() => { extractors.forEach((ex) => { memoEvals++; fakeEval(raw, ex.path); }); }, []); // `extractors`/`raw` are module constants, not reactive deps
        return <div><span>{tick}</span><button onClick={() => setTick(t => t + 1)}>go</button></div>;
    }

    it('unrelated re-render does not re-evaluate extractors', () => {
        naiveEvals = 0;
        const n = render(<NaivePanel />);
        fireEvent.click(n.container.querySelector('button')!);

        memoEvals = 0;
        const m = render(<MemoPanel />);
        fireEvent.click(m.container.querySelector('button')!);

        results.push({ item: 'Item 4 (evaluations per unrelated re-render)', naive: naiveEvals, optimized: memoEvals });
        expect(naiveEvals).toBe(16); // 8 extractors x 2 renders
        expect(memoEvals).toBe(8);   // 8 extractors x 1 memo
    });
});

// ---------------------------------------------------------------------------
// Item 5 — memoized settings context value
// ---------------------------------------------------------------------------
describe('Item 5: context consumer render counts', () => {
    let naiveConsumerRenders = 0;
    let memoConsumerRenders = 0;

    const NaiveCtx = createContext<any>(undefined);
    const MemoCtx = createContext<any>(undefined);

    // Plain consumer: re-renders whenever the provider re-renders.
    function NaiveConsumer() {
        naiveConsumerRenders++;
        React.useContext(NaiveCtx);
        return null;
    }
    // Memoized consumer: skips when the context value identity is unchanged.
    const MemoConsumer = memo(function MemoConsumer() {
        memoConsumerRenders++;
        React.useContext(MemoCtx);
        return null;
    });

    function NaiveProvider() {
        const [settings] = useState({ a: 1 });
        const [other, setOther] = useState(0);
        const value = { settings, other }; // new object every render
        return (
            <NaiveCtx.Provider value={value}>
                <NaiveConsumer />
                <button onClick={() => setOther(o => o + 1)}>go</button>
            </NaiveCtx.Provider>
        );
    }

    function MemoProvider() {
        const [settings] = useState({ a: 1 });
        const [, setOther] = useState(0);
        const value = useMemo(() => ({ settings }), [settings]); // stable across unrelated re-renders
        return (
            <MemoCtx.Provider value={value}>
                <MemoConsumer />
                <button onClick={() => setOther(o => o + 1)}>go</button>
            </MemoCtx.Provider>
        );
    }

    it('unrelated provider re-render does not re-render memoized consumers', () => {
        naiveConsumerRenders = 0;
        const n = render(<NaiveProvider />);
        fireEvent.click(n.container.querySelector('button')!);

        memoConsumerRenders = 0;
        const m = render(<MemoProvider />);
        fireEvent.click(m.container.querySelector('button')!);

        results.push({ item: 'Item 5 (consumer renders per unrelated provider re-render)', naive: naiveConsumerRenders, optimized: memoConsumerRenders });
        expect(naiveConsumerRenders).toBe(2); // mount + re-render
        expect(memoConsumerRenders).toBe(1);  // mount only
    });
});

// Summary table
describe('Benchmark summary', () => {
    it('prints the render/compute counts', () => {
        const table = results.map(r => `${r.item}: naive=${r.naive} optimized=${r.optimized}`);
        console.log('\n=== Performance benchmark ===\n' + table.join('\n'));
        results.forEach(r => expect(r.optimized).toBeLessThan(r.naive));
    });
});
