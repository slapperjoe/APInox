/**
 * QueryParamsPanel - Key-value editor for REST query parameters
 * Similar to HeadersPanel but for URL query strings
 */

import React from 'react';
import styled from 'styled-components';
import { Plus, Trash2 } from 'lucide-react';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
import { SPACING_XS, SPACING_SM } from '../styles/spacing';

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

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${SPACING_XS};
`;

const Title = styled.h3`
    margin: 0;
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

const IconButton = styled.button`
    background: transparent;
    border: none;
    color: var(--apinox-icon-foreground);
    cursor: pointer;
    padding: ${SPACING_XS};
    border-radius: 3px;
    display: flex;
    align-items: center;
    &:hover {
        background: var(--apinox-toolbar-hoverBackground);
        color: var(--apinox-foreground);
    }
`;

const Label = styled.div`
    font-size: 11px;
    color: var(--apinox-descriptionForeground);
    text-transform: uppercase;
    margin-bottom: ${SPACING_XS};
`;

const EmptyMessage = styled.div`
    opacity: 0.6;
    font-style: italic;
    padding: ${SPACING_SM};
    text-align: center;
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
        <Container>
            <Header>
                <Title>{title}</Title>
                {!readOnly && (
                    <IconButton onClick={addParam} title={`Add ${paramLabel}`}>
                        <Plus size={16} /> Add
                    </IconButton>
                )}
            </Header>

            {/* Column Headers */}
            <HeaderRow>
                <InputWrapper><Label>Key</Label></InputWrapper>
                <InputWrapper><Label>Value</Label></InputWrapper>
                {!readOnly && <Spacer />}
            </HeaderRow>

            {entries.length === 0 && (
                <EmptyMessage>
                    {readOnly ? `No ${title.toLowerCase()} defined.` : `No ${title.toLowerCase()} defined. Click "Add" to create one.`}
                </EmptyMessage>
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
                        <IconButton onClick={() => removeParam(key)} title={`Delete ${paramLabel}`}>
                            <Trash2 size={14} />
                        </IconButton>
                    )}
                </ParamRow>
            ))}

            {entries.length > 0 && (
                <PreviewBox>
                    <Label>Preview</Label>
                    ?{entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}
                </PreviewBox>
            )}
        </Container>
    );
};
