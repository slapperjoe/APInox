import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Modal, Button } from './Modal';
import { SPACING_XS } from '../../styles/spacing';

const Input = styled.input`
    width: 100%;
    padding: ${SPACING_XS};
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    outline: none;
    border-radius: 2px;
    font-size: 13px;

    &:focus {
        border-color: var(--vscode-focusBorder);
    }
`;

interface RenameModalProps {
    isOpen: boolean;
    title: string;
    initialValue: string;
    onSave: (newValue: string) => void;
    onCancel: () => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({ isOpen, title, initialValue, onSave, onCancel }) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (isOpen) setValue(initialValue);
    }, [isOpen, initialValue]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title={title}
            size="small"
            footer={
                <Button onClick={() => onSave(value)}>Save</Button>
            }
        >
            <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                    if (e.key === 'Enter') onSave(value);
                    if (e.key === 'Escape') onCancel();
                }}
            />
        </Modal>
    );
};
