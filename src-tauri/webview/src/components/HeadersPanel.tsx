import React from 'react';
import styled from 'styled-components';
import { Plus, Trash2 } from 'lucide-react';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
import { SPACING_XS, SPACING_SM } from '../styles/spacing';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: ${SPACING_SM};
    gap: ${SPACING_SM};
    overflow-y: auto;
`;

const HeaderRow = styled.div<{ dimmed?: boolean }>`
    display: flex;
    gap: ${SPACING_SM};
    align-items: center;
    opacity: ${props => props.dimmed ? 0.7 : 1};
`;

const HeaderTitle = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${SPACING_XS};
`;

const FlexColumn = styled.div`
    flex: 1;
`;

const ReadOnlyField = styled.div`
    padding: 6px ${SPACING_SM};
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border);
    border-radius: ${SPACING_XS};
    color: var(--vscode-disabledForeground);
    font-family: monospace;
    font-size: 12px;
`;

const LockIndicator = styled.div`
    width: 30px;
    text-align: center;
    font-size: 10px;
    opacity: 0.5;
`;

const EmptyState = styled.div`
    opacity: 0.6;
    font-style: italic;
    padding: ${SPACING_SM};
    text-align: center;
`;

const IconButton = styled.button`
    background: transparent;
    border: none;
    color: var(--vscode-icon-foreground);
    cursor: pointer;
    padding: ${SPACING_XS};
    border-radius: 3px;
    display: flex;
    align-items: center;
    &:hover {
        background: var(--vscode-toolbar-hoverBackground);
        color: var(--vscode-foreground);
    }
`;

interface HeadersPanelProps {
    headers: Record<string, string>;
    onChange: (headers: Record<string, string>) => void;
    contentType?: string; // Managed by toolbar dropdown, shown read-only here
}

export const HeadersPanel: React.FC<HeadersPanelProps> = ({ headers, onChange, contentType }) => {
    // Filter out Content-Type as it's managed by the toolbar dropdown
    const filteredHeaders = Object.fromEntries(
        Object.entries(headers || {}).filter(([key]) => key.toLowerCase() !== 'content-type')
    );
    const entries = Object.entries(filteredHeaders);
    const displayContentType = contentType || 'application/soap+xml';

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
    };

    const removeHeader = (key: string) => {
        const newHeaders = { ...headers };
        delete newHeaders[key];
        onChange(newHeaders);
    };

    const addHeader = () => {
        const newHeaders = { ...headers };
        // Find unique key
        let count = 1;
        while (newHeaders[`Header${count}`]) count++;
        newHeaders[`Header${count}`] = '';
        onChange(newHeaders);
    };

    return (
        <Container>
            <HeaderTitle>
                <h3>HTTP Headers</h3>
                <IconButton onClick={addHeader} title="Add Header">
                    <Plus size={16} /> Add
                </IconButton>
            </HeaderTitle>

            {/* Read-only Content-Type row */}
            <HeaderRow dimmed>
                <FlexColumn>
                    <ReadOnlyField>
                        Content-Type
                    </ReadOnlyField>
                </FlexColumn>
                <FlexColumn>
                    <ReadOnlyField>
                        {displayContentType}
                    </ReadOnlyField>
                </FlexColumn>
                <LockIndicator title="Managed by toolbar dropdown">
                    🔒
                </LockIndicator>
            </HeaderRow>

            {entries.length === 0 && (
                <EmptyState>
                    No custom headers defined.
                </EmptyState>
            )}

            {entries.map(([key, value], index) => (
                <HeaderRow key={index}>
                    <FlexColumn>
                        <MonacoSingleLineInput
                            value={key}
                            onChange={(newKey: string) => updateHeader(key, newKey, value)}
                            placeholder="Header Name"
                        />
                    </FlexColumn>
                    <FlexColumn>
                        <MonacoSingleLineInput
                            value={value}
                            onChange={(newValue: string) => updateHeader(key, key, newValue)}
                            placeholder="Value"
                        />
                    </FlexColumn>
                    <IconButton onClick={() => removeHeader(key)} title="Delete Header">
                        <Trash2 size={14} />
                    </IconButton>
                </HeaderRow>
            ))}
        </Container>
    );
};
