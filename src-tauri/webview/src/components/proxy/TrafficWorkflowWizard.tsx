/**
 * TrafficWorkflowWizard
 *
 * Full-screen, 3-step wizard that turns captured proxy traffic into a runnable
 * Workflow:
 *   1. Select & name — choose which captured requests to include, name the workflow.
 *   2. Variables — manual `{{name}}` variables + auto-detected response→request
 *      chains (accepted by default, each becomes an XPath extractor on the source step).
 *   3. Review & save — ordered step list with inline rename + extractor chips; Create.
 *
 * This is NOT a modal — it fills the proxy work area in place of `ProxyPanel`.
 * It receives a chronological snapshot of `logs` and emits a finished `Workflow`
 * through `onDone` (the parent saves + navigates).
 */
import React, { useState, useMemo } from 'react';
import { Workflow, WorkflowExtractor } from '@shared/models';
import { tokens } from './tokens';
import type { TrafficLog } from './TrafficViewer';
import { lastPathSegment, detectChainedValues, assembleWorkflow } from '../../utils/trafficWorkflow';

interface TrafficWorkflowWizardProps {
    /** Captured traffic in chronological order (oldest first). */
    logs: TrafficLog[];
    /** Parent saves + navigates. */
    onDone: (workflow: Workflow) => void;
    onCancel: () => void;
}

// ── styles (inline, token palette, consistent with AddToProjectDialog) ─────
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

const stepIndicator: React.CSSProperties = {
    fontSize: 'var(--apinox-fs-sm)', color: tokens.text.muted,
    fontFamily: 'monospace', letterSpacing: '0.05em',
};

const body: React.CSSProperties = {
    flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18,
};

const sectionLabel: React.CSSProperties = {
    fontSize: 'var(--apinox-fs-sm)', fontWeight: 'var(--fw-semibold)', color: tokens.text.muted,
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
};

const input: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: tokens.surface.input,
    color: tokens.text.primary, border: `1px solid ${tokens.border.default}`,
    borderRadius: tokens.radius.md, fontSize: 'var(--apinox-fs-base)', outline: 'none',
    boxSizing: 'border-box',
};

const mono: React.CSSProperties = { fontFamily: 'monospace' };

const divider: React.CSSProperties = {
    borderTop: `1px solid ${tokens.border.default}`, margin: '4px 0',
};

const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

const methodBadge: React.CSSProperties = {
    fontFamily: 'monospace', fontSize: 'var(--apinox-fs-sm)',
    padding: '2px 8px', borderRadius: tokens.radius.sm,
    background: tokens.surface.active, color: tokens.text.secondary, flexShrink: 0, minWidth: 52, textAlign: 'center',
};

const footer: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
    padding: '12px 20px', borderTop: `1px solid ${tokens.border.default}`,
    background: tokens.surface.elevated, flexShrink: 0,
};

const footerRight: React.CSSProperties = { display: 'flex', gap: 8, marginLeft: 'auto' };

const hint: React.CSSProperties = {
    fontSize: 'var(--apinox-fs-sm)', color: tokens.text.muted, lineHeight: 1.5,
};

const chip: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    fontFamily: 'monospace', fontSize: 'var(--apinox-fs-sm)',
    background: tokens.surface.tag, color: tokens.text.secondary,
    padding: '2px 8px', borderRadius: tokens.radius.sm, margin: '0 4px 4px 0',
};

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

// ── component ──────────────────────────────────────────────────────────────
type WizardStep = 1 | 2 | 3;
interface ManualVar { name: string; value: string; }
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
interface SelectedPart { value: string; tag: string; }

/** Lowercased, safe variable name from an element tag (fallback: the value). */
function nameFromTag(tag: string, fallback: string): string {
    let base = tag.replace(/[^A-Za-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || fallback;
    base = base[0].toLowerCase() + base.slice(1);
    return base;
}

const HIGHLIGHT_RE = /<([A-Za-z0-9_:\-]+)([^>]*)>([^<]*)<\/\1>/g;

/**
 * Render an XML body as plain text with element-text parts marked up.
 * `isHighlighted` decides the styling for an element's inner text; when
 * `onPart` is given each element part is clickable (select-to-vary-ify).
 */
function renderXmlParts(
    body: string,
    isHighlighted: (text: string, tag: string) => boolean,
    partTestId: (text: string) => string,
    onPart?: (text: string, tag: string) => void,
): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const re = new RegExp(HIGHLIGHT_RE.source, "g");
    let last = 0; let m: RegExpExecArray | null; let k = 0;
    while ((m = re.exec(body)) !== null) {
        if (m.index > last) parts.push(<span key={`t${k++}`}>{body.slice(last, m.index)}</span>);
        const tag = m[1].split(":").pop() || m[1];
        const text = m[3];
        const hl = isHighlighted(text, tag);
        parts.push(
            <span
                key={`e${k++}`}
                data-testid={partTestId(text)}
                onClick={onPart ? (e => { e.stopPropagation(); onPart(text, tag); }) : undefined}
                style={{
                    ...(hl ? { background: 'rgba(0, 127, 212, 0.35)', borderRadius: 3, padding: '0 3px' } : {}),
                    ...(onPart ? { cursor: 'pointer', textDecoration: hl ? 'none' : 'underline dotted' } : {}),
                    color: hl ? tokens.text.primary : undefined,
                }}
                title={onPart ? "Click to select this value" : undefined}
            >
                {m[0]}
            </span>,
        );
        last = re.lastIndex;
    }
    if (last < body.length) parts.push(<span key={`t${k++}`}>{body.slice(last)}</span>);
    return parts;
}

export function TrafficWorkflowWizard({ logs, onDone, onCancel }: TrafficWorkflowWizardProps) {
    const [step, setStep] = useState<WizardStep>(1);
    const [name, setName] = useState('');
    const [disabledIds, setDisabledIds] = useState<Set<string>>(() => new Set());
    const [initialVars, setInitialVars] = useState<ManualVar[]>([]);
    const [stepNames, setStepNames] = useState<Record<string, string>>({});

    const chained = useMemo(() => detectChainedValues(logs), [logs]);
    const includedLogs = useMemo(() => logs.filter(l => !disabledIds.has(l.id)), [logs, disabledIds]);

    // Seed accepted chain picks once per logs (all accepted by default).
    // Default variable name = the source element tag (e.g. SessionToken), which
    // the detector records in c.variable.
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

    // Selected part of the source request (clicked element text) so the user
    // can promote it to a manual variable.
    const [selectedPart, setSelectedPart] = useState<SelectedPart | null>(null);

    const stepNameFor = (logId: string, log: TrafficLog) =>
        stepNames[logId] || `${log.method} ${lastPathSegment(log.url)}`;

    const stepIndexById = useMemo(() => {
        const m: Record<string, number> = {};
        includedLogs.forEach((l, i) => { m[l.id] = i + 1; });
        return m;
    }, [includedLogs]);

    // ── empty state ────────────────────────────────────────────────────────
    if (logs.length === 0) {
        return (
            <div style={root}>
                <div style={header}>
                    <h3 style={title}>Create Workflow from Traffic</h3>
                </div>
                <div style={emptyState}>
                    <div>No traffic captured yet. Start the proxy and capture some requests, then create a workflow.</div>
                    <Btn label="Back to proxy" onClick={onCancel} primary />
                </div>
            </div>
        );
    }

    const canContinueFromStep1 = name.trim().length > 0 && includedLogs.length >= 1;

    // ── create ─────────────────────────────────────────────────────────────
    function handleCreate() {
        const extractorsByLog: Record<string, WorkflowExtractor[]> = {};
        for (const pick of chainPicks) {
            if (!pick.sourceLogId) continue;
            const extractor: WorkflowExtractor = {
                id: crypto.randomUUID(),
                variable: pick.variable,
                type: 'xpath',
                pattern: pick.source === 'header' ? (pick.header ?? '') : (pick.xpath ?? ''),
                source: pick.source,
                headerName: pick.source === 'header' ? pick.header : undefined,
            };
            extractorsByLog[pick.sourceLogId] = [
                ...(extractorsByLog[pick.sourceLogId] ?? []),
                extractor,
            ];
        }
        const wf = assembleWorkflow({
            name: name.trim(),
            logs,
            disabledIds,
            initialVariables: Object.fromEntries(
                initialVars.filter(v => v.name.trim()).map(v => [v.name.trim(), v.value]),
            ),
            extractors: extractorsByLog,
            stepNames,
        });
        onDone(wf);
    }

    // ── step 1: select & name ──────────────────────────────────────────────
    function renderStep1() {
        return (
            <>
                <div>
                    <div style={sectionLabel}>Workflow name</div>
                    <input
                        style={input}
                        type="text"
                        placeholder="Workflow name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        data-testid="wf-name-input"
                    />
                </div>
                <div>
                    <div style={sectionLabel}>Captured requests (fire order)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {logs.map((log, i) => (
                            <label
                                key={log.id}
                                data-testid={'wf-step-' + log.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '8px 10px', borderRadius: tokens.radius.md,
                                    background: tokens.surface.deep,
                                    border: `1px solid ${disabledIds.has(log.id) ? tokens.border.subtle : tokens.border.default}`,
                                    opacity: disabledIds.has(log.id) ? 0.5 : 1,
                                    cursor: 'pointer', userSelect: 'none',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={!disabledIds.has(log.id)}
                                    onChange={() => toggleLog(log.id)}
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
                        ))}
                    </div>
                </div>
            </>
        );
    }

    function toggleLog(id: string) {
        setDisabledIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

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

    // Promote the selected source-request part to a manual variable
    // (name defaulted from the element tag, value = the part text).
    function useSelectedAsManualVar() {
        if (!selectedPart) return;
        const name = nameFromTag(selectedPart.tag, selectedPart.value);
        setInitialVars(vs => {
            if (vs.some(v => v.value === selectedPart.value && v.name === name)) return vs;
            return [...vs, { name, value: selectedPart.value }];
        });
        setSelectedPart(null);
    }

    // The first captured step is the one whose response feeds the chain — show
    // its request (editable parts) + response (captured value highlighted).
    const sourceLog = chained.length ? logs.find(l => l.id === chained[0].sourceLogId) : undefined;

    // ── step 2: variables ──────────────────────────────────────────────────
    function renderStep2() {
        return (
            <>
                <div>
                    <div style={sectionLabel}>Manual variables</div>
                    {initialVars.length === 0 && (
                        <div style={{ ...hint, marginBottom: 8 }}>No manual variables. Add one below, or click a value in the source request.</div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {initialVars.map((v, i) => (
                            <div key={i} style={{ ...rowStyle }}>
                                <input
                                    style={{ ...input, flex: 1 }}
                                    type="text"
                                    placeholder="name"
                                    value={v.name}
                                    onChange={e => setInitialVars(vs => vs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                                    data-testid={'wf-manual-name-' + i}
                                />
                                <input
                                    style={{ ...input, flex: 1 }}
                                    type="text"
                                    placeholder="value"
                                    value={v.value}
                                    onChange={e => setInitialVars(vs => vs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                                    data-testid={'wf-manual-value-' + i}
                                />
                                <button
                                    onClick={() => setInitialVars(vs => vs.filter((_, j) => j !== i))}
                                    style={{ ...btnGhost, color: tokens.text.muted }}
                                    aria-label={'Remove variable ' + i}
                                >×</button>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setInitialVars(vs => [...vs, { name: '', value: '' }])} style={{ ...btnGhost, marginTop: 8, alignSelf: 'flex-start' }}>
                        + Add variable
                    </button>
                </div>

                <div style={divider} />

                <div>
                    <div style={sectionLabel}>Captured &amp; reused values</div>
                    <div style={{ ...hint, marginBottom: 10 }}>
                        Accepted values are captured from the source step's response at run time and available as <span style={mono}>{'{{variable}}'}</span>.
                        Names default to the element tag and are editable.
                    </div>
                    {chained.length === 0 ? (
                        <div style={hint}>No response values were detected being reused in later requests.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {chained.map((c, i) => {
                                const pick = chainPicks.find(p => p.value === c.value);
                                const srcName = stepNameFor(c.sourceLogId, logs.find(l => l.id === c.sourceLogId) ?? { method: '', url: '' } as TrafficLog);
                                const useName = stepNameFor(c.consumedByLogId, logs.find(l => l.id === c.consumedByLogId) ?? { method: '', url: '' } as TrafficLog);
                                const from = c.source === 'header'
                                    ? `header ${c.sourceHeaderName ?? ''}`
                                    : c.sourceElementName ? `<${c.sourceElementName}>` : 'body';
                                const usedIn = c.consumedIn === 'header'
                                    ? `header ${c.consumedHeaderName ?? ''}`
                                    : c.consumedIn;
                                return (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '8px 10px', borderRadius: tokens.radius.md,
                                            background: tokens.surface.deep,
                                            border: `1px solid ${tokens.border.default}`, userSelect: 'none',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={!!pick}
                                            onChange={() => toggleChainPick(c.value)}
                                            style={{ cursor: 'pointer', accentColor: tokens.status.accentDark, flexShrink: 0 }}
                                            data-testid={'wf-chain-' + i}
                                        />
                                        <input
                                            style={{ ...input, width: 160, flex: '0 0 160px', padding: '3px 8px' }}
                                            type="text"
                                            value={pick?.variable ?? ''}
                                            onChange={e => setVarName(c.value, e.target.value)}
                                            data-testid={'wf-varname-' + c.value}
                                            aria-label={'Variable name for ' + c.value}
                                        />
                                        <span style={{ ...mono, fontSize: 'var(--apinox-fs-sm)', color: tokens.text.secondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {c.value}
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

                {sourceLog && (
                    <>
                        <div style={divider} />
                        <div>
                            <div style={sectionLabel}>
                                Source request — {stepNameFor(sourceLog.id, sourceLog)}
                            </div>
                            <div style={{ ...hint, marginBottom: 8 }}>
                                Highlighted values are captured &amp; reused. Click any value to select it, then promote it to a manual variable.
                            </div>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ ...hint, marginBottom: 4 }}>Request body</div>
                                    <div style={{
                                        ...mono, fontSize: 'var(--apinox-fs-sm)', lineHeight: 1.6,
                                        background: tokens.surface.deep, border: `1px solid ${tokens.border.default}`,
                                        borderRadius: tokens.radius.md, padding: '10px 12px',
                                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflow: 'auto',
                                    }}>
                                        {renderXmlParts(
                                            sourceLog.requestBody || '(no body)',
                                            () => false,
                                            text => 'wf-varpart-' + text,
                                            (text, tag) => setSelectedPart({ value: text, tag }),
                                        )}
                                    </div>
                                    {selectedPart && (
                                        <div style={{ ...rowStyle, marginTop: 8, gap: 10 }}>
                                            <span style={{ ...chip }}>
                                                {'{{' + nameFromTag(selectedPart.tag, selectedPart.value) + '}}'} = {selectedPart.value}
                                            </span>
                                            <button onClick={useSelectedAsManualVar} style={btnGhost}>
                                                Use as manual variable
                                            </button>
                                            <button onClick={() => setSelectedPart(null)} style={{ ...btnGhost, color: tokens.text.muted }}>
                                                Clear
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ ...hint, marginBottom: 4 }}>Source response (captured value highlighted)</div>
                                    <div style={{
                                        ...mono, fontSize: 'var(--apinox-fs-sm)', lineHeight: 1.6,
                                        background: tokens.surface.deep, border: `1px solid ${tokens.border.default}`,
                                        borderRadius: tokens.radius.md, padding: '10px 12px',
                                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflow: 'auto',
                                    }}>
                                        {renderXmlParts(
                                            sourceLog.responseBody || '(no body)',
                                            text => chained.some(c => c.sourceLogId === sourceLog.id && c.value === text.trim()),
                                            text => 'wf-highlight-' + text,
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </>
        );
    }

    // ── step 3: review & save ──────────────────────────────────────────────
    function renderStep3() {
        const extractorVars = chainPicks.map(p => p.variable);
        const varSummary = [
            ...initialVars.filter(v => v.name.trim()).map(v => v.name),
            ...extractorVars,
        ];
        return (
            <>
                <div>
                    <div style={sectionLabel}>Steps</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {includedLogs.map((log, i) => {
                            const pickVars = chainPicks
                                .filter(p => p.sourceLogId === log.id)
                                .map(p => p.variable);
                            return (
                                <div
                                    key={log.id}
                                    data-testid={'wf-review-step-' + log.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 10px', borderRadius: tokens.radius.md,
                                        background: tokens.surface.deep,
                                        border: `1px solid ${tokens.border.default}`,
                                    }}
                                >
                                    <span style={{ ...mono, fontSize: 'var(--apinox-fs-sm)', color: tokens.text.hint, minWidth: 18 }}>#{i + 1}</span>
                                    <input
                                        style={{ ...input, flex: 1, padding: '4px 8px' }}
                                        type="text"
                                        value={stepNameFor(log.id, log)}
                                        onChange={e => setStepNames(m => ({ ...m, [log.id]: e.target.value }))}
                                        data-testid={'wf-review-name-' + log.id}
                                    />
                                    <span style={methodBadge}>{log.method}</span>
                                    <span style={{ ...mono, fontSize: 'var(--apinox-fs-sm)', color: tokens.text.secondary, flexShrink: 0 }}>
                                        {lastPathSegment(log.url)}
                                    </span>
                                    {pickVars.map(v => (
                                        <span key={v} style={chip}>{'{{' + v + '}}'}</span>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div style={divider} />
                <div>
                    <div style={sectionLabel}>Variables</div>
                    {varSummary.length === 0 ? (
                        <div style={hint}>No variables.</div>
                    ) : (
                        <div>{varSummary.map((v, i) => <span key={i} style={chip}>{'{{' + v + '}}'}</span>)}</div>
                    )}
                </div>
            </>
        );
    }

    const footerLeft: React.CSSProperties = { display: 'flex', gap: 8 };

    return (
        <div style={root}>
            <div style={header}>
                <h3 style={title}>Create Workflow from Traffic</h3>
                <span style={stepIndicator}>Step {step} / 3 — {step === 1 ? 'Select & name' : step === 2 ? 'Variables' : 'Review & save'}</span>
            </div>
            <div style={body}>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </div>
            <div style={footer}>
                <div style={footerLeft}>
                    {step > 1 && <Btn label="Back" onClick={() => setStep(s => (s - 1) as WizardStep)} />}
                    <Btn label="Cancel" onClick={onCancel} />
                </div>
                <div style={footerRight}>
                    {step === 1 && (
                        <Btn label="Continue" primary disabled={!canContinueFromStep1} onClick={() => setStep(2)} />
                    )}
                    {step === 2 && (
                        <Btn label="Continue" primary onClick={() => setStep(3)} />
                    )}
                    {step === 3 && (
                        <Btn label="Create workflow" primary disabled={includedLogs.length === 0} onClick={handleCreate} />
                    )}
                </div>
            </div>
        </div>
    );
}

const btnGhost: React.CSSProperties = {
    padding: '4px 10px', fontSize: 'var(--apinox-fs-sm)',
    background: 'transparent', border: `1px solid ${tokens.border.default}`,
    borderRadius: tokens.radius.md, color: tokens.text.secondary, cursor: 'pointer',
};
