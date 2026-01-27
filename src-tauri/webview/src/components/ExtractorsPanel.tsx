import React from 'react';
import styled from 'styled-components';
import { Trash2, Pencil } from 'lucide-react';
import { CustomXPathEvaluator } from '../utils/xpathEvaluator';
import { RequestExtractor } from '@shared/models';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_LG } from '../styles/spacing';

const Container = styled.div`
    height: 100%;
    overflow: auto;
    padding: 0;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
`;

const Toolbar = styled.div`
    padding: ${SPACING_SM};
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    justify-content: flex-end;
    gap: ${SPACING_SM};
`;

const ExtractorList = styled.div`
    padding: ${SPACING_SM};
`;

const ExtractorItem = styled.div`
    display: flex;
    padding: ${SPACING_SM};
    border: 1px solid var(--vscode-panel-border);
    background-color: var(--vscode-list-hoverBackground);
    margin-bottom: ${SPACING_SM};
    border-radius: ${SPACING_XS};
    align-items: flex-start;
    gap: ${SPACING_MD};
`;

const ExtractorInfo = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XS};
`;

const InfoRow = styled.div`
    display: flex;
    gap: ${SPACING_SM};
    align-items: baseline;
`;

const Label = styled.span`
    font-weight: bold;
    color: var(--vscode-textLink-foreground);
    min-width: 80px;
    font-size: 0.9em;
`;

const Value = styled.code`
    background: var(--vscode-textCodeBlock-background);
    padding: 2px ${SPACING_XS};
    border-radius: 3px;
    font-family: monospace;
    word-break: break-all;
    font-size: 0.9em;
`;

const IconButton = styled.button`
    background: transparent;
    color: var(--vscode-icon-foreground);
    border: none;
    cursor: pointer;
    padding: ${SPACING_XS};
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;

    &:hover {
        opacity: 1;
        background-color: var(--vscode-toolbar-hoverBackground);
        border-radius: 3px;
    }
`;

const ButtonGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XS};
`;

const ToolbarTitle = styled.span`
    margin-right: auto;
    font-weight: bold;
    font-size: 1.1em;
`;

const EmptyState = styled.div`
    padding: ${SPACING_LG};
    opacity: 0.7;
    font-style: italic;
    text-align: center;
`;

const VariableValue = styled(Value)`
    color: var(--vscode-debugTokenExpression-name);
`;

const DefaultLabel = styled(Label)`
    color: var(--vscode-editorInfo-foreground);
`;

const DefaultValue = styled(Value)`
    color: var(--vscode-editorInfo-foreground);
`;

const PreviewLabel = styled(Label)`
    color: var(--vscode-testing-iconPassed);
`;

const PreviewValue = styled(Value)`
    border-color: var(--vscode-testing-iconPassed);
    border: 1px solid transparent;
    background-color: var(--vscode-editor-inactiveSelectionBackground);
`;

const DeleteButton = styled(IconButton)`
    color: var(--vscode-errorForeground);
`;

interface ExtractorsPanelProps {
    extractors: RequestExtractor[];
    onChange: (extractors: RequestExtractor[]) => void;
    onEdit?: (extractor: RequestExtractor, index: number) => void;
    rawResponse?: string;
}

export const ExtractorsPanel: React.FC<ExtractorsPanelProps> = ({ extractors, onChange, onEdit, rawResponse }) => {

    const handleDelete = (index: number) => {
        const newExtractors = [...extractors];
        newExtractors.splice(index, 1);
        onChange(newExtractors);
    };

    console.log('[ExtractorsPanel] Rendering. Extractors:', extractors.length, 'RawResponse length:', rawResponse?.length);

    return (
        <Container>
            <Toolbar>
                <ToolbarTitle>Context Variables extracted from this Step</ToolbarTitle>
            </Toolbar>
            <ExtractorList>
                {extractors.length === 0 ? (
                    <EmptyState>
                        No extractors defined. Select text in the Response panel to create one.
                    </EmptyState>
                ) : (
                    extractors.map((ex, index) => {
                        let currentValue: string | null = null;
                        if (rawResponse && ex.source === 'body') {
                            try {
                                currentValue = CustomXPathEvaluator.evaluate(rawResponse, ex.path);
                                console.log(`[ExtractorsPanel] Expr: ${ex.path}, Val: ${currentValue}`);
                            } catch (e) {
                                console.error('[ExtractorsPanel] Evaluation Error:', e);
                                currentValue = "Error evaluating XPath";
                            }
                        }

                        return (
                            <ExtractorItem key={ex.id || index}>
                                <ExtractorInfo>
                                    <InfoRow>
                                        <Label>Variable:</Label>
                                        <VariableValue>{ex.variable}</VariableValue>
                                    </InfoRow>
                                    <InfoRow>
                                        <Label>Source:</Label>
                                        <span>{ex.source}</span>
                                    </InfoRow>
                                    <InfoRow>
                                        <Label>Path:</Label>
                                        <Value>{ex.path}</Value>
                                    </InfoRow>
                                    {ex.defaultValue && (
                                        <InfoRow>
                                            <DefaultLabel>Default:</DefaultLabel>
                                            <DefaultValue>{ex.defaultValue}</DefaultValue>
                                        </InfoRow>
                                    )}
                                    {currentValue !== null && (
                                        <InfoRow>
                                            <PreviewLabel>Preview:</PreviewLabel>
                                            <PreviewValue>
                                                {currentValue || "(No Match)"}
                                            </PreviewValue>
                                        </InfoRow>
                                    )}
                                </ExtractorInfo>
                                <ButtonGroup>
                                    {onEdit && (
                                        <IconButton onClick={() => onEdit(ex, index)} title="Edit Extractor">
                                            <Pencil size={16} />
                                        </IconButton>
                                    )}
                                    <DeleteButton onClick={() => handleDelete(index)} title="Delete Extractor">
                                        <Trash2 size={16} />
                                    </DeleteButton>
                                </ButtonGroup>
                            </ExtractorItem>
                        );
                    })
                )}
            </ExtractorList>
        </Container>
    );
};
