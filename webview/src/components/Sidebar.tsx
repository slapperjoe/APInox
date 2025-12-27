import React, { useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { ChevronRight, ChevronDown, Plus, Trash2, Globe, FileCode, Play, Save, FolderOpen, FolderPlus, Settings, HelpCircle, Eye, Clock, Square, Network, FolderOpen as FolderIcon, Shield, FileDown, Compass } from 'lucide-react';
import { SoapUIInterface, SoapUIOperation, SoapUIRequest, SoapUIProject, WatcherEvent, SidebarView } from '../models';
import { formatXml } from '../utils/xmlFormatter';
import { ProjectTestTree } from './ProjectTestTree';

// Styled Components
// Styled Components
const DirtyMarker = styled.span`
    color: var(--vscode-charts-yellow);
    margin-left: 5px;
    font-size: 1.2em;
    line-height: 0.5;
`;

const SectionHeader = styled.div`
    padding: 5px 10px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    user-select: none;
    &:hover {
        background-color: var(--vscode-list-hoverBackground);
    }
`;

const SectionTitle = styled.div`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const ServiceItem = styled.div`
    padding: 5px 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    &:hover {
        background-color: var(--vscode-list-hoverBackground);
    }
`;

const OperationItem = styled.div<{ active?: boolean }>`
    padding: 5px 10px;
    padding-left: 20px;
    cursor: pointer;
    background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit'};
    display: flex;
    align-items: center;
    &:hover {
        background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-list-hoverBackground)'};
    }
`;

const RequestItem = styled.div<{ active?: boolean }>`
    padding: 5px 10px;
    padding-left: 45px;
    cursor: pointer;
    font-size: 0.9em;
    background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit'};
    display: flex;
    align-items: center;
    &:hover {
        background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-list-hoverBackground)'};
    }
`;

const shake = keyframes`
    0% { transform: translateX(0); }
    25% { transform: translateX(2px) rotate(5deg); }
    50% { transform: translateX(-2px) rotate(-5deg); }
    75% { transform: translateX(2px) rotate(5deg); }
    100% { transform: translateX(0); }
`;

const HeaderButton = styled.button<{ shake?: boolean }>`
    background: transparent;
    border: none;
    color: var(--vscode-icon-foreground);
    cursor: pointer;
    padding: 2px;
    margin-left: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    ${props => props.shake && css`animation: ${shake} 0.5s ease-in-out;`}
    &:hover {
        background-color: var(--vscode-toolbar-hoverBackground);
        border-radius: 3px;
    }
`;

const Input = styled.input`
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 4px;
    flex: 1;
    outline: none;
    &:focus {
        border-color: var(--vscode-focusBorder);
    }
`;

interface SidebarProps {
    savedProjects: Set<string>;
    explorerExpanded: boolean;
    toggleExplorerExpand: () => void;
    exploredInterfaces: SoapUIInterface[];
    projects: SoapUIProject[];
    inputType: 'url' | 'file';
    setInputType: (type: 'url' | 'file') => void;
    wsdlUrl: string;
    setWsdlUrl: (url: string) => void;
    selectedFile: string | null;
    loadWsdl: () => void;
    pickLocalWsdl: () => void;
    downloadStatus: string[] | null;

    // Actions
    addToProject: (iface: SoapUIInterface) => void;
    addAllToProject: () => void;
    clearExplorer: () => void;
    removeFromExplorer: (iface: SoapUIInterface) => void;

    toggleProjectExpand: (name: string) => void;
    toggleInterfaceExpand: (projName: string, ifaceName: string) => void;
    toggleOperationExpand: (projName: string, ifaceName: string, opName: string) => void;
    toggleExploredInterface: (iName: string) => void;
    toggleExploredOperation: (iName: string, oName: string) => void;

    loadProject: () => void;
    saveProject: (proj: SoapUIProject) => void;
    closeProject: (name: string) => void;
    onAddProject: () => void;

    // Selection State
    selectedProjectName: string | null;
    setSelectedProjectName: (name: string | null) => void;
    selectedInterface: SoapUIInterface | null;
    setSelectedInterface: (iface: SoapUIInterface | null) => void;
    selectedOperation: SoapUIOperation | null;
    setSelectedOperation: (op: SoapUIOperation | null) => void;
    selectedRequest: SoapUIRequest | null;
    setSelectedRequest: (req: SoapUIRequest | null) => void;
    setResponse: (res: any) => void;

    handleContextMenu: (e: React.MouseEvent, type: string, data: any, isExplorer?: boolean) => void;
    onAddRequest?: (op: SoapUIOperation) => void;
    onDeleteRequest?: (req: SoapUIRequest) => void;
    deleteConfirm: string | null;
    backendConnected: boolean;

    // Settings
    onOpenSettings?: () => void;
    onOpenHelp?: () => void;

    // Computed
    workspaceDirty?: boolean;
    showBackendStatus?: boolean;
    onSaveUiState?: () => void;

    // View State
    // Navigation
    activeView: SidebarView;
    onChangeView: (view: SidebarView) => void;

    // Test Runner
    onAddSuite: (projectName: string) => void;
    onDeleteSuite: (suiteId: string) => void;
    onRunSuite: (suiteId: string) => void;
    onAddTestCase: (suiteId: string) => void;
    onRunCase: (caseId: string) => void;
    onDeleteTestCase: (caseId: string) => void;
    onSelectSuite?: (suiteId: string) => void;
    onSelectTestCase?: (caseId: string) => void;

    // Watcher
    watcherHistory: WatcherEvent[];
    onSelectWatcherEvent: (event: WatcherEvent) => void;
    watcherRunning: boolean;
    onStartWatcher: () => void;
    onStopWatcher: () => void;
    onClearWatcher: () => void;

    // Proxy
    proxyRunning: boolean;
    onStartProxy: () => void;
    onStopProxy: () => void;
    proxyConfig: { port: number, target: string, systemProxyEnabled?: boolean };
    onUpdateProxyConfig: (config: { port: number, target: string, systemProxyEnabled?: boolean }) => void;
    proxyHistory: WatcherEvent[];
    onClearProxy: () => void;
    // Reporting
    onSaveProxyHistory: (content: string) => void;
    // Config Switcher
    configPath: string | null;
    onSelectConfigFile: () => void;
    onInjectProxy: () => void;
    onRestoreProxy: () => void;
    onOpenCertificate?: () => void;
    onDeleteInterface?: (iface: SoapUIInterface) => void;
    onDeleteOperation?: (op: SoapUIOperation, iface: SoapUIInterface) => void;
    onToggleSuiteExpand?: (suiteId: string) => void;
    onToggleCaseExpand?: (caseId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    exploredInterfaces, projects,
    inputType, setInputType, wsdlUrl, setWsdlUrl, selectedFile, loadWsdl, pickLocalWsdl, downloadStatus,
    addToProject, addAllToProject, clearExplorer, removeFromExplorer,
    toggleProjectExpand, toggleInterfaceExpand, toggleOperationExpand,
    toggleExploredInterface, toggleExploredOperation,
    loadProject, saveProject, closeProject, onAddProject,
    onAddSuite, onDeleteSuite,
    onRunSuite,
    onAddTestCase, onRunCase, onDeleteTestCase,
    onSelectSuite, onSelectTestCase,
    setSelectedProjectName,
    selectedInterface, setSelectedInterface,
    selectedOperation, setSelectedOperation,
    selectedRequest, setSelectedRequest,
    setResponse,
    handleContextMenu, deleteConfirm, backendConnected,
    onOpenSettings, onOpenHelp, savedProjects, workspaceDirty, showBackendStatus = true,
    activeView, onChangeView, watcherHistory, onSelectWatcherEvent, watcherRunning,
    onStartWatcher, onStopWatcher, onClearWatcher,
    proxyRunning, onStartProxy, onStopProxy, proxyConfig, onUpdateProxyConfig, proxyHistory, onClearProxy,
    onSaveProxyHistory,
    configPath, onSelectConfigFile, onInjectProxy, onRestoreProxy, onOpenCertificate, onAddRequest, onDeleteRequest, onDeleteInterface, onDeleteOperation,
    onToggleSuiteExpand, onToggleCaseExpand
}) => {
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const renderInterfaceList = (interfaces: SoapUIInterface[], isExplorer: boolean) => (
        interfaces.map((iface, i) => (
            <div key={i}>
                <ServiceItem
                    onContextMenu={(e) => handleContextMenu(e, 'interface', iface, isExplorer)}
                    onClick={() => {
                        if (isExplorer) {
                            toggleExploredInterface(iface.name);
                        } else {
                            toggleInterfaceExpand(projects.find(p => p.interfaces.includes(iface))?.name || '', iface.name);
                        }
                    }}
                    style={{ paddingLeft: 20 }}
                >
                    <span style={{ marginRight: 5, display: 'flex' }}>
                        {(iface as any).expanded !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {iface.name} {isExplorer ? '(Preview)' : ''}
                    </span>
                    {isExplorer && selectedInterface === iface && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <HeaderButton onClick={(e) => { e.stopPropagation(); addToProject(iface); }} title="Add to Project">
                                <Plus size={14} />
                            </HeaderButton>
                            <HeaderButton onClick={(e) => { e.stopPropagation(); removeFromExplorer(iface); }} title="Remove from Explorer">
                                <Trash2 size={14} />
                            </HeaderButton>
                        </div>
                    )}
                    {!isExplorer && onDeleteInterface && (
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                            <HeaderButton
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirmDeleteId === iface.name) {
                                        onDeleteInterface(iface);
                                        setConfirmDeleteId(null);
                                    } else {
                                        setConfirmDeleteId(iface.name);
                                        setTimeout(() => setConfirmDeleteId(curr => curr === iface.name ? null : curr), 3000);
                                    }
                                }}
                                title={confirmDeleteId === iface.name ? "Click again to Confirm Delete" : "Delete Interface"}
                                style={{ color: confirmDeleteId === iface.name ? 'var(--vscode-errorForeground)' : undefined }}
                                shake={confirmDeleteId === iface.name}
                            >
                                <Trash2 size={12} />
                            </HeaderButton>
                        </div>
                    )}
                </ServiceItem>
                {(iface as any).expanded !== false && iface.operations.map((op: any, j: number) => {
                    const hasSingleRequest = op.requests.length === 1;
                    const singleRequest = hasSingleRequest ? op.requests[0] : null;

                    return (
                        <div key={j} style={{ marginLeft: 15 }}>
                            <OperationItem
                                active={selectedOperation === op && (!hasSingleRequest || selectedRequest === singleRequest)}
                                onClick={() => {
                                    if (isExplorer) {
                                        if (!hasSingleRequest) toggleExploredOperation(iface.name, op.name);
                                    } else {
                                        const projName = projects.find(p => p.interfaces.includes(iface))?.name || '';
                                        if (!hasSingleRequest) toggleOperationExpand(projName, iface.name, op.name);
                                        setSelectedProjectName(projName);
                                    }
                                    setSelectedInterface(iface);
                                    setSelectedOperation(op);

                                    if (hasSingleRequest && singleRequest) {
                                        setSelectedRequest(singleRequest);
                                        setResponse(null);
                                    } else {
                                        setSelectedRequest(null);
                                    }
                                }}
                                onContextMenu={(e) => handleContextMenu(e, 'operation', op, isExplorer)}
                            >
                                <span style={{ marginRight: 5, display: 'flex', alignItems: 'center', width: 14 }}>
                                    {!hasSingleRequest && (op.expanded !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                                </span>
                                {op.name}
                                {hasSingleRequest && singleRequest?.dirty && <DirtyMarker>●</DirtyMarker>}
                                {!isExplorer && selectedOperation === op && (
                                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                                        {onAddRequest && (
                                            <HeaderButton
                                                onClick={(e) => { e.stopPropagation(); onAddRequest(op); }}
                                                title="Add New Request"
                                            >
                                                <Plus size={12} />
                                            </HeaderButton>
                                        )}
                                        {onDeleteOperation && (
                                            <HeaderButton
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const id = `op-${iface.name}-${op.name}`;
                                                    if (confirmDeleteId === id) {
                                                        onDeleteOperation(op, iface);
                                                        setConfirmDeleteId(null);
                                                    } else {
                                                        setConfirmDeleteId(id);
                                                        setTimeout(() => setConfirmDeleteId(curr => curr === id ? null : curr), 3000);
                                                    }
                                                }}
                                                title={confirmDeleteId === `op-${iface.name}-${op.name}` ? "Click to Confirm Delete" : "Delete Operation"}
                                                style={{ color: confirmDeleteId === `op-${iface.name}-${op.name}` ? 'var(--vscode-errorForeground)' : undefined }}
                                                shake={confirmDeleteId === `op-${iface.name}-${op.name}`}
                                            >
                                                <Trash2 size={12} />
                                            </HeaderButton>
                                        )}
                                    </div>
                                )}
                            </OperationItem>

                            {/* Render Children only if NOT single request */}
                            {!hasSingleRequest && op.expanded !== false && op.requests.map((req: any, k: number) => (
                                <RequestItem
                                    key={k}
                                    active={selectedRequest === req}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isExplorer) setSelectedProjectName(projects.find(p => p.interfaces.includes(iface))?.name || null);
                                        setSelectedInterface(iface);
                                        setSelectedOperation(op);
                                        setSelectedRequest(req);
                                        setResponse(null);
                                    }}
                                    onContextMenu={(e) => handleContextMenu(e, 'request', req, isExplorer)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.name}</span>
                                        {req.dirty && <DirtyMarker>●</DirtyMarker>}
                                        {!isExplorer && onDeleteRequest && (
                                            <div style={{ marginLeft: 5 }}>
                                                <HeaderButton
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirmDeleteId === req.id) {
                                                            onDeleteRequest(req);
                                                            setConfirmDeleteId(null);
                                                        } else {
                                                            setConfirmDeleteId(req.id);
                                                            // Auto-reset after 3s
                                                            setTimeout(() => setConfirmDeleteId(curr => curr === req.id ? null : curr), 3000);
                                                        }
                                                    }}
                                                    title={confirmDeleteId === req.id ? "Click again to Confirm Delete" : "Delete Request"}
                                                    style={{ color: confirmDeleteId === req.id ? 'var(--vscode-errorForeground)' : undefined }}
                                                    shake={confirmDeleteId === req.id}
                                                >
                                                    <Trash2 size={12} />
                                                </HeaderButton>
                                            </div>
                                        )}
                                    </div>
                                </RequestItem>
                            ))}
                        </div>
                    );
                })}
            </div>
        ))
    );

    const renderWatcherList = () => (
        <div style={{ padding: 10 }}>
            {watcherHistory.length === 0 ? (
                <div style={{ color: 'var(--vscode-descriptionForeground)', textAlign: 'center', marginTop: 20 }}>
                    {watcherRunning ? (
                        <>
                            Watching C:\temp\requestXML.xml...<br />Waiting for events.
                        </>
                    ) : (
                        <>
                            Watcher is stopped.<br />Press Play to begin.
                        </>
                    )}
                </div>
            ) : (
                watcherHistory.map(event => (
                    <ServiceItem key={event.id} onClick={() => onSelectWatcherEvent(event)}>
                        <Clock size={14} style={{ marginRight: 5 }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold' }}>
                                {(() => {
                                    const reqOp = event.requestOperation || 'Unknown';
                                    const resOp = event.responseOperation;
                                    if (!resOp) return reqOp;
                                    const reqBase = reqOp.replace(/Request$/, '');
                                    const resBase = resOp.replace(/Response$/, '');
                                    if (reqBase === resBase) return reqBase;
                                    return `${reqOp} - ${resOp} `;
                                })()}
                            </div>
                            <div style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>{event.timestampLabel}</div>
                            <div style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>
                                {event.responseContent ? 'Request & Response' : 'Request Pending...'}
                            </div>
                        </div>
                    </ServiceItem>
                ))
            )}
        </div>
    );

    const renderProxyList = () => {
        // Check if HTTPS
        const isHttps = proxyConfig.target.toLowerCase().startsWith('https');

        return (
            <div style={{ padding: 10, color: 'var(--vscode-descriptionForeground)' }}>

                {/* compact controls */}
                <div style={{ marginBottom: 15, padding: 10, backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)', borderRadius: 5 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8em', marginBottom: 2 }}>Local Port</label>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--vscode-input-background)', border: '1px solid var(--vscode-input-border)' }}>
                                <div
                                    onClick={() => onUpdateProxyConfig({ ...proxyConfig, port: Math.max(1, (proxyConfig.port || 9000) - 1) })}
                                    style={{ padding: '4px 8px', cursor: 'pointer', borderRight: '1px solid var(--vscode-input-border)', userSelect: 'none' }}
                                >-</div>
                                <input
                                    type="number"
                                    className="vscode-input"
                                    value={proxyConfig.port}
                                    onChange={(e) => onUpdateProxyConfig({ ...proxyConfig, port: parseInt(e.target.value) || 9000 })}
                                    style={{
                                        flex: 1,
                                        width: '50px',
                                        padding: '4px',
                                        background: 'transparent',
                                        color: 'var(--vscode-input-foreground)',
                                        border: 'none',
                                        textAlign: 'center',
                                        appearance: 'textfield', // Hide default arrows
                                    }}
                                />
                                <div
                                    onClick={() => onUpdateProxyConfig({ ...proxyConfig, port: (proxyConfig.port || 9000) + 1 })}
                                    style={{ padding: '4px 8px', cursor: 'pointer', borderLeft: '1px solid var(--vscode-input-border)', userSelect: 'none' }}
                                >+</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', paddingBottom: 1 }}>
                            {!proxyRunning ? (
                                <HeaderButton onClick={onStartProxy} style={{ color: 'var(--vscode-testing-iconPassed)', border: '1px solid currentColor', padding: '5px 8px', height: '28px' }} title="Start Proxy"><Play size={14} /></HeaderButton>
                            ) : (
                                <HeaderButton onClick={onStopProxy} style={{ color: 'var(--vscode-testing-iconFailed)', border: '1px solid currentColor', padding: '5px 8px', height: '28px' }} title="Stop Proxy"><Square size={14} /></HeaderButton>
                            )}
                        </div>
                    </div>

                    <div style={{ marginBottom: 5 }}>
                        <label style={{ display: 'block', fontSize: '0.8em', marginBottom: 2 }}>Target URL</label>
                        <input
                            type="text"
                            className="vscode-input"
                            value={proxyConfig.target}
                            onChange={(e) => onUpdateProxyConfig({ ...proxyConfig, target: e.target.value })}
                            style={{ width: '100%', padding: '4px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)' }}
                        />
                    </div>

                    <div style={{ marginBottom: 5, display: 'flex', alignItems: 'center' }}>
                        <input
                            type="checkbox"
                            id="chkSystemProxy"
                            checked={proxyConfig.systemProxyEnabled !== false}
                            onChange={e => onUpdateProxyConfig({ ...proxyConfig, systemProxyEnabled: e.target.checked })}
                            style={{
                                marginRight: 6,
                                accentColor: 'var(--vscode-button-background)',
                                width: '14px',
                                height: '14px',
                                cursor: 'pointer'
                            }}
                        />
                        <label htmlFor="chkSystemProxy" style={{ fontSize: '0.8em', cursor: 'pointer', userSelect: 'none' }} title="Uncheck to bypass local corporate proxy (direct connection)">
                            Use System Proxy
                        </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <div style={{ fontSize: '0.8em' }}>Status: {proxyRunning ? <span style={{ color: 'var(--vscode-testing-iconPassed)' }}>Running</span> : 'Stopped'}</div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            {isHttps && onOpenCertificate && (
                                <HeaderButton onClick={onOpenCertificate} title="Install Certificate (Required for HTTPS)" style={{ color: 'var(--vscode-charts-yellow)' }}>
                                    <Shield size={14} />
                                </HeaderButton>
                            )}
                            <HeaderButton onClick={onClearProxy} title="Clear Traffic History"><Trash2 size={14} /></HeaderButton>
                            {/* <HeaderButton onClick={handleSaveReport} title="Save Report (Markdown)" disabled={proxyHistory.length === 0}><Save size={14} /></HeaderButton> */}
                        </div>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid var(--vscode-panel-border)', paddingTop: 10, marginTop: 10 }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9em' }}>Config Switcher</h4>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 5 }}>
                        <div style={{
                            flex: 1,
                            fontSize: '0.8em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            padding: '4px',
                            backgroundColor: 'var(--vscode-editor-background)',
                            border: '1px solid var(--vscode-input-border)',
                            borderRadius: '2px'
                        }} title={configPath || ''}>
                            {configPath ? configPath.split(/[\\/]/).pop() : 'Select web.config...'}
                        </div>
                        <HeaderButton onClick={onSelectConfigFile} title="Browse"><FolderOpen size={14} /></HeaderButton>
                    </div>

                    {configPath && (
                        <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                            <HeaderButton onClick={onInjectProxy} style={{ flex: 1, justifyContent: 'center', border: '1px solid var(--vscode-button-border)', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)' }} title="Inject Proxy Address">
                                <Network size={12} style={{ marginRight: 5 }} /> Inject
                            </HeaderButton>
                            <HeaderButton onClick={onRestoreProxy} style={{ flex: 1, justifyContent: 'center', border: '1px solid var(--vscode-button-border)', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)' }} title="Restore Original Config">
                                <FileCode size={12} style={{ marginRight: 5 }} /> Restore
                            </HeaderButton>
                        </div>
                    )}
                </div>

                <div style={{ marginTop: 15 }}>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '0.9em' }}>Traffic ({proxyHistory.length})</h4>
                    {proxyHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', marginTop: 10, fontSize: '0.8em', opacity: 0.7 }}>
                            No events captured.
                        </div>
                    ) : (
                        proxyHistory.map((event, i) => (
                            <ServiceItem
                                key={i}
                                style={{ paddingLeft: 5, paddingRight: 5 }}
                                onClick={() => onSelectWatcherEvent(event)}
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
                </div>
            </div>
        );
    };

    // Sidebar Navigation Rail Item
    const NavItem = ({ icon: Icon, active, onClick, title }: any) => (
        <div
            onClick={onClick}
            style={{
                padding: '10px 0',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
                color: active ? 'var(--vscode-activityBar-foreground)' : 'var(--vscode-activityBar-inactiveForeground)',
                borderLeft: active ? '2px solid var(--vscode-activityBar-activeBorder)' : '2px solid transparent',
                backgroundColor: active ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent' // Subtle highlight
            }}
            title={title}
        >
            <Icon size={24} strokeWidth={active ? 2.5 : 2} />
        </div>
    );

    /*
    const handleSaveReport = () => {
        if (proxyHistory.length === 0) return;

        let fullMd = '# Dirty SOAP Proxy Report\n\n' + `Generated: ${ new Date().toLocaleString() } \n` + `Entries: ${ proxyHistory.length } \n\n` + '---\n\n';
        [...proxyHistory].reverse().forEach(event => {
            fullMd += generateEventMarkdown(event) + '---\n\n';
        });

        onSaveProxyHistory(fullMd);
    };
    */



    const handleSaveSingleReport = (event: WatcherEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        const md = generateEventMarkdown(event);
        onSaveProxyHistory(md);
    };

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


    return (
        <div style={{ display: 'flex', height: '100%', flexDirection: 'row', minWidth: 300, flexShrink: 0 }}>
            {/* Left Rail */}
            <div style={{
                width: 50,
                backgroundColor: 'var(--vscode-activityBar-background)',
                borderRight: '1px solid var(--vscode-activityBar-border)',
                display: 'flex',
                flexDirection: 'column',
                paddingTop: 10
            }}>
                <NavItem
                    icon={FolderIcon}
                    active={activeView === SidebarView.PROJECTS}
                    onClick={() => onChangeView(SidebarView.PROJECTS)}
                    title="Project"
                />
                <NavItem
                    icon={Compass} // Need to import Compass or similar for Explorer
                    active={activeView === SidebarView.EXPLORER}
                    onClick={() => onChangeView(SidebarView.EXPLORER)}
                    title="WSDL Explorer"
                />
                <NavItem
                    icon={Eye}
                    active={activeView === SidebarView.WATCHER}
                    onClick={() => onChangeView(SidebarView.WATCHER)}
                    title="File Watcher"
                />
                <NavItem
                    icon={Globe}
                    active={activeView === SidebarView.PROXY}
                    onClick={() => onChangeView(SidebarView.PROXY)}
                    title="Dirty Proxy"
                />

                <div style={{ flex: 1 }}></div>

                <div style={{ paddingBottom: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <NavItem icon={Settings} onClick={onOpenSettings} title="Settings" />
                    <NavItem icon={HelpCircle} onClick={onOpenHelp} title="Help" />
                </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--vscode-sideBar-background)' }}>


                {/* View Headers */}
                {activeView === SidebarView.EXPLORER && (
                    <div style={{ borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)' }}>
                        <SectionHeader>
                            <SectionTitle style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                WSDL Explorer
                                {showBackendStatus && (
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        backgroundColor: backendConnected ? '#4caf50' : '#f44336',
                                        marginLeft: 10
                                    }} title={backendConnected ? "Backend Connected" : "Backend Disconnected"}></div>
                                )}
                            </SectionTitle>
                            {exploredInterfaces.length > 0 && (
                                <>
                                    <div style={{ flex: 1 }}></div>
                                    <HeaderButton onClick={(e) => { e.stopPropagation(); addAllToProject(); }} title="Add All to Project">
                                        <Plus size={16} />
                                    </HeaderButton>
                                    <HeaderButton onClick={(e) => { e.stopPropagation(); clearExplorer(); }} title="Clear Explorer">
                                        <Trash2 size={16} />
                                    </HeaderButton>
                                </>
                            )}
                        </SectionHeader>
                        {/* Render Explorer Content logic moved below */}
                    </div>
                )}

                {activeView === SidebarView.WATCHER && (
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)', padding: '5px 10px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 'bold' }}>File Watcher</div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <HeaderButton
                                onClick={(e) => { e.stopPropagation(); if (watcherRunning) onStopWatcher(); else onStartWatcher(); }}
                                title={watcherRunning ? "Stop Watcher" : "Start Watcher"}
                                style={{ color: watcherRunning ? 'var(--vscode-testing-iconFailed)' : 'var(--vscode-testing-iconPassed)' }}
                            >
                                {watcherRunning ? <Square size={14} /> : <Play size={14} />}
                            </HeaderButton>
                            <HeaderButton onClick={(e) => { e.stopPropagation(); onClearWatcher(); }} title="Clear History" style={{ marginLeft: 5 }}>
                                <Trash2 size={14} />
                            </HeaderButton>
                        </div>
                    </div>
                )}

                {activeView === SidebarView.PROXY && (
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)', padding: '5px 10px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 'bold' }}>Dirty Proxy</div>
                    </div>
                )}

                {/* Main Content Body */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {activeView === SidebarView.PROXY && renderProxyList()}

                    {activeView === SidebarView.WATCHER && renderWatcherList()}

                    {activeView === SidebarView.EXPLORER && (
                        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* Input Buttons */}
                            <div style={{ display: 'flex', gap: 5 }}>
                                <HeaderButton onClick={() => setInputType('url')} title="Load from URL"
                                    style={{ flex: 1, textAlign: 'center', backgroundColor: inputType === 'url' ? 'var(--vscode-button-background)' : 'transparent', color: inputType === 'url' ? 'var(--vscode-button-foreground)' : 'inherit', border: '1px solid var(--vscode-button-border)', marginLeft: 0, gap: 5, justifyContent: 'center' }}>
                                    <Globe size={14} /> URL
                                </HeaderButton>
                                <HeaderButton onClick={() => setInputType('file')} title="Load from File"
                                    style={{ flex: 1, textAlign: 'center', backgroundColor: inputType === 'file' ? 'var(--vscode-button-background)' : 'transparent', color: inputType === 'file' ? 'var(--vscode-button-foreground)' : 'inherit', border: '1px solid var(--vscode-button-border)', marginLeft: 0, gap: 5, justifyContent: 'center' }}>
                                    <FileCode size={14} /> File
                                </HeaderButton>
                            </div>
                            {/* Input Fields */}
                            {inputType === 'url' ? (
                                <div style={{ display: 'flex', gap: 5 }}>
                                    <Input value={wsdlUrl} onChange={(e) => setWsdlUrl(e.target.value)} placeholder="WSDL URL" />
                                    <HeaderButton onClick={loadWsdl} title="Load WSDL" style={{ border: '1px solid var(--vscode-button-border)', margin: 0 }}><Play size={14} /></HeaderButton>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: 5 }}>
                                    <HeaderButton onClick={pickLocalWsdl} title="Select Local WSDL" style={{ flex: 1, textAlign: 'center', border: '1px solid var(--vscode-button-border)', margin: 0 }}>Select File</HeaderButton>
                                    {selectedFile && <HeaderButton onClick={loadWsdl} title="Load WSDL" style={{ border: '1px solid var(--vscode-button-border)', margin: 0 }}><Play size={14} /></HeaderButton>}
                                </div>
                            )}
                            {selectedFile && inputType === 'file' && <div style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>{selectedFile}</div>}
                            {downloadStatus && <div style={{ padding: '0 10px 5px', fontSize: '0.8em' }}>{downloadStatus.map((f, i) => <div key={i}>• {f}</div>)}</div>}



                            {renderInterfaceList(exploredInterfaces, true)}
                        </div>
                    )}

                    {activeView === SidebarView.PROJECTS && (
                        <>

                            <div style={{ padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                                <div style={{ fontWeight: 'bold' }}>Workspace {workspaceDirty && <DirtyMarker>●</DirtyMarker>}</div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <HeaderButton onClick={onAddProject} title="New Project"><Plus size={16} /></HeaderButton>
                                    <div style={{ width: 10 }}></div>
                                    <HeaderButton onClick={loadProject} title="Add Project"><FolderPlus size={16} /></HeaderButton>
                                </div>
                            </div>
                            {projects.map((proj, pIdx) => (
                                <div key={proj.id || pIdx}>
                                    <SectionHeader onClick={() => toggleProjectExpand(proj.name)} onContextMenu={(e) => handleContextMenu(e, 'project', proj)}>
                                        <SectionTitle style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            {(proj as any).expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                Project: {proj.name || (proj as any).fileName} {proj.dirty && <DirtyMarker>●</DirtyMarker>}
                                            </span>
                                        </SectionTitle>
                                        <HeaderButton onClick={(e) => { e.stopPropagation(); saveProject(proj); }} title="Save Project" style={{ color: savedProjects.has(proj.name) ? 'var(--vscode-testing-iconPassed)' : 'inherit' }}>
                                            <Save size={16} />
                                        </HeaderButton>
                                        <HeaderButton
                                            onClick={(e) => { e.stopPropagation(); closeProject(proj.name); }}
                                            title={deleteConfirm === proj.name ? "Click again to Confirm Delete" : "Close Project"}
                                            style={{ color: deleteConfirm === proj.name ? 'var(--vscode-errorForeground)' : undefined }}
                                            shake={deleteConfirm === proj.name}
                                        >
                                            <Trash2 size={16} />
                                        </HeaderButton>
                                    </SectionHeader>
                                    {(proj as any).expanded && (
                                        <>
                                            {/* Interfaces */}
                                            {renderInterfaceList(proj.interfaces, false)}

                                            {/* Tests */}
                                            <ProjectTestTree
                                                project={proj}
                                                onAddSuite={onAddSuite}
                                                onDeleteSuite={onDeleteSuite}
                                                onRunSuite={onRunSuite}
                                                onAddTestCase={onAddTestCase}
                                                onRunCase={onRunCase}
                                                onDeleteTestCase={onDeleteTestCase}
                                                onSelectSuite={onSelectSuite}
                                                onSelectTestCase={onSelectTestCase}
                                                onToggleSuiteExpand={onToggleSuiteExpand}
                                                onToggleCaseExpand={onToggleCaseExpand}
                                                deleteConfirm={deleteConfirm}
                                            />
                                        </>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>


        </div>

    );
};
