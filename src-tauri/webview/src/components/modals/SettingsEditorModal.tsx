import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import Editor, { Monaco } from '@monaco-editor/react';
import { AlertTriangle, Settings, FileJson, Globe, Cloud } from 'lucide-react';
import { GeneralTab, EnvironmentsTab, GlobalsTab, IntegrationsTab, ApinoxConfig } from './settings';
import { bridge, isTauri } from '../../utils/bridge';
import { FrontendCommand } from '@shared/messages';
import { useTheme } from '@apinox/request-editor'; // Use package ThemeContext
import { Modal } from './Modal';
import { TAG_COLORS } from '../../styles/colors';
import { SPACING_SM, SPACING_MD } from '../../styles/spacing';

const ModalWrapper = styled.div`
    display: flex;
    flex-direction: column;
    height: calc(95vh - 120px);
    overflow: hidden;
`;

const TabContainer = styled.div`
    display: flex;
    border-bottom: 1px solid var(--apinox-panel-border);
    background: var(--apinox-sideBar-background);
`;

const Tab = styled.div<{ $active: boolean }>`
    padding: ${SPACING_SM} ${SPACING_MD};
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-top: 1px solid transparent;
    border-right: 1px solid var(--apinox-panel-border);
    background: ${props => props.$active ? 'var(--apinox-editor-background)' : 'transparent'};
    color: ${props => props.$active ? 'var(--apinox-tab-activeForeground)' : 'var(--apinox-tab-inactiveForeground)'};

    &:hover {
        color: var(--apinox-tab-activeForeground);
    }
`;

const ContentContainer = styled.div`
    flex: 1;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
`;



// Save button removed - settings auto-save on tab changes/close

// Types imported from ./settings/SettingsTypes.ts

/** Enum for settings modal tab names */
enum SettingsTab {
    GUI = 'gui',
    ENVIRONMENTS = 'environments',
    GLOBALS = 'globals',
    INTEGRATIONS = 'integrations',
    JSON = 'json'
}

interface SettingsEditorModalProps {
    rawConfig: string;
    onClose: () => void;
    onSave: (content: string, config?: any) => void;
    initialTab?: string | null;
}

export const SettingsEditorModal: React.FC<SettingsEditorModalProps> = ({ rawConfig, onClose, onSave, initialTab }) => {
    const { theme } = useTheme();
    const monacoRef = useRef<Monaco | null>(null);
    const lastSavedConfigRef = useRef<string>('');
    const [editorTheme, setEditorTheme] = useState<string>('vs-dark');
    const [activeTab, setActiveTab] = useState<SettingsTab>(
        (initialTab as SettingsTab) || SettingsTab.GUI
    );
    const [jsonContent, setJsonContent] = useState(rawConfig || '{}');
    const [guiConfig, setGuiConfig] = useState<ApinoxConfig>({ version: 1 });
    const [parseError, setParseError] = useState<string | null>(null);
    const [configLoaded, setConfigLoaded] = useState(false);

    // Environments State
    const [selectedEnvKey, setSelectedEnvKey] = useState<string | null>(null);
    // Globals State
    const [selectedGlobalKey, setSelectedGlobalKey] = useState<string | null>(null);

    // Status message for inject/restore operations
    const [injectionStatus, setInjectionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const applyEditorTheme = (monacoInstance: Monaco) => {
        const root = document.documentElement;
        const getVar = (name: string, fallback: string) => {
            const value = getComputedStyle(root).getPropertyValue(name).trim();
            return value || fallback;
        };

        const isLight = theme.includes('light');
        const themeId = `apinox-${theme}`;

        monacoInstance.editor.defineTheme(themeId, {
            base: isLight ? 'vs' : 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': getVar('--apinox-editor-background', isLight ? '#ffffff' : '#1e1e1e'),
                'editor.foreground': getVar('--apinox-editor-foreground', isLight ? '#000000' : '#d4d4d4'),
                'editor.selectionBackground': getVar('--apinox-editor-selectionBackground', isLight ? '#add6ff' : '#264f78'),
                'editor.lineHighlightBackground': getVar('--apinox-editor-lineHighlightBackground', 'transparent'),
                'editorCursor.foreground': getVar('--apinox-editorCursor-foreground', isLight ? '#000000' : '#ffffff'),
                'editorLineNumber.foreground': getVar('--apinox-editorLineNumber-foreground', isLight ? '#999999' : '#858585'),
                'editorLineNumber.activeForeground': getVar('--apinox-editorLineNumber-activeForeground', isLight ? '#000000' : '#c6c6c6'),
                'editorWhitespace.foreground': getVar('--apinox-editorWhitespace-foreground', isLight ? '#d3d3d3' : '#404040')
            }
        });

        monacoInstance.editor.setTheme(themeId);
        setEditorTheme(themeId);
    };

    useEffect(() => {
        if (monacoRef.current) {
            applyEditorTheme(monacoRef.current);
        }
    }, [theme]);

    // Initial Parse
    useEffect(() => {
        try {
            const parsed = JSON.parse(rawConfig || '{}');
            setGuiConfig(parsed);
            setJsonContent(rawConfig || '{}');
            lastSavedConfigRef.current = JSON.stringify(parsed);
            const rawTrimmed = (rawConfig || '').trim();
            setConfigLoaded(rawTrimmed.length > 0 && rawTrimmed !== '{}');
            
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
            setActiveTab(SettingsTab.JSON);
        }
    }, [rawConfig]);

    useEffect(() => {
        const rawTrimmed = (rawConfig || '').trim();
        if (!rawTrimmed || rawTrimmed === '{}') {
            bridge.sendMessageAsync({ command: FrontendCommand.GetSettings })
                .then((data: any) => {
                    const raw = data?.raw;
                    const config = data?.config ?? data;
                    if (raw && raw.trim().length > 0) {
                        try {
                            const parsed = JSON.parse(raw);
                            setGuiConfig(parsed);
                            setJsonContent(raw);
                            lastSavedConfigRef.current = JSON.stringify(parsed);
                            setConfigLoaded(true);
                            return;
                        } catch (e) {
                            // Fall back to config object below
                        }
                    }

                    if (config) {
                        setGuiConfig(config);
                        const serialized = JSON.stringify(config, null, 2);
                        setJsonContent(serialized);
                        lastSavedConfigRef.current = JSON.stringify(config);
                        setConfigLoaded(true);
                    }
                })
                .catch(() => {
                    // ignore
                });
        }
    }, []);

    const handleTabSwitch = (tab: SettingsTab) => {
        if (tab === SettingsTab.JSON) {
            persistGuiConfig(guiConfig);
            setJsonContent(JSON.stringify(guiConfig, null, 2));
            setParseError(null);
            setActiveTab(SettingsTab.JSON);
            return;
        }

        if (activeTab === SettingsTab.JSON) {
            if (!tryPersistJson()) return;
            setActiveTab(tab);
            return;
        }

        persistGuiConfig(guiConfig);
        setParseError(null);
        setActiveTab(tab);
    };

    const handleClose = () => {
        if (activeTab === SettingsTab.JSON) {
            if (!tryPersistJson()) return;
        } else {
            // Server config removed - proxy features moved to APIprox
            persistGuiConfig(guiConfig);
        }
        onClose();
    };

    const handleGuiChange = (section: keyof ApinoxConfig, key: string, value: any) => {
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

        // Auto-suggest a color
        const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];

        setGuiConfig(prev => {
            const updated = { ...prev };
            if (!updated.environments) updated.environments = {};
            updated.environments[finalName] = { endpoint_url: "", env: "", color: randomColor };
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

    const persistGuiConfig = (config: ApinoxConfig) => {
        if (!configLoaded) return;
        onSave('', config);
        lastSavedConfigRef.current = JSON.stringify(config);
    };

    const tryPersistJson = () => {
        try {
            const parsed = JSON.parse(jsonContent);
            setGuiConfig(parsed);
            setParseError(null);
            if (!configLoaded) {
                lastSavedConfigRef.current = JSON.stringify(parsed);
                return true;
            }
            onSave('', parsed);
            lastSavedConfigRef.current = JSON.stringify(parsed);
            return true;
        } catch (e) {
            setParseError('Cannot save JSON: Invalid syntax.');
            return false;
        }
    };

    useEffect(() => {
        if (!configLoaded) return;
        if (activeTab === SettingsTab.JSON) return;

        const serialized = JSON.stringify(guiConfig);
        if (serialized === lastSavedConfigRef.current) return;

        const handle = setTimeout(() => {
            persistGuiConfig(guiConfig);
        }, 400);

        return () => clearTimeout(handle);
    }, [guiConfig, activeTab, configLoaded]);

    return (
        <Modal
            isOpen={true}
            onClose={handleClose}
            title="Settings"
            size="large"
            showCloseButton={true}
        >
            <ModalWrapper>
                <TabContainer>
                    <Tab $active={activeTab === SettingsTab.GUI} onClick={() => handleTabSwitch(SettingsTab.GUI)}>
                        <Settings size={14} /> General
                    </Tab>
                    <Tab $active={activeTab === SettingsTab.ENVIRONMENTS} onClick={() => handleTabSwitch(SettingsTab.ENVIRONMENTS)}>
                        <Globe size={14} /> Environments
                    </Tab>
                    <Tab $active={activeTab === SettingsTab.GLOBALS} onClick={() => handleTabSwitch(SettingsTab.GLOBALS)}>
                        <Globe size={14} /> Globals
                    </Tab>
                    <Tab $active={activeTab === SettingsTab.INTEGRATIONS} onClick={() => handleTabSwitch(SettingsTab.INTEGRATIONS)}>
                        <Cloud size={14} /> Integrations
                    </Tab>
                    <Tab $active={activeTab === SettingsTab.JSON} onClick={() => handleTabSwitch(SettingsTab.JSON)} style={{ marginLeft: 'auto', borderRight: 'none', borderLeft: '1px solid var(--apinox-panel-border)' }}>
                        <FileJson size={14} /> JSON (Advanced)
                    </Tab>
                </TabContainer>

                <ContentContainer>
                    {activeTab === SettingsTab.GUI && (
                        <GeneralTab config={guiConfig} onChange={handleGuiChange} />
                    )}

                    {activeTab === SettingsTab.ENVIRONMENTS && (
                        <EnvironmentsTab
                            config={guiConfig}
                            selectedEnvKey={selectedEnvKey}
                            setSelectedEnvKey={setSelectedEnvKey}
                            onAddEnv={handleAddEnv}
                            onDeleteEnv={handleDeleteEnv}
                            onSetActive={handleSetActive}
                            onEnvChange={handleEnvChange}
                            onImportEnvironments={(envs, activeEnv) => {
                                setGuiConfig(prev => ({
                                    ...prev,
                                    environments: { ...prev.environments, ...envs },
                                    activeEnvironment: activeEnv || prev.activeEnvironment
                                }));
                            }}
                        />
                    )}

                    {activeTab === SettingsTab.GLOBALS && (
                        <GlobalsTab
                            config={guiConfig}
                            selectedGlobalKey={selectedGlobalKey}
                            setSelectedGlobalKey={setSelectedGlobalKey}
                            onAddGlobal={handleAddGlobal}
                            onDeleteGlobal={handleDeleteGlobal}
                            onGlobalKeyChange={handleGlobalKeyChange}
                            onGlobalValueChange={handleGlobalValueChange}
                        />
                    )}

                    {activeTab === SettingsTab.INTEGRATIONS && (
                        <IntegrationsTab
                            config={guiConfig}
                            onConfigChange={(field, value) => setGuiConfig(prev => ({ ...prev, [field]: value }))}
                            sendMessage={(msg) => bridge.sendMessage(msg)}
                        />
                    )}

                    {activeTab === SettingsTab.JSON && (
                        <>
                            {parseError && (
                                <div style={{ padding: '8px', background: 'var(--apinox-inputValidation-errorBackground)', color: 'var(--apinox-inputValidation-errorForeground)' }}>
                                    <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                                    {parseError}
                                </div>
                            )}
                            <Editor
                                height="100%"
                                language="json"
                                theme={editorTheme}
                                value={jsonContent}
                                onChange={(val) => setJsonContent(val || '')}
                                options={{
                                    minimap: { enabled: false },
                                    automaticLayout: true,
                                    formatOnPaste: true,
                                    formatOnType: true
                                }}
                                onMount={(_editor, monaco) => {
                                    monacoRef.current = monaco;
                                    applyEditorTheme(monaco);
                                }}
                            />
                        </>
                    )}
                </ContentContainer>

            </ModalWrapper>
        </Modal>
    );
};
