import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import Editor from '@monaco-editor/react';
import { X, Save, AlertTriangle, Settings, FileJson, Server, Plus, Trash2, Check, Globe, Replace } from 'lucide-react';

const ModalOverlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
`;

const ModalContent = styled.div`
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    width: 800px;
    height: 600px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    border: 1px solid var(--vscode-widget-border);
`;

const ModalHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px;
    background: var(--vscode-editor-background);
    border-bottom: 1px solid var(--vscode-widget-border);
`;

const Title = styled.h2`
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
`;

const Button = styled.button`
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--vscode-button-foreground);
    display: flex;
    align-items: center;
    padding: 4px;
    &:hover {
        background: var(--vscode-toolbar-hoverBackground);
    }
`;

const TabContainer = styled.div`
    display: flex;
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background);
`;

const Tab = styled.div<{ active: boolean }>`
    padding: 8px 16px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-top: 1px solid transparent;
    border-right: 1px solid var(--vscode-panel-border);
    background: ${props => props.active ? 'var(--vscode-editor-background)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-tab-activeForeground)' : 'var(--vscode-tab-inactiveForeground)'};

    &:hover {
        color: var(--vscode-tab-activeForeground);
    }
`;

const ContentContainer = styled.div`
    flex: 1;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
`;

const ScrollableForm = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 20px;
`;

const FormGroup = styled.div`
    margin-bottom: 20px;
`;

const Label = styled.label`
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    font-size: 12px;
`;

const Input = styled.input`
    width: 100%;
    padding: 6px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    &:focus {
        border-color: var(--vscode-focusBorder);
        outline: none;
    }
`;

const Select = styled.select`
    width: 100%;
    padding: 6px;
    background: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    &:focus {
        border-color: var(--vscode-focusBorder);
        outline: none;
    }
`;

const CheckboxLabel = styled.label`
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 12px;
`;

const SectionHeader = styled.h3`
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-transform: uppercase;
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: 4px;
    margin-bottom: 12px;
    margin-top: 20px;
`;

const ModalFooter = styled.div`
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 10px 15px;
    border-top: 1px solid var(--vscode-widget-border);
    gap: 10px;
    background: var(--vscode-editor-background);
`;

const PrimaryButton = styled.button`
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    &:hover {
        background: var(--vscode-button-hoverBackground);
    }
`;

const EnvList = styled.div`
    display: flex;
    flex-direction: column;
    width: 200px;
    border-right: 1px solid var(--vscode-panel-border);
    overflow-y: auto;
    background: var(--vscode-sideBar-background);
`;

const EnvItem = styled.div<{ active: boolean, selected: boolean }>`
    padding: 8px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: ${props => props.selected ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.selected ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)'};
    &:hover {
        background: ${props => props.selected ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-list-hoverBackground)'};
    }
`;

const EnvDetail = styled.div`
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 15px;
`;

const Badge = styled.span`
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    margin-left: 8px;
`;

const IconButton = styled.button`
    background: transparent;
    border: none;
    color: var(--vscode-foreground);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    &:hover {
        background: var(--vscode-list-hoverBackground);
    }
`;

// Helper interfaces matching backend Logic
interface DirtySoapConfig {
    version?: number;
    network?: {
        defaultTimeout?: number;
        retryCount?: number;
        proxy?: string;
    };
    ui?: {
        layoutMode?: 'vertical' | 'horizontal';
        showLineNumbers?: boolean;
        alignAttributes?: boolean;
        inlineElementValues?: boolean;
        splitRatio?: number;
    };
    activeEnvironment?: string;
    environments?: Record<string, {
        endpoint_url?: string;
        env?: string;
        [key: string]: string | undefined;
    }>;
    globals?: Record<string, string>;
    replaceRules?: ReplaceRuleSettings[];
}

interface ReplaceRuleSettings {
    id: string;
    name?: string;
    xpath: string;
    matchText: string;
    replaceWith: string;
    target: 'request' | 'response' | 'both';
    enabled: boolean;
}

interface SettingsEditorModalProps {
    rawConfig: string;
    onClose: () => void;
    onSave: (content: string, config?: any) => void;
}

export const SettingsEditorModal: React.FC<SettingsEditorModalProps> = ({ rawConfig, onClose, onSave }) => {
    const [activeTab, setActiveTab] = useState<'gui' | 'environments' | 'globals' | 'replaceRules' | 'json'>('gui');
    const [jsonContent, setJsonContent] = useState(rawConfig || '{}');
    const [guiConfig, setGuiConfig] = useState<DirtySoapConfig>({});
    const [parseError, setParseError] = useState<string | null>(null);

    // Environments State
    const [selectedEnvKey, setSelectedEnvKey] = useState<string | null>(null);
    // Globals State
    const [selectedGlobalKey, setSelectedGlobalKey] = useState<string | null>(null);
    // Replace Rules State
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

    // Initial Parse
    useEffect(() => {
        try {
            const parsed = JSON.parse(rawConfig || '{}');
            setGuiConfig(parsed);
            setJsonContent(rawConfig || '{}');
            // Select active environment by default if available
            if (parsed.activeEnvironment && parsed.environments?.[parsed.activeEnvironment]) {
                setSelectedEnvKey(parsed.activeEnvironment);
            } else if (parsed.environments) {
                const keys = Object.keys(parsed.environments);
                if (keys.length > 0) setSelectedEnvKey(keys[0]);
            }
        } catch (e) {
            console.error("Failed to parse initial config", e);
            setParseError("Could not parse config JSON. Defaulting to JSON view.");
            setActiveTab('json');
        }
    }, [rawConfig]);

    const handleTabSwitch = (tab: 'gui' | 'environments' | 'globals' | 'replaceRules' | 'json') => {
        if (tab === 'json') {
            setActiveTab('json');
            return;
        }

        // Switch to GUI or Environments: Attempt parse
        try {
            const parsed = JSON.parse(jsonContent);
            setGuiConfig(parsed);
            setParseError(null);
            setActiveTab(tab);
        } catch (e) {
            setParseError(`Cannot switch to ${tab.toUpperCase()}: Invalid JSON syntax.`);
        }
    };

    const handleGuiChange = (section: keyof DirtySoapConfig, key: string, value: any) => {
        setGuiConfig(prev => {
            const updated = { ...prev };
            if (!updated[section]) (updated as any)[section] = {};
            (updated as any)[section][key] = value;
            return updated;
        });
    };

    const handleEnvChange = (envKey: string, key: string, value: any) => {
        setGuiConfig(prev => {
            const updated = { ...prev };
            if (!updated.environments) updated.environments = {};
            if (!updated.environments[envKey]) updated.environments[envKey] = {};
            (updated.environments[envKey] as any)[key] = value;
            return updated;
        });
    };

    const handleAddEnv = () => {
        const name = "NewEnvironment";
        let finalName = name;
        let counter = 1;
        while (guiConfig.environments?.[finalName]) {
            finalName = `${name}${counter}`;
            counter++;
        }

        setGuiConfig(prev => {
            const updated = { ...prev };
            if (!updated.environments) updated.environments = {};
            updated.environments[finalName] = { endpoint_url: "", env: "" };
            return updated;
        });
        setSelectedEnvKey(finalName);
    };

    const handleDeleteEnv = (key: string) => {
        setGuiConfig(prev => {
            const updated = { ...prev };
            if (updated.environments) {
                delete updated.environments[key];
            }
            if (updated.activeEnvironment === key) {
                updated.activeEnvironment = undefined;
            }
            return updated;
        });
        if (selectedEnvKey === key) setSelectedEnvKey(null);
    };

    // Globals Logic
    const handleAddGlobal = () => {
        const name = "NEW_VAR";
        let finalName = name;
        let counter = 1;
        while (guiConfig.globals?.[finalName] !== undefined) {
            finalName = `${name}_${counter}`;
            counter++;
        }
        setGuiConfig(prev => {
            const updated = { ...prev };
            if (!updated.globals) updated.globals = {};
            updated.globals[finalName] = "";
            return updated;
        });
        setSelectedGlobalKey(finalName);
    };

    const handleDeleteGlobal = (key: string) => {
        setGuiConfig(prev => {
            const updated = { ...prev };
            if (updated.globals) {
                delete updated.globals[key];
            }
            return updated;
        });
        if (selectedGlobalKey === key) setSelectedGlobalKey(null);
    };

    const handleGlobalKeyChange = (oldKey: string, newKey: string) => {
        if (oldKey === newKey) return;
        if (guiConfig.globals?.[newKey] !== undefined) {
            // Key conflict
            return;
        }

        setGuiConfig(prev => {
            const updated = { ...prev };
            if (!updated.globals) updated.globals = {};
            const val = updated.globals[oldKey];
            delete updated.globals[oldKey];
            updated.globals[newKey] = val;
            return updated;
        });
        setSelectedGlobalKey(newKey);
    };

    const handleGlobalValueChange = (key: string, value: string) => {
        setGuiConfig(prev => {
            const updated = { ...prev };
            if (!updated.globals) updated.globals = {};
            updated.globals[key] = value;
            return updated;
        });
    };

    const handleSetActive = (key: string) => {
        setGuiConfig(prev => ({ ...prev, activeEnvironment: key }));
    };

    const handleSave = () => {
        if (activeTab === 'json') {
            onSave(jsonContent);
        } else {
            onSave('', guiConfig);
        }
    };

    const environments = guiConfig.environments || {};
    const envKeys = Object.keys(environments);

    const globals = guiConfig.globals || {};
    const globalKeys = Object.keys(globals);

    const replaceRules = guiConfig.replaceRules || [];

    const handleAddRule = () => {
        const newRule: ReplaceRuleSettings = {
            id: crypto.randomUUID(),
            name: 'New Rule',
            xpath: '//element',
            matchText: '',
            replaceWith: '',
            target: 'response',
            enabled: true
        };
        setGuiConfig(prev => ({
            ...prev,
            replaceRules: [...(prev.replaceRules || []), newRule]
        }));
        setSelectedRuleId(newRule.id);
    };

    const handleDeleteRule = (id: string) => {
        setGuiConfig(prev => ({
            ...prev,
            replaceRules: (prev.replaceRules || []).filter(r => r.id !== id)
        }));
        if (selectedRuleId === id) setSelectedRuleId(null);
    };

    const handleRuleChange = (id: string, field: keyof ReplaceRuleSettings, value: any) => {
        setGuiConfig(prev => ({
            ...prev,
            replaceRules: (prev.replaceRules || []).map(r =>
                r.id === id ? { ...r, [field]: value } : r
            )
        }));
    };

    return (
        <ModalOverlay onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <ModalContent>
                <ModalHeader>
                    <Title>Settings</Title>
                    <Button onClick={onClose}><X size={16} /></Button>
                </ModalHeader>

                <TabContainer>
                    <Tab active={activeTab === 'gui'} onClick={() => handleTabSwitch('gui')}>
                        <Settings size={14} /> General
                    </Tab>
                    <Tab active={activeTab === 'environments'} onClick={() => handleTabSwitch('environments')}>
                        <Server size={14} /> Environments
                    </Tab>
                    <Tab active={activeTab === 'globals'} onClick={() => handleTabSwitch('globals')}>
                        <Globe size={14} /> Globals
                    </Tab>
                    <Tab active={activeTab === 'replaceRules'} onClick={() => handleTabSwitch('replaceRules')}>
                        <Replace size={14} /> Replace Rules
                    </Tab>
                    <Tab active={activeTab === 'json'} onClick={() => handleTabSwitch('json')} style={{ marginLeft: 'auto', borderRight: 'none', borderLeft: '1px solid var(--vscode-panel-border)' }}>
                        <FileJson size={14} /> JSON (Advanced)
                    </Tab>
                </TabContainer>

                <ContentContainer>
                    {activeTab === 'gui' && (
                        <ScrollableForm>
                            <SectionHeader>Network</SectionHeader>
                            <FormGroup>
                                <Label>Default Timeout (seconds)</Label>
                                <Input
                                    type="number"
                                    value={guiConfig.network?.defaultTimeout ?? 30}
                                    onChange={e => handleGuiChange('network', 'defaultTimeout', parseInt(e.target.value))}
                                />
                            </FormGroup>
                            <FormGroup>
                                <Label>Retry Count</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={10}
                                    value={guiConfig.network?.retryCount ?? 0}
                                    onChange={e => handleGuiChange('network', 'retryCount', parseInt(e.target.value))}
                                />
                            </FormGroup>
                            <FormGroup>
                                <Label>Proxy URL (Optional)</Label>
                                <Input
                                    type="text"
                                    placeholder="http://127.0.0.1:8080"
                                    value={guiConfig.network?.proxy ?? ''}
                                    onChange={e => handleGuiChange('network', 'proxy', e.target.value)}
                                />
                            </FormGroup>

                            <SectionHeader>User Interface</SectionHeader>
                            <FormGroup>
                                <Label>Layout Mode</Label>
                                <Select
                                    value={guiConfig.ui?.layoutMode ?? 'vertical'}
                                    onChange={e => handleGuiChange('ui', 'layoutMode', e.target.value)}
                                >
                                    <option value="vertical">Vertical (Two Columns)</option>
                                    <option value="horizontal">Horizontal (Stacked)</option>
                                </Select>
                            </FormGroup>
                            <FormGroup>
                                <CheckboxLabel>
                                    <input
                                        type="checkbox"
                                        checked={guiConfig.ui?.showLineNumbers ?? true}
                                        onChange={e => handleGuiChange('ui', 'showLineNumbers', e.target.checked)}
                                    />
                                    Show Line Numbers in Editor
                                </CheckboxLabel>
                            </FormGroup>
                            <FormGroup>
                                <CheckboxLabel>
                                    <input
                                        type="checkbox"
                                        checked={guiConfig.ui?.alignAttributes ?? false}
                                        onChange={e => handleGuiChange('ui', 'alignAttributes', e.target.checked)}
                                    />
                                    Align Attributes Vertically
                                </CheckboxLabel>
                            </FormGroup>
                            <FormGroup>
                                <CheckboxLabel>
                                    <input
                                        type="checkbox"
                                        checked={guiConfig.ui?.inlineElementValues ?? false}
                                        onChange={e => handleGuiChange('ui', 'inlineElementValues', e.target.checked)}
                                    />
                                    Inline simple values in XML Response (Experimental)
                                </CheckboxLabel>
                            </FormGroup>
                        </ScrollableForm>
                    )}

                    {activeTab === 'environments' && (
                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                            <EnvList>
                                <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--vscode-panel-border)' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Profiles</span>
                                    <IconButton onClick={handleAddEnv} title="Add Environment">
                                        <Plus size={14} />
                                    </IconButton>
                                </div>
                                {envKeys.map(key => (
                                    <EnvItem
                                        key={key}
                                        active={key === selectedEnvKey}
                                        selected={key === selectedEnvKey}
                                        onClick={() => setSelectedEnvKey(key)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{key}</span>
                                            {guiConfig.activeEnvironment === key && <Badge>Active</Badge>}
                                        </div>
                                    </EnvItem>
                                ))}
                            </EnvList>
                            <EnvDetail>
                                {selectedEnvKey && environments[selectedEnvKey] ? (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            <h3 style={{ margin: 0, textTransform: 'uppercase', fontSize: 12 }}>{selectedEnvKey}</h3>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {guiConfig.activeEnvironment !== selectedEnvKey && (
                                                    <PrimaryButton onClick={() => handleSetActive(selectedEnvKey)} style={{ background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)' }}>
                                                        <Check size={14} /> Set Active
                                                    </PrimaryButton>
                                                )}
                                                <IconButton onClick={() => handleDeleteEnv(selectedEnvKey)} style={{ color: 'var(--vscode-errorForeground)' }} title="Delete Environment">
                                                    <Trash2 size={14} />
                                                </IconButton>
                                            </div>
                                        </div>
                                        <FormGroup>
                                            <Label>Endpoint URL</Label>
                                            <Input
                                                type="text"
                                                value={environments[selectedEnvKey].endpoint_url ?? ''}
                                                onChange={e => handleEnvChange(selectedEnvKey, 'endpoint_url', e.target.value)}
                                                placeholder="http://api.example.com/service.svc"
                                            />
                                        </FormGroup>
                                        <FormGroup>
                                            <Label>Short Code (used in {'{{env}}'})</Label>
                                            <Input
                                                type="text"
                                                value={environments[selectedEnvKey].env ?? ''}
                                                onChange={e => handleEnvChange(selectedEnvKey, 'env', e.target.value)}
                                                placeholder="dev01"
                                            />
                                        </FormGroup>
                                        <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', padding: '10px', background: 'var(--vscode-textBlockQuote-background)', borderLeft: '3px solid var(--vscode-textBlockQuote-border)' }}>
                                            <p style={{ margin: 0 }}>
                                                Use <code>{'{{url}}'}</code> in your requests to reference the Endpoint URL.<br />
                                                Use <code>{'{{env}}'}</code> to reference the Short Code.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-disabledForeground)' }}>
                                        Select an environment to edit
                                    </div>
                                )}
                            </EnvDetail>
                        </div>
                    )}

                    {activeTab === 'globals' && (
                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                            <EnvList>
                                <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--vscode-panel-border)' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Globals</span>
                                    <IconButton onClick={handleAddGlobal} title="Add Variable">
                                        <Plus size={14} />
                                    </IconButton>
                                </div>
                                {globalKeys.map(key => (
                                    <EnvItem
                                        key={key}
                                        active={key === selectedGlobalKey}
                                        selected={key === selectedGlobalKey}
                                        onClick={() => setSelectedGlobalKey(key)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{key}</span>
                                        </div>
                                    </EnvItem>
                                ))}
                            </EnvList>
                            <EnvDetail>
                                {selectedGlobalKey !== null && globals[selectedGlobalKey] !== undefined ? (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            <h3 style={{ margin: 0, textTransform: 'uppercase', fontSize: 12 }}>Variable</h3>
                                            <IconButton onClick={() => handleDeleteGlobal(selectedGlobalKey)} style={{ color: 'var(--vscode-errorForeground)' }} title="Delete Variable">
                                                <Trash2 size={14} />
                                            </IconButton>
                                        </div>
                                        <FormGroup>
                                            <Label>Key Name</Label>
                                            <Input
                                                type="text"
                                                value={selectedGlobalKey}
                                                onChange={e => handleGlobalKeyChange(selectedGlobalKey, e.target.value)}
                                            />
                                        </FormGroup>
                                        <FormGroup>
                                            <Label>Value</Label>
                                            <Input
                                                type="text"
                                                value={globals[selectedGlobalKey]}
                                                onChange={e => handleGlobalValueChange(selectedGlobalKey, e.target.value)}
                                            />
                                        </FormGroup>
                                        <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', padding: '10px', background: 'var(--vscode-textBlockQuote-background)', borderLeft: '3px solid var(--vscode-textBlockQuote-border)' }}>
                                            <p style={{ margin: 0 }}>
                                                Use <code>{'{{' + selectedGlobalKey + '}}'}</code> in your requests to insert this value.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-disabledForeground)' }}>
                                        Select a global variable to edit
                                    </div>
                                )}
                            </EnvDetail>
                        </div>
                    )}

                    {activeTab === 'replaceRules' && (
                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                            <EnvList>
                                <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--vscode-panel-border)' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Rules</span>
                                    <IconButton onClick={handleAddRule} title="Add Rule">
                                        <Plus size={14} />
                                    </IconButton>
                                </div>
                                {replaceRules.map(rule => (
                                    <EnvItem
                                        key={rule.id}
                                        active={rule.id === selectedRuleId}
                                        selected={rule.id === selectedRuleId}
                                        onClick={() => setSelectedRuleId(rule.id)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', gap: 6 }}>
                                            <input
                                                type="checkbox"
                                                checked={rule.enabled}
                                                onChange={(e) => { e.stopPropagation(); handleRuleChange(rule.id, 'enabled', e.target.checked); }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', opacity: rule.enabled ? 1 : 0.5 }}>
                                                {rule.name || rule.id.slice(0, 8)}
                                            </span>
                                        </div>
                                    </EnvItem>
                                ))}
                                {replaceRules.length === 0 && (
                                    <div style={{ padding: '15px', textAlign: 'center', color: 'var(--vscode-disabledForeground)', fontSize: 12 }}>
                                        No rules yet.<br />Create one from Proxy view.
                                    </div>
                                )}
                            </EnvList>
                            <EnvDetail>
                                {selectedRuleId && replaceRules.find(r => r.id === selectedRuleId) ? (() => {
                                    const rule = replaceRules.find(r => r.id === selectedRuleId)!;
                                    return (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                <h3 style={{ margin: 0, textTransform: 'uppercase', fontSize: 12 }}>Edit Rule</h3>
                                                <IconButton onClick={() => handleDeleteRule(selectedRuleId)} style={{ color: 'var(--vscode-errorForeground)' }} title="Delete Rule">
                                                    <Trash2 size={14} />
                                                </IconButton>
                                            </div>
                                            <FormGroup>
                                                <Label>Name</Label>
                                                <Input
                                                    type="text"
                                                    value={rule.name || ''}
                                                    onChange={e => handleRuleChange(rule.id, 'name', e.target.value)}
                                                    placeholder="Rule Name"
                                                />
                                            </FormGroup>
                                            <FormGroup>
                                                <Label>XPath</Label>
                                                <Input
                                                    type="text"
                                                    value={rule.xpath}
                                                    onChange={e => handleRuleChange(rule.id, 'xpath', e.target.value)}
                                                    placeholder="//element"
                                                />
                                            </FormGroup>
                                            <FormGroup>
                                                <Label>Match Text</Label>
                                                <Input
                                                    type="text"
                                                    value={rule.matchText}
                                                    onChange={e => handleRuleChange(rule.id, 'matchText', e.target.value)}
                                                    placeholder="Text to find"
                                                />
                                            </FormGroup>
                                            <FormGroup>
                                                <Label>Replace With</Label>
                                                <Input
                                                    type="text"
                                                    value={rule.replaceWith}
                                                    onChange={e => handleRuleChange(rule.id, 'replaceWith', e.target.value)}
                                                    placeholder="Replacement text"
                                                />
                                            </FormGroup>
                                            <FormGroup>
                                                <Label>Apply To</Label>
                                                <Select
                                                    value={rule.target}
                                                    onChange={e => handleRuleChange(rule.id, 'target', e.target.value)}
                                                >
                                                    <option value="request">Request Only</option>
                                                    <option value="response">Response Only</option>
                                                    <option value="both">Both</option>
                                                </Select>
                                            </FormGroup>
                                            <FormGroup>
                                                <CheckboxLabel>
                                                    <input
                                                        type="checkbox"
                                                        checked={rule.enabled}
                                                        onChange={e => handleRuleChange(rule.id, 'enabled', e.target.checked)}
                                                    />
                                                    Enabled
                                                </CheckboxLabel>
                                            </FormGroup>
                                        </>
                                    );
                                })() : (
                                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-disabledForeground)' }}>
                                        Select a rule to edit
                                    </div>
                                )}
                            </EnvDetail>
                        </div>
                    )}

                    {activeTab === 'json' && (
                        <>
                            {parseError && (
                                <div style={{ padding: '8px', background: 'var(--vscode-inputValidation-errorBackground)', color: 'var(--vscode-inputValidation-errorForeground)' }}>
                                    <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                                    {parseError}
                                </div>
                            )}
                            <Editor
                                height="100%"
                                language="json"
                                theme="vs-dark"
                                value={jsonContent}
                                onChange={(val) => setJsonContent(val || '')}
                                options={{
                                    minimap: { enabled: false },
                                    automaticLayout: true,
                                    formatOnPaste: true,
                                    formatOnType: true
                                }}
                            />
                        </>
                    )}
                </ContentContainer>

                <ModalFooter>
                    <PrimaryButton onClick={handleSave}>
                        <Save size={14} /> Save Settings
                    </PrimaryButton>
                </ModalFooter>
            </ModalContent>
        </ModalOverlay>
    );
};
