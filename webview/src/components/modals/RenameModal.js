import { jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Modal, Button } from './Modal';
export const RenameModal = ({ isOpen, title, initialValue, onSave, onCancel }) => {
    const [value, setValue] = useState(initialValue);
    useEffect(() => {
        if (isOpen)
            setValue(initialValue);
    }, [isOpen, initialValue]);
    return (_jsx(Modal, { isOpen: isOpen, onClose: onCancel, title: title, footer: _jsx(Button, { onClick: () => onSave(value), children: "Save" }), children: _jsx("input", { style: {
                width: '100%',
                padding: 5,
                background: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
                outline: 'none'
            }, value: value, onChange: (e) => setValue(e.target.value), autoFocus: true, onKeyDown: (e) => {
                if (e.key === 'Enter')
                    onSave(value);
                if (e.key === 'Escape')
                    onCancel();
            } }) }));
};
