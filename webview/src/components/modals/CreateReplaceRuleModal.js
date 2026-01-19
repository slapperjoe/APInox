import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * CreateReplaceRuleModal.tsx
 *
 * Modal for creating replace rules from selected text in proxy view.
 * Shows XPath (auto-detected), match text (from selection), and allows
 * user to enter replacement text.
 */
import { useState, useEffect } from 'react';
import { Modal, Button } from './Modal';
import styled from 'styled-components';
const FormGroup = styled.div `
    margin-bottom: 15px;
`;
const Label = styled.label `
    display: block;
    margin-bottom: 5px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
`;
const Input = styled.input `
    width: 100%;
    padding: 6px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 2px;
    outline: none;
    box-sizing: border-box;

    &:focus {
        border-color: var(--vscode-focusBorder);
    }
`;
const TextArea = styled.textarea `
    width: 100%;
    padding: 6px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 2px;
    outline: none;
    box-sizing: border-box;
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
    resize: vertical;
    min-height: 60px;

    &:focus {
        border-color: var(--vscode-focusBorder);
    }
`;
const XPathDisplay = styled.code `
    display: block;
    padding: 8px;
    background: var(--vscode-textCodeBlock-background);
    border-radius: 3px;
    font-family: var(--vscode-editor-font-family);
    font-size: 11px;
    word-break: break-all;
    color: var(--vscode-textLink-foreground);
`;
const TargetSelect = styled.select `
    padding: 6px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 2px;
    outline: none;

    &:focus {
        border-color: var(--vscode-focusBorder);
    }
`;
export const CreateReplaceRuleModal = ({ isOpen, xpath, matchText, initialTarget, onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [replaceWith, setReplaceWith] = useState('');
    const [target, setTarget] = useState(initialTarget);
    useEffect(() => {
        if (isOpen) {
            setName('');
            setReplaceWith('');
            setTarget(initialTarget);
        }
    }, [isOpen, initialTarget]);
    const handleSave = () => {
        onSave({
            name: name || `Replace in ${target}`,
            xpath,
            matchText,
            replaceWith,
            target
        });
    };
    return (_jsxs(Modal, { isOpen: isOpen, onClose: onCancel, title: "Create Replace Rule", footer: _jsxs(_Fragment, { children: [_jsx(Button, { onClick: onCancel, style: { marginRight: 8, background: 'transparent', border: '1px solid var(--vscode-button-border)' }, children: "Cancel" }), _jsx(Button, { onClick: handleSave, children: "Create Rule" })] }), children: [_jsxs(FormGroup, { children: [_jsx(Label, { children: "Rule Name (optional)" }), _jsx(Input, { value: name, onChange: (e) => setName(e.target.value), placeholder: "e.g., Mask SSN", autoFocus: true })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "XPath" }), _jsx(XPathDisplay, { children: xpath })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Match Text" }), _jsx(TextArea, { value: matchText, readOnly: true, style: { background: 'var(--vscode-textCodeBlock-background)' } })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Replace With" }), _jsx(TextArea, { value: replaceWith, onChange: (e) => setReplaceWith(e.target.value), placeholder: "Enter replacement text...", onKeyDown: (e) => {
                            if (e.key === 'Enter' && e.ctrlKey)
                                handleSave();
                            if (e.key === 'Escape')
                                onCancel();
                        } })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Apply To" }), _jsxs(TargetSelect, { value: target, onChange: (e) => setTarget(e.target.value), children: [_jsx("option", { value: "request", children: "Request Only" }), _jsx("option", { value: "response", children: "Response Only" }), _jsx("option", { value: "both", children: "Both Request & Response" })] })] })] }));
};
