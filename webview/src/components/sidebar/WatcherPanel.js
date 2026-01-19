import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Clock, Play, Square, Trash2, Download } from 'lucide-react';
import { HeaderButton, ServiceItem } from './shared/SidebarStyles';
import { exportWatcherEvents } from '../../utils/csvExport';
export const WatcherPanel = ({ history, isRunning, onStart, onStop, onClear, onSelectEvent }) => {
    const handleExport = () => {
        if (history.length === 0)
            return;
        const exportData = history.map(e => ({
            id: e.id,
            timestamp: e.timestamp || Date.now(),
            type: e.responseContent ? 'request_response' : 'request',
            method: 'SOAP',
            url: e.requestOperation || 'Unknown',
            status: e.responseContent ? 200 : undefined,
            duration: undefined
        }));
        exportWatcherEvents(exportData);
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsxs("div", { style: { display: 'flex', borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)', padding: '5px 10px', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--vscode-sideBarTitle-foreground)', flex: 1 }, children: "File Watcher" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center' }, children: [_jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); if (isRunning)
                                    onStop();
                                else
                                    onStart(); }, title: isRunning ? "Stop Watcher" : "Start Watcher", style: { color: isRunning ? 'var(--vscode-testing-iconFailed)' : 'var(--vscode-testing-iconPassed)' }, children: isRunning ? _jsx(Square, { size: 14 }) : _jsx(Play, { size: 14 }) }), _jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); handleExport(); }, title: "Export to CSV", style: { marginLeft: 5, opacity: history.length === 0 ? 0.5 : 1 }, disabled: history.length === 0, children: _jsx(Download, { size: 14 }) }), _jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); onClear(); }, title: "Clear History", style: { marginLeft: 5 }, children: _jsx(Trash2, { size: 14 }) })] })] }), _jsx("div", { style: { padding: 10, flex: 1, overflowY: 'auto' }, children: history.length === 0 ? (_jsx("div", { style: { color: 'var(--vscode-descriptionForeground)', textAlign: 'center', marginTop: 20 }, children: isRunning ? (_jsxs(_Fragment, { children: ["Watching C:\\temp\\requestXML.xml...", _jsx("br", {}), "Waiting for events."] })) : (_jsxs(_Fragment, { children: ["Watcher is stopped.", _jsx("br", {}), "Press Play to begin."] })) })) : (history.map(event => (_jsxs(ServiceItem, { onClick: () => onSelectEvent(event), children: [_jsx(Clock, { size: 14, style: { marginRight: 5 } }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontWeight: 'bold' }, children: (() => {
                                        const reqOp = event.requestOperation || 'Unknown';
                                        const resOp = event.responseOperation;
                                        if (!resOp)
                                            return reqOp;
                                        const reqBase = reqOp.replace(/Request$/, '');
                                        const resBase = resOp.replace(/Response$/, '');
                                        if (reqBase === resBase)
                                            return reqBase;
                                        return `${reqOp} - ${resOp} `;
                                    })() }), _jsx("div", { style: { fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }, children: event.timestampLabel }), _jsx("div", { style: { fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }, children: event.responseContent ? 'Request & Response' : 'Request Pending...' })] })] }, event.id)))) })] }));
};
