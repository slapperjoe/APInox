import React, { useCallback, useRef, useEffect, useState, memo } from 'react';
import styled from 'styled-components';
import { EmptyState } from './common/EmptyState';
import { PanelContainer, PanelIconButton, PanelFlexColumn } from './common/PanelShell';
import { Tooltip } from '../../components/common/Tooltip';
import { Plus, Trash2, List } from 'lucide-react';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
import { SPACING_XS, SPACING_SM } from '../styles/spacing';
import type { EditorVariable } from '../types';
import {
    CONTENT_TYPE_OPTIONS,
    CONTENT_TYPE_OTHER,
    findContentTypeHeader,
    isStandardContentType,
} from '../utils/contentType';

const HeaderRow = styled.div<{ $dimmed?: boolean }>`
    display: flex;
    gap: ${SPACING_SM};
    align-items: center;
    opacity: ${props => props.$dimmed ? 0.7 : 1};
`;

const HeaderTitle = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${SPACING_XS};
    gap: ${SPACING_SM};
    font-weight: var(--fw-semibold);
    font-size: 0.95em;
    color: var(--apinox-foreground);
`;

const ReadOnlyField = styled.div`
    padding: 6px ${SPACING_SM};
    background: var(--apinox-input-background);
    border: 1px solid var(--apinox-input-border);
    border-radius: ${SPACING_XS};
    color: var(--apinox-disabledForeground);
    font-family: monospace;
    font-size: 12px;
`;

const ContentTypeValue = styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
`;

const CustomContentTypeValue = styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
`;

const ContentTypeSelect = styled.select<{ $custom?: boolean }>`
    /* The dropdown takes the remaining space. When "Other…" is active the
       header name keeps its size and the dropdown is the thing that shrinks —
       it keeps just enough width for its current value and the text box gets
       the rest. */
    flex: ${props => (props.$custom ? '0 0 140px' : '1')};
    min-width: 0;
    padding: 6px ${SPACING_SM};
    background: var(--apinox-input-background);
    border: 1px solid var(--apinox-input-border);
    border-radius: ${SPACING_XS};
    color: var(--apinox-input-foreground);
    font-family: monospace;
    font-size: 12px;
    cursor: pointer;
`;

const HintText = styled.div`
    font-size: 10px;
    opacity: 0.5;
    margin-top: 4px;
    color: var(--apinox-descriptionForeground);
`;

interface HeadersPanelProps {
    headers: Record<string, string>;
    onChange: (headers: Record<string, string>) => void;
    /**
     * Content-Type to show when the request has no `Content-Type` header yet —
     * the value the app would default to (WSDL / interface resolution, or the
     * stored mirror). The dropdown below writes the header, and the header is
     * what is sent. Falls back to 'application/soap+xml' when omitted.
     */
    contentType?: string;
    /** Chain/workflow variables, forwarded to the single-line inputs for ${...} tooltips. */
    availableVariables?: EditorVariable[];
    /** Environment/global variables, forwarded to the single-line inputs for {{...}} tooltips. */
    availableEnvVariables?: EditorVariable[];
}

// Memoized row: stable handler identities (the panel's useCallback handlers read
// refs, so they do not change when a sibling row edits) let unchanged rows skip
// re-render when one row changes.
interface HeaderRowItemProps {
    headerKey: string;
    value: string;
    availableVariables?: EditorVariable[];
    availableEnvVariables?: EditorVariable[];
    updateHeader: (oldKey: string, newKey: string, newValue: string) => void;
    removeHeader: (key: string) => void;
}

const HeaderRowItem = memo(function HeaderRowItem({
    headerKey,
    value,
    availableVariables,
    availableEnvVariables,
    updateHeader,
    removeHeader,
}: HeaderRowItemProps) {
    return (
        <HeaderRow>
            <PanelFlexColumn>
                <MonacoSingleLineInput
                    value={headerKey}
                    onChange={(newKey: string) => updateHeader(headerKey, newKey, value)}
                    placeholder="Header Name"
                    availableVariables={availableVariables}
                    availableEnvVariables={availableEnvVariables}
                />
            </PanelFlexColumn>
            <PanelFlexColumn>
                <MonacoSingleLineInput
                    value={value}
                    onChange={(newValue: string) => updateHeader(headerKey, headerKey, newValue)}
                    placeholder="Value"
                    availableVariables={availableVariables}
                    availableEnvVariables={availableEnvVariables}
                />
            </PanelFlexColumn>
            <Tooltip content="Delete Header">
                <PanelIconButton onClick={() => removeHeader(headerKey)}>
                    <Trash2 size={14} />
                </PanelIconButton>
            </Tooltip>
        </HeaderRow>
    );
});

const HeadersPanelBase: React.FC<HeadersPanelProps> = ({
    headers,
    onChange,
    contentType,
    availableVariables,
    availableEnvVariables,
}) => {
    const defaultContentType = contentType || 'application/soap+xml';
    const currentContentType = findContentTypeHeader(headers) || defaultContentType;
    // A stored value outside the fixed list (a captured header carrying
    // `action="urn:..."`, for example) is a custom one, so the row opens in
    // "Other" mode and the value is preserved verbatim rather than snapped to
    // the nearest standard option.
    const isCustom = !isStandardContentType(currentContentType);
    // "Other…" is a mode, not a value. It is re-derived when the displayed
    // value changes (a different request selected, or the custom value replaced)
    // rather than in an effect, so the row never shows "Other…" against a value
    // that is actually one of the standard options.
    const [customMode, setCustomMode] = useState(isCustom);
    const [lastContentType, setLastContentType] = useState(currentContentType);
    if (currentContentType !== lastContentType) {
        setLastContentType(currentContentType);
        setCustomMode(isCustom);
    }
    const showCustomInput = customMode || isCustom;

    // Content-Type has its own row above, so it is filtered out of the editable
    // table (the table would otherwise show a duplicate, renameable row).
    const entries = Object.entries(headers || {}).filter(([key]) => key.toLowerCase() !== 'content-type');

    // Refs + stable handlers: the row callbacks keep a constant identity so
    // memoized rows skip re-render when a different row changes.
    // Synced in an effect rather than during render — writing refs in the render
    // phase is unsafe under concurrent rendering and StrictMode double-invocation.
    const headersRef = useRef(headers);
    const onChangeRef = useRef(onChange);
    useEffect(() => { headersRef.current = headers; }, [headers]);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    const updateHeader = useCallback((oldKey: string, newKey: string, newValue: string) => {
        // Content-Type has its own row (the dropdown above), so a second row
        // with that name would be a duplicate — ignore it.
        if (newKey.toLowerCase() === 'content-type') {
            return;
        }
        const newHeaders = { ...headersRef.current };
        if (oldKey !== newKey) {
            delete newHeaders[oldKey];
        }
        newHeaders[newKey] = newValue;
        onChangeRef.current(newHeaders);
    }, []);

    const removeHeader = useCallback((key: string) => {
        const newHeaders = { ...headersRef.current };
        delete newHeaders[key];
        onChangeRef.current(newHeaders);
    }, []);

    const addHeader = () => {
        const newHeaders = { ...headersRef.current };
        // Find unique key
        let count = 1;
        while (newHeaders[`Header${count}`]) count++;
        newHeaders[`Header${count}`] = '';
        onChangeRef.current(newHeaders);
    };

    // The single write path for Content-Type: the header the dropdown (or the
    // custom input) chooses IS what gets sent, so it is written straight into
    // the headers record under the canonical `Content-Type` key.
    const setContentType = useCallback((value: string) => {
        const newHeaders = { ...headersRef.current };
        for (const key of Object.keys(newHeaders)) {
            if (key.toLowerCase() === 'content-type') delete newHeaders[key];
        }
        const trimmed = value.trim();
        if (trimmed !== '') {
            newHeaders['Content-Type'] = trimmed;
        }
        onChangeRef.current(newHeaders);
    }, []);

    const handleContentTypeSelect = (picked: string) => {
        if (picked === CONTENT_TYPE_OTHER) {
            setCustomMode(true);
            return;
        }
        setCustomMode(false);
        setContentType(picked);
    };

    return (
        <PanelContainer>
            <HeaderTitle>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <List size={16} />
                    HTTP Headers
                </div>
                <PanelIconButton onClick={addHeader} title="Add Header">
                    <Plus size={16} /> Add
                </PanelIconButton>
            </HeaderTitle>

            {/* Content-Type row — the only place Content-Type is chosen. The
                header name is fixed; the value is a dropdown of the common
                types, and "Other…" turns it into a free-text value. The name
                column keeps its width in both states: the dropdown is what
                shrinks when the text box appears. */}
            <HeaderRow>
                <PanelFlexColumn>
                    <ReadOnlyField title="Content-Type (fixed header name)">
                        Content-Type
                    </ReadOnlyField>
                </PanelFlexColumn>
                <ContentTypeValue>
                    <ContentTypeSelect
                        $custom={showCustomInput}
                        aria-label="Content-Type"
                        title="Content-Type sent with this request"
                        value={showCustomInput ? CONTENT_TYPE_OTHER : currentContentType}
                        onChange={(e) => handleContentTypeSelect(e.target.value)}
                    >
                        {CONTENT_TYPE_OPTIONS.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                        <option value={CONTENT_TYPE_OTHER}>Other…</option>
                    </ContentTypeSelect>
                    {showCustomInput && (
                        <CustomContentTypeValue>
                            <MonacoSingleLineInput
                                value={currentContentType}
                                onChange={setContentType}
                                placeholder="Custom Content-Type"
                                availableVariables={availableVariables}
                                availableEnvVariables={availableEnvVariables}
                            />
                        </CustomContentTypeValue>
                    )}
                </ContentTypeValue>
            </HeaderRow>
            <HintText>
                {showCustomInput
                    ? 'Custom value — pick a standard type from the dropdown to go back.'
                    : 'This is the Content-Type the request sends. Pick "Other…" to type a custom value.'}
            </HintText>

            {entries.length === 0 && (
                <EmptyState title="No custom headers defined." />
            )}

            {entries.map(([key, value], index) => (
                <HeaderRowItem
                    key={index}
                    headerKey={key}
                    value={value}
                    availableVariables={availableVariables}
                    availableEnvVariables={availableEnvVariables}
                    updateHeader={updateHeader}
                    removeHeader={removeHeader}
                />
            ))}
        </PanelContainer>
    );
};

// Perf (review item 3): memoize the panel so parent re-renders that do not
// change its props skip the subtree.
export const HeadersPanel = memo(HeadersPanelBase);
