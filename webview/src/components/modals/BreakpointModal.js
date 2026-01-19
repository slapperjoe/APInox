import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
export const BreakpointModal = ({ open, breakpoint, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [pattern, setPattern] = useState('');
    const [isRegex, setIsRegex] = useState(false);
    const [target, setTarget] = useState('both');
    const [matchOn, setMatchOn] = useState('body');
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
        }
        else {
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
    if (!open)
        return null;
    const handleSave = () => {
        const bp = {
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
    const inputStyle = {
        width: '100%',
        padding: '8px 12px',
        backgroundColor: 'var(--vscode-input-background)',
        color: 'var(--vscode-input-foreground)',
        border: '1px solid var(--vscode-input-border)',
        borderRadius: 4,
        fontSize: 13
    };
    const selectStyle = {
        ...inputStyle,
        cursor: 'pointer'
    };
    const labelStyle = {
        display: 'block',
        marginBottom: 6,
        fontSize: 12,
        color: 'var(--vscode-descriptionForeground)'
    };
    const rowStyle = {
        marginBottom: 16
    };
    return (_jsx("div", { style: {
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }, onClick: onClose, children: _jsxs("div", { style: {
                backgroundColor: 'var(--vscode-editor-background)',
                borderRadius: 8,
                width: 450,
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }, onClick: e => e.stopPropagation(), children: [_jsxs("div", { style: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--vscode-panel-border)'
                    }, children: [_jsx("h3", { style: { margin: 0, fontSize: 16 }, children: breakpoint ? 'Edit Breakpoint' : 'Add Breakpoint' }), _jsx("button", { onClick: onClose, style: {
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--vscode-foreground)',
                                padding: 4
                            }, children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { style: { padding: 20 }, children: [_jsxs("div", { style: rowStyle, children: [_jsx("label", { style: labelStyle, children: "Name (optional)" }), _jsx("input", { type: "text", value: name, onChange: e => setName(e.target.value), placeholder: "e.g., Break on GetCustomer", style: inputStyle })] }), _jsxs("div", { style: rowStyle, children: [_jsx("label", { style: labelStyle, children: "Pattern *" }), _jsx("input", { type: "text", value: pattern, onChange: e => setPattern(e.target.value), placeholder: isRegex ? "e.g., GetCustomer.*Request" : "e.g., GetCustomer", style: inputStyle })] }), _jsxs("div", { style: { ...rowStyle, display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("input", { type: "checkbox", id: "isRegex", checked: isRegex, onChange: e => setIsRegex(e.target.checked), style: { width: 16, height: 16, cursor: 'pointer' } }), _jsx("label", { htmlFor: "isRegex", style: { fontSize: 13, cursor: 'pointer' }, children: "Use Regular Expression" })] }), _jsxs("div", { style: { display: 'flex', gap: 16 }, children: [_jsxs("div", { style: { ...rowStyle, flex: 1 }, children: [_jsx("label", { style: labelStyle, children: "Target" }), _jsxs("select", { value: target, onChange: e => setTarget(e.target.value), style: selectStyle, children: [_jsx("option", { value: "both", children: "Both" }), _jsx("option", { value: "request", children: "Request Only" }), _jsx("option", { value: "response", children: "Response Only" })] })] }), _jsxs("div", { style: { ...rowStyle, flex: 1 }, children: [_jsx("label", { style: labelStyle, children: "Match On" }), _jsxs("select", { value: matchOn, onChange: e => setMatchOn(e.target.value), style: selectStyle, children: [_jsx("option", { value: "body", children: "Body Content" }), _jsx("option", { value: "url", children: "URL" }), _jsx("option", { value: "header", children: "Header" })] })] })] }), matchOn === 'header' && (_jsxs("div", { style: rowStyle, children: [_jsx("label", { style: labelStyle, children: "Header Name" }), _jsx("input", { type: "text", value: headerName, onChange: e => setHeaderName(e.target.value), placeholder: "e.g., Content-Type", style: inputStyle })] })), _jsxs("div", { style: { ...rowStyle, display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("input", { type: "checkbox", id: "enabled", checked: enabled, onChange: e => setEnabled(e.target.checked), style: { width: 16, height: 16, cursor: 'pointer' } }), _jsx("label", { htmlFor: "enabled", style: { fontSize: 13, cursor: 'pointer' }, children: "Enabled" })] })] }), _jsxs("div", { style: {
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 10,
                        padding: '16px 20px',
                        borderTop: '1px solid var(--vscode-panel-border)'
                    }, children: [_jsx("button", { onClick: onClose, style: {
                                padding: '8px 16px',
                                backgroundColor: 'var(--vscode-button-secondaryBackground)',
                                color: 'var(--vscode-button-secondaryForeground)',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: 13
                            }, children: "Cancel" }), _jsx("button", { onClick: handleSave, disabled: !pattern.trim(), style: {
                                padding: '8px 16px',
                                backgroundColor: pattern.trim() ? 'var(--vscode-button-background)' : 'var(--vscode-disabledForeground)',
                                color: 'var(--vscode-button-foreground)',
                                border: 'none',
                                borderRadius: 4,
                                cursor: pattern.trim() ? 'pointer' : 'not-allowed',
                                fontSize: 13
                            }, children: breakpoint ? 'Save' : 'Add Breakpoint' })] })] }) }));
};
