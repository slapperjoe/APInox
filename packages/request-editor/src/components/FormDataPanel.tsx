import React, { useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Upload, File, X } from 'lucide-react';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
import { SPACING_XS, SPACING_SM } from '../styles/spacing';
import type { FormField, FormFieldType, EditorVariable } from '../types';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--apinox-foreground);
    background: var(--apinox-editor-background);
    padding: ${SPACING_SM};
    gap: ${SPACING_SM};
    overflow-y: auto;
`;

const HeaderRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${SPACING_XS};
`;

const Title = styled.div`
    font-weight: 600;
    font-size: 13px;
`;

const EncodingBadge = styled.div`
    font-size: 11px;
    padding: 2px 6px;
    background: var(--apinox-badge-background);
    border-radius: 3px;
    opacity: 0.7;
`;

const FieldRow = styled.div<{ $dimmed?: boolean }>`
    display: flex;
    gap: ${SPACING_SM};
    align-items: center;
    opacity: ${props => props.$dimmed ? 0.5 : 1};
`;

const FlexColumn = styled.div`
    flex: 1;
`;

const TypeSelector = styled.select`
    width: 70px;
    padding: 6px ${SPACING_SM};
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    border-radius: ${SPACING_XS};
    font-size: 12px;
    cursor: pointer;

    &:focus {
        outline: 1px solid var(--apinox-focusBorder);
    }
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const FilePreview = styled.div`
    padding: 6px ${SPACING_SM};
    background: var(--apinox-input-background);
    border: 1px solid var(--apinox-input-border);
    border-radius: ${SPACING_XS};
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--apinox-descriptionForeground);
`;

const FileName = styled.span`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const FileSize = styled.span`
    font-size: 11px;
    opacity: 0.7;
`;

const IconButton = styled.button`
    background: transparent;
    border: none;
    color: var(--apinox-icon-foreground);
    cursor: pointer;
    padding: ${SPACING_XS};
    border-radius: 3px;
    display: flex;
    align-items: center;
    
    &:hover:not(:disabled) {
        background: var(--apinox-toolbar-hoverBackground);
        color: var(--apinox-foreground);
    }
    
    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
`;

const Checkbox = styled.input`
    width: 16px;
    height: 16px;
    cursor: pointer;
    
    &:disabled {
        cursor: not-allowed;
    }
`;

const EmptyState = styled.div`
    opacity: 0.6;
    font-style: italic;
    padding: ${SPACING_SM};
    text-align: center;
`;

const Hint = styled.div`
    font-size: 11px;
    color: var(--apinox-descriptionForeground);
    opacity: 0.8;
    padding: ${SPACING_XS} 0;
`;

interface FormDataPanelProps {
    fields: FormField[];
    onChange: (fields: FormField[]) => void;
    enctype?: 'application/x-www-form-urlencoded' | 'multipart/form-data';
    readOnly?: boolean;
    availableVariables?: EditorVariable[];
    onPickFile?: () => Promise<{ name: string; content: string; contentType: string; size: number } | null>;
}

export const FormDataPanel: React.FC<FormDataPanelProps> = ({
    fields,
    onChange,
    enctype = 'application/x-www-form-urlencoded',
    readOnly = false,
    onPickFile
}) => {
    const [isPickingFile, setIsPickingFile] = useState<string | null>(null);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const addField = () => {
        const newField: FormField = {
            key: '',
            value: '',
            type: 'text',
            enabled: true
        };
        onChange([...fields, newField]);
    };

    const updateField = (index: number, updates: Partial<FormField>) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], ...updates };
        
        // If switching from file to text, clear file metadata
        if (updates.type === 'text' && newFields[index].fileName) {
            delete newFields[index].fileName;
            delete newFields[index].contentType;
            delete newFields[index].fileSize;
            newFields[index].value = '';
        }
        
        onChange(newFields);
    };

    const removeField = (index: number) => {
        onChange(fields.filter((_, i) => i !== index));
    };

    const handlePickFile = async (index: number) => {
        if (!onPickFile || isPickingFile) return;
        
        setIsPickingFile(fields[index].key);
        try {
            const file = await onPickFile();
            if (file) {
                updateField(index, {
                    value: file.content,
                    fileName: file.name,
                    contentType: file.contentType,
                    fileSize: file.size
                });
            }
        } catch (error) {
            console.error('[FormDataPanel] File pick error:', error);
        } finally {
            setIsPickingFile(null);
        }
    };

    const clearFile = (index: number) => {
        updateField(index, {
            value: '',
            fileName: undefined,
            contentType: undefined,
            fileSize: undefined
        });
    };

    const supportsFiles = enctype === 'multipart/form-data';

    return (
        <Container>
            <HeaderRow>
                <Title>Form Data</Title>
                <EncodingBadge>
                    {enctype === 'multipart/form-data' ? 'multipart' : 'url-encoded'}
                </EncodingBadge>
            </HeaderRow>

            {!supportsFiles && (
                <Hint>
                    URL-encoded forms support text fields only. Use multipart/form-data for file uploads.
                </Hint>
            )}

            {fields.length === 0 ? (
                <EmptyState>No form fields. Click + to add a field.</EmptyState>
            ) : (
                fields.map((field, index) => (
                    <FieldRow key={index} $dimmed={!field.enabled}>
                        <Checkbox
                            type="checkbox"
                            checked={field.enabled}
                            onChange={(e) => updateField(index, { enabled: e.target.checked })}
                            disabled={readOnly}
                        />

                        <FlexColumn>
                            <MonacoSingleLineInput
                                value={field.key}
                                onChange={(value) => updateField(index, { key: value })}
                                placeholder="Key"
                                readOnly={readOnly}
                            />
                        </FlexColumn>

                        {supportsFiles && (
                            <TypeSelector
                                value={field.type}
                                onChange={(e) => updateField(index, { type: e.target.value as FormFieldType })}
                                disabled={readOnly}
                            >
                                <option value="text">Text</option>
                                <option value="file">File</option>
                            </TypeSelector>
                        )}

                        <FlexColumn>
                            {field.type === 'file' ? (
                                field.fileName ? (
                                    <FilePreview>
                                        <File size={14} />
                                        <FileName title={field.fileName}>{field.fileName}</FileName>
                                        {field.fileSize && <FileSize>{formatFileSize(field.fileSize)}</FileSize>}
                                        {!readOnly && (
                                            <IconButton
                                                onClick={() => clearFile(index)}
                                                title="Remove file"
                                            >
                                                <X size={14} />
                                            </IconButton>
                                        )}
                                    </FilePreview>
                                ) : (
                                    <IconButton
                                        onClick={() => handlePickFile(index)}
                                        disabled={readOnly || isPickingFile === field.key}
                                        title="Pick file"
                                        style={{ 
                                            border: '1px dashed var(--apinox-input-border)',
                                            padding: '6px 12px',
                                            justifyContent: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <Upload size={14} />
                                        {isPickingFile === field.key ? 'Picking...' : 'Choose File'}
                                    </IconButton>
                                )
                            ) : (
                                <MonacoSingleLineInput
                                    value={field.value}
                                    onChange={(value) => updateField(index, { value })}
                                    placeholder="Value"
                                    readOnly={readOnly}
                                />
                            )}
                        </FlexColumn>

                        <IconButton
                            onClick={() => removeField(index)}
                            disabled={readOnly}
                            title="Remove"
                        >
                            <Trash2 size={16} />
                        </IconButton>
                    </FieldRow>
                ))
            )}

            {!readOnly && (
                <IconButton onClick={addField} title="Add field">
                    <Plus size={16} /> Add Field
                </IconButton>
            )}
        </Container>
    );
};
