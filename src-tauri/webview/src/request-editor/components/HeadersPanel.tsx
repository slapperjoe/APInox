import React, { useCallback, useRef, useEffect, memo } from 'react';
import styled from 'styled-components';
import { EmptyState } from './common/EmptyState';
import { PanelContainer, PanelIconButton, PanelFlexColumn } from './common/PanelShell';
import { Plus, Trash2, List } from 'lucide-react';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
import { SPACING_XS, SPACING_SM } from '../styles/spacing';
import type { EditorVariable } from '../types';

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
    font-weight: 600;
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

const LockIndicator = styled.div`
    width: 30px;
    text-align: center;
    font-size: 10px;
    opacity: 0.5;
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
     * Effective Content-Type resolved by the caller (request override >
     * interface override > WSDL default — see SOAP_INTERFACE_CONTENT_TYPE_SPEC.md
     * §5.3). Shown in the Content-Type row; when the row is unlocked it is
     * the placeholder shown while no explicit override is set. Falls back to
     * 'application/soap+xml' when omitted.
     */
    contentType?: string;
    /**
     * Whether the Content-Type row is locked (read-only, managed by the
     * WSDL/interface resolution) or an editable header. Defaults to `true`
     * (locked) — the historical behaviour. `false` is the opt-in from
     * Settings → General → "Allow overriding Content-Type".
     */
    contentTypeLocked?: boolean;
    /**
     * Invoked when the user edits the Content-Type in the unlocked row.
     * Receives the NEW full headers record (the `Content-Type` entry added or
     * removed); callers typically forward it straight to their headers
     * onChange / onUpdateRequest. Omitting this handler keeps the row
     * read-only even when unlocked (matches the `readOnly` editor mode).
     */
    onContentTypeChange?: (headers: Record<string, string>) => void;
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
            <PanelIconButton onClick={() => removeHeader(headerKey)} title="Delete Header">
                <Trash2 size={14} />
            </PanelIconButton>
        </HeaderRow>
    );
});

const HeadersPanelBase: React.FC<HeadersPanelProps> = ({
    headers,
    onChange,
    contentType,
    contentTypeLocked = true,
    onContentTypeChange,
    availableVariables,
    availableEnvVariables,
}) => {
    const effectiveContentType = contentType || 'application/soap+xml';
    const hasContentTypeOverride =
        !contentTypeLocked &&
        Object.entries(headers || {}).some(([key]) => key.toLowerCase() === 'content-type');

    // Filter out Content-Type as it's managed by the toolbar dropdown
    const filteredHeaders = Object.fromEntries(
        Object.entries(headers || {}).filter(([key]) => key.toLowerCase() !== 'content-type')
    );
    const entries = Object.entries(filteredHeaders);
    const displayContentType = hasContentTypeOverride
        ? Object.entries(headers!).find(([key]) => key.toLowerCase() === 'content-type')![1]
        : effectiveContentType;

    // Refs + stable handlers: the row callbacks keep a constant identity so
    // memoized rows skip re-render when a different row changes.
    // Synced in an effect rather than during render — writing refs in the render
    // phase is unsafe under concurrent rendering and StrictMode double-invocation.
    const headersRef = useRef(headers);
    const onChangeRef = useRef(onChange);
    useEffect(() => { headersRef.current = headers; }, [headers]);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    const updateHeader = useCallback((oldKey: string, newKey: string, newValue: string) => {
        // Prevent adding Content-Type via this panel
        if (newKey.toLowerCase() === 'content-type') {
            return; // Silently ignore - Content-Type is managed by toolbar
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

    const setContentTypeOverride = (value: string) => {
        if (!onContentTypeChange) return;
        const newHeaders = { ...headersRef.current };
        // Drop any existing case-variant of the header before writing the
        // canonical `Content-Type` key.
        for (const key of Object.keys(newHeaders)) {
            if (key.toLowerCase() === 'content-type') delete newHeaders[key];
        }
        const trimmed = value.trim();
        if (trimmed !== '') {
            newHeaders['Content-Type'] = trimmed;
        }
        onContentTypeChange(newHeaders);
    };

    const clearContentTypeOverride = () => {
        const newHeaders = { ...headersRef.current };
        for (const key of Object.keys(newHeaders)) {
            if (key.toLowerCase() === 'content-type') delete newHeaders[key];
        }
        if (Object.keys(newHeaders).length !== Object.keys(headersRef.current).length) {
            onContentTypeChange?.(newHeaders);
        }
    };

    const contentEditable = !contentTypeLocked && !!onContentTypeChange;

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

            {/* Content-Type row — read-only when locked (managed by the
                WSDL/interface resolution), an editable override header when
                unlocked. */}
            <HeaderRow $dimmed={!contentEditable}>
                <PanelFlexColumn>
                    {/* The header NAME is always the fixed `Content-Type`
                        label — only the value (next column) is editable when
                        unlocked. */}
                    <ReadOnlyField>
                        Content-Type
                    </ReadOnlyField>
                </PanelFlexColumn>
                <PanelFlexColumn>
                    {contentEditable ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING_SM, flex: 1, minWidth: 0 }}>
                            <MonacoSingleLineInput
                                value={displayContentType}
                                onChange={(v: string) => setContentTypeOverride(v)}
                                placeholder={hasContentTypeOverride ? 'Content-Type' : effectiveContentType}
                                availableVariables={availableVariables}
                                availableEnvVariables={availableEnvVariables}
                            />
                            {hasContentTypeOverride && (
                                <PanelIconButton
                                    onClick={clearContentTypeOverride}
                                    title="Clear override (use the resolved value)"
                                >
                                    <Trash2 size={14} />
                                </PanelIconButton>
                            )}
                        </div>
                    ) : (
                        <ReadOnlyField>
                            {displayContentType}
                        </ReadOnlyField>
                    )}
                </PanelFlexColumn>
                <LockIndicator
                    title={contentTypeLocked ? 'Managed by WSDL / interface resolution' : 'Editable — overrides the resolved value'}
                >
                    {contentTypeLocked ? '🔒' : hasContentTypeOverride ? '✏️' : '🔓'}
                </LockIndicator>
            </HeaderRow>
            {!contentTypeLocked && contentEditable && (
                <HintText>
                    {hasContentTypeOverride
                        ? 'Overriding the resolved value (shown as placeholder).'
                        : `Unlocked — type a value to override ${effectiveContentType}.`}
                </HintText>
            )}

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
