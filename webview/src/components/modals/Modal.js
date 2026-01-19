import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styled, { keyframes } from 'styled-components';
import { X } from 'lucide-react';
const overlayEnter = keyframes `
  from { opacity: 0; }
  to { opacity: 1; }
`;
export const ModalOverlay = styled.div `
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* VS Code doesn't have a standard modal backdrop variable, but we can try to matches quick input backdrop if available, otherwise fallback to existing but maybe valid? 
     Actually, standard VS Code usually just dims. 
     Let's try to find a variable or keep it if no good match. 
     QuickInput uses 'pickerGroup.border' maybe? No. 
     Let's stick to the shadow replacement and maybe use a variable for the overlay if I find one. 
     For now, replacing the shadow. */
  background-color: rgba(0, 0, 0, 0.5); 
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: ${overlayEnter} 0.2s ease-out;
`;
const modalEnter = keyframes `
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;
export const ModalContent = styled.div `
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  box-shadow: 0 4px 6px var(--vscode-widget-shadow);
  width: ${props => typeof props.width === 'number' ? `${props.width}px` : (props.width || '400px')};
  max-width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: ${modalEnter} 0.2s ease-out;
`;
export const ModalHeader = styled.div `
    padding: 10px 15px;
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
`;
export const ModalTitle = styled.div `
    font-weight: bold;
`;
export const ModalBody = styled.div `
    padding: 15px;
    overflow-y: auto;
    flex: 1;
`;
export const ModalFooter = styled.div `
    padding: 10px 15px;
    border-top: 1px solid var(--vscode-panel-border);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
`;
export const Button = styled.button `
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 6px 12px;
  cursor: pointer;
  &:hover {
    background: var(--vscode-button-hoverBackground);
  }
  &:disabled {
    opacity: 0.5;
    cursor: NOT-allowed;
  }
`;
export const Modal = ({ isOpen, onClose, title, children, footer, width }) => {
    if (!isOpen)
        return null;
    return (_jsx(ModalOverlay, { onClick: (e) => {
            if (e.target === e.currentTarget)
                onClose();
        }, children: _jsxs(ModalContent, { width: width, children: [_jsxs(ModalHeader, { children: [_jsx(ModalTitle, { children: title }), _jsx(Button, { onClick: onClose, style: { background: 'transparent' }, children: _jsx(X, { size: 16 }) })] }), _jsx(ModalBody, { children: children }), footer && (_jsx(ModalFooter, { children: footer }))] }) }));
};
