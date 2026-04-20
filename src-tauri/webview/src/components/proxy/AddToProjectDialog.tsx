/**
 * AddToProjectDialog
 *
 * Modal that lets the user save a traffic log entry as a request inside
 * a project — either under an Interface → Operation, or directly in a Folder.
 */
import React, { useState, useEffect } from 'react';
import { ApinoxProject, ApiInterface, ApiOperation } from '@shared/models';
import { tokens } from './tokens';
import type { TrafficLog } from './TrafficViewer';

export type AddToProjectDestination =
    | { type: 'operation'; interfaceName: string; operationName: string }
    | { type: 'folder'; folderName: string };

interface AddToProjectDialogProps {
    log: TrafficLog;
    projects: ApinoxProject[];
    onConfirm: (projectName: string, destination: AddToProjectDestination, requestName: string) => void;
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

const NEW_FOLDER_SENTINEL = '__new__';
const DEFAULT_FOLDER_NAME = 'Captured Traffic';

// ── component ─────────────────────────────────────────────────────────────

export function AddToProjectDialog({ log, projects, onConfirm, onClose }: AddToProjectDialogProps) {
    const writableProjects = projects.filter(p => !p.readOnly);

    type Mode = 'operation' | 'folder';
    const [mode, setMode] = useState<Mode>('folder');

    const [selectedProjectName, setSelectedProjectName] = useState<string>(writableProjects[0]?.name ?? '');
    // operation mode
    const [selectedInterfaceName, setSelectedInterfaceName] = useState<string>('');
    const [selectedOperationName, setSelectedOperationName] = useState<string>('');
    // folder mode
    const [selectedFolderValue, setSelectedFolderValue] = useState<string>(NEW_FOLDER_SENTINEL);
    const [newFolderName, setNewFolderName] = useState<string>(DEFAULT_FOLDER_NAME);

    const [requestName, setRequestName] = useState<string>(deriveDefaultName(log));

    const selectedProject: ApinoxProject | undefined = writableProjects.find(p => p.name === selectedProjectName);
    const interfaces: ApiInterface[] = selectedProject?.interfaces ?? [];
    const selectedInterface: ApiInterface | undefined = interfaces.find(i => i.name === selectedInterfaceName);
    const operations: ApiOperation[] = selectedInterface?.operations ?? [];
    const existingFolders = selectedProject?.folders ?? [];

    // Reset cascading selections when project changes
    useEffect(() => {
        const firstIface = interfaces[0];
        setSelectedInterfaceName(firstIface?.name ?? '');
        // reset folder selection too
        const firstFolder = existingFolders[0];
        setSelectedFolderValue(firstFolder ? firstFolder.name : NEW_FOLDER_SENTINEL);
    }, [selectedProjectName]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset operation when interface changes
    useEffect(() => {
        const firstOp = operations[0];
        setSelectedOperationName(firstOp?.name ?? '');
    }, [selectedInterfaceName]); // eslint-disable-line react-hooks/exhaustive-deps

    const resolvedFolderName = selectedFolderValue === NEW_FOLDER_SENTINEL ? newFolderName.trim() : selectedFolderValue;

    const canConfirm = mode === 'folder'
        ? selectedProjectName !== '' && resolvedFolderName !== '' && requestName.trim() !== ''
        : selectedProjectName !== '' && selectedInterfaceName !== '' && selectedOperationName !== '' && requestName.trim() !== '';

    function handleConfirm() {
        if (!canConfirm) return;
        if (mode === 'folder') {
            onConfirm(selectedProjectName, { type: 'folder', folderName: resolvedFolderName }, requestName.trim());
        } else {
            onConfirm(selectedProjectName, { type: 'operation', interfaceName: selectedInterfaceName, operationName: selectedOperationName }, requestName.trim());
        }
    }

    function handleBackdropClick(e: React.MouseEvent) {
        if (e.target === e.currentTarget) onClose();
    }

    const tabBase: React.CSSProperties = {
        flex: 1, padding: '5px 0', fontSize: 12, fontWeight: 600,
        border: `1px solid ${tokens.border.default}`,
        cursor: 'pointer', transition: 'background 0.15s',
    };

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
                        {/* Mode toggle */}
                        <div style={{ display: 'flex', borderRadius: tokens.radius.md, overflow: 'hidden' }}>
                            <button
                                style={{
                                    ...tabBase,
                                    borderRadius: `${tokens.radius.md} 0 0 ${tokens.radius.md}`,
                                    borderRight: 'none',
                                    background: mode === 'folder' ? tokens.status.accentDark : tokens.surface.elevated,
                                    color: mode === 'folder' ? '#fff' : tokens.text.secondary,
                                }}
                                onClick={() => setMode('folder')}
                            >
                                Folder
                            </button>
                            <button
                                style={{
                                    ...tabBase,
                                    borderRadius: `0 ${tokens.radius.md} ${tokens.radius.md} 0`,
                                    background: mode === 'operation' ? tokens.status.accentDark : tokens.surface.elevated,
                                    color: mode === 'operation' ? '#fff' : tokens.text.secondary,
                                }}
                                onClick={() => setMode('operation')}
                            >
                                Interface / Operation
                            </button>
                        </div>

                        {/* Project */}
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

                        {/* ── FOLDER MODE ── */}
                        {mode === 'folder' && (
                            <>
                                <div style={rowStyle}>
                                    <label style={label}>Folder</label>
                                    <select
                                        style={select}
                                        value={selectedFolderValue}
                                        onChange={e => setSelectedFolderValue(e.target.value)}
                                    >
                                        {existingFolders.map(f => (
                                            <option key={f.id} value={f.name}>{f.name}</option>
                                        ))}
                                        <option value={NEW_FOLDER_SENTINEL}>New folder…</option>
                                    </select>
                                </div>
                                {selectedFolderValue === NEW_FOLDER_SENTINEL && (
                                    <div style={rowStyle}>
                                        <label style={label}>New folder name</label>
                                        <input
                                            style={input}
                                            type="text"
                                            value={newFolderName}
                                            onChange={e => setNewFolderName(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onClose(); }}
                                            autoFocus
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── OPERATION MODE ── */}
                        {mode === 'operation' && (
                            <>
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
                            </>
                        )}

                        <div style={rowStyle}>
                            <label style={label}>Request name</label>
                            <input
                                style={input}
                                type="text"
                                value={requestName}
                                onChange={e => setRequestName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onClose(); }}
                                autoFocus={mode === 'operation' || selectedFolderValue !== NEW_FOLDER_SENTINEL}
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
