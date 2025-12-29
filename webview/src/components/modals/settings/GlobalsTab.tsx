/**
 * GlobalsTab.tsx
 * 
 * Global variables management for the Settings modal.
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import styled, { keyframes, css } from 'styled-components';
import {
    DirtySoapConfig,
    EnvList,
    EnvItem,
    EnvDetail,
    FormGroup,
    Label,
    Input,
    IconButton,
} from './SettingsTypes';

// Shake animation for delete confirmation
const shakeAnimation = keyframes`
    0% { transform: translateX(0); }
    25% { transform: translateX(2px) rotate(5deg); }
    50% { transform: translateX(-2px) rotate(-5deg); }
    75% { transform: translateX(2px) rotate(5deg); }
    100% { transform: translateX(0); }
`;

const DeleteButton = styled(IconButton) <{ confirming?: boolean }>`
    color: ${props => props.confirming ? 'var(--vscode-errorForeground)' : 'var(--vscode-foreground)'};
    ${props => props.confirming && css`
        animation: ${shakeAnimation} 0.5s ease-in-out infinite;
    `}
`;

interface GlobalsTabProps {
    config: DirtySoapConfig;
    selectedGlobalKey: string | null;
    setSelectedGlobalKey: (key: string | null) => void;
    onAddGlobal: () => void;
    onDeleteGlobal: (key: string) => void;
    onGlobalKeyChange: (oldKey: string, newKey: string) => void;
    onGlobalValueChange: (key: string, value: string) => void;
}

export const GlobalsTab: React.FC<GlobalsTabProps> = ({
    config,
    selectedGlobalKey,
    setSelectedGlobalKey,
    onAddGlobal,
    onDeleteGlobal,
    onGlobalKeyChange,
    onGlobalValueChange,
}) => {
    const globals = config.globals || {};
    const globalKeys = Object.keys(globals);

    // Delete confirmation state
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Reset confirm state when selection changes
    useEffect(() => {
        setConfirmDelete(false);
    }, [selectedGlobalKey]);

    const handleDeleteClick = () => {
        if (!selectedGlobalKey) return;

        if (confirmDelete) {
            onDeleteGlobal(selectedGlobalKey);
            setConfirmDelete(false);
        } else {
            setConfirmDelete(true);
        }
    };

    return (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <EnvList>
                <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--vscode-panel-border)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Globals</span>
                    <IconButton onClick={onAddGlobal} title="Add Variable">
                        <Plus size={14} />
                    </IconButton>
                </div>
                {globalKeys.map(key => (
                    <EnvItem
                        key={key}
                        active={key === selectedGlobalKey}
                        selected={key === selectedGlobalKey}
                        onClick={() => setSelectedGlobalKey(key)}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{key}</span>
                        </div>
                    </EnvItem>
                ))}
            </EnvList>
            <EnvDetail>
                {selectedGlobalKey !== null && globals[selectedGlobalKey] !== undefined ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <h3 style={{ margin: 0, textTransform: 'uppercase', fontSize: 12 }}>Variable</h3>
                            <DeleteButton
                                onClick={handleDeleteClick}
                                confirming={confirmDelete}
                                title={confirmDelete ? "Click again to confirm delete" : "Delete Variable"}
                            >
                                <Trash2 size={14} />
                            </DeleteButton>
                        </div>
                        <FormGroup>
                            <Label>Key Name</Label>
                            <Input
                                type="text"
                                value={selectedGlobalKey}
                                onChange={e => onGlobalKeyChange(selectedGlobalKey, e.target.value)}
                            />
                        </FormGroup>
                        <FormGroup>
                            <Label>Value</Label>
                            <Input
                                type="text"
                                value={globals[selectedGlobalKey]}
                                onChange={e => onGlobalValueChange(selectedGlobalKey, e.target.value)}
                            />
                        </FormGroup>
                        <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', padding: '10px', background: 'var(--vscode-textBlockQuote-background)', borderLeft: '3px solid var(--vscode-textBlockQuote-border)' }}>
                            <p style={{ margin: 0 }}>
                                Use <code>{'{{' + selectedGlobalKey + '}}'}</code> in your requests to insert this value.
                            </p>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-disabledForeground)' }}>
                        Select a global variable to edit
                    </div>
                )}
            </EnvDetail>
        </div>
    );
};
