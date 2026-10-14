/**
 * CreateTestCaseFromTrafficWizard
 *
 * Full-page wizard (rendered in place of `ProxyPanel`) that turns captured
 * proxy traffic into a runnable Test Case: pick the test suite the new case
 * belongs to (or create a new one), pick which captured requests to include,
 * and name the case. Each selected log becomes a standalone `request` step
 * holding a raw, identical copy of the captured call (method, URL, headers
 * and body verbatim) — unless a detected response value the capture reused in
 * a later request is tagged as a captured variable: the source step then gets
 * an extractor and the consuming step emits `{{variable}}` (runtime-extracted),
 * the same chain capture the workflow wizard offers.
 *
 * This is NOT a modal — it fills the proxy work area in place of
 * `ProxyPanel`, the same hosting pattern as `TrafficWorkflowWizard`. It
 * receives a chronological snapshot of `logs` and emits the user's choices
 * through `onCreate` (the parent builds the case + saves).
 */
import React, { useMemo, useRef, useState } from 'react';
import { RequestExtractor, TestSuite } from '@shared/models';
import { FlaskConical, Plus } from 'lucide-react';
import type { TrafficLog } from './TrafficViewer';
import { tokens } from './tokens';
import { lastPathSegment, trafficStepName, detectChainedValues, chainSourceLine } from '../../utils/trafficWorkflow';
import { newId } from '../../utils/trafficTestCase';

/** What the wizard resolves to when the user confirms. */
export interface CreateTestCaseFromTrafficResult {
    /** Where the new case lands: an existing suite, or a brand-new one. */
    suite: { kind: 'existing'; suiteId: string } | { kind: 'new'; name: string };
    /** Name for the new test case. */
    caseName: string;
    /** Selected captures, in capture order (oldest first). */
    selectedLogs: TrafficLog[];
    /** Extractors to attach per source step, keyed by log id (absent when no picks). */
    extractors?: Record<string, RequestExtractor[]>;
    /** Value → variable substitutions for `{{variable}}` emission (absent when no picks). */
    valueSubstitutions?: Array<{ value: string; variable: string }>;
}

/** A "captured & reused value" the user accepted (ported from the workflow wizard). */
interface ChainPick {
    /** The raw captured value (stable key). */
    value: string;
    /** Current variable name (editable; defaults to the source element name). */
    variable: string;
    source: 'body' | 'header';
    header?: string;
    xpath?: string;
    sourceLogId: string;
}

interface CreateTestCaseFromTrafficWizardProps {
    /** All captured traffic, in capture order (oldest first). */
    logs: TrafficLog[];
    /** The right-clicked log — pre-selected. */
    anchorLogId: string | null;
    testSuites: TestSuite[];
    /** Close without creating (the wizard's own "Cancel"). */
    onCancel: () => void;
    /** Emit the user's choices; the parent builds + saves the case. */
    onCreate: (result: CreateTestCaseFromTrafficResult) => void;
}

// ── styles (inline, token palette — consistent with TrafficWorkflowWizard) ─
const root: React.CSSProperties = {
    flex: 1, display: 'flex', flexDirection: 'column',
    background: tokens.surface.base, minHeight: 0, overflow: 'hidden',
};

const header: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 20px', borderBottom: `1px solid ${tokens.border.default}`,
    background: tokens.surface.elevated, flexShrink: 0,
};

const title: React.CSSProperties = {
    margin: 0, fontSize: 15, fontWeight: 'var(--fw-bold)', color: tokens.text.primary,
};

const body: React.CSSProperties = {
    flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18,
};

const sectionLabel: React.CSSProperties = {
    fontSize: 'var(--apinox-fs-sm)', fontWeight: 'var(--fw-semibold)', color: tokens.text.muted,
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
};

const hint: React.CSSProperties = {
    fontSize: 'var(--apinox-fs-sm)', color: tokens.text.muted, lineHeight: 1.5,
};

const input: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: tokens.surface.input,
    color: tokens.text.primary, border: `1px solid ${tokens.border.default}`,
    borderRadius: tokens.radius.md, fontSize: 'var(--apinox-fs-base)', outline: 'none',
    boxSizing: 'border-box',
};

const mono: React.CSSProperties = { fontFamily: 'monospace' };

const methodBadge: React.CSSProperties = {
    fontFamily: 'monospace', fontSize: 'var(--apinox-fs-sm)',
    padding: '2px 8px', borderRadius: tokens.radius.sm,
    background: tokens.surface.active, color: tokens.text.secondary, flexShrink: 0, minWidth: 52, textAlign: 'center',
};

/** Clickable suite row — highlighted while selected. */
const itemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', borderRadius: tokens.radius.md,
    background: active ? tokens.surface.active : 'transparent',
    border: `1px solid ${active ? tokens.border.default : 'transparent'}`,
    cursor: 'pointer', userSelect: 'none',
});

/** Clickable request row (checkbox + method + path + time), fire order. */
const logRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', borderRadius: tokens.radius.md,
    background: tokens.surface.deep,
    border: `1px solid ${tokens.border.default}`,
    cursor: 'pointer', userSelect: 'none',
};

const footer: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
    padding: '12px 20px', borderTop: `1px solid ${tokens.border.default}`,
    background: tokens.surface.elevated, flexShrink: 0,
};

const footerRight: React.CSSProperties = { display: 'flex', gap: 8, marginLeft: 'auto' };

const emptyState: React.CSSProperties = {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 16, color: tokens.text.muted, fontSize: 'var(--apinox-fs-md)', padding: 40, textAlign: 'center',
};

function Btn({ label, onClick, primary, disabled }: {
    label: string; onClick: () => void; primary?: boolean; disabled?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '8px 16px', fontSize: 'var(--apinox-fs-base)', fontWeight: 'var(--fw-semibold)',
                borderRadius: tokens.radius.md,
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: primary ? tokens.status.accentDark : tokens.surface.elevated,
                color: primary ? 'var(--apinox-button-foreground)' : tokens.text.primary,
                border: `1px solid ${tokens.border.default}`,
                opacity: disabled ? 0.5 : 1,
            }}
        >
            {label}
        </button>
    );
}

export const CreateTestCaseFromTrafficWizard: React.FC<CreateTestCaseFromTrafficWizardProps> = ({
    logs,
    anchorLogId,
    testSuites,
    onCancel,
    onCreate,
}) => {
    // 'new' = the "New Suite..." row is active (no suite id yet).
    const [suiteSel, setSuiteSel] = useState<{ kind: 'existing'; suiteId: string } | { kind: 'new' } | null>(null);
    const [newSuiteName, setNewSuiteName] = useState('');
    // Default is derived from the selected suite's case count until the user
    // edits the field (caseNameEdited) — after that their text wins.
    const [caseName, setCaseName] = useState('TestCase 1');
    const caseNameEdited = useRef(false);
    const [selected, setSelected] = useState<Set<string>>(
        () => new Set(anchorLogId ? [anchorLogId] : []),
    );
    const selectAllRef = useRef<HTMLInputElement | null>(null);

    // ── chain capture (ported from the workflow wizard) ────────────────────
    // Response values the detector found being reused in a later request —
    // accepted by default, each editable and removable per value.
    const chained = useMemo(() => detectChainedValues(logs), [logs]);
    const [chainPicks, setChainPicks] = useState<ChainPick[]>(() =>
        chained.map(c => ({
            value: c.value,
            variable: c.variable,
            source: c.source,
            header: c.sourceHeaderName,
            xpath: c.sourceXPath,
            sourceLogId: c.sourceLogId,
        })),
    );
    const setVarName = (value: string, name: string) =>
        setChainPicks(ps => ps.map(p => p.value === value ? { ...p, variable: name } : p));
    function toggleChainPick(value: string) {
        setChainPicks(ps => {
            const existing = ps.find(p => p.value === value);
            if (existing) return ps.filter(p => p.value !== value);
            const c = chained.find(x => x.value === value);
            if (!c) return ps;
            return [...ps, {
                value: c.value,
                variable: c.variable,
                source: c.source,
                header: c.sourceHeaderName,
                xpath: c.sourceXPath,
                sourceLogId: c.sourceLogId,
            }];
        });
    }

    const toggleSelected = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allSelected = logs.length > 0 && selected.size === logs.length;
    // Keep the select-all checkbox visually honest (indeterminate state).
    const selectAllRefCb = (el: HTMLInputElement | null) => {
        selectAllRef.current = el;
        if (el) el.indeterminate = selected.size > 0 && selected.size < logs.length;
    };
    const handleSelectAll = (checked: boolean) => {
        setSelected(checked ? new Set(logs.map(l => l.id)) : new Set());
    };

    const defaultCaseName = (sel: { kind: 'existing'; suiteId: string } | { kind: 'new' } | null): string => {
        if (sel?.kind === 'existing') {
            const suite = testSuites.find(s => s.id === sel.suiteId);
            return `TestCase ${(suite?.testCases?.length || 0) + 1}`;
        }
        return 'TestCase 1';
    };

    const selectSuite = (sel: { kind: 'existing'; suiteId: string } | { kind: 'new' }) => {
        setSuiteSel(sel);
        if (!caseNameEdited.current) {
            setCaseName(defaultCaseName(sel));
        }
    };

    const newSuiteValid = newSuiteName.trim().length > 0;
    const canCreate =
        selected.size > 0 &&
        ((suiteSel?.kind === 'existing') || (suiteSel?.kind === 'new' && newSuiteValid));

    const handleSubmit = () => {
        if (!canCreate || !suiteSel) return;
        // Preserve capture order — fire order = step order.
        const selectedLogs = logs.filter(l => selected.has(l.id));
        const suite = suiteSel.kind === 'existing'
            ? { kind: 'existing' as const, suiteId: suiteSel.suiteId }
            : { kind: 'new' as const, name: newSuiteName.trim() };
        // Chain picks: an extractor on the source step + {{variable}} in the
        // consuming steps. A pick is only useful when its SOURCE step is in
        // the case (otherwise nothing re-captures the value) — skip those.
        const extractors: Record<string, RequestExtractor[]> = {};
        const valueSubstitutions: Array<{ value: string; variable: string }> = [];
        for (const pick of chainPicks) {
            const variable = pick.variable.trim();
            if (!pick.value.trim() || !variable) continue;
            if (!pick.sourceLogId || !selected.has(pick.sourceLogId)) continue;
            valueSubstitutions.push({ value: pick.value.trim(), variable });
            const ext: RequestExtractor = {
                id: newId(),
                variable,
                type: pick.source === 'header' ? 'Header' : 'XPath',
                source: pick.source,
                path: pick.source === 'header' ? (pick.header ?? '') : (pick.xpath ?? ''),
            };
            (extractors[pick.sourceLogId] ??= []).push(ext);
        }
        onCreate({
            suite,
            caseName: caseName.trim() || 'TestCase',
            selectedLogs,
            extractors: Object.keys(extractors).length ? extractors : undefined,
            valueSubstitutions: valueSubstitutions.length ? valueSubstitutions : undefined,
        });
    };

    // ── empty state ────────────────────────────────────────────────────────
    if (logs.length === 0) {
        return (
            <div style={root}>
                <div style={header}>
                    <h3 style={title}>Create Test Case from Traffic</h3>
                </div>
                <div style={emptyState}>
                    <div>No traffic captured yet. Start the proxy and capture some requests, then create a test case.</div>
                    <Btn label="Back to proxy" onClick={onCancel} primary />
                </div>
            </div>
        );
    }

    return (
        <div style={root}>
            <div style={header}>
                <h3 style={title}>Create Test Case from Traffic</h3>
            </div>
            <div style={body}>
                <div>
                    <div style={sectionLabel}>Test Suite</div>
                    <div style={{ ...hint, marginBottom: 10 }}>
                        Choose the Test Suite this case belongs to, then pick which captured requests to include. Each is added as a raw, identical call; response values the capture reused in a later request are offered below as captured variables.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {testSuites.length === 0 && (
                            <div style={hint}>No test suites yet — choose "New Suite…" below to create one.</div>
                        )}
                        {testSuites.map(suite => (
                            <div
                                key={suite.id}
                                role="button"
                                style={itemStyle(suiteSel?.kind === 'existing' && suiteSel.suiteId === suite.id)}
                                onClick={() => selectSuite({ kind: 'existing', suiteId: suite.id })}
                            >
                                <FlaskConical size={14} style={{ flexShrink: 0, color: tokens.text.muted }} />
                                {suite.name}
                            </div>
                        ))}
                        <div
                            role="button"
                            style={itemStyle(suiteSel?.kind === 'new')}
                            onClick={() => selectSuite({ kind: 'new' })}
                        >
                            <Plus size={14} style={{ flexShrink: 0, color: tokens.text.muted }} />
                            New Suite…
                        </div>
                        {suiteSel?.kind === 'new' && (
                            <input
                                aria-label="New suite name"
                                placeholder="Suite name"
                                value={newSuiteName}
                                onChange={(e) => setNewSuiteName(e.target.value)}
                                style={input}
                            />
                        )}
                    </div>
                </div>

                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ ...sectionLabel, marginBottom: 0 }}>Requests ({selected.size}/{logs.length})</span>
                        <label
                            data-testid="select-all-row"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                                fontSize: 'var(--apinox-fs-sm)', color: tokens.text.muted, marginLeft: 'auto',
                            }}
                        >
                            <input
                                ref={selectAllRefCb}
                                aria-label="Select all requests"
                                type="checkbox"
                                checked={allSelected}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                style={{ cursor: 'pointer', accentColor: tokens.status.accentDark }}
                            />
                            Select all
                        </label>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {logs.map((log, i) => {
                            const label = trafficStepName(log);
                            return (
                                <label key={log.id} style={logRow} title={log.url}>
                                    <input
                                        aria-label={label}
                                        type="checkbox"
                                        checked={selected.has(log.id)}
                                        onChange={() => toggleSelected(log.id)}
                                        style={{ cursor: 'pointer', accentColor: tokens.status.accentDark }}
                                    />
                                    <span style={{ ...mono, fontSize: 'var(--apinox-fs-sm)', color: tokens.text.hint, minWidth: 18 }}>#{i + 1}</span>
                                    <span style={methodBadge}>{log.method}</span>
                                    <span style={{ ...mono, fontSize: 'var(--apinox-fs-sm)', color: tokens.text.secondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {lastPathSegment(log.url)}
                                    </span>
                                    <span style={{ ...mono, fontSize: 'var(--apinox-fs-sm)', color: tokens.text.hint, flexShrink: 0 }}>
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <div style={sectionLabel}>Captured &amp; reused values</div>
                    <div style={{ ...hint, marginBottom: 10 }}>
                        Accepted values are captured from the source step's response at run time and available as <span style={mono}>{'{{variable}}'}</span> in the step that reuses them.
                        The raw source line each value would be captured from is shown so you can verify the suggestion.
                        Names default to the element tag and are editable.
                    </div>
                    {chained.length === 0 ? (
                        <div style={hint}>No response values were detected being reused in later requests.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {chained.map((c, i) => {
                                const pick = chainPicks.find(p => p.value === c.value);
                                const srcLog = logs.find(l => l.id === c.sourceLogId);
                                const srcName = srcLog ? trafficStepName(srcLog) : '';
                                const useName = trafficStepName(logs.find(l => l.id === c.consumedByLogId) ?? { method: '', url: '' } as TrafficLog);
                                // The raw line the runtime extractor will read —
                                // shown so the user can verify the suggestion.
                                const sourceLine = srcLog ? chainSourceLine(srcLog, c) : '';
                                const from = c.source === 'header'
                                    ? `header ${c.sourceHeaderName ?? ''}`
                                    : c.sourceElementName ? `<${c.sourceElementName}>` : 'body';
                                const usedIn = c.consumedIn === 'header'
                                    ? `header ${c.consumedHeaderName ?? ''}`
                                    : c.consumedIn;
                                // Skipped at create time when the source step is
                                // not part of the case — flag it on the row.
                                const sourceIncluded = selected.has(c.sourceLogId);
                                const rowTitle = pick && !sourceIncluded
                                    ? 'The source step is not selected — this pick is skipped when the case is created'
                                    : undefined;
                                return (
                                    <div
                                        key={i}
                                        title={rowTitle}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '8px 10px', borderRadius: tokens.radius.md,
                                            background: tokens.surface.deep,
                                            border: `1px solid ${tokens.border.default}`, userSelect: 'none',
                                            opacity: pick && sourceIncluded ? 1 : 0.5,
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={!!pick}
                                            onChange={() => toggleChainPick(c.value)}
                                            style={{ cursor: 'pointer', accentColor: tokens.status.accentDark, flexShrink: 0 }}
                                            data-testid={'tc-chain-' + i}
                                        />
                                        <input
                                            style={{ ...input, width: 160, flex: '0 0 160px', padding: '3px 8px' }}
                                            type="text"
                                            value={pick?.variable ?? ''}
                                            onChange={e => setVarName(c.value, e.target.value)}
                                            data-testid={'tc-varname-' + c.value}
                                            aria-label={'Variable name for ' + c.value}
                                        />
                                        <span style={{ ...mono, fontSize: 'var(--apinox-fs-sm)', color: tokens.text.secondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {c.value}
                                        </span>
                                        <span
                                            title={sourceLine || undefined}
                                            data-testid={'tc-chain-line-' + i}
                                            style={{ ...mono, fontSize: 'var(--apinox-fs-sm)', color: tokens.text.secondary, flex: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        >
                                            {sourceLine}
                                        </span>
                                        <span style={{ ...mono, fontSize: 'var(--apinox-fs-sm)', color: tokens.text.muted, flexShrink: 0 }}>
                                            from {srcName} ({from})
                                        </span>
                                        <span style={{ ...mono, fontSize: 'var(--apinox-fs-sm)', color: tokens.text.hint, flexShrink: 0 }}>
                                            used in {useName} ({usedIn})
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div>
                    <div style={sectionLabel}>Test Case Name</div>
                    <input
                        aria-label="Test case name"
                        value={caseName}
                        onChange={(e) => {
                            caseNameEdited.current = true;
                            setCaseName(e.target.value);
                        }}
                        style={input}
                    />
                </div>
            </div>
            <div style={footer}>
                <Btn label="Cancel" onClick={onCancel} />
                <div style={footerRight}>
                    <Btn label="Create Test Case" primary disabled={!canCreate} onClick={handleSubmit} />
                </div>
            </div>
        </div>
    );
};
