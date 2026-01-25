import React, { useState } from 'react';
import styled from 'styled-components';
import { Play, Square, Trash2, Plus, Edit2, ToggleLeft, ToggleRight, Radio, ArrowRight, Circle } from 'lucide-react';
import { MockConfig, MockRule, MockEvent } from '@shared/models';
import { HeaderButton, ServiceItem, SidebarContainer, SidebarContent, SidebarHeader, SidebarHeaderTitle } from './shared/SidebarStyles';
import { MockRuleModal } from '../modals/MockRuleModal';
import { NumberSpinner } from '../common/NumberSpinner';
import { RunButton, StopButton } from '../common/Button';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_LG } from '../../styles/spacing';

interface MockUiProps {
    isRunning: boolean;
    config: MockConfig;
    history: MockEvent[];
    onStart: () => void;
    onStop: () => void;
    onUpdateConfig: (config: Partial<MockConfig>) => void;
    onClear: () => void;
    onSelectEvent: (event: MockEvent) => void;

    // Rule management
    rules: MockRule[];
    onAddRule: (rule: MockRule) => void;
    onUpdateRule: (id: string, updates: Partial<MockRule>) => void;
    onDeleteRule: (id: string) => void;
    onToggleRule: (id: string, enabled: boolean) => void;
    onEditRule?: (rule: MockRule) => void;
}

const Content = styled(SidebarContent)`
    color: var(--vscode-descriptionForeground);
`;

const ConfigSection = styled.div`
    margin-bottom: ${SPACING_LG};
    padding: ${SPACING_MD};
    background-color: var(--vscode-editor-inactiveSelectionBackground);
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
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 2px;
    
    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
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
    border-top: 1px solid var(--vscode-panel-border);
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

const RuleItem = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    padding: ${SPACING_SM};
    background: var(--vscode-editor-inactiveSelectionBackground);
    border-radius: 3px;
    margin-bottom: ${SPACING_XS};
    font-size: 0.85em;
`;

const RuleInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const RuleLabel = styled.div`
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const RuleDetails = styled.div`
    font-size: 0.9em;
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const EmptyMessage = styled.div`
    text-align: center;
    font-size: 0.8em;
    opacity: 0.7;
    padding: ${SPACING_MD} 0;
`;

const DEFAULT_CONFIG: MockConfig = {
    enabled: false,
    port: 9001,
    targetUrl: 'http://localhost:8080',
    rules: [],
    passthroughEnabled: true,
    routeThroughProxy: false
};

export const MockUi: React.FC<MockUiProps> = ({
    isRunning,
    config = DEFAULT_CONFIG,
    history,
    onStart,
    onStop,
    onUpdateConfig,
    onClear,
    onSelectEvent,
    rules,
    onAddRule,
    onDeleteRule,
    onToggleRule
}) => {
    const [showRules, setShowRules] = useState(true);
    const [ruleModal, setRuleModal] = useState<{ open: boolean, rule?: MockRule | null }>({ open: false });

    const handleAddRule = () => {
        setRuleModal({ open: true, rule: null });
    };

    const handleEditRule = (rule: MockRule) => {
        setRuleModal({ open: true, rule });
    };

    const handleSaveRule = (rule: MockRule) => {
        // Check if it's an update or new rule
        const existing = rules.find(r => r.id === rule.id);
        if (existing) {
            onAddRule(rule); // Will update via command
        } else {
            onAddRule(rule);
        }
    };

    return (
        <SidebarContainer>
            <SidebarHeader>
                <SidebarHeaderTitle>
                    <Radio size={14} />
                    Dirty Moxy
                </SidebarHeaderTitle>
            </SidebarHeader>

            <Content>
                {/* Configuration */}
                <ConfigSection>
                    <ConfigRow>
                        <ConfigField>
                            <FieldLabel>Port</FieldLabel>
                            <NumberSpinner
                                value={config.port}
                                onChange={(port) => onUpdateConfig({ port })}
                                defaultValue={9001}
                            />
                        </ConfigField>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                            {!isRunning ? (
                                <RunButton onClick={onStart} title="Start Dirty Moxy" style={{ padding: '5px 8px', height: '28px' }}>
                                    <Play size={14} />
                                </RunButton>
                            ) : (
                                <StopButton onClick={onStop} title="Stop Dirty Moxy" style={{ padding: '5px 8px', height: '28px' }}>
                                    <Square size={14} />
                                </StopButton>
                            )}
                        </div>
                    </ConfigRow>

                    <ConfigField style={{ marginBottom: SPACING_XS }}>
                        <FieldLabel>Target URL (Passthrough)</FieldLabel>
                        <TextInput
                            type="text"
                            value={config.targetUrl}
                            onChange={(e) => onUpdateConfig({ targetUrl: e.target.value })}
                            placeholder="http://localhost:8080"
                        />
                    </ConfigField>

                    <CheckboxRow>
                        <input
                            type="checkbox"
                            id="chkPassthrough"
                            checked={config.passthroughEnabled !== false}
                            onChange={e => onUpdateConfig({ passthroughEnabled: e.target.checked })}
                            style={{
                                accentColor: 'var(--vscode-button-background)',
                                width: '14px',
                                height: '14px',
                                cursor: 'pointer'
                            }}
                        />
                        <CheckboxLabel htmlFor="chkPassthrough" title="Forward unmatched requests to target URL">
                            Forward unmatched requests
                        </CheckboxLabel>
                    </CheckboxRow>

                    {config.passthroughEnabled && (
                        <div style={{ marginBottom: 5, display: 'flex', alignItems: 'center', paddingLeft: 20 }}>
                            <input
                                type="checkbox"
                                id="chkRouteProxy"
                                checked={config.routeThroughProxy === true}
                                onChange={e => onUpdateConfig({ routeThroughProxy: e.target.checked })}
                                style={{
                                    marginRight: 6,
                                    accentColor: 'var(--vscode-button-background)',
                                    width: '14px',
                                    height: '14px',
                                    cursor: 'pointer'
                                }}
                            />
                            <label htmlFor="chkRouteProxy" style={{ fontSize: '0.8em', cursor: 'pointer', userSelect: 'none' }} title="Route passthrough traffic through Dirty Proxy instead of directly to target">
                                Route through Dirty Proxy
                            </label>
                        </div>
                    )}

                    <div style={{ marginBottom: 5, display: 'flex', alignItems: 'center' }}>
                        <input
                            type="checkbox"
                            id="chkRecordMode"
                            checked={config.recordMode === true}
                            onChange={e => onUpdateConfig({ recordMode: e.target.checked })}
                            style={{
                                marginRight: 6,
                                accentColor: 'var(--vscode-charts-yellow)',
                                width: '14px',
                                height: '14px',
                                cursor: 'pointer'
                            }}
                        />
                        <label htmlFor="chkRecordMode" style={{ fontSize: '0.8em', cursor: 'pointer', userSelect: 'none', color: config.recordMode ? 'var(--vscode-charts-yellow)' : undefined }} title="Auto-capture real responses as mock rules">
                            🔴 Record Mode
                        </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <div style={{ fontSize: '0.8em' }}>Status: {isRunning ? <span style={{ color: 'var(--vscode-testing-iconPassed)' }}>Running</span> : 'Stopped'}</div>
                    </div>
                    </ConfigSection>

                {/* Mock Rules Section */}
                <Section>
                    <SectionHeader>
                        <SectionTitle
                            $clickable
                            onClick={() => setShowRules(!showRules)}
                        >
                            <Circle size={14} />
                            Mock Rules ({rules.length})
                        </SectionTitle>
                        <HeaderButton onClick={handleAddRule} title="Add Mock Rule">
                            <Plus size={14} />
                        </HeaderButton>
                    </SectionHeader>

                    {showRules && rules.length > 0 && (
                        <div style={{ fontSize: '0.85em' }}>
                            {rules.map((rule) => (
                                <RuleItem
                                    key={rule.id}
                                    style={{ opacity: rule.enabled ? 1 : 0.5 }}
                                >
                                    <button
                                        onClick={() => onToggleRule(rule.id, !rule.enabled)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: rule.enabled ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-disabledForeground)',
                                            padding: 2,
                                            display: 'flex'
                                        }}
                                        title={rule.enabled ? 'Disable' : 'Enable'}
                                    >
                                        {rule.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                    </button>
                                    <RuleInfo>
                                        <RuleLabel style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {rule.name}
                                            {rule.hitCount && rule.hitCount > 0 && (
                                                <span style={{ fontSize: '0.8em', opacity: 0.7 }}>({rule.hitCount})</span>
                                            )}
                                        </RuleLabel>
                                        <RuleDetails>
                                            {rule.conditions.map(c => `${c.type}: ${c.pattern.substring(0, 20)}${c.pattern.length > 20 ? '...' : ''}`).join(' & ')}
                                        </RuleDetails>
                                    </RuleInfo>
                                    <HeaderButton
                                        onClick={() => handleEditRule(rule)}
                                        title="Edit"
                                        style={{ padding: 4 }}
                                    >
                                        <Edit2 size={12} />
                                    </HeaderButton>
                                    <HeaderButton
                                        onClick={() => onDeleteRule(rule.id)}
                                        title="Delete"
                                        style={{ padding: 4, color: 'var(--vscode-testing-iconFailed)' }}
                                    >
                                        <Trash2 size={12} />
                                    </HeaderButton>
                                </RuleItem>
                            ))}
                        </div>
                    )}

                    {showRules && rules.length === 0 && (
                        <EmptyMessage>
                            No mock rules configured.
                            <br />
                            <span style={{ color: 'var(--vscode-textLink-foreground)', cursor: 'pointer' }} onClick={handleAddRule}>
                                Click + to add one.
                            </span>
                        </EmptyMessage>
                    )}
                </Section>

                {/* Traffic Log */}
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 'bold' }}>{event.method}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {event.matchedRule && (
                                                <span style={{ color: 'var(--vscode-charts-green)', fontSize: '0.8em' }}>MOXY</span>
                                            )}
                                            {event.passthrough && (
                                                <span style={{ color: 'var(--vscode-charts-blue)', fontSize: '0.8em', display: 'flex', alignItems: 'center' }}>
                                                    <ArrowRight size={10} /> FWD
                                                </span>
                                            )}
                                            <span style={{ opacity: 0.7 }}>{event.status}</span>
                                        </div>
                                    </div>
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={event.url}>{event.url}</div>
                                    {event.matchedRule && (
                                        <div style={{ fontSize: '0.75em', opacity: 0.7, color: 'var(--vscode-charts-green)' }}>
                                            Rule: {event.matchedRule}
                                        </div>
                                    )}
                                </div>
                            </ServiceItem>
                        ))
                    )}
                </Section>
            </Content>

            {/* Mock Rule Modal */}
            <MockRuleModal
                open={ruleModal.open}
                rule={ruleModal.rule}
                onClose={() => setRuleModal({ open: false })}
                onSave={handleSaveRule}
            />
        </SidebarContainer>
    );
};
