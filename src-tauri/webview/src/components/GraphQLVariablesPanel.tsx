/**
 * GraphQLVariablesPanel - JSON editor for GraphQL variables
 */

import React from 'react';
import styled from 'styled-components';
import Editor from '@monaco-editor/react';
import { SPACING_XS, SPACING_SM } from '../styles/spacing';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    overflow: hidden;
`;

const Header = styled.div`
    padding: ${SPACING_SM}px 15px;
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const EditorContainer = styled.div`
    flex: 1;
    overflow: hidden;
`;

const Hint = styled.div`
    padding: ${SPACING_SM}px 15px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-textBlockQuote-background);
    border-top: 1px solid var(--vscode-panel-border);
`;

const ErrorBanner = styled.div`
    padding: ${SPACING_SM}px 15px;
    font-size: 12px;
    color: var(--vscode-errorForeground);
    background: var(--vscode-inputValidation-errorBackground);
    border-top: 1px solid var(--vscode-inputValidation-errorBorder);
`;

const Title = styled.h3`
    margin: 0;
`;

const OperationWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM}px;
`;

const OperationLabel = styled.label`
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
`;

const OperationInput = styled.input`
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: ${SPACING_XS}px ${SPACING_SM}px;
    border-radius: 3px;
    font-size: 12px;
    width: 150px;
`;

interface GraphQLVariablesPanelProps {
    variables?: Record<string, any>;
    operationName?: string;
    onChange: (variables: Record<string, any>) => void;
    onOperationNameChange?: (name: string) => void;
    readOnly?: boolean;
}

export const GraphQLVariablesPanel: React.FC<GraphQLVariablesPanelProps> = ({
    variables,
    operationName,
    onChange,
    onOperationNameChange,
    readOnly = false
}) => {
    const [error, setError] = React.useState<string | null>(null);

    // Convert variables object to JSON string for editing
    const jsonString = React.useMemo(() => {
        try {
            return JSON.stringify(variables || {}, null, 2);
        } catch {
            return '{}';
        }
    }, [variables]);

    const handleChange = (value: string | undefined) => {
        if (!value) {
            onChange({});
            setError(null);
            return;
        }

        try {
            const parsed = JSON.parse(value);
            onChange(parsed);
            setError(null);
        } catch (e: any) {
            setError(`Invalid JSON: ${e.message}`);
        }
    };

    return (
        <Container>
            <Header>
                <Title>GraphQL Variables</Title>
                {onOperationNameChange && (
                    <OperationWrapper>
                        <OperationLabel>
                            Operation:
                        </OperationLabel>
                        <OperationInput
                            type="text"
                            value={operationName || ''}
                            onChange={(e) => onOperationNameChange(e.target.value)}
                            placeholder="operationName"
                            disabled={readOnly}
                        />
                    </OperationWrapper>
                )}
            </Header>

            <EditorContainer>
                <Editor
                    height="100%"
                    language="json"
                    value={jsonString}
                    onChange={handleChange}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: 'off',
                        folding: false,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        readOnly,
                        automaticLayout: true,
                        tabSize: 2
                    }}
                />
            </EditorContainer>

            {error && <ErrorBanner>{error}</ErrorBanner>}

            <Hint>
                Variables are passed to your GraphQL query. Use $variableName in your query to reference them.
            </Hint>
        </Container>
    );
};
