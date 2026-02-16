import React, { useState } from 'react';
import styled from 'styled-components';
import { Upload, X, File } from 'lucide-react';
import { BinaryBodyPanelProps, BinaryFile } from '../types';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #d4d4d4);
    padding: 12px;
    gap: 12px;
    overflow: auto;
`;

const EmptyState = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 48px 24px;
    text-align: center;
    color: var(--vscode-descriptionForeground, #858585);
    flex: 1;
`;

const EmptyStateIcon = styled.div`
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--vscode-input-background, #3c3c3c);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--vscode-descriptionForeground, #858585);
`;

const EmptyStateText = styled.div`
    font-size: 14px;
    line-height: 1.5;
`;

const UploadButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--vscode-button-background, #0e639c);
    color: var(--vscode-button-foreground, #ffffff);
    border: none;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover:not(:disabled) {
        background: var(--vscode-button-hoverBackground, #1177bb);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const FileCard = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--vscode-input-background, #3c3c3c);
    border: 1px solid var(--vscode-input-border, #3c3c3c);
    border-radius: 4px;
`;

const FileIcon = styled.div`
    width: 40px;
    height: 40px;
    border-radius: 4px;
    background: var(--vscode-editor-background, #1e1e1e);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--vscode-descriptionForeground, #858585);
    flex-shrink: 0;
`;

const FileInfo = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
`;

const FileName = styled.div`
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const FileMetadata = styled.div`
    font-size: 12px;
    color: var(--vscode-descriptionForeground, #858585);
    display: flex;
    gap: 12px;
`;

const MetadataItem = styled.span`
    white-space: nowrap;
`;

const RemoveButton = styled.button`
    width: 28px;
    height: 28px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--vscode-foreground, #cccccc);
    cursor: pointer;
    border-radius: 4px;
    flex-shrink: 0;
    transition: background 0.2s;

    &:hover:not(:disabled) {
        background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const InfoSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--vscode-input-background, #3c3c3c);
    border: 1px solid var(--vscode-input-border, #3c3c3c);
    border-radius: 4px;
    font-size: 12px;
`;

const InfoRow = styled.div`
    display: flex;
    gap: 8px;
`;

const InfoLabel = styled.span`
    color: var(--vscode-descriptionForeground, #858585);
    min-width: 80px;
`;

const InfoValue = styled.span`
    color: var(--vscode-foreground, #cccccc);
    word-break: break-all;
`;

export const BinaryBodyPanel: React.FC<BinaryBodyPanelProps> = ({
    file,
    onChange,
    readOnly = false,
    onPickFile
}) => {
    const [isPickingFile, setIsPickingFile] = useState(false);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };

    const handlePickFile = async () => {
        if (!onPickFile || readOnly || isPickingFile) return;

        setIsPickingFile(true);
        try {
            const result = await onPickFile();
            if (result) {
                const newFile: BinaryFile = {
                    fileName: result.name,
                    contentType: result.contentType,
                    fileSize: result.size,
                    content: result.content
                };
                onChange(newFile);
            }
        } catch (error) {
            console.error('Failed to pick file:', error);
        } finally {
            setIsPickingFile(false);
        }
    };

    const handleRemoveFile = () => {
        if (!readOnly) {
            onChange(null);
        }
    };

    if (!file) {
        return (
            <Container>
                <EmptyState>
                    <EmptyStateIcon>
                        <Upload size={32} />
                    </EmptyStateIcon>
                    <EmptyStateText>
                        No binary file selected.<br />
                        Upload a file to use as the request body.
                    </EmptyStateText>
                    {onPickFile && (
                        <UploadButton
                            onClick={handlePickFile}
                            disabled={readOnly || isPickingFile}
                        >
                            <Upload size={16} />
                            {isPickingFile ? 'Selecting...' : 'Choose File'}
                        </UploadButton>
                    )}
                </EmptyState>
            </Container>
        );
    }

    return (
        <Container>
            <FileCard>
                <FileIcon>
                    <File size={24} />
                </FileIcon>
                <FileInfo>
                    <FileName title={file.fileName}>{file.fileName}</FileName>
                    <FileMetadata>
                        <MetadataItem>{formatFileSize(file.fileSize)}</MetadataItem>
                        {file.contentType && (
                            <MetadataItem>{file.contentType}</MetadataItem>
                        )}
                    </FileMetadata>
                </FileInfo>
                <RemoveButton
                    onClick={handleRemoveFile}
                    disabled={readOnly}
                    title="Remove file"
                >
                    <X size={16} />
                </RemoveButton>
            </FileCard>

            <InfoSection>
                <InfoRow>
                    <InfoLabel>File Name:</InfoLabel>
                    <InfoValue>{file.fileName}</InfoValue>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>Content Type:</InfoLabel>
                    <InfoValue>{file.contentType || 'application/octet-stream'}</InfoValue>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>File Size:</InfoLabel>
                    <InfoValue>{formatFileSize(file.fileSize)}</InfoValue>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>Encoding:</InfoLabel>
                    <InfoValue>Base64</InfoValue>
                </InfoRow>
            </InfoSection>

            {onPickFile && !readOnly && (
                <UploadButton
                    onClick={handlePickFile}
                    disabled={isPickingFile}
                >
                    <Upload size={16} />
                    {isPickingFile ? 'Selecting...' : 'Replace File'}
                </UploadButton>
            )}
        </Container>
    );
};
