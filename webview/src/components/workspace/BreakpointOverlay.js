import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Bug, Play } from 'lucide-react';
import { MonacoRequestEditor } from '../MonacoRequestEditor';
import { Content, ToolbarButton } from '../../styles/WorkspaceLayout.styles';
/**
 * Full-screen overlay shown when a breakpoint is hit.
 * Allows editing request/response content before continuing.
 */
export const BreakpointOverlay = ({ breakpoint, content, onContentChange, timeRemaining, onResolve, config }) => {
    const bp = breakpoint;
    const seconds = Math.ceil(timeRemaining / 1000);
    const progress = (timeRemaining / bp.timeoutMs) * 100;
    return (_jsxs(Content, { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsxs("div", { style: {
                    background: 'var(--vscode-editor-inactiveSelectionBackground)', // Fallback / Base
                    borderTop: '2px solid var(--vscode-debugIcon-breakpointForeground)',
                    padding: '12px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: 'white'
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx(Bug, { size: 20 }), _jsxs("div", { children: [_jsxs("strong", { children: ["Breakpoint Hit: ", bp.breakpointName] }), _jsxs("span", { style: { marginLeft: 10, opacity: 0.9 }, children: ["(", bp.type === 'request' ? 'Outgoing Request' : 'Incoming Response', ")"] })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 15 }, children: [_jsx("div", { style: {
                                    width: 120,
                                    height: 6,
                                    background: 'var(--vscode-toolbar-hoverBackground)',
                                    borderRadius: 3,
                                    overflow: 'hidden'
                                }, children: _jsx("div", { style: {
                                        width: `${progress}%`,
                                        height: '100%',
                                        background: 'white',
                                        transition: 'width 1s linear'
                                    } }) }), _jsxs("span", { style: { fontWeight: 'bold', minWidth: 40 }, children: [seconds, "s"] }), _jsxs(ToolbarButton, { onClick: () => {
                                    // Minify XML back to single line (remove pretty-print formatting)
                                    const minified = content.replace(/>\s+</g, '><').trim();
                                    onResolve(minified);
                                }, style: { background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', padding: '6px 12px' }, children: [_jsx(Play, { size: 14 }), " Continue"] }), _jsx(ToolbarButton, { onClick: () => onResolve(bp.content, true), style: { background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', padding: '6px 12px' }, children: "Cancel" })] })] }), _jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }, children: [_jsx("div", { style: { padding: '10px 20px', borderBottom: '1px solid var(--vscode-panel-border)' }, children: _jsxs("span", { style: { fontWeight: 'bold' }, children: ["Edit ", bp.type === 'request' ? 'Request' : 'Response', " Content:"] }) }), _jsx("div", { style: { flex: 1, position: 'relative' }, children: _jsx(MonacoRequestEditor, { value: content, onChange: onContentChange, readOnly: false, autoFoldElements: config?.ui?.autoFoldElements }) })] })] }));
};
