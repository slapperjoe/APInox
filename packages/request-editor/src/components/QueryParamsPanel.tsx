/**
 * QueryParamsPanel - Key-value editor for REST query parameters
 * Similar to HeadersPanel but for URL query strings
 */

import React from 'react';
import styled from 'styled-components';
import { EmptyState } from './common/EmptyState';
import { PanelContainer, PanelIconButton } from './common/PanelShell';
import { Plus, Trash2, Code } from 'lucide-react';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
import { SPACING_XS, SPACING_SM } from '../styles/spacing';

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${SPACING_XS};
    gap: ${SPACING_SM};
    font-weight: 600;
    font-size: 0.95em;
    color: var(--apinox-foreground);
`;

const Title = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
`;

const ParamRow = styled.div`
    display: flex;
    gap: ${SPACING_SM};
    align-items: center;
`;

const HeaderRow = styled(ParamRow)`
    opacity: 0.7;
`;

const InputWrapper = styled.div`
    flex: 1;
`;

const Spacer = styled.div`
    width: 30px;
`;

const Label = styled.div`
    font-size: 11px;
    color: var(--apinox-descriptionForeground);
    text-transform: uppercase;
    margin-bottom: ${SPACING_XS};
`;


const PreviewBox = styled.div`
    margin-top: ${SPACING_SM};
    padding: ${SPACING_SM};
    background: var(--apinox-textBlockQuote-background);
    border-radius: 4px;
    font-size: 11px;
    font-family: monospace;
    word-break: break-all;
`;

interface QueryParamsPanelProps {
    params: Record<string, string>;
    onChange: (params: Record<string, string>) => void;
    title?: string;
    paramLabel?: string;
    readOnly?: boolean;
}

export const QueryParamsPanel: React.FC<QueryParamsPanelProps> = ({
    params,
    onChange,
    title = 'Query Parameters',
    paramLabel = 'Param',
    readOnly = false
}) => {
    const entries = Object.entries(params || {});

    const updateParam = (oldKey: string, newKey: string, newValue: string) => {
        if (readOnly) return;
        const newParams = { ...params };
        if (oldKey !== newKey) {
            delete newParams[oldKey];
        }
        newParams[newKey] = newValue;
        onChange(newParams);
    };

    const removeParam = (key: string) => {
        if (readOnly) return;
        const newParams = { ...params };
        delete newParams[key];
        onChange(newParams);
    };

    const addParam = () => {
        if (readOnly) return;
        const newParams = { ...params };
        let count = 1;
        while (newParams[`${paramLabel.toLowerCase()}${count}`]) count++;
        newParams[`${paramLabel.toLowerCase()}${count}`] = '';
        onChange(newParams);
    };

    return (
        <PanelContainer>
            <Header>
                <Title>
                    <Code size={16} />
                    {title}
                </Title>
                {!readOnly && (
                    <PanelIconButton onClick={addParam} title={`Add ${paramLabel}`}>
                        <Plus size={16} /> Add
                    </PanelIconButton>
                )}
            </Header>

            {/* Column Headers */}
            <HeaderRow>
                <InputWrapper><Label>Key</Label></InputWrapper>
                <InputWrapper><Label>Value</Label></InputWrapper>
                {!readOnly && <Spacer />}
            </HeaderRow>

            {entries.length === 0 && (
                <EmptyState title={readOnly ? `No ${title.toLowerCase()} defined.` : `No ${title.toLowerCase()} defined. Click "Add" to create one.`} />
            )}

            {entries.map(([key, value], index) => (
                <ParamRow key={index}>
                    <InputWrapper>
                        <MonacoSingleLineInput
                            value={key}
                            onChange={(newKey: string) => updateParam(key, newKey, value)}
                            placeholder="parameter_name"
                            readOnly={readOnly}
                        />
                    </InputWrapper>
                    <InputWrapper>
                        <MonacoSingleLineInput
                            value={value}
                            onChange={(newValue: string) => updateParam(key, key, newValue)}
                            placeholder="value"
                            readOnly={readOnly}
                        />
                    </InputWrapper>
                    {!readOnly && (
                        <PanelIconButton onClick={() => removeParam(key)} title={`Delete ${paramLabel}`}>
                            <Trash2 size={14} />
                        </PanelIconButton>
                    )}
                </ParamRow>
            ))}

            {entries.length > 0 && (
                <PreviewBox>
                    <Label>Preview</Label>
                    ?{entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}
                </PreviewBox>
            )}
        </PanelContainer>
    );
};
