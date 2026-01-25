import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { WsdlDiff } from '@shared/models';
import { Modal, Button } from './Modal';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_XL } from '../../styles/spacing';

const Content = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XL};
`;

const EmptyState = styled.div`
    padding: ${SPACING_XL};
    text-align: center;
    opacity: 0.7;
`;

const DiffSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XS};
`;

const SectionTitle = styled.h3<{ $color: string }>`
    font-size: 0.9em;
    text-transform: uppercase;
    color: ${props => props.$color};
    margin: 0 0 ${SPACING_SM} 0;
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: ${SPACING_XS};
`;

const OperationList = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XS};
`;

const DiffItem = styled.div<{ $type: 'add' | 'remove' | 'modify' }>`
    display: flex;
    align-items: center;
    padding: ${SPACING_SM};
    background-color: ${props => {
        switch (props.$type) {
            case 'add': return 'rgba(72, 187, 120, 0.1)';
            case 'remove': return 'rgba(245, 101, 101, 0.1)';
            default: return 'transparent';
        }
    }};
    border-left: 3px solid ${props => {
        switch (props.$type) {
            case 'add': return '#48bb78';
            case 'remove': return '#f56565';
            case 'modify': return '#ecc94b';
            default: return '#ecc94b';
        }
    }};
`;

const ChangeLabel = styled.span`
    font-size: 0.8em;
    background-color: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: ${SPACING_XS} ${SPACING_XS};
    border-radius: 4px;
    margin-left: ${SPACING_SM};
`;

const Checkbox = styled.input`
    margin-right: ${SPACING_SM};
`;

const IconWrapper = styled.span<{ $color: string }>`
    margin-right: ${SPACING_SM};
    color: ${props => props.$color};
    display: inline-flex;
`;

const OperationName = styled.span<{ $strikethrough?: boolean }>`
    font-weight: 500;
    ${props => props.$strikethrough && 'text-decoration: line-through; opacity: 0.8;'}
`;

const SecondaryButton = styled(Button)`
    background-color: transparent;
    border: 1px solid var(--vscode-button-secondaryHoverBackground);
    
    &:hover {
        background-color: var(--vscode-toolbar-hoverBackground);
    }
`;

interface WsdlSyncModalProps {
    diff: WsdlDiff;
    onClose: () => void;
    onSync: (diff: WsdlDiff) => void;
}

export const WsdlSyncModal: React.FC<WsdlSyncModalProps> = ({ diff, onClose, onSync }) => {
    const [selectedAdds, setSelectedAdds] = useState<Set<string>>(new Set());
    const [selectedRemoves, setSelectedRemoves] = useState<Set<string>>(new Set());
    const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Select all by default
        setSelectedAdds(new Set(diff.addedOperations.map(op => op.name)));
        setSelectedRemoves(new Set(diff.removedOperations.map(op => op.name)));
        setSelectedMods(new Set(diff.modifiedOperations.map(op => op.operation.name)));
    }, [diff]);

    const toggleAdd = (name: string) => {
        const next = new Set(selectedAdds);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setSelectedAdds(next);
    };

    const toggleRemove = (name: string) => {
        const next = new Set(selectedRemoves);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setSelectedRemoves(next);
    };

    const toggleMod = (name: string) => {
        const next = new Set(selectedMods);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setSelectedMods(next);
    };

    const handleSync = () => {
        const finalDiff: WsdlDiff = {
            ...diff,
            addedOperations: diff.addedOperations.filter(op => selectedAdds.has(op.name)),
            removedOperations: diff.removedOperations.filter(op => selectedRemoves.has(op.name)),
            modifiedOperations: diff.modifiedOperations.filter(op => selectedMods.has(op.operation.name))
        };
        onSync(finalDiff);
    };

    const hasChanges = diff.addedOperations.length > 0 || diff.removedOperations.length > 0 || diff.modifiedOperations.length > 0;

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={`Synchronize Interface: ${diff.interfaceName}`}
            size="large"
            footer={<>
                <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                <Button onClick={handleSync} disabled={!hasChanges}>
                    Apply Changes
                </Button>
            </>}
        >
            <Content>
                {!hasChanges && (
                    <EmptyState>
                        No changes detected. The interface is up to date.
                    </EmptyState>
                )}

                {diff.addedOperations.length > 0 && (
                    <DiffSection>
                        <SectionTitle $color="#48bb78">
                            New Operations ({diff.addedOperations.length})
                        </SectionTitle>
                        <OperationList>
                            {diff.addedOperations.map(op => (
                                <DiffItem key={op.name} $type="add">
                                    <Checkbox
                                        type="checkbox"
                                        checked={selectedAdds.has(op.name)}
                                        onChange={() => toggleAdd(op.name)}
                                    />
                                    <IconWrapper $color="#48bb78">
                                        <Plus size={14} />
                                    </IconWrapper>
                                    <OperationName>{op.name}</OperationName>
                                </DiffItem>
                            ))}
                        </OperationList>
                    </DiffSection>
                )}

                {diff.removedOperations.length > 0 && (
                    <DiffSection>
                        <SectionTitle $color="#f56565">
                            Removed Operations ({diff.removedOperations.length})
                        </SectionTitle>
                        <OperationList>
                            {diff.removedOperations.map(op => (
                                <DiffItem key={op.name} $type="remove">
                                    <Checkbox
                                        type="checkbox"
                                        checked={selectedRemoves.has(op.name)}
                                        onChange={() => toggleRemove(op.name)}
                                    />
                                    <IconWrapper $color="#f56565">
                                        <Trash2 size={14} />
                                    </IconWrapper>
                                    <OperationName $strikethrough>{op.name}</OperationName>
                                </DiffItem>
                            ))}
                        </OperationList>
                    </DiffSection>
                )}

                {diff.modifiedOperations.length > 0 && (
                    <DiffSection>
                        <SectionTitle $color="#ecc94b">
                            Modified Operations ({diff.modifiedOperations.length})
                        </SectionTitle>
                        <OperationList>
                            {diff.modifiedOperations.map(mod => (
                                <DiffItem key={mod.operation.name} $type="modify">
                                    <Checkbox
                                        type="checkbox"
                                        checked={selectedMods.has(mod.operation.name)}
                                        onChange={() => toggleMod(mod.operation.name)}
                                    />
                                    <IconWrapper $color="#ecc94b">
                                        <RefreshCw size={14} />
                                    </IconWrapper>
                                    <OperationName>{mod.operation.name}</OperationName>
                                    {mod.changes.map(c => (
                                        <ChangeLabel key={c}>{c}</ChangeLabel>
                                    ))}
                                </DiffItem>
                            ))}
                        </OperationList>
                    </DiffSection>
                )}
            </Content>
        </Modal>
    );
};
