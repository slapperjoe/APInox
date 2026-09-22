import React from 'react';
import styled from 'styled-components';
import { EmptyState } from './common/EmptyState';
import { PanelContainer, PanelIconButton, PanelFlexColumn } from './common/PanelShell';
import { Plus, Trash2, List } from 'lucide-react';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
import { SPACING_XS, SPACING_SM } from '../styles/spacing';

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
}

export const HeadersPanel: React.FC<HeadersPanelProps> = ({
    headers,
    onChange,
    contentType,
    contentTypeLocked = true,
    onContentTypeChange,
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

    const updateHeader = (oldKey: string, newKey: string, newValue: string) => {
        // Prevent adding Content-Type via this panel
        if (newKey.toLowerCase() === 'content-type') {
            return; // Silently ignore - Content-Type is managed by toolbar
        }
        const newHeaders = { ...headers };
        if (oldKey !== newKey) {
            delete newHeaders[oldKey];
        }
        newHeaders[newKey] = newValue;
        onChange(newHeaders);
    }

    const removeHeader = (key: string) => {
        const newHeaders = { ...headers };
        delete newHeaders[key];
        onChange(newHeaders);
    }

    const addHeader = () => {
        const newHeaders = { ...headers };
        // Find unique key
        let count = 1;
        while (newHeaders[`Header${count}`]) count++;
        newHeaders[`Header${count}`] = '';
        onChange(newHeaders);
    }

    const setContentTypeOverride = (value: string) => {
        if (!onContentTypeChange) return;
        const newHeaders = { ...headers };
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
        const newHeaders = { ...headers };
        for (const key of Object.keys(newHeaders)) {
            if (key.toLowerCase() === 'content-type') delete newHeaders[key];
        }
        if (Object.keys(newHeaders).length !== Object.keys(headers).length) {
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
                <HeaderRow key={index}>
                    <PanelFlexColumn>
                        <MonacoSingleLineInput
                            value={key}
                            onChange={(newKey: string) => updateHeader(key, newKey, value)}
                            placeholder="Header Name"
                        />
                    </PanelFlexColumn>
                    <PanelFlexColumn>
                        <MonacoSingleLineInput
                            value={value}
                            onChange={(newValue: string) => updateHeader(key, key, newValue)}
                            placeholder="Value"
                        />
                    </PanelFlexColumn>
                    <PanelIconButton onClick={() => removeHeader(key)} title="Delete Header">
                        <Trash2 size={14} />
                    </PanelIconButton>
                </HeaderRow>
            ))}
        </PanelContainer>
    );
};
