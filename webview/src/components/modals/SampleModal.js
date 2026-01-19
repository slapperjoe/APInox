import { jsx as _jsx } from "react/jsx-runtime";
import { Modal } from './Modal';
import { SchemaViewer } from '../SchemaViewer';
export const SampleModal = ({ isOpen, operationName, schema, onClose }) => {
    return (_jsx(Modal, { isOpen: isOpen, onClose: onClose, title: `Schema: ${operationName}`, width: 600, children: _jsx("div", { style: { height: 500, overflow: 'hidden', display: 'flex', flexDirection: 'column' }, children: schema && _jsx(SchemaViewer, { schema: schema }) }) }));
};
