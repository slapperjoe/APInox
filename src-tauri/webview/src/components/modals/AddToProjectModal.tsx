/**
 * AddToProjectModal Component
 * 
 * Modal for selecting an existing project or creating a new one
 * when adding interfaces from WSDL Explorer.
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { FolderPlus, Folder } from 'lucide-react';
import { Modal, Button } from './Modal';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_XL } from '../../styles/spacing';

const Content = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XL};
`;

const InterfaceInfo = styled.div`
    font-size: 0.9em;
    opacity: 0.8;
`;

const RadioOption = styled.label<{ selected: boolean }>`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    padding: ${SPACING_MD} ${SPACING_MD};
    border: 1px solid ${props => props.selected ? 'var(--vscode-focusBorder)' : 'var(--vscode-input-border)'};
    border-radius: 6px;
    cursor: pointer;
    background: ${props => props.selected ? 'var(--vscode-list-hoverBackground)' : 'transparent'};
    transition: all 0.15s ease;
    
    &:hover {
        background: var(--vscode-list-hoverBackground);
    }
    
    input[type="radio"] {
        margin: 0;
    }
`;

const Select = styled.select`
    width: 100%;
    padding: ${SPACING_SM} ${SPACING_MD};
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    font-size: 0.95em;
    margin-top: ${SPACING_SM};
    
    &:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
    }
`;

const Input = styled.input`
    width: 100%;
    padding: ${SPACING_SM} ${SPACING_MD};
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    font-size: 0.95em;
    margin-top: ${SPACING_SM};
    
    &:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
    }
`;

const OptionContent = styled.div`
    flex: 1;
    
    .label {
        font-weight: 500;
        margin-bottom: ${SPACING_XS};
    }
    
    .description {
        font-size: 0.85em;
        opacity: 0.7;
    }
`;

const SecondaryButton = styled(Button)`
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
`;

interface AddToProjectModalProps {
    open: boolean;
    onClose: () => void;
    existingProjects: string[];
    onSelectProject: (projectName: string) => void;
    onCreateProject: (projectName: string) => void;
    interfaceName?: string;
}

type Mode = 'existing' | 'new';

export const AddToProjectModal: React.FC<AddToProjectModalProps> = ({
    open,
    onClose,
    existingProjects,
    onSelectProject,
    onCreateProject,
    interfaceName
}) => {
    const [mode, setMode] = useState<Mode>(existingProjects.length > 0 ? 'existing' : 'new');
    const [selectedProject, setSelectedProject] = useState(existingProjects[0] || '');
    const [newProjectName, setNewProjectName] = useState('');

    const handleConfirm = () => {
        if (mode === 'existing' && selectedProject) {
            onSelectProject(selectedProject);
        } else if (mode === 'new' && newProjectName.trim()) {
            onCreateProject(newProjectName.trim());
        }
        onClose();
        // Reset state
        setNewProjectName('');
    };

    const isValid = mode === 'existing'
        ? selectedProject.length > 0
        : newProjectName.trim().length > 0;

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title="Add to Project"
            size="medium"
            footer={<>
                <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                <Button onClick={handleConfirm} disabled={!isValid}>
                    {mode === 'existing' ? 'Add to Project' : 'Create & Add'}
                </Button>
            </>}
        >
            <Content>
                {interfaceName && (
                    <InterfaceInfo>
                        Adding: <strong>{interfaceName}</strong>
                    </InterfaceInfo>
                )}

                {existingProjects.length > 0 && (
                    <RadioOption
                        selected={mode === 'existing'}
                        onClick={() => setMode('existing')}
                    >
                        <input
                            type="radio"
                            name="mode"
                            checked={mode === 'existing'}
                            onChange={() => setMode('existing')}
                        />
                        <Folder size={18} />
                        <OptionContent>
                            <div className="label">Existing Project</div>
                            <div className="description">Add to an existing project</div>
                            {mode === 'existing' && (
                                <Select
                                    value={selectedProject}
                                    onChange={e => setSelectedProject(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                >
                                    {existingProjects.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </Select>
                            )}
                        </OptionContent>
                    </RadioOption>
                )}

                <RadioOption
                    selected={mode === 'new'}
                    onClick={() => setMode('new')}
                >
                    <input
                        type="radio"
                        name="mode"
                        checked={mode === 'new'}
                        onChange={() => setMode('new')}
                    />
                    <FolderPlus size={18} />
                    <OptionContent>
                        <div className="label">New Project</div>
                        <div className="description">Create a new project</div>
                        {mode === 'new' && (
                            <Input
                                type="text"
                                value={newProjectName}
                                onChange={e => setNewProjectName(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                placeholder="Enter project name..."
                                autoFocus
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && isValid) {
                                        handleConfirm();
                                    }
                                }}
                            />
                        )}
                    </OptionContent>
                </RadioOption>
            </Content>
        </Modal>
    );
};
