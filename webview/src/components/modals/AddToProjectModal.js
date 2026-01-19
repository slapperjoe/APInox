import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * AddToProjectModal Component
 *
 * Modal for selecting an existing project or creating a new one
 * when adding interfaces from WSDL Explorer.
 */
import { useState } from 'react';
import styled from 'styled-components';
import { X, FolderPlus, Folder } from 'lucide-react';
const Overlay = styled.div `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
`;
const Modal = styled.div `
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 8px;
    min-width: 400px;
    max-width: 500px;
    display: flex;
    flex-direction: column;
`;
const Header = styled.div `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    border-bottom: 1px solid var(--vscode-panel-border);
    
    h2 {
        margin: 0;
        font-size: 1.1em;
        display: flex;
        align-items: center;
        gap: 8px;
    }
`;
const CloseButton = styled.button `
    background: none;
    border: none;
    cursor: pointer;
    color: var(--vscode-foreground);
    opacity: 0.7;
    &:hover { opacity: 1; }
`;
const Content = styled.div `
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
`;
const Footer = styled.div `
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 15px 20px;
    border-top: 1px solid var(--vscode-panel-border);
`;
const Button = styled.button `
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
    border: none;
    background: ${props => props.$primary ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)'};
    color: ${props => props.$primary ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)'};
    
    &:hover {
        opacity: 0.9;
    }
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;
const RadioOption = styled.label `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 15px;
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
const Select = styled.select `
    width: 100%;
    padding: 8px 12px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    font-size: 0.95em;
    margin-top: 10px;
    
    &:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
    }
`;
const Input = styled.input `
    width: 100%;
    padding: 8px 12px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    font-size: 0.95em;
    margin-top: 10px;
    
    &:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
    }
`;
const OptionContent = styled.div `
    flex: 1;
    
    .label {
        font-weight: 500;
        margin-bottom: 4px;
    }
    
    .description {
        font-size: 0.85em;
        opacity: 0.7;
    }
`;
export const AddToProjectModal = ({ open, onClose, existingProjects, onSelectProject, onCreateProject, interfaceName }) => {
    const [mode, setMode] = useState(existingProjects.length > 0 ? 'existing' : 'new');
    const [selectedProject, setSelectedProject] = useState(existingProjects[0] || '');
    const [newProjectName, setNewProjectName] = useState('');
    if (!open)
        return null;
    const handleConfirm = () => {
        if (mode === 'existing' && selectedProject) {
            onSelectProject(selectedProject);
        }
        else if (mode === 'new' && newProjectName.trim()) {
            onCreateProject(newProjectName.trim());
        }
        onClose();
        // Reset state
        setNewProjectName('');
    };
    const isValid = mode === 'existing'
        ? selectedProject.length > 0
        : newProjectName.trim().length > 0;
    return (_jsx(Overlay, { onClick: onClose, children: _jsxs(Modal, { onClick: e => e.stopPropagation(), children: [_jsxs(Header, { children: [_jsxs("h2", { children: [_jsx(FolderPlus, { size: 18 }), " Add to Project"] }), _jsx(CloseButton, { onClick: onClose, children: _jsx(X, { size: 18 }) })] }), _jsxs(Content, { children: [interfaceName && (_jsxs("div", { style: { fontSize: '0.9em', opacity: 0.8 }, children: ["Adding: ", _jsx("strong", { children: interfaceName })] })), existingProjects.length > 0 && (_jsxs(RadioOption, { selected: mode === 'existing', onClick: () => setMode('existing'), children: [_jsx("input", { type: "radio", name: "mode", checked: mode === 'existing', onChange: () => setMode('existing') }), _jsx(Folder, { size: 18 }), _jsxs(OptionContent, { children: [_jsx("div", { className: "label", children: "Existing Project" }), _jsx("div", { className: "description", children: "Add to an existing project" }), mode === 'existing' && (_jsx(Select, { value: selectedProject, onChange: e => setSelectedProject(e.target.value), onClick: e => e.stopPropagation(), children: existingProjects.map(name => (_jsx("option", { value: name, children: name }, name))) }))] })] })), _jsxs(RadioOption, { selected: mode === 'new', onClick: () => setMode('new'), children: [_jsx("input", { type: "radio", name: "mode", checked: mode === 'new', onChange: () => setMode('new') }), _jsx(FolderPlus, { size: 18 }), _jsxs(OptionContent, { children: [_jsx("div", { className: "label", children: "New Project" }), _jsx("div", { className: "description", children: "Create a new project" }), mode === 'new' && (_jsx(Input, { type: "text", value: newProjectName, onChange: e => setNewProjectName(e.target.value), onClick: e => e.stopPropagation(), placeholder: "Enter project name...", autoFocus: true, onKeyDown: e => {
                                                if (e.key === 'Enter' && isValid) {
                                                    handleConfirm();
                                                }
                                            } }))] })] })] }), _jsxs(Footer, { children: [_jsx(Button, { onClick: onClose, children: "Cancel" }), _jsx(Button, { "$primary": true, onClick: handleConfirm, disabled: !isValid, children: mode === 'existing' ? 'Add to Project' : 'Create & Add' })] })] }) }));
};
