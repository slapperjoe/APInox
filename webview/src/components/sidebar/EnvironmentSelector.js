import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
const envColors = [
    'var(--vscode-charts-blue)',
    'var(--vscode-charts-green)',
    'var(--vscode-charts-red)',
    'var(--vscode-charts-yellow)',
    'var(--vscode-charts-orange)',
    'var(--vscode-charts-purple)',
    'var(--vscode-charts-foreground)',
    'var(--vscode-textLink-foreground)',
    'var(--vscode-terminal-ansiCyan)',
    'var(--vscode-terminal-ansiMagenta)',
    'var(--vscode-terminal-ansiYellow)',
    'var(--vscode-terminal-ansiGreen)'
];
const getEnvColor = (env, environments) => {
    if (!environments)
        return 'var(--vscode-charts-green)';
    const envData = environments[env];
    if (envData?.color)
        return envData.color;
    const index = Object.keys(environments).indexOf(env);
    return index >= 0 ? envColors[index % envColors.length] : 'var(--vscode-charts-green)';
};
export const EnvironmentSelector = ({ activeEnvironment, environments, onChangeEnvironment }) => {
    const [showEnvMenu, setShowEnvMenu] = useState(false);
    if (!activeEnvironment)
        return null;
    return (_jsxs("div", { style: { position: 'relative' }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '8px 4px',
                    marginBottom: 5,
                    cursor: onChangeEnvironment ? 'pointer' : 'default',
                    opacity: showEnvMenu ? 0.7 : 1
                }, title: `Active Environment: ${activeEnvironment}`, onClick: () => onChangeEnvironment && setShowEnvMenu(!showEnvMenu), children: [_jsx("div", { style: {
                            fontSize: 9,
                            fontWeight: 600,
                            color: getEnvColor(activeEnvironment, environments),
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            maxWidth: 45,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }, children: activeEnvironment }), _jsx("div", { style: {
                            fontSize: 7,
                            color: 'var(--vscode-activityBar-inactiveForeground)',
                            marginTop: 2
                        }, children: "ENV" })] }), showEnvMenu && environments && (_jsxs(_Fragment, { children: [_jsx("div", { style: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }, onClick: () => setShowEnvMenu(false) }), _jsxs("div", { style: {
                            position: 'absolute',
                            left: 50,
                            bottom: 0,
                            width: 200,
                            backgroundColor: 'var(--vscode-menu-background)',
                            border: '1px solid var(--vscode-menu-border)',
                            borderRadius: 4,
                            boxShadow: '0 2px 8px var(--vscode-widget-shadow)',
                            zIndex: 1000,
                            display: 'flex',
                            flexDirection: 'column',
                            padding: 4
                        }, children: [_jsx("div", { style: {
                                    padding: '4px 8px',
                                    fontSize: 10,
                                    fontWeight: 'bold',
                                    borderBottom: '1px solid var(--vscode-menu-separatorBackground)',
                                    marginBottom: 4,
                                    color: 'var(--vscode-menu-foreground)',
                                    textTransform: 'uppercase'
                                }, children: "Switch Environment" }), Object.keys(environments).map((env, index) => {
                                const fallbackColor = envColors[index % envColors.length];
                                const color = environments[env].color || fallbackColor;
                                return (_jsxs("div", { onClick: () => {
                                        if (onChangeEnvironment) {
                                            onChangeEnvironment(env);
                                            setShowEnvMenu(false);
                                        }
                                    }, style: {
                                        padding: '6px 12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        borderRadius: 3,
                                        backgroundColor: activeEnvironment === env ? 'var(--vscode-menu-selectionBackground)' : 'transparent',
                                        color: activeEnvironment === env ? 'var(--vscode-menu-selectionForeground)' : 'var(--vscode-menu-foreground)'
                                    }, onMouseEnter: (e) => {
                                        if (activeEnvironment !== env) {
                                            e.currentTarget.style.backgroundColor = 'var(--vscode-menu-selectionBackground)';
                                            e.currentTarget.style.color = 'var(--vscode-menu-selectionForeground)';
                                        }
                                    }, onMouseLeave: (e) => {
                                        if (activeEnvironment !== env) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.color = 'var(--vscode-menu-foreground)';
                                        }
                                    }, children: [_jsx("div", { style: { width: 8, height: 8, borderRadius: '50%', backgroundColor: color } }), _jsx("span", { style: { fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: env })] }, env));
                            })] })] }))] }));
};
