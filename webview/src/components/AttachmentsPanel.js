import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useCallback } from 'react';
import styled from 'styled-components';
import { Paperclip, Plus, Trash2, File, FileText, Image, Film, Music } from 'lucide-react';
import { FrontendCommand } from '@shared/messages';
import { bridge } from '../utils/bridge';
const Container = styled.div `
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 15px;
    gap: 15px;
    overflow-y: auto;
`;
const Header = styled.div `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
`;
const Title = styled.div `
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 0.95em;
`;
const AddButton = styled.button `
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.85em;
    &:hover {
        background: var(--vscode-button-hoverBackground);
    }
`;
const AttachmentList = styled.div `
    display: flex;
    flex-direction: column;
    gap: 8px;
`;
const AttachmentCard = styled.div `
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
`;
const FileIcon = styled.div `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--vscode-badge-background);
    border-radius: 4px;
    color: var(--vscode-badge-foreground);
`;
const FileInfo = styled.div `
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
`;
const FileName = styled.div `
    font-weight: 500;
    font-size: 0.9em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;
const FileMeta = styled.div `
    font-size: 0.8em;
    color: var(--vscode-descriptionForeground);
    display: flex;
    gap: 8px;
`;
const ContentIdInput = styled.input `
    width: 100px;
    padding: 4px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
    font-size: 0.85em;
    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
`;
const TypeSelect = styled.select `
    padding: 4px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
    font-size: 0.85em;
    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
`;
const DeleteButton = styled.button `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    color: var(--vscode-descriptionForeground);
    &:hover {
        background: var(--vscode-toolbar-hoverBackground);
        color: var(--vscode-errorForeground);
    }
`;
const EmptyState = styled.div `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    gap: 12px;
`;
const DropZone = styled.div `
    border: 2px dashed ${props => props.isDragging
    ? 'var(--vscode-focusBorder)'
    : 'var(--vscode-input-border)'};
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    background: ${props => props.isDragging
    ? 'var(--vscode-list-hoverBackground)'
    : 'transparent'};
    transition: all 0.2s ease;
    cursor: pointer;
    &:hover {
        border-color: var(--vscode-focusBorder);
        background: var(--vscode-list-hoverBackground);
    }
`;
// Helper to get icon based on content type
const getFileIcon = (contentType) => {
    if (contentType.startsWith('image/'))
        return _jsx(Image, { size: 18 });
    if (contentType.startsWith('video/'))
        return _jsx(Film, { size: 18 });
    if (contentType.startsWith('audio/'))
        return _jsx(Music, { size: 18 });
    if (contentType.includes('pdf') || contentType.includes('text'))
        return _jsx(FileText, { size: 18 });
    return _jsx(File, { size: 18 });
};
// Helper to format file size
const formatSize = (bytes) => {
    if (!bytes)
        return '';
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
export const AttachmentsPanel = ({ attachments, onChange }) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const handleAddClick = useCallback(() => {
        // Request file picker from backend
        bridge.sendMessage({ command: FrontendCommand.SelectAttachment });
    }, []);
    const handleDelete = useCallback((id) => {
        onChange(attachments.filter(a => a.id !== id));
    }, [attachments, onChange]);
    const handleUpdateContentId = useCallback((id, contentId) => {
        onChange(attachments.map(a => a.id === id ? { ...a, contentId } : a));
    }, [attachments, onChange]);
    const handleUpdateType = useCallback((id, type) => {
        onChange(attachments.map(a => a.id === id ? { ...a, type } : a));
    }, [attachments, onChange]);
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);
    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        // Note: Webview can't directly access dropped files
        // We'd need to send file paths to backend - for now just trigger file picker
        handleAddClick();
    }, [handleAddClick]);
    return (_jsxs(Container, { children: [_jsxs(Header, { children: [_jsxs(Title, { children: [_jsx(Paperclip, { size: 16 }), "Attachments (", attachments.length, ")"] }), _jsxs(AddButton, { onClick: handleAddClick, children: [_jsx(Plus, { size: 14 }), "Add File"] })] }), attachments.length === 0 ? (_jsx(EmptyState, { children: _jsxs(DropZone, { isDragging: isDragging, onClick: handleAddClick, onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop, children: [_jsx(Paperclip, { size: 32, style: { marginBottom: 8, opacity: 0.5 } }), _jsx("div", { children: "Click to add files or drag & drop here" }), _jsx("div", { style: { fontSize: '0.85em', marginTop: 4 }, children: "Supports Base64 inline, SwA (Multipart), and MTOM" })] }) })) : (_jsxs(AttachmentList, { children: [attachments.map(att => (_jsxs(AttachmentCard, { children: [_jsx(FileIcon, { children: getFileIcon(att.contentType) }), _jsxs(FileInfo, { children: [_jsx(FileName, { title: att.fsPath, children: att.name }), _jsxs(FileMeta, { children: [_jsx("span", { children: att.contentType }), att.size && _jsx("span", { children: formatSize(att.size) })] })] }), _jsx(ContentIdInput, { value: att.contentId, onChange: (e) => handleUpdateContentId(att.id, e.target.value), placeholder: "Content-ID", title: "Content-ID for cid: reference" }), _jsxs(TypeSelect, { value: att.type, onChange: (e) => handleUpdateType(att.id, e.target.value), title: "Encoding type", children: [_jsx("option", { value: "Base64", children: "Base64 (Inline)" }), _jsx("option", { value: "SwA", children: "SwA (Multipart)" }), _jsx("option", { value: "MTOM", children: "MTOM" })] }), _jsx(DeleteButton, { onClick: () => handleDelete(att.id), title: "Remove attachment", children: _jsx(Trash2, { size: 16 }) })] }, att.id))), _jsxs(DropZone, { isDragging: isDragging, onClick: handleAddClick, onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop, style: { padding: 12, fontSize: '0.85em' }, children: [_jsx(Plus, { size: 16, style: { marginRight: 6 } }), "Add another file"] })] }))] }));
};
