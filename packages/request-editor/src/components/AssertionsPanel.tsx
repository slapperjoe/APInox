import React from 'react';
import styled from 'styled-components';
import { Trash2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Assertion } from '../types';
import { StatusCodePicker } from './StatusCodePicker';
import Editor from '@monaco-editor/react';
// import { ScriptPlaygroundModal } from './modals/ScriptPlaygroundModal'; // TODO: Add ScriptPlaygroundModal
const SPACING_XS = '4px';
const SPACING_SM = '8px';
const SPACING_MD = '16px';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    padding: ${SPACING_MD};
    height: 100%;
    overflow-y: auto;
    background-color: var(--apinox-editor-background);
`;

const Toolbar = styled.div`
    display: flex;
    gap: ${SPACING_MD};
    margin-bottom: ${SPACING_MD};
`;

const Button = styled.button`
    background: var(--apinox-button-background);
    color: var(--apinox-button-foreground);
    border: none;
    padding: ${SPACING_XS} ${SPACING_SM};
    border-radius: 2px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    &:hover { background: var(--apinox-button-hoverBackground); }
`;

const AssertionList = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_SM};
`;

const AssertionItem = styled.div`
    display: flex;
    align-items: center;
    padding: ${SPACING_SM};
    background: var(--apinox-list-hoverBackground);
    border: 1px solid var(--apinox-panel-border);
    border-radius: 4px;
    gap: ${SPACING_MD};
`;

const IconWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
`;

const Details = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
`;

const Title = styled.div`
    font-weight: bold;
`;

const ConfigText = styled.div`
    opacity: 0.8;
`;

const Input = styled.input`
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    padding: 2px ${SPACING_XS};
    margin-left: ${SPACING_SM};
`;

const Select = styled.select`
    background-color: var(--apinox-dropdown-background);
    color: var(--apinox-dropdown-foreground);
    border: 1px solid var(--apinox-dropdown-border);
    padding: ${SPACING_XS};
    outline: none;
    height: 26px;
    box-sizing: border-box;
    cursor: pointer;
    &:focus {
        border-color: var(--apinox-focusBorder);
    }
`;

const EmptyState = styled.div`
    opacity: 0.5;
    font-style: italic;
`;

const Label = styled.label`
    margin-left: ${SPACING_MD};
`;

const FieldRow = styled.div`
    display: flex;
    align-items: center;
`;

const FieldColumn = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_SM};
`;

const FieldLabel = styled.span`
    min-width: 60px;
`;

const FlexInput = styled(Input)`
    flex: 1;
`;

const FaultCodeSection = styled.div`
    margin-top: ${SPACING_SM};
    display: flex;
    align-items: center;
`;

const FaultCodeLabel = styled.span`
    margin-right: ${SPACING_SM};
`;

const StatusCodeSection = styled.div`
    margin-top: ${SPACING_SM};
`;

const StatusCodeLabel = styled.div`
    margin-bottom: ${SPACING_XS};
    font-size: 12px;
`;

const ScriptSection = styled.div`
    margin-top: ${SPACING_SM};
    width: 100%;
`;

const ScriptHeader = styled.div`
    margin-bottom: ${SPACING_XS};
    font-size: 11px;
    opacity: 0.7;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const Code = styled.code`
    background: var(--apinox-textCodeBlock-background);
    padding: 1px ${SPACING_XS};
    border-radius: 2px;
`;

const ScriptEditorWrapper = styled.div`
    border: 1px solid var(--apinox-input-border);
    border-radius: 4px;
    overflow: hidden;
`;

const SLAInput = styled(Input)`
    width: 60px;
`;

const CheckboxLabel = styled.label`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
`;

const TransparentButton = styled(Button)`
    background: transparent;
    color: var(--apinox-descriptionForeground);
`;

// TODO: Restore when ScriptPlaygroundModal is added
// const TestButton = styled(Button)`
//     font-size: 11px;
//     padding: 2px 6px;
//     height: 20px;
// `;

function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

interface AssertionsPanelProps {
    assertions: Assertion[];
    onChange: (assertions: Assertion[]) => void;
    lastResult?: Array<{ id: string; status: string }>;
}

export const AssertionsPanel: React.FC<AssertionsPanelProps> = ({ assertions, onChange, lastResult }) => {
    // const [playgroundScript] = React.useState<string | null>(null);
    // const [playgroundAssertionId] = React.useState<string | null>(null);

    const handleAdd = (type: Assertion['type']) => {
        const newAssertion: Assertion = {
            id: generateId(),
            type,
            name: type,
            enabled: true,
            configuration: {}
        };
        // Set defaults
        if (type === 'Response SLA') newAssertion.configuration = { sla: '200' };
        if (type === 'Simple Contains') newAssertion.configuration = { token: '', ignoreCase: true };
        if (type === 'Simple Not Contains') newAssertion.configuration = { token: '', ignoreCase: true };
        if (type === 'XPath Match') newAssertion.configuration = { xpath: '', expectedContent: '' };
        if (type === 'SOAP Fault') newAssertion.configuration = { expectFault: false };
        if (type === 'HTTP Status') newAssertion.configuration = { expectedStatus: '200' };
        if (type === 'Script') newAssertion.configuration = { script: '// return true to pass, false to fail\n// Available: response, statusCode\nreturn response.includes("Success");' };

        onChange([...assertions, newAssertion]);
    };

    const handleRemove = (id: string) => {
        onChange(assertions.filter(a => a.id !== id));
    };

    const updateConfig = (id: string, key: string, value: any) => {
        onChange(assertions.map(a => {
            if (a.id === id) {
                return { ...a, configuration: { ...a.configuration, [key]: value } };
            }
            return a;
        }));
    };

    const getStatus = (id: string) => {
        if (!lastResult) return null;
        // console.log('Checking status for', id, 'in', lastResult);
        const res = lastResult.find(r => r.id === id);
        return res ? res.status : null;
    };

    return (
        <Container>
            <Toolbar>
                <Select onChange={(e) => handleAdd(e.target.value as any)} value="">
                    <option value="" disabled style={{ color: 'var(--apinox-dropdown-foreground)' }}>+ Add Assertion</option>
                    <option value="Simple Contains">Contains</option>
                    <option value="Simple Not Contains">Not Contains</option>
                    <option value="Response SLA">Response SLA</option>
                    <option value="XPath Match">XPath Match</option>
                    <option value="SOAP Fault">SOAP Fault</option>
                    <option value="HTTP Status">HTTP Status</option>
                    <option value="Script">Script (JavaScript)</option>
                </Select>
            </Toolbar>

            <AssertionList>
                {assertions.length === 0 && <EmptyState>No assertions defined.</EmptyState>}

                {assertions.map((a, i) => {
                    const status = getStatus(a.id || '');
                    return (
                        <AssertionItem key={a.id || i}>
                            <IconWrapper title={status || 'Not Run'}>
                                {status === 'PASS' ? <CheckCircle2 size={18} color="var(--apinox-testing-iconPassed)" /> :
                                    status === 'FAIL' ? <XCircle size={18} color="var(--apinox-testing-iconFailed)" /> :
                                        <Clock size={18} opacity={0.5} />}
                            </IconWrapper>
                            <Details>
                                <Title>{a.name || a.type}</Title>
                                <ConfigText>
                                    {(a.type === 'Simple Contains' || a.type === 'Simple Not Contains') && (
                                        <>
                                            Token:
                                            <Input
                                                value={a.configuration?.token || ''}
                                                onChange={(e) => updateConfig(a.id!, 'token', e.target.value)}
                                                placeholder="Text to check"
                                            />
                                            <Label>
                                                <input
                                                    type="checkbox"
                                                    checked={a.configuration?.ignoreCase}
                                                    onChange={(e) => updateConfig(a.id!, 'ignoreCase', e.target.checked)}
                                                /> Ignore Case
                                            </Label>
                                        </>
                                    )}
                                    {a.type === 'Response SLA' && (
                                        <>
                                            Limit (ms):
                                            <SLAInput
                                                type="number"
                                                value={a.configuration?.sla || ''}
                                                onChange={(e) => updateConfig(a.id!, 'sla', e.target.value)}
                                            />
                                        </>
                                    )}
                                    {a.type === 'XPath Match' && (
                                        <FieldColumn>
                                            <FieldRow>
                                                <FieldLabel>XPath:</FieldLabel>
                                                <FlexInput
                                                    value={a.configuration?.xpath || ''}
                                                    onChange={(e) => updateConfig(a.id!, 'xpath', e.target.value)}
                                                    placeholder="//ns:Node"
                                                />
                                            </FieldRow>
                                            <FieldRow>
                                                <FieldLabel>Expected:</FieldLabel>
                                                <FlexInput
                                                    value={a.configuration?.expectedContent || ''}
                                                    onChange={(e) => updateConfig(a.id!, 'expectedContent', e.target.value)}
                                                    placeholder="Value"
                                                />
                                            </FieldRow>
                                        </FieldColumn>
                                    )}
                                    {a.type === 'SOAP Fault' && (
                                        <>
                                            <CheckboxLabel>
                                                <input
                                                    type="checkbox"
                                                    checked={a.configuration?.expectFault === true}
                                                    onChange={(e) => updateConfig(a.id!, 'expectFault', e.target.checked)}
                                                />
                                                Expect Fault
                                            </CheckboxLabel>
                                            <FaultCodeSection>
                                                <FaultCodeLabel>Fault Code:</FaultCodeLabel>
                                                <Input
                                                    value={a.configuration?.faultCode || ''}
                                                    onChange={(e) => updateConfig(a.id!, 'faultCode', e.target.value)}
                                                    placeholder="Optional (e.g. Client)"
                                                    style={{ width: 140 }}
                                                />
                                            </FaultCodeSection>
                                        </>
                                    )}
                                    {a.type === 'HTTP Status' && (
                                        <StatusCodeSection>
                                            <StatusCodeLabel>Expected Codes:</StatusCodeLabel>
                                            <StatusCodePicker
                                                value={a.configuration?.expectedStatus || ''}
                                                onChange={(val) => updateConfig(a.id!, 'expectedStatus', val)}
                                            />
                                        </StatusCodeSection>
                                    )}
                                    {a.type === 'Script' && (
                                        <ScriptSection>
                                            <ScriptHeader>
                                                <span>
                                                    Return <Code>true</Code> to pass, <Code>false</Code> to fail.
                                                    Available: <Code>response</Code>, <Code>statusCode</Code>
                                                </span>
                                                {/* TODO: Restore ScriptPlaygroundModal button */}
                                            </ScriptHeader>
                                            <ScriptEditorWrapper>
                                                <Editor
                                                    height="100px"
                                                    defaultLanguage="javascript"
                                                    theme="vs-dark"
                                                    value={a.configuration?.script || ''}
                                                    onChange={(val) => updateConfig(a.id!, 'script', val || '')}
                                                    onMount={(editor, monaco) => {
                                                        // Fix Enter key to insert newline
                                                        editor.addAction({
                                                            id: 'insert-newline',
                                                            label: 'Insert Newline',
                                                            keybindings: [monaco.KeyCode.Enter],
                                                            run: (ed) => {
                                                                ed.trigger('keyboard', 'type', { text: '\n' });
                                                            }
                                                        });
                                                    }}
                                                    options={{
                                                        minimap: { enabled: false },
                                                        scrollBeyondLastLine: false,
                                                        fontSize: 12,
                                                        lineNumbers: 'off',
                                                        folding: false,
                                                        glyphMargin: false,
                                                        lineDecorationsWidth: 0,
                                                        lineNumbersMinChars: 0,
                                                        automaticLayout: true,
                                                        acceptSuggestionOnEnter: 'off',
                                                        quickSuggestions: false,
                                                    }}
                                                />
                                            </ScriptEditorWrapper>
                                        </ScriptSection>
                                    )}
                                </ConfigText>
                            </Details>
                            <TransparentButton onClick={() => handleRemove(a.id!)} title="Delete Assertion">
                                <Trash2 size={16} />
                            </TransparentButton>
                        </AssertionItem>
                    );
                })}
            </AssertionList>

            {/* TODO: Add ScriptPlaygroundModal component
            {playgroundScript !== null && (
                <ScriptPlaygroundModal
                    scriptType="assertion"
                    initialScript={playgroundScript}
                    onClose={() => {
                        setPlaygroundScript(null);
                        setPlaygroundAssertionId(null);
                    }}
                    onApplyScript={(newScript) => {
                        if (playgroundAssertionId) {
                            updateConfig(playgroundAssertionId, 'script', newScript);
                        }
                    }}
                />
            )}
            */}
        </Container>
    );
};
