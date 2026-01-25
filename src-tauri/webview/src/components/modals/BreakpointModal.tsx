import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Modal, Button } from './Modal';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_LG } from '../../styles/spacing';

const FormRow = styled.div`
    margin-bottom: ${SPACING_LG};
`;

const Label = styled.label`
    display: block;
    margin-bottom: ${SPACING_XS};
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
`;

const Input = styled.input`
    width: 100%;
    padding: ${SPACING_SM} 12px;
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    font-size: 13px;

    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
`;

const Select = styled.select`
    width: 100%;
    padding: ${SPACING_SM} 12px;
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;

    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
`;

const CheckboxRow = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    margin-bottom: ${SPACING_LG};
`;

const CheckboxInput = styled.input`
    width: 16px;
    height: 16px;
    cursor: pointer;
`;

const CheckboxLabel = styled.label`
    font-size: 13px;
    cursor: pointer;
`;

const TwoColumnRow = styled.div`
    display: flex;
    gap: ${SPACING_LG};
`;

const Column = styled.div`
    flex: 1;
`;

const SecondaryButton = styled(Button)`
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);

    &:hover {
        background-color: var(--vscode-button-secondaryHoverBackground);
    }
`;

export interface Breakpoint {
    id: string;
    name?: string;
    enabled: boolean;
    pattern: string;
    isRegex?: boolean;
    target: 'request' | 'response' | 'both';
    matchOn: 'url' | 'body' | 'header';
    headerName?: string;
}

interface BreakpointModalProps {
    open: boolean;
    breakpoint?: Breakpoint | null;
    onClose: () => void;
    onSave: (breakpoint: Breakpoint) => void;
}

export const BreakpointModal: React.FC<BreakpointModalProps> = ({
    open,
    breakpoint,
    onClose,
    onSave
}) => {
    const [name, setName] = useState('');
    const [pattern, setPattern] = useState('');
    const [isRegex, setIsRegex] = useState(false);
    const [target, setTarget] = useState<'request' | 'response' | 'both'>('both');
    const [matchOn, setMatchOn] = useState<'url' | 'body' | 'header'>('body');
    const [headerName, setHeaderName] = useState('');
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        if (breakpoint) {
            setName(breakpoint.name || '');
            setPattern(breakpoint.pattern);
            setIsRegex(breakpoint.isRegex || false);
            setTarget(breakpoint.target);
            setMatchOn(breakpoint.matchOn);
            setHeaderName(breakpoint.headerName || '');
            setEnabled(breakpoint.enabled);
        } else {
            // Reset for new breakpoint
            setName('');
            setPattern('');
            setIsRegex(false);
            setTarget('both');
            setMatchOn('body');
            setHeaderName('');
            setEnabled(true);
        }
    }, [breakpoint, open]);

    const handleSave = () => {
        const bp: Breakpoint = {
            id: breakpoint?.id || `bp-${Date.now()}`,
            name: name || undefined,
            enabled,
            pattern,
            isRegex,
            target,
            matchOn,
            headerName: matchOn === 'header' ? headerName : undefined
        };
        onSave(bp);
        onClose();
    };

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={breakpoint ? 'Edit Breakpoint' : 'Add Breakpoint'}
            size="small"
            footer={<>
                <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                <Button onClick={handleSave} disabled={!pattern.trim()}>
                    {breakpoint ? 'Save' : 'Add Breakpoint'}
                </Button>
            </>}
        >
            <FormRow>
                <Label>Name (optional)</Label>
                <Input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g., Break on GetCustomer"
                />
            </FormRow>

            <FormRow>
                <Label>Pattern *</Label>
                <Input
                    type="text"
                    value={pattern}
                    onChange={e => setPattern(e.target.value)}
                    placeholder={isRegex ? "e.g., GetCustomer.*Request" : "e.g., GetCustomer"}
                />
            </FormRow>

            <CheckboxRow>
                <CheckboxInput
                    type="checkbox"
                    id="isRegex"
                    checked={isRegex}
                    onChange={e => setIsRegex(e.target.checked)}
                />
                <CheckboxLabel htmlFor="isRegex">
                    Use Regular Expression
                </CheckboxLabel>
            </CheckboxRow>

            <TwoColumnRow>
                <Column>
                    <Label>Target</Label>
                    <Select
                        value={target}
                        onChange={e => setTarget(e.target.value as any)}
                    >
                        <option value="both">Both</option>
                        <option value="request">Request Only</option>
                        <option value="response">Response Only</option>
                    </Select>
                </Column>

                <Column>
                    <Label>Match On</Label>
                    <Select
                        value={matchOn}
                        onChange={e => setMatchOn(e.target.value as any)}
                    >
                        <option value="body">Body Content</option>
                        <option value="url">URL</option>
                        <option value="header">Header</option>
                    </Select>
                </Column>
            </TwoColumnRow>

            {matchOn === 'header' && (
                <FormRow>
                    <Label>Header Name</Label>
                    <Input
                        type="text"
                        value={headerName}
                        onChange={e => setHeaderName(e.target.value)}
                        placeholder="e.g., Content-Type"
                    />
                </FormRow>
            )}

            <CheckboxRow>
                <CheckboxInput
                    type="checkbox"
                    id="enabled"
                    checked={enabled}
                    onChange={e => setEnabled(e.target.checked)}
                />
                <CheckboxLabel htmlFor="enabled">
                    Enabled
                </CheckboxLabel>
            </CheckboxRow>
        </Modal>
    );
};
