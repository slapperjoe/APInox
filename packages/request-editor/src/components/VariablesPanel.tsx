import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Variable, CheckCircle, XCircle, Circle, Copy } from 'lucide-react';
import { CustomXPathEvaluator } from '../utils/xpathEvaluator';

// Stub TestCase type
interface TestCase {
    id: string;
    name: string;
    steps: Array<{
        id: string;
        name: string;
        type: string;
        config?: {
            request?: {
                extractors?: Array<{
                    id: string;
                    variable: string;
                    source: string;
                    path: string;
                    defaultValue?: string;
                    type?: string;
                }>;
            };
        };
    }>;
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--apinox-foreground);
    background: var(--apinox-editor-background);
    padding: 16px;
    gap: 16px;
    overflow-y: auto;
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--apinox-foreground);
`;

const EmptyMessage = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--apinox-descriptionForeground);
    text-align: center;
    padding: 32px;
    
    svg {
        opacity: 0.5;
    }
`;

const VariablesList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const VariableItem = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--apinox-input-background);
    border: 1px solid var(--apinox-input-border);
    border-radius: 4px;
    transition: all 0.2s;

    &:hover {
        background: var(--apinox-list-hoverBackground);
        border-color: var(--apinox-focusBorder);
    }
`;

const StatusIcon = styled.div<{ status: 'extracted' | 'pending' | 'failed' }>`
    display: flex;
    align-items: center;
    color: ${props => {
        if (props.status === 'extracted') return 'var(--apinox-testing-iconPassed)';
        if (props.status === 'failed') return 'var(--apinox-testing-iconFailed)';
        return 'var(--apinox-descriptionForeground)';
    }};
    opacity: ${props => props.status === 'pending' ? 0.5 : 1};
`;

const VariableInfo = styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const VariableName = styled.div`
    font-family: var(--apinox-editor-font-family);
    font-size: 13px;
    font-weight: 500;
    color: var(--apinox-textLink-foreground);
`;

const VariableMeta = styled.div`
    font-size: 11px;
    color: var(--apinox-descriptionForeground);
`;

const VariableValue = styled.div`
    font-family: var(--apinox-editor-font-family);
    font-size: 12px;
    color: var(--apinox-foreground);
    background: var(--apinox-editor-background);
    padding: 4px 8px;
    border-radius: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const CopyButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    background: transparent;
    border: 1px solid var(--apinox-input-border);
    border-radius: 3px;
    color: var(--apinox-foreground);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        background: var(--apinox-button-hoverBackground);
        border-color: var(--apinox-focusBorder);
    }

    &:active {
        transform: scale(0.95);
    }
`;

interface VariablesPanelProps {
    testCase: TestCase | null;
    currentStepId: string | null;
    testExecution: Record<string, Record<string, any>>;
}

export const VariablesPanel: React.FC<VariablesPanelProps> = ({
    testCase,
    currentStepId,
    testExecution
}) => {
    const availableVariables = useMemo(() => {
        if (!testCase || !currentStepId) return [];

        const currentIndex = testCase.steps.findIndex(s => s.id === currentStepId);
        if (currentIndex <= 0) return [];

        const priorSteps = testCase.steps.slice(0, currentIndex);
        const vars: Array<{
            name: string;
            value: string | null;
            source: string;
            xpath: string;
            status: 'extracted' | 'pending' | 'failed';
        }> = [];

        priorSteps.forEach(step => {
            if (step.type === 'request' && step.config?.request?.extractors) {
                step.config.request.extractors.forEach(ext => {
                    const stepExec = testExecution?.[testCase.id]?.[step.id];
                    let value: string | null = null;
                    let status: 'extracted' | 'pending' | 'failed' = 'pending';

                    if (stepExec?.response) {
                        const rawResp = stepExec.response.rawResponse ||
                            (typeof stepExec.response.result === 'string'
                                ? stepExec.response.result
                                : JSON.stringify(stepExec.response.result));

                        if (rawResp && ext.source === 'body') {
                            try {
                                value = CustomXPathEvaluator.evaluate(rawResp, ext.path);
                                if (value) {
                                    status = 'extracted';
                                } else if (ext.defaultValue) {
                                    value = ext.defaultValue;
                                    status = 'extracted';
                                } else {
                                    status = 'failed';
                                }
                            } catch (e) {
                                if (ext.defaultValue) {
                                    value = ext.defaultValue;
                                    status = 'extracted';
                                } else {
                                    status = 'failed';
                                }
                            }
                        }
                    } else if (ext.defaultValue) {
                        value = ext.defaultValue;
                        status = 'extracted';
                    }

                    vars.push({
                        name: ext.variable,
                        value,
                        source: step.name,
                        xpath: ext.path,
                        status
                    });
                });
            }
        });

        return vars;
    }, [testCase, currentStepId, testExecution]);

    const handleCopy = (varName: string) => {
        navigator.clipboard.writeText(`\${${varName}}`);
    };

    if (availableVariables.length === 0) {
        return (
            <Container>
                <Header>
                    <Variable size={16} />
                    Available Variables
                </Header>
                <EmptyMessage>
                    <Variable size={48} />
                    <div>
                        <strong>No variables available</strong>
                        <div style={{ fontSize: '12px', marginTop: '8px' }}>
                            Add extractors to prior steps to capture values from responses.
                            <br />
                            Variables can be used in subsequent requests using <code>${'{variableName}'}</code> syntax.
                        </div>
                    </div>
                </EmptyMessage>
            </Container>
        );
    }

    return (
        <Container>
            <Header>
                <Variable size={16} />
                Available Variables ({availableVariables.length})
            </Header>
            <VariablesList>
                {availableVariables.map((variable, index) => (
                    <VariableItem key={`${variable.name}-${index}`}>
                        <StatusIcon status={variable.status}>
                            {variable.status === 'extracted' && <CheckCircle size={18} />}
                            {variable.status === 'failed' && <XCircle size={18} />}
                            {variable.status === 'pending' && <Circle size={18} />}
                        </StatusIcon>
                        <VariableInfo>
                            <VariableName>${'{' + variable.name + '}'}</VariableName>
                            <VariableMeta>
                                From: {variable.source} • XPath: {variable.xpath}
                            </VariableMeta>
                            {variable.value && (
                                <VariableValue title={variable.value}>
                                    {variable.value}
                                </VariableValue>
                            )}
                        </VariableInfo>
                        <CopyButton
                            onClick={() => handleCopy(variable.name)}
                            title="Copy variable syntax"
                        >
                            <Copy size={14} />
                        </CopyButton>
                    </VariableItem>
                ))}
            </VariablesList>
        </Container>
    );
};
