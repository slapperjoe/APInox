/**
 * QueryParamsPanel - Key-value editor for REST query parameters
 * Similar to HeadersPanel but for URL query strings
 */

import React, { useCallback, useRef, memo } from 'react';
import styled from 'styled-components';
import { EmptyState } from './common/EmptyState';
import { PanelContainer, PanelIconButton } from './common/PanelShell';
import { Plus, Trash2, Code } from 'lucide-react';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
import { SPACING_XS, SPACING_SM } from '../styles/spacing';
import type { EditorVariable } from '../types';

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
    /** Chain/workflow variables, forwarded to the single-line inputs for ${...} tooltips. */
    availableVariables?: EditorVariable[];
    /** Environment/global variables, forwarded to the single-line inputs for {{...}} tooltips. */
    availableEnvVariables?: EditorVariable[];
}

// Memoized row: stable handler identities let unchanged rows skip re-render
// when a different row changes (review item 3).
interface ParamRowItemProps {
    paramKey: string;
    value: string;
    readOnly: boolean;
    paramLabel: string;
    availableVariables?: EditorVariable[];
    availableEnvVariables?: EditorVariable[];
    updateParam: (oldKey: string, newKey: string, newValue: string) => void;
    removeParam: (key: string) => void;
}

const ParamRowItem = memo(function ParamRowItem({
    paramKey,
    value,
    readOnly,
    paramLabel,
    availableVariables,
    availableEnvVariables,
    updateParam,
    removeParam,
}: ParamRowItemProps) {
    return (
        <ParamRow>
            <InputWrapper>
                <MonacoSingleLineInput
                    value={paramKey}
                    onChange={(newKey: string) => updateParam(paramKey, newKey, value)}
                    placeholder="parameter_name"
                    readOnly={readOnly}
                    availableVariables={availableVariables}
                    availableEnvVariables={availableEnvVariables}
                />
            </InputWrapper>
            <InputWrapper>
                <MonacoSingleLineInput
                    value={value}
                    onChange={(newValue: string) => updateParam(paramKey, paramKey, newValue)}
                    placeholder="value"
                    readOnly={readOnly}
                    availableVariables={availableVariables}
                    availableEnvVariables={availableEnvVariables}
                />
            </InputWrapper>
            {!readOnly && (
                <PanelIconButton onClick={() => removeParam(paramKey)} title={`Delete ${paramLabel}`}>
                    <Trash2 size={14} />
                </PanelIconButton>
            )}
        </ParamRow>
    );
});

const QueryParamsPanelBase: React.FC<QueryParamsPanelProps> = ({
    params,
    onChange,
    title = 'Query Parameters',
    paramLabel = 'Param',
    readOnly = false,
    availableVariables,
    availableEnvVariables
}) => {
    const entries = Object.entries(params || {});

    const paramsRef = useRef(params);
    paramsRef.current = params;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const updateParam = useCallback((oldKey: string, newKey: string, newValue: string) => {
        if (readOnly) return;
        const newParams = { ...paramsRef.current };
        if (oldKey !== newKey) {
            delete newParams[oldKey];
        }
        newParams[newKey] = newValue;
        onChangeRef.current(newParams);
    }, [readOnly]);

    const removeParam = useCallback((key: string) => {
        if (readOnly) return;
        const newParams = { ...paramsRef.current };
        delete newParams[key];
        onChangeRef.current(newParams);
    }, [readOnly]);

    const addParam = () => {
        if (readOnly) return;
        const newParams = { ...paramsRef.current };
        let count = 1;
        while (newParams[`${paramLabel.toLowerCase()}${count}`]) count++;
        newParams[`${paramLabel.toLowerCase()}${count}`] = '';
        onChangeRef.current(newParams);
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
                <ParamRowItem
                    key={index}
                    paramKey={key}
                    value={value}
                    readOnly={readOnly}
                    paramLabel={paramLabel}
                    availableVariables={availableVariables}
                    availableEnvVariables={availableEnvVariables}
                    updateParam={updateParam}
                    removeParam={removeParam}
                />
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

// Perf (review item 3): memoize the panel.
export const QueryParamsPanel = memo(QueryParamsPanelBase);
