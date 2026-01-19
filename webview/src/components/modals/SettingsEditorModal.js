import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styled from 'styled-components';
import Editor from '@monaco-editor/react';
import { X, Save, AlertTriangle, Settings, FileJson, Server, Globe, Replace, Cloud, Network } from 'lucide-react';
import { GeneralTab, EnvironmentsTab, GlobalsTab, ReplaceRulesTab, IntegrationsTab, ServerTab } from './settings';
import { bridge } from '../../utils/bridge';
const ModalOverlay = styled.div `
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
const ModalContent = styled.div `
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    width: 800px;
    height: 600px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    border: 1px solid var(--vscode-widget-border);
`;
const ModalHeader = styled.div `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px;
    background: var(--vscode-editor-background);
    border-bottom: 1px solid var(--vscode-widget-border);
`;
const Title = styled.h2 `
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
`;
const Button = styled.button `
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
const TabContainer = styled.div `
    display: flex;
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-sideBar-background);
`;
const Tab = styled.div `
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
const ContentContainer = styled.div `
    flex: 1;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
`;
const ModalFooter = styled.div `
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 10px 15px;
    border-top: 1px solid var(--vscode-widget-border);
    gap: 10px;
    background: var(--vscode-editor-background);
`;
const PrimaryButton = styled.button `
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
// Types imported from ./settings/SettingsTypes.ts
/** Enum for settings modal tab names */
export var SettingsTab;
(function (SettingsTab) {
    SettingsTab["GUI"] = "gui";
    SettingsTab["ENVIRONMENTS"] = "environments";
    SettingsTab["GLOBALS"] = "globals";
    SettingsTab["REPLACE_RULES"] = "replaceRules";
    SettingsTab["INTEGRATIONS"] = "integrations";
    SettingsTab["SERVER"] = "server";
    SettingsTab["JSON"] = "json";
})(SettingsTab || (SettingsTab = {}));
export const SettingsEditorModal = ({ rawConfig, onClose, onSave, initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || SettingsTab.GUI);
    const [jsonContent, setJsonContent] = useState(rawConfig || '{}');
    const [guiConfig, setGuiConfig] = useState({ version: 1 });
    const [parseError, setParseError] = useState(null);
    // Environments State
    const [selectedEnvKey, setSelectedEnvKey] = useState(null);
    // Globals State
    const [selectedGlobalKey, setSelectedGlobalKey] = useState(null);
    // Replace Rules State
    const [selectedRuleId, setSelectedRuleId] = useState(null);
    // Server Config State
    const [serverConfig, setServerConfig] = useState({
        mode: 'off',
        port: 9000,
        targetUrl: '',
        mockRules: [],
        passthroughEnabled: true
    });
    // Initial Parse
    useEffect(() => {
        try {
            const parsed = JSON.parse(rawConfig || '{}');
            setGuiConfig(parsed);
            setJsonContent(rawConfig || '{}');
            // Select active environment by default if available
            if (parsed.activeEnvironment && parsed.environments?.[parsed.activeEnvironment]) {
                setSelectedEnvKey(parsed.activeEnvironment);
            }
            else if (parsed.environments) {
                const keys = Object.keys(parsed.environments);
                if (keys.length > 0)
                    setSelectedEnvKey(keys[0]);
            }
        }
        catch (e) {
            console.error("Failed to parse initial config", e);
            setParseError("Could not parse config JSON. Defaulting to JSON view.");
            setActiveTab(SettingsTab.JSON);
        }
    }, [rawConfig]);
    const handleTabSwitch = (tab) => {
        if (tab === SettingsTab.JSON) {
            setActiveTab(SettingsTab.JSON);
            return;
        }
        // Switch to GUI or Environments: Attempt parse
        try {
            const parsed = JSON.parse(jsonContent);
            setGuiConfig(parsed);
            setParseError(null);
            setActiveTab(tab);
        }
        catch (e) {
            setParseError(`Cannot switch to ${tab.toUpperCase()}: Invalid JSON syntax.`);
        }
    };
    const handleGuiChange = (section, key, value) => {
        setGuiConfig(prev => {
            const updated = { ...prev };
            if (!updated[section])
                updated[section] = {};
            updated[section][key] = value;
            return updated;
        });
    };
    const handleEnvChange = (envKey, key, value) => {
        setGuiConfig(prev => {
            const updated = { ...prev };
            if (!updated.environments)
                updated.environments = {};
            if (!updated.environments[envKey])
                updated.environments[envKey] = {};
            updated.environments[envKey][key] = value;
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
        const colors = ['#58A6FF', '#7EE787', '#FF7B72', '#FFA657', '#D29922', '#F2CC60', '#3FB950', '#A371F7', '#79C0FF', '#FFA198', '#FFCB6B', '#C9D1D9'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        setGuiConfig(prev => {
            const updated = { ...prev };
            if (!updated.environments)
                updated.environments = {};
            updated.environments[finalName] = { endpoint_url: "", env: "", color: randomColor };
            return updated;
        });
        setSelectedEnvKey(finalName);
    };
    const handleDeleteEnv = (key) => {
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
        if (selectedEnvKey === key)
            setSelectedEnvKey(null);
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
            if (!updated.globals)
                updated.globals = {};
            updated.globals[finalName] = "";
            return updated;
        });
        setSelectedGlobalKey(finalName);
    };
    const handleDeleteGlobal = (key) => {
        setGuiConfig(prev => {
            const updated = { ...prev };
            if (updated.globals) {
                delete updated.globals[key];
            }
            return updated;
        });
        if (selectedGlobalKey === key)
            setSelectedGlobalKey(null);
    };
    const handleGlobalKeyChange = (oldKey, newKey) => {
        if (oldKey === newKey)
            return;
        if (guiConfig.globals?.[newKey] !== undefined) {
            // Key conflict
            return;
        }
        setGuiConfig(prev => {
            const updated = { ...prev };
            if (!updated.globals)
                updated.globals = {};
            const val = updated.globals[oldKey];
            delete updated.globals[oldKey];
            updated.globals[newKey] = val;
            return updated;
        });
        setSelectedGlobalKey(newKey);
    };
    const handleGlobalValueChange = (key, value) => {
        setGuiConfig(prev => {
            const updated = { ...prev };
            if (!updated.globals)
                updated.globals = {};
            updated.globals[key] = value;
            return updated;
        });
    };
    const handleSetActive = (key) => {
        setGuiConfig(prev => ({ ...prev, activeEnvironment: key }));
    };
    const handleSave = () => {
        if (activeTab === 'json') {
            onSave(jsonContent);
        }
        else {
            onSave('', guiConfig);
        }
    };
    // environments and globals are managed by tab components via guiConfig prop
    const replaceRules = guiConfig.replaceRules || [];
    const handleAddRule = () => {
        const newRule = {
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
    const handleDeleteRule = (id) => {
        setGuiConfig(prev => ({
            ...prev,
            replaceRules: (prev.replaceRules || []).filter(r => r.id !== id)
        }));
        if (selectedRuleId === id)
            setSelectedRuleId(null);
    };
    const handleRuleChange = (id, field, value) => {
        setGuiConfig(prev => ({
            ...prev,
            replaceRules: (prev.replaceRules || []).map(r => r.id === id ? { ...r, [field]: value } : r)
        }));
    };
    return (_jsx(ModalOverlay, { onClick: (e) => {
            if (e.target === e.currentTarget)
                onClose();
        }, children: _jsxs(ModalContent, { children: [_jsxs(ModalHeader, { children: [_jsx(Title, { children: "Settings" }), _jsx(Button, { onClick: onClose, children: _jsx(X, { size: 16 }) })] }), _jsxs(TabContainer, { children: [_jsxs(Tab, { active: activeTab === SettingsTab.GUI, onClick: () => handleTabSwitch(SettingsTab.GUI), children: [_jsx(Settings, { size: 14 }), " General"] }), _jsxs(Tab, { active: activeTab === SettingsTab.ENVIRONMENTS, onClick: () => handleTabSwitch(SettingsTab.ENVIRONMENTS), children: [_jsx(Server, { size: 14 }), " Environments"] }), _jsxs(Tab, { active: activeTab === SettingsTab.GLOBALS, onClick: () => handleTabSwitch(SettingsTab.GLOBALS), children: [_jsx(Globe, { size: 14 }), " Globals"] }), _jsxs(Tab, { active: activeTab === SettingsTab.REPLACE_RULES, onClick: () => handleTabSwitch(SettingsTab.REPLACE_RULES), children: [_jsx(Replace, { size: 14 }), " Replace Rules"] }), _jsxs(Tab, { active: activeTab === SettingsTab.INTEGRATIONS, onClick: () => handleTabSwitch(SettingsTab.INTEGRATIONS), children: [_jsx(Cloud, { size: 14 }), " Integrations"] }), _jsxs(Tab, { active: activeTab === SettingsTab.SERVER, onClick: () => handleTabSwitch(SettingsTab.SERVER), children: [_jsx(Network, { size: 14 }), " Server"] }), _jsxs(Tab, { active: activeTab === SettingsTab.JSON, onClick: () => handleTabSwitch(SettingsTab.JSON), style: { marginLeft: 'auto', borderRight: 'none', borderLeft: '1px solid var(--vscode-panel-border)' }, children: [_jsx(FileJson, { size: 14 }), " JSON (Advanced)"] })] }), _jsxs(ContentContainer, { children: [activeTab === SettingsTab.GUI && (_jsx(GeneralTab, { config: guiConfig, onChange: handleGuiChange })), activeTab === SettingsTab.ENVIRONMENTS && (_jsx(EnvironmentsTab, { config: guiConfig, selectedEnvKey: selectedEnvKey, setSelectedEnvKey: setSelectedEnvKey, onAddEnv: handleAddEnv, onDeleteEnv: handleDeleteEnv, onSetActive: handleSetActive, onEnvChange: handleEnvChange, onImportEnvironments: (envs, activeEnv) => {
                                setGuiConfig(prev => ({
                                    ...prev,
                                    environments: { ...prev.environments, ...envs },
                                    activeEnvironment: activeEnv || prev.activeEnvironment
                                }));
                            } })), activeTab === SettingsTab.GLOBALS && (_jsx(GlobalsTab, { config: guiConfig, selectedGlobalKey: selectedGlobalKey, setSelectedGlobalKey: setSelectedGlobalKey, onAddGlobal: handleAddGlobal, onDeleteGlobal: handleDeleteGlobal, onGlobalKeyChange: handleGlobalKeyChange, onGlobalValueChange: handleGlobalValueChange })), activeTab === SettingsTab.REPLACE_RULES && (_jsx(ReplaceRulesTab, { rules: replaceRules, selectedRuleId: selectedRuleId, setSelectedRuleId: setSelectedRuleId, onAddRule: handleAddRule, onDeleteRule: handleDeleteRule, onRuleChange: handleRuleChange })), activeTab === SettingsTab.INTEGRATIONS && (_jsx(IntegrationsTab, { config: guiConfig, onConfigChange: (field, value) => setGuiConfig(prev => ({ ...prev, [field]: value })), sendMessage: (msg) => bridge.sendMessage(msg) })), activeTab === SettingsTab.SERVER && (_jsx(ServerTab, { config: guiConfig, serverConfig: serverConfig, onServerConfigChange: (updates) => setServerConfig(prev => ({ ...prev, ...updates })), configPath: guiConfig.lastConfigPath || null, onSelectConfigFile: () => bridge.sendMessage({ command: 'selectConfigFile' }), onInjectConfig: () => bridge.sendMessage({
                                command: 'injectProxy',
                                path: guiConfig.lastConfigPath,
                                proxyUrl: `http://localhost:${serverConfig.port || 9000}`
                            }), onRestoreConfig: () => bridge.sendMessage({
                                command: 'restoreProxy',
                                path: guiConfig.lastConfigPath
                            }) })), activeTab === SettingsTab.JSON && (_jsxs(_Fragment, { children: [parseError && (_jsxs("div", { style: { padding: '8px', background: 'var(--vscode-inputValidation-errorBackground)', color: 'var(--vscode-inputValidation-errorForeground)' }, children: [_jsx(AlertTriangle, { size: 14, style: { verticalAlign: 'middle', marginRight: '6px' } }), parseError] })), _jsx(Editor, { height: "100%", language: "json", theme: "vs-dark", value: jsonContent, onChange: (val) => setJsonContent(val || ''), options: {
                                        minimap: { enabled: false },
                                        automaticLayout: true,
                                        formatOnPaste: true,
                                        formatOnType: true
                                    } })] }))] }), _jsx(ModalFooter, { children: _jsxs(PrimaryButton, { onClick: handleSave, children: [_jsx(Save, { size: 14 }), " Save Settings"] }) })] }) }));
};
