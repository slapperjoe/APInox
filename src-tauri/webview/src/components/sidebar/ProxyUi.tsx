import React, { useState } from 'react';
import styled from 'styled-components';
import { Play, Square, Shield, Trash2, FolderOpen, Network, FileCode, FileDown, Bug, Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import { WatcherEvent } from '@shared/models';
import { HeaderButton, ServiceItem, SidebarContainer, SidebarContent, SidebarHeader, SidebarHeaderTitle } from './shared/SidebarStyles';
import { formatXml } from '@shared/utils/xmlFormatter';
import { BreakpointModal, Breakpoint } from '../modals/BreakpointModal';
import { NumberSpinner } from '../common/NumberSpinner';
import { RunButton, StopButton } from '../common/Button';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_LG } from '../../styles/spacing';

export interface ProxyUiProps {
    isRunning: boolean;
    config: { port: number, target: string, systemProxyEnabled?: boolean };
    history: WatcherEvent[];
    onStart: () => void;
    onStop: () => void;
    onUpdateConfig: (config: { port: number, target: string, systemProxyEnabled?: boolean }) => void;
    onClear: () => void;
    onSelectEvent: (event: WatcherEvent) => void;
    onSaveHistory: (content: string) => void;

    // Config Switcher
    configPath: string | null;
    onSelectConfigFile: () => void;
    onInjectProxy: () => void;
    onRestoreProxy: () => void;
    onOpenCertificate?: () => void;

    // Breakpoints
    breakpoints?: Breakpoint[];
    onUpdateBreakpoints?: (breakpoints: Breakpoint[]) => void;
}

const Content = styled(SidebarContent)`
    color: var(--apinox-descriptionForeground);
`;

const ConfigSection = styled.div`
    margin-bottom: ${SPACING_LG};
    padding: ${SPACING_MD};
    background-color: var(--apinox-editor-inactiveSelectionBackground);
    border-radius: 5px;
`;

const ConfigRow = styled.div`
    display: flex;
    gap: ${SPACING_MD};
    align-items: center;
    margin-bottom: ${SPACING_XS};
`;

const ConfigField = styled.div`
    flex: 1;
`;

const FieldLabel = styled.label`
    display: block;
    font-size: 0.8em;
    margin-bottom: 2px;
`;

const TextInput = styled.input`
    width: 100%;
    padding: ${SPACING_XS};
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    border-radius: 2px;
    
    &:focus {
        outline: 1px solid var(--apinox-focusBorder);
    }
`;

const CheckboxRow = styled.div`
    display: flex;
    align-items: center;
    margin-bottom: ${SPACING_XS};
    gap: ${SPACING_SM};
`;

const CheckboxLabel = styled.label`
    font-size: 0.8em;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
`;

const Section = styled.div`
    border-top: 1px solid var(--apinox-panel-border);
    padding-top: ${SPACING_MD};
    margin-top: ${SPACING_MD};
`;

const SectionHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${SPACING_SM};
`;

const SectionTitle = styled.h4<{ $clickable?: boolean }>`
    margin: 0;
    font-size: 0.9em;
    cursor: ${props => props.$clickable ? 'pointer' : 'default'};
    display: flex;
    align-items: center;
    gap: ${SPACING_XS};
`;

const BreakpointItem = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    padding: ${SPACING_SM};
    background: var(--apinox-editor-inactiveSelectionBackground);
    border-radius: 3px;
    margin-bottom: ${SPACING_XS};
    font-size: 0.85em;
`;

const BreakpointInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const BreakpointLabel = styled.div`
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const BreakpointDetails = styled.div`
    font-size: 0.9em;
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const ButtonRow = styled.div`
    display: flex;
    gap: ${SPACING_XS};
    margin-top: ${SPACING_XS};
`;

const EmptyMessage = styled.div`
    text-align: center;
    font-size: 0.8em;
    opacity: 0.7;
    padding: ${SPACING_MD} 0;
`;

const ConfigPathDisplay = styled.div`
    flex: 1;
    font-size: 0.8em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: ${SPACING_XS};
    background-color: var(--apinox-editor-background);
    border: 1px solid var(--apinox-input-border);
    border-radius: 2px;
`;

export const ProxyUi: React.FC<ProxyUiProps> = ({
    isRunning,
    config,
    history,
    onStart,
    onStop,
    onUpdateConfig,
    onClear,
    onSelectEvent,
    onSaveHistory,
    configPath,
    onSelectConfigFile,
    onInjectProxy,
    onRestoreProxy,
    onOpenCertificate,
    breakpoints = [],
    onUpdateBreakpoints
}) => {
    const isHttps = config.target.toLowerCase().startsWith('https');
    const [breakpointModal, setBreakpointModal] = useState<{ open: boolean, bp?: Breakpoint | null }>({ open: false });
    const [showBreakpoints, setShowBreakpoints] = useState(true);

    const generateEventMarkdown = (event: WatcherEvent) => {
        let md = `## Request: ${event.url} \n\n`;
        md += `Timestamp: ${event.timestampLabel} \n`;
        md += `Method: ${event.method} \n`;
        md += `Status: ${event.status} \n`;
        md += `Duration: ${(event.duration || 0).toFixed(2)} s\n\n`;

        md += '### Request\n\n';
        if (event.requestHeaders) {
            md += '#### Headers\n';
            md += '```yaml\n';
            Object.entries(event.requestHeaders).forEach(([k, v]) => {
                md += `${k}: ${v}\n`;
            });
            md += '```\n\n';
        }
        md += '#### Body\n';
        const reqBody = event.formattedBody || (event.requestContent || event.requestBody || '').trim();
        if (reqBody) {
            md += '```xml\n' + formatXml(reqBody, true) + '\n```\n\n';
        } else {
            md += '*Empty Body*\n\n';
        }

        md += '### Response\n\n';
        if (event.responseHeaders) {
            md += '#### Headers\n';
            md += '```yaml\n';
            Object.entries(event.responseHeaders).forEach(([k, v]) => {
                md += `${k}: ${v}\n`;
            });
            md += '```\n\n';
        }
        md += '#### Body\n';
        const resBody = event.responseContent || event.responseBody || '';
        if (resBody) {
            let displayRes = resBody;
            try {
                if (resBody.trim().startsWith('<')) displayRes = formatXml(resBody, true);
                else if (resBody.trim().startsWith('{')) displayRes = JSON.stringify(JSON.parse(resBody), null, 2);
            } catch (e) { }

            md += '```\n' + displayRes + '\n```\n\n';
        } else {
            md += '*Empty Body*\n\n';
        }
        return md;
    };

    const handleSaveSingleReport = (event: WatcherEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        const md = generateEventMarkdown(event);
        onSaveHistory(md);
    };

    return (
        <SidebarContainer>
            <SidebarHeader>
                <SidebarHeaderTitle>Dirty Proxy</SidebarHeaderTitle>
            </SidebarHeader>

            <Content>
                {/* Configuration */}
                <ConfigSection>
                    <ConfigRow>
                        <ConfigField>
                            <FieldLabel>Local Port</FieldLabel>
                            <NumberSpinner
                                value={config.port}
                                onChange={(port) => onUpdateConfig({ ...config, port })}
                                defaultValue={9000}
                            />
                        </ConfigField>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                            {!isRunning ? (
                                <RunButton onClick={onStart} title="Start Proxy" style={{ padding: '5px 8px', height: '28px' }}>
                                    <Play size={14} />
                                </RunButton>
                            ) : (
                                <StopButton onClick={onStop} title="Stop Proxy" style={{ padding: '5px 8px', height: '28px' }}>
                                    <Square size={14} />
                                </StopButton>
                            )}
                        </div>
                    </ConfigRow>

                    <ConfigField style={{ marginBottom: SPACING_XS }}>
                        <FieldLabel>Target URL</FieldLabel>
                        <TextInput
                            type="text"
                            value={config.target}
                            onChange={(e) => onUpdateConfig({ ...config, target: e.target.value })}
                        />
                    </ConfigField>

                    <CheckboxRow>
                        <input
                            type="checkbox"
                            id="chkSystemProxy"
                            checked={config.systemProxyEnabled !== false}
                            onChange={e => onUpdateConfig({ ...config, systemProxyEnabled: e.target.checked })}
                            style={{
                                accentColor: 'var(--apinox-button-background)',
                                width: '14px',
                                height: '14px',
                                cursor: 'pointer'
                            }}
                        />
                        <CheckboxLabel htmlFor="chkSystemProxy" title="Uncheck to bypass local corporate proxy (direct connection)">
                            Use System Proxy
                        </CheckboxLabel>
                    </CheckboxRow>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING_SM }}>
                        <div style={{ fontSize: '0.8em' }}>
                            Status: {isRunning ? <span style={{ color: 'var(--apinox-testing-iconPassed)' }}>Running</span> : 'Stopped'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            {isHttps && onOpenCertificate && (
                                <HeaderButton onClick={onOpenCertificate} title="Install Certificate (Required for HTTPS)" style={{ color: 'var(--apinox-charts-yellow)' }}>
                                    <Shield size={14} />
                                </HeaderButton>
                            )}
                            <HeaderButton onClick={onClear} title="Clear Traffic History"><Trash2 size={14} /></HeaderButton>
                        </div>
                    </div>
                </ConfigSection>

                {/* Breakpoints Section */}
                {onUpdateBreakpoints && (
                    <Section>
                        <SectionHeader>
                            <SectionTitle
                                $clickable
                                onClick={() => setShowBreakpoints(!showBreakpoints)}
                            >
                                <Bug size={14} />
                                Breakpoints ({breakpoints.length})
                            </SectionTitle>
                            <HeaderButton onClick={() => setBreakpointModal({ open: true })} title="Add Breakpoint">
                                <Plus size={14} />
                            </HeaderButton>
                        </SectionHeader>

                        {showBreakpoints && breakpoints.length > 0 && (
                            <div style={{ fontSize: '0.85em' }}>
                                {breakpoints.map((bp, i) => (
                                    <BreakpointItem
                                        key={bp.id}
                                        style={{ opacity: bp.enabled ? 1 : 0.5 }}
                                    >
                                        <button
                                            onClick={() => {
                                                const updated = breakpoints.map((b, idx) =>
                                                    idx === i ? { ...b, enabled: !b.enabled } : b
                                                );
                                                onUpdateBreakpoints(updated);
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: bp.enabled ? 'var(--apinox-testing-iconPassed)' : 'var(--apinox-disabledForeground)',
                                                padding: 2,
                                                display: 'flex'
                                            }}
                                            title={bp.enabled ? 'Disable' : 'Enable'}
                                        >
                                            {bp.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                        </button>
                                        <BreakpointInfo>
                                            <BreakpointLabel>
                                                {bp.name || bp.pattern}
                                            </BreakpointLabel>
                                            <BreakpointDetails>
                                                {bp.target} • {bp.matchOn}{bp.isRegex ? ' (regex)' : ''}
                                            </BreakpointDetails>
                                        </BreakpointInfo>
                                        <HeaderButton
                                            onClick={() => setBreakpointModal({ open: true, bp })}
                                            title="Edit"
                                            style={{ padding: 4 }}
                                        >
                                            <Edit2 size={12} />
                                        </HeaderButton>
                                        <HeaderButton
                                            onClick={() => {
                                                const updated = breakpoints.filter((_, idx) => idx !== i);
                                                onUpdateBreakpoints(updated);
                                            }}
                                            title="Delete"
                                            style={{ padding: 4, color: 'var(--apinox-testing-iconFailed)' }}
                                        >
                                            <Trash2 size={12} />
                                        </HeaderButton>
                                    </BreakpointItem>
                                ))}
                            </div>
                        )}

                        {showBreakpoints && breakpoints.length === 0 && (
                            <EmptyMessage>
                                No breakpoints configured.
                            </EmptyMessage>
                        )}
                    </Section>
                )}

                <Section>
                    <SectionHeader>
                        <SectionTitle>Config Switcher</SectionTitle>
                    </SectionHeader>
                    <div style={{ display: 'flex', gap: SPACING_XS, alignItems: 'center', marginBottom: SPACING_XS }}>
                        <ConfigPathDisplay title={configPath || ''}>
                            {configPath ? configPath.split(/[\\/]/).pop() : 'Select web.config...'}
                        </ConfigPathDisplay>
                        <HeaderButton onClick={onSelectConfigFile} title="Browse"><FolderOpen size={14} /></HeaderButton>
                    </div>

                    {configPath && (
                        <ButtonRow>
                            <HeaderButton onClick={onInjectProxy} style={{ flex: 1, justifyContent: 'center', border: '1px solid var(--apinox-button-border)', background: 'var(--apinox-button-secondaryBackground)', color: 'var(--apinox-button-secondaryForeground)' }} title="Inject Proxy Address">
                                <Network size={12} style={{ marginRight: 5 }} /> Inject
                            </HeaderButton>
                            <HeaderButton onClick={onRestoreProxy} style={{ flex: 1, justifyContent: 'center', border: '1px solid var(--apinox-button-border)', background: 'var(--apinox-button-secondaryBackground)', color: 'var(--apinox-button-secondaryForeground)' }} title="Restore Original Config">
                                <FileCode size={12} style={{ marginRight: 5 }} /> Restore
                            </HeaderButton>
                        </ButtonRow>
                    )}
                </Section>

                <Section style={{ marginTop: SPACING_LG }}>
                    <SectionHeader>
                        <SectionTitle>Traffic ({history.length})</SectionTitle>
                        {history.length > 0 && (
                            <HeaderButton onClick={onClear} title="Clear Traffic History" style={{ padding: 4 }}>
                                <Trash2 size={14} />
                            </HeaderButton>
                        )}
                    </SectionHeader>
                    {history.length === 0 ? (
                        <EmptyMessage style={{ marginTop: SPACING_MD }}>
                            No events captured.
                        </EmptyMessage>
                    ) : (
                        history.map((event, i) => (
                            <ServiceItem
                                key={i}
                                style={{ paddingLeft: 5, paddingRight: 5 }}
                                onClick={() => onSelectEvent(event)}
                            >
                                <div style={{ flex: 1, fontSize: '0.85em', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 'bold' }}>{event.method}</span>
                                        <span style={{ opacity: 0.7 }}>{event.status}</span>
                                    </div>
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={event.url}>{event.url}</div>
                                </div>
                                <HeaderButton onClick={(e) => handleSaveSingleReport(event, e)} title="Save Request Log"><FileDown size={14} /></HeaderButton>
                            </ServiceItem>
                        ))
                    )}
                </Section>
            </Content>

            {/* Breakpoint Modal */}
            {onUpdateBreakpoints && (
                <BreakpointModal
                    open={breakpointModal.open}
                    breakpoint={breakpointModal.bp}
                    onClose={() => setBreakpointModal({ open: false })}
                    onSave={(bp) => {
                        const existing = breakpoints.findIndex(b => b.id === bp.id);
                        if (existing >= 0) {
                            // Update existing
                            const updated = [...breakpoints];
                            updated[existing] = bp;
                            onUpdateBreakpoints(updated);
                        } else {
                            // Add new
                            onUpdateBreakpoints([...breakpoints, bp]);
                        }
                    }}
                />
            )}
        </SidebarContainer>
    );
};
