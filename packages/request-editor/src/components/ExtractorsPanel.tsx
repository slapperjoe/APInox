import React from 'react';
import styled from 'styled-components';
import { Trash2, Pencil, Variable } from 'lucide-react';
import { CustomXPathEvaluator } from '../utils/xpathEvaluator';
import { RequestExtractor } from '../types';
const SPACING_XS = '4px';
const SPACING_SM = '8px';
const SPACING_MD = '16px';
const SPACING_LG = '24px';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: auto;
    padding: ${SPACING_SM};
    gap: ${SPACING_SM};
    font-family: var(--apinox-font-family);
    color: var(--apinox-foreground);
    background-color: var(--apinox-editor-background);
`;

const Toolbar = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: ${SPACING_SM};
    margin-bottom: ${SPACING_XS};
`;

const ExtractorList = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_SM};
`;

const ExtractorItem = styled.div`
    display: flex;
    padding: ${SPACING_SM};
    border: 1px solid var(--apinox-panel-border);
    background-color: var(--apinox-list-hoverBackground);
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
    color: var(--apinox-textLink-foreground);
    min-width: 80px;
    font-size: 0.9em;
`;

const Value = styled.code`
    background: var(--apinox-textCodeBlock-background);
    padding: 2px ${SPACING_XS};
    border-radius: 3px;
    font-family: monospace;
    word-break: break-all;
    font-size: 0.9em;
`;

const IconButton = styled.button`
    background: transparent;
    color: var(--apinox-icon-foreground);
    border: none;
    cursor: pointer;
    padding: ${SPACING_XS};
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;

    &:hover {
        opacity: 1;
        background-color: var(--apinox-toolbar-hoverBackground);
        border-radius: 3px;
    }
`;

const ButtonGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XS};
`;

const ToolbarTitle = styled.div`
    font-weight: 600;
    font-size: 0.95em;
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    color: var(--apinox-foreground);
`;

const EmptyState = styled.div`
    padding: ${SPACING_LG};
    opacity: 0.7;
    font-style: italic;
    text-align: center;
`;

const VariableValue = styled(Value)`
    color: var(--apinox-debugTokenExpression-name);
`;

const DefaultLabel = styled(Label)`
    color: var(--apinox-editorInfo-foreground);
`;

const DefaultValue = styled(Value)`
    color: var(--apinox-editorInfo-foreground);
`;

const PreviewLabel = styled(Label)`
    color: var(--apinox-testing-iconPassed);
`;

const PreviewValue = styled(Value)`
    border-color: var(--apinox-testing-iconPassed);
    border: 1px solid transparent;
    background-color: var(--apinox-editor-inactiveSelectionBackground);
`;

const DeleteButton = styled(IconButton)`
    color: var(--apinox-errorForeground);
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
                <ToolbarTitle>
                    <Variable size={16} />
                    Context Variables extracted from this Step
                </ToolbarTitle>
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
                                if (ex.type === 'Regex') {
                                    // Use regex extraction (will be handled by backend)
                                    // For now, show pattern
                                    currentValue = `(Regex extraction - run step to see result)`;
                                } else {
                                    // Default to XPath for backward compatibility
                                    const pathValue = ex.path || ex.query;
                                    if (pathValue) {
                                        currentValue = CustomXPathEvaluator.evaluate(rawResponse, pathValue);
                                    }
                                }
                                console.log(`[ExtractorsPanel] Type: ${ex.type || 'XPath'}, Expr: ${ex.path || ex.query}, Val: ${currentValue}`);
                            } catch (e) {
                                console.error('[ExtractorsPanel] Evaluation Error:', e);
                                currentValue = "Error evaluating expression";
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
                                    {ex.type && (
                                        <InfoRow>
                                            <Label>Type:</Label>
                                            <span>{ex.type}</span>
                                        </InfoRow>
                                    )}
                                    <InfoRow>
                                        <Label>{ex.type === 'Regex' ? 'Pattern:' : 'Path:'}</Label>
                                        <Value>{ex.path || ex.query}</Value>
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
