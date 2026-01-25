import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Plus, Trash2 } from 'lucide-react';
import { MockRule, MockMatchCondition } from '@shared/models';
import { Modal, Button } from './Modal';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_LG } from '../../styles/spacing';

const FormRow = styled.div`
    margin-bottom: ${SPACING_LG};
`;

const Label = styled.label`
    display: block;
    margin-bottom: ${SPACING_XS};
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
`;

const Input = styled.input`
    width: 100%;
    padding: ${SPACING_SM} 12px;
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    font-size: 13px;

    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
`;

const Select = styled.select`
    padding: ${SPACING_SM} 12px;
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;

    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
`;

const Textarea = styled.textarea`
    width: 100%;
    min-height: 200px;
    padding: ${SPACING_SM} 12px;
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    font-size: 13px;
    font-family: monospace;
    resize: vertical;

    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
`;

const CheckboxRow = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
`;

const CheckboxInput = styled.input`
    width: 16px;
    height: 16px;
    cursor: pointer;
`;

const CheckboxLabel = styled.label`
    font-size: 13px;
    cursor: pointer;
`;

const ConditionsHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${SPACING_SM};
`;

const AddConditionButton = styled.button`
    background: none;
    border: 1px solid var(--vscode-button-background);
    color: var(--vscode-button-background);
    cursor: pointer;
    padding: 4px ${SPACING_SM};
    border-radius: 4px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;

    &:hover {
        background-color: var(--vscode-toolbar-hoverBackground);
    }
`;

const ConditionItem = styled.div`
    display: flex;
    gap: ${SPACING_SM};
    margin-bottom: ${SPACING_SM};
    padding: ${SPACING_SM};
    background-color: var(--vscode-editor-inactiveSelectionBackground);
    border-radius: 4px;
`;

const RemoveButton = styled.button<{ $disabled?: boolean }>`
    background: none;
    border: none;
    cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
    color: ${props => props.$disabled ? 'var(--vscode-disabledForeground)' : 'var(--vscode-testing-iconFailed)'};
    padding: 4px;

    &:hover:not(:disabled) {
        opacity: 0.8;
    }
`;

const ThreeColumnRow = styled.div`
    display: flex;
    gap: ${SPACING_LG};
    margin-bottom: ${SPACING_LG};
`;

const Column = styled.div`
    flex: 1;
`;

const SecondaryButton = styled(Button)`
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);

    &:hover {
        background-color: var(--vscode-button-secondaryHoverBackground);
    }
`;

interface MockRuleModalProps {
    open: boolean;
    rule?: MockRule | null;
    onClose: () => void;
    onSave: (rule: MockRule) => void;
}

const CONDITION_TYPES: { value: MockMatchCondition['type'], label: string }[] = [
    { value: 'soapAction', label: 'SOAPAction' },
    { value: 'operation', label: 'Operation Name' },
    { value: 'url', label: 'URL Path' },
    { value: 'contains', label: 'Body Contains' },
    { value: 'xpath', label: 'XPath' },
    { value: 'header', label: 'Header' }
];

const DEFAULT_RESPONSE = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Response>
      <Result>Mock Response</Result>
    </Response>
  </soap:Body>
</soap:Envelope>`;

export const MockRuleModal: React.FC<MockRuleModalProps> = ({
    open,
    rule,
    onClose,
    onSave
}) => {
    const [name, setName] = useState('');
    const [conditions, setConditions] = useState<MockMatchCondition[]>([]);
    const [statusCode, setStatusCode] = useState(200);
    const [responseBody, setResponseBody] = useState(DEFAULT_RESPONSE);
    const [contentType, setContentType] = useState('text/xml; charset=utf-8');
    const [delayMs, setDelayMs] = useState(0);
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        if (rule) {
            setName(rule.name);
            setConditions([...rule.conditions]);
            setStatusCode(rule.statusCode);
            setResponseBody(rule.responseBody);
            setContentType(rule.contentType || 'text/xml; charset=utf-8');
            setDelayMs(rule.delayMs || 0);
            setEnabled(rule.enabled);
        } else {
            // Reset for new rule
            setName('');
            setConditions([{ type: 'contains', pattern: '' }]);
            setStatusCode(200);
            setResponseBody(DEFAULT_RESPONSE);
            setContentType('text/xml; charset=utf-8');
            setDelayMs(0);
            setEnabled(true);
        }
    }, [rule, open]);

    const handleSave = () => {
        const validConditions = conditions.filter(c => c.pattern.trim());
        if (validConditions.length === 0) return;

        const newRule: MockRule = {
            id: rule?.id || `mock-${Date.now()}`,
            name: name || 'Unnamed Rule',
            enabled,
            conditions: validConditions,
            statusCode,
            responseBody,
            contentType,
            delayMs: delayMs > 0 ? delayMs : undefined,
            hitCount: rule?.hitCount || 0
        };
        onSave(newRule);
        onClose();
    };

    const addCondition = () => {
        setConditions([...conditions, { type: 'contains', pattern: '' }]);
    };

    const updateCondition = (index: number, updates: Partial<MockMatchCondition>) => {
        setConditions(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
    };

    const removeCondition = (index: number) => {
        if (conditions.length > 1) {
            setConditions(conditions.filter((_, i) => i !== index));
        }
    };

    const hasValidConditions = conditions.some(c => c.pattern.trim());

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={rule ? 'Edit Mock Rule' : 'Add Mock Rule'}
            size="medium"
            footer={<>
                <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                <Button onClick={handleSave} disabled={!hasValidConditions}>
                    {rule ? 'Save' : 'Add Rule'}
                </Button>
            </>}
        >
            {/* Name */}
            <FormRow>
                <Label>Rule Name *</Label>
                <Input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g., GetCustomer Success Response"
                />
            </FormRow>

            {/* Match Conditions */}
            <FormRow>
                <ConditionsHeader>
                    <Label style={{ marginBottom: 0 }}>Match Conditions (AND)</Label>
                    <AddConditionButton onClick={addCondition}>
                        <Plus size={12} /> Add
                    </AddConditionButton>
                </ConditionsHeader>

                {conditions.map((condition, index) => (
                    <ConditionItem key={index}>
                        <Select
                            value={condition.type}
                            onChange={e => updateCondition(index, { type: e.target.value as MockMatchCondition['type'] })}
                            style={{ width: 140 }}
                        >
                            {CONDITION_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </Select>

                        {condition.type === 'header' && (
                            <Input
                                type="text"
                                value={condition.headerName || ''}
                                onChange={e => updateCondition(index, { headerName: e.target.value })}
                                placeholder="Header name"
                                style={{ width: 120 }}
                            />
                        )}

                        <Input
                            type="text"
                            value={condition.pattern}
                            onChange={e => updateCondition(index, { pattern: e.target.value })}
                            placeholder={
                                condition.type === 'xpath' ? '//ns:CustomerID' :
                                    condition.type === 'soapAction' ? 'http://example.com/GetCustomer' :
                                        'Match pattern...'
                            }
                            style={{ flex: 1 }}
                        />

                        <CheckboxLabel style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
                            <CheckboxInput
                                type="checkbox"
                                checked={condition.isRegex || false}
                                onChange={e => updateCondition(index, { isRegex: e.target.checked })}
                            />
                            Regex
                        </CheckboxLabel>

                        <RemoveButton
                            onClick={() => removeCondition(index)}
                            disabled={conditions.length === 1}
                            $disabled={conditions.length === 1}
                        >
                            <Trash2 size={14} />
                        </RemoveButton>
                    </ConditionItem>
                ))}
            </FormRow>

            {/* Response Configuration */}
            <ThreeColumnRow>
                <Column>
                    <Label>Status Code</Label>
                    <Input
                        type="number"
                        value={statusCode}
                        onChange={e => setStatusCode(parseInt(e.target.value) || 200)}
                    />
                </Column>
                <Column>
                    <Label>Content-Type</Label>
                    <Select
                        value={contentType}
                        onChange={e => setContentType(e.target.value)}
                    >
                        <option value="text/xml; charset=utf-8">text/xml</option>
                        <option value="application/soap+xml; charset=utf-8">application/soap+xml</option>
                        <option value="application/json">application/json</option>
                        <option value="text/plain">text/plain</option>
                    </Select>
                </Column>
                <Column>
                    <Label>Delay (ms)</Label>
                    <Input
                        type="number"
                        value={delayMs}
                        onChange={e => setDelayMs(parseInt(e.target.value) || 0)}
                        min={0}
                    />
                </Column>
            </ThreeColumnRow>

            {/* Response Body */}
            <FormRow>
                <Label>Response Body *</Label>
                <Textarea
                    value={responseBody}
                    onChange={e => setResponseBody(e.target.value)}
                    placeholder="Enter response XML/JSON..."
                />
            </FormRow>

            {/* Enabled */}
            <CheckboxRow>
                <CheckboxInput
                    type="checkbox"
                    id="ruleEnabled"
                    checked={enabled}
                    onChange={e => setEnabled(e.target.checked)}
                />
                <CheckboxLabel htmlFor="ruleEnabled">
                    Enabled
                </CheckboxLabel>
            </CheckboxRow>
        </Modal>
    );
};
