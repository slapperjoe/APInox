/**
 * AddToProjectDialog
 *
 * Modal that lets the user save a traffic log entry as a request inside
 * a project operation (Project → Interface → Operation → new Request).
 */
import React, { useState, useEffect } from 'react';
import { ApinoxProject, ApiInterface, ApiOperation } from '@shared/models';
import { tokens } from './tokens';
import type { TrafficLog } from './TrafficViewer';

interface AddToProjectDialogProps {
    log: TrafficLog;
    projects: ApinoxProject[];
    onConfirm: (projectName: string, interfaceName: string, operationName: string, requestName: string) => void;
    onClose: () => void;
}

// ── helpers ───────────────────────────────────────────────────────────────

function deriveDefaultName(log: TrafficLog): string {
    try {
        const url = new URL(log.url);
        const last = url.pathname.split('/').filter(Boolean).pop();
        if (last) return last;
    } catch {/* ignore */}
    return 'Traffic Request';
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
    margin: 0, fontSize: 15, fontWeight: 700,
    color: tokens.text.primary,
};

const label: React.CSSProperties = {
    display: 'block',
    fontSize: 11, fontWeight: 600, color: tokens.text.muted,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 4,
};

const select: React.CSSProperties = {
    width: '100%', padding: '6px 8px',
    background: tokens.surface.input,
    color: tokens.text.primary,
    border: `1px solid ${tokens.border.default}`,
    borderRadius: tokens.radius.md,
    fontSize: 13, outline: 'none',
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
                padding: '6px 16px', fontSize: 13, fontWeight: 600,
                borderRadius: tokens.radius.md, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                background: primary ? tokens.status.accentDark : tokens.surface.elevated,
                color: primary ? '#fff' : tokens.text.primary,
                opacity: disabled ? 0.5 : 1,
            }}
        >
            {lbl}
        </button>
    );
}

// ── component ─────────────────────────────────────────────────────────────

export function AddToProjectDialog({ log, projects, onConfirm, onClose }: AddToProjectDialogProps) {
    const writableProjects = projects.filter(p => !p.readOnly);

    const [selectedProjectName, setSelectedProjectName] = useState<string>(writableProjects[0]?.name ?? '');
    const [selectedInterfaceName, setSelectedInterfaceName] = useState<string>('');
    const [selectedOperationName, setSelectedOperationName] = useState<string>('');
    const [requestName, setRequestName] = useState<string>(deriveDefaultName(log));

    const selectedProject: ApinoxProject | undefined = writableProjects.find(p => p.name === selectedProjectName);
    const interfaces: ApiInterface[] = selectedProject?.interfaces ?? [];
    const selectedInterface: ApiInterface | undefined = interfaces.find(i => i.name === selectedInterfaceName);
    const operations: ApiOperation[] = selectedInterface?.operations ?? [];

    // Reset cascading selections when project changes
    useEffect(() => {
        const firstIface = interfaces[0];
        setSelectedInterfaceName(firstIface?.name ?? '');
    }, [selectedProjectName]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset operation when interface changes
    useEffect(() => {
        const firstOp = operations[0];
        setSelectedOperationName(firstOp?.name ?? '');
    }, [selectedInterfaceName]); // eslint-disable-line react-hooks/exhaustive-deps

    const canConfirm =
        selectedProjectName !== '' &&
        selectedInterfaceName !== '' &&
        selectedOperationName !== '' &&
        requestName.trim() !== '';

    function handleConfirm() {
        if (canConfirm) {
            onConfirm(selectedProjectName, selectedInterfaceName, selectedOperationName, requestName.trim());
        }
    }

    // Close on backdrop click
    function handleBackdropClick(e: React.MouseEvent) {
        if (e.target === e.currentTarget) onClose();
    }

    return (
        <div style={backdrop} onMouseDown={handleBackdropClick}>
            <div style={card}>
                <h3 style={title}>Add to Project</h3>

                {/* URL summary */}
                <div style={{
                    fontSize: 11, color: tokens.text.muted,
                    background: tokens.surface.elevated,
                    padding: '5px 8px', borderRadius: tokens.radius.sm,
                    fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {log.method} {log.url}
                </div>

                {writableProjects.length === 0 ? (
                    <div style={{ color: tokens.text.muted, fontSize: 13 }}>
                        No writable projects found. Open or create a project first.
                    </div>
                ) : (
                    <>
                        <div style={rowStyle}>
                            <label style={label}>Project</label>
                            <select
                                style={select}
                                value={selectedProjectName}
                                onChange={e => setSelectedProjectName(e.target.value)}
                            >
                                {writableProjects.map(p => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={rowStyle}>
                            <label style={label}>Interface</label>
                            {interfaces.length === 0 ? (
                                <div style={{ fontSize: 12, color: tokens.text.muted }}>
                                    No interfaces in this project.
                                </div>
                            ) : (
                                <select
                                    style={select}
                                    value={selectedInterfaceName}
                                    onChange={e => setSelectedInterfaceName(e.target.value)}
                                >
                                    {interfaces.map(i => (
                                        <option key={i.name} value={i.name}>{i.displayName || i.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div style={rowStyle}>
                            <label style={label}>Operation</label>
                            {interfaces.length > 0 && operations.length === 0 ? (
                                <div style={{ fontSize: 12, color: tokens.text.muted }}>
                                    No operations in this interface.
                                </div>
                            ) : interfaces.length === 0 ? null : (
                                <select
                                    style={select}
                                    value={selectedOperationName}
                                    onChange={e => setSelectedOperationName(e.target.value)}
                                >
                                    {operations.map(o => (
                                        <option key={o.name} value={o.name}>{o.displayName || o.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div style={rowStyle}>
                            <label style={label}>Request name</label>
                            <input
                                style={input}
                                type="text"
                                value={requestName}
                                onChange={e => setRequestName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onClose(); }}
                                autoFocus
                            />
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
