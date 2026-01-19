import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Modal, Button } from './Modal';
export const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    return (_jsx(Modal, { isOpen: isOpen, onClose: onCancel, title: title, footer: _jsxs(_Fragment, { children: [_jsx(Button, { onClick: onCancel, style: { background: 'transparent', border: '1px solid var(--vscode-button-secondaryForeground)', color: 'var(--vscode-button-secondaryForeground)' }, children: "Cancel" }), _jsx(Button, { onClick: onConfirm, style: { background: 'var(--vscode-errorForeground)', color: 'white' }, children: "Delete" })] }), children: _jsx("div", { style: { padding: '10px 0' }, children: message }) }));
};
