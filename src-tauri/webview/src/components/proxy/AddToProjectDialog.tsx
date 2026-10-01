/**
 * AddToProjectDialog
 *
 * Modal that lets the user save a traffic log entry as a request inside a
 * unified-explorer project, under an Operation — either an existing operation
 * (so the request groups with the WSDL operation) or a NEW operation (so
 * arbitrary captured traffic that doesn't match a WSDL operation is usable).
 *
 * NOTE: the destination is an OPERATION, not a folder/interface. The unified
 * explorer sidebar (UnifiedExplorerSidebar) renders project → operation →
 * request only; it never renders folders, so a folder destination would be
 * invisible, and the legacy `interfaces[]` (nested model) is empty on unified
 * projects — which is exactly why the old dialog's "Add Request" button stayed
 * disabled. The write path is the unified store (updateUnifiedProject), so the
 * new request appears in the tree immediately.
 */
import React, { useState, useEffect } from 'react';
import { UnifiedProject } from '@shared/models';
import { tokens } from './tokens';
import type { TrafficLog } from './TrafficViewer';

/** Where in the unified project the captured request lands. */
export type AddToProjectDestination = {
    /** Target operation name (stable name, not display name). */
    operationName: string;
    /**
     * True → create a NEW operation with this name holding the request.
     * False → append the request to the existing operation of that name.
     */
    isNew: boolean;
};

interface AddToProjectDialogProps {
    log: TrafficLog;
    projects: UnifiedProject[];
    onConfirm: (projectName: string, destination: AddToProjectDestination, requestName: string, includeAllHeaders: boolean) => void;
    onClose: () => void;
}

// ── helpers ───────────────────────────────────────────────────────────────

/** Derive a sensible request name from the URL's last path segment. */
function deriveDefaultName(log: TrafficLog): string {
    try {
        const url = new URL(log.url);
        const last = url.pathname.split('/').filter(Boolean).pop();
        if (last) return last;
    } catch {/* ignore */}
    return 'Traffic Request';
}

/** Best-effort operation name for a NEW operation derived from the traffic. */
function deriveOperationName(log: TrafficLog): string {
    // Prefer a SOAP action if one is present (it names the operation in the
    // WSDL model); fall back to the request name.
    const headers = log.requestHeaders ?? {};
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'soapaction') {
            const val = (headers[key] as string).replace(/"/g, '').trim();
            if (val) {
                const hash = val.lastIndexOf('#');
                const slash = val.lastIndexOf('/');
                const idx = Math.max(hash, slash);
                return idx >= 0 && idx < val.length - 1 ? val.slice(idx + 1) : val;
            }
        }
    }
    return deriveDefaultName(log);
}

// ── styles (inline to keep this file self-contained) ─────────────────────

const backdrop: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 100000,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const card: React.CSSProperties = {
    background: tokens.surface.panel,
    border: `1px solid ${tokens.border.default}`,
    borderRadius: tokens.radius.lg,
    boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
    minWidth: 420, maxWidth: 560, width: '92vw',
    padding: 24,
    display: 'flex', flexDirection: 'column', gap: 16,
};

const title: React.CSSProperties = {
    margin: 0, fontSize: 15, fontWeight: 'var(--fw-bold)',
    color: tokens.text.primary,
};

const label: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--apinox-fs-sm)', fontWeight: 'var(--fw-semibold)', color: tokens.text.muted,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 4,
};

const select: React.CSSProperties = {
    width: '100%', padding: '8px 8px',
    background: tokens.surface.input,
    color: tokens.text.primary,
    border: `1px solid ${tokens.border.default}`,
    borderRadius: tokens.radius.md,
    fontSize: 'var(--apinox-fs-base)', outline: 'none',
};

const input: React.CSSProperties = {
    ...select,
};

const rowStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column' };

const btnRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4,
};

function Btn({ label: lbl, onClick, primary, disabled }: { label: string; onClick: () => void; primary?: boolean; disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '8px 16px', fontSize: 'var(--apinox-fs-base)', fontWeight: 'var(--fw-semibold)',
                borderRadius: tokens.radius.md, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                background: primary ? tokens.status.accentDark : tokens.surface.elevated,
                color: primary ? 'var(--apinox-button-foreground)' : tokens.text.primary,
                opacity: disabled ? 0.5 : 1,
            }}
        >
            {lbl}
        </button>
    );
}

const NEW_OPERATION_SENTINEL = '__new__';

// ── component ─────────────────────────────────────────────────────────────

export function AddToProjectDialog({ log, projects, onConfirm, onClose }: AddToProjectDialogProps) {
    const writableProjects = projects.filter(p => !p.readOnly);

    const [selectedProjectName, setSelectedProjectName] = useState<string>(writableProjects[0]?.name ?? '');

    // Operation destination: existing operation name, or the "new" sentinel.
    const [selectedOperationValue, setSelectedOperationValue] = useState<string>(NEW_OPERATION_SENTINEL);
    const [newOperationName, setNewOperationName] = useState<string>(() => deriveOperationName(log));

    const [requestName, setRequestName] = useState<string>(deriveDefaultName(log));
    const [includeAllHeaders, setIncludeAllHeaders] = useState<boolean>(false);

    const selectedProject: UnifiedProject | undefined = writableProjects.find(p => p.name === selectedProjectName);
    const operations = selectedProject?.operations ?? [];

    // Reset the operation cascade when the project changes: default to a NEW
    // operation (the captured request usually doesn't match a WSDL operation),
    // re-seeding the suggested name from the traffic.
    useEffect(() => {
        setSelectedOperationValue(NEW_OPERATION_SENTINEL);
        setNewOperationName(deriveOperationName(log));
    }, [selectedProjectName]); // eslint-disable-line react-hooks/exhaustive-deps

    const resolvedOperationName = selectedOperationValue === NEW_OPERATION_SENTINEL
        ? newOperationName.trim()
        : selectedOperationValue;

    const canConfirm = selectedProjectName !== '' && resolvedOperationName !== '' && requestName.trim() !== '';

    function handleConfirm() {
        if (!canConfirm) return;
        onConfirm(
            selectedProjectName,
            { operationName: resolvedOperationName, isNew: selectedOperationValue === NEW_OPERATION_SENTINEL },
            requestName.trim(),
            includeAllHeaders,
        );
    }

    function handleBackdropClick(e: React.MouseEvent) {
        if (e.target === e.currentTarget) onClose();
    }

    return (
        <div style={backdrop} onMouseDown={handleBackdropClick}>
            <div style={card}>
                <h3 style={title}>Add to Project</h3>

                {/* URL summary */}
                <div style={{
                    fontSize: 'var(--apinox-fs-sm)', color: tokens.text.muted,
                    background: tokens.surface.elevated,
                    padding: '5px 8px', borderRadius: tokens.radius.sm,
                    fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {log.method} {log.url}
                </div>

                {writableProjects.length === 0 ? (
                    <div style={{ color: tokens.text.muted, fontSize: 'var(--apinox-fs-base)' }}>
                        No writable projects found. Open or create a project first.
                    </div>
                ) : (
                    <>
                        {/* Project */}
                        <div style={rowStyle}>
                            <label style={label}>Project</label>
                            <select
                                style={select}
                                value={selectedProjectName}
                                onChange={e => setSelectedProjectName(e.target.value)}
                            >
                                {writableProjects.map(p => (
                                    <option key={p.name} value={p.name}>{p.displayName || p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Operation */}
                        <div style={rowStyle}>
                            <label style={label}>Operation</label>
                            {operations.length > 0 && (
                                <select
                                    style={select}
                                    value={selectedOperationValue}
                                    onChange={e => setSelectedOperationValue(e.target.value)}
                                >
                                    {operations.map(op => (
                                        <option key={op.id || op.name} value={op.name}>{op.displayName || op.name}</option>
                                    ))}
                                    <option value={NEW_OPERATION_SENTINEL}>New operation…</option>
                                </select>
                            )}
                            {operations.length === 0 && (
                                <div style={{ fontSize: 'var(--apinox-fs-sm)', color: tokens.text.muted, marginBottom: 4 }}>
                                    No operations in this project — a new operation will be created.
                                </div>
                            )}
                        </div>
                        {selectedOperationValue === NEW_OPERATION_SENTINEL && (
                            <div style={rowStyle}>
                                <label style={label}>New operation name</label>
                                <input
                                    style={input}
                                    type="text"
                                    value={newOperationName}
                                    onChange={e => setNewOperationName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onClose(); }}
                                    autoFocus={operations.length === 0}
                                />
                            </div>
                        )}

                        <div style={rowStyle}>
                            <label style={label}>Request name</label>
                            <input
                                style={input}
                                type="text"
                                value={requestName}
                                onChange={e => setRequestName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onClose(); }}
                                autoFocus={selectedOperationValue !== NEW_OPERATION_SENTINEL}
                            />
                        </div>

                        {/* Header copy option */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                                id="include-all-headers"
                                type="checkbox"
                                checked={includeAllHeaders}
                                onChange={e => setIncludeAllHeaders(e.target.checked)}
                                style={{ cursor: 'pointer', accentColor: tokens.status.accentDark }}
                            />
                            <label
                                htmlFor="include-all-headers"
                                style={{ fontSize: 'var(--apinox-fs-md)', color: tokens.text.secondary, cursor: 'pointer', userSelect: 'none' }}
                            >
                                Include all request headers
                                <span style={{ color: tokens.text.muted, marginLeft: 4 }}>(default: Content-Type only)</span>
                            </label>
                        </div>
                    </>
                )}

                <div style={btnRow}>
                    <Btn label="Cancel" onClick={onClose} />
                    {writableProjects.length > 0 && (
                        <Btn label="Add Request" onClick={handleConfirm} primary disabled={!canConfirm} />
                    )}
                </div>
            </div>
        </div>
    );
}
