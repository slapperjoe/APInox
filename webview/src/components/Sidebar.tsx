import React from 'react';
import styled from 'styled-components';
import { ChevronRight, ChevronDown, Plus, Trash2, Globe, FileCode, Play, Save, FolderOpen, FolderPlus, Settings, HelpCircle, Eye, Clock, Square, LayoutGrid, Network } from 'lucide-react';
import { SoapUIInterface, SoapUIOperation, SoapUIRequest, SoapUIProject, WatcherEvent } from '../models';

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

const HeaderButton = styled.button`
    background: transparent;
    border: none;
    color: var(--vscode-icon-foreground);
    cursor: pointer;
    padding: 2px;
    margin-left: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
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

    saveWorkspace: () => void;
    openWorkspace: () => void;
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
    deleteConfirm: string | null;
    backendConnected: boolean;

    // Settings
    onOpenSettings?: () => void;
    onOpenHelp?: () => void;

    // Computed
    workspaceDirty?: boolean;
    showBackendStatus?: boolean;

    // View State
    activeView: 'projects' | 'watcher' | 'proxy';
    onChangeView: (view: 'projects' | 'watcher' | 'proxy') => void;

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
    proxyConfig: { port: number, target: string };
    onUpdateProxyConfig: (config: { port: number, target: string }) => void;
    proxyHistory: WatcherEvent[];
    onClearProxy: () => void;
    configPath: string | null;
    onSelectConfigFile: () => void;
    onInjectProxy: () => void;
    onRestoreProxy: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    explorerExpanded, toggleExplorerExpand, exploredInterfaces, projects,
    inputType, setInputType, wsdlUrl, setWsdlUrl, selectedFile, loadWsdl, pickLocalWsdl, downloadStatus,
    addToProject, addAllToProject, clearExplorer, removeFromExplorer,
    toggleProjectExpand, toggleInterfaceExpand, toggleOperationExpand,
    toggleExploredInterface, toggleExploredOperation,
    saveWorkspace, openWorkspace, loadProject, saveProject, closeProject, onAddProject,
    setSelectedProjectName,
    setSelectedInterface,
    selectedOperation, setSelectedOperation,
    selectedRequest, setSelectedRequest,
    setResponse,
    handleContextMenu, deleteConfirm, backendConnected,
    onOpenSettings, onOpenHelp, savedProjects, workspaceDirty, showBackendStatus = true,
    activeView, onChangeView, watcherHistory, onSelectWatcherEvent, watcherRunning,
    onStartWatcher, onStopWatcher, onClearWatcher,
    proxyRunning, onStartProxy, onStopProxy, proxyConfig, onUpdateProxyConfig, proxyHistory, onClearProxy,
    configPath, onSelectConfigFile, onInjectProxy, onRestoreProxy
}) => {

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
                    {isExplorer && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <HeaderButton onClick={(e) => { e.stopPropagation(); addToProject(iface); }} title="Add to Project">
                                <Plus size={14} />
                            </HeaderButton>
                            <HeaderButton onClick={(e) => { e.stopPropagation(); removeFromExplorer(iface); }} title="Remove from Explorer">
                                <Trash2 size={14} />
                            </HeaderButton>
                        </div>
                    )}
                </ServiceItem>
                {(iface as any).expanded !== false && iface.operations.map((op: any, j: number) => (
                    <div key={j} style={{ marginLeft: 15 }}>
                        <OperationItem
                            active={selectedOperation === op}
                            onClick={() => {
                                if (isExplorer) {
                                    toggleExploredOperation(iface.name, op.name);
                                } else {
                                    const projName = projects.find(p => p.interfaces.includes(iface))?.name || '';
                                    toggleOperationExpand(projName, iface.name, op.name);
                                    setSelectedProjectName(projName);
                                }
                                setSelectedInterface(iface);
                                setSelectedOperation(op);
                                setSelectedRequest(null);
                            }}
                            onContextMenu={(e) => handleContextMenu(e, 'operation', op, isExplorer)}
                        >
                            <span style={{ marginRight: 5, display: 'flex', alignItems: 'center' }}>
                                {op.expanded !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                            {op.name}
                        </OperationItem>
                        {op.expanded !== false && op.requests.map((req: any, k: number) => (
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
                                {req.name}
                                {req.dirty && <DirtyMarker>●</DirtyMarker>}
                            </RequestItem>
                        ))}
                    </div>
                ))}
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

    const renderProxyList = () => (
        <div style={{ padding: 20, color: 'var(--vscode-descriptionForeground)' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <h3>Dirty Proxy</h3>
                <p>Port: {proxyConfig.port}</p>
                <p>Target: {proxyConfig.target}</p>
                <p>Status: {proxyRunning ? 'Running' : 'Stopped'}</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 10 }}>
                    {!proxyRunning ? (
                        <HeaderButton onClick={onStartProxy}>Start</HeaderButton>
                    ) : (
                        <HeaderButton onClick={onStopProxy}>Stop</HeaderButton>
                    )}
                    <HeaderButton onClick={onClearProxy} title="Clear History"><Trash2 size={16} /></HeaderButton>
                    <HeaderButton onClick={() => onUpdateProxyConfig({ ...proxyConfig, port: proxyConfig.port + 1 })}>Config</HeaderButton>
                </div>
            </div>

            <div style={{ borderTop: '1px solid var(--vscode-panel-border)', paddingTop: 15, marginTop: 15 }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Config Switcher</h4>
                <div style={{
                    marginBottom: 10,
                    fontSize: '0.85em',
                    wordBreak: 'break-all',
                    padding: '5px',
                    backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
                    borderRadius: '3px'
                }}>
                    {configPath ? configPath : 'No web.config selected'}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <HeaderButton onClick={onSelectConfigFile} title="Select web.config">
                        <FolderOpen size={14} style={{ marginRight: 5 }} /> Select
                    </HeaderButton>
                    {configPath && (
                        <>
                            <HeaderButton onClick={onInjectProxy} title="Inject Proxy Address">
                                <Network size={14} style={{ marginRight: 5 }} /> Inject
                            </HeaderButton>
                            <HeaderButton onClick={onRestoreProxy} title="Restore Original Config">
                                <FileCode size={14} style={{ marginRight: 5 }} /> Restore
                            </HeaderButton>
                        </>
                    )}
                </div>
            </div>

            <div style={{ marginTop: 20 }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Live Traffic</h4>
                {proxyHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: 10 }}>
                        Waiting for requests...
                    </div>
                ) : (
                    proxyHistory.map((event, i) => (
                        <ServiceItem
                            key={i}
                            style={{ paddingLeft: 10 }}
                            onClick={() => onSelectWatcherEvent(event)}
                        >
                            <div style={{ flex: 1, fontSize: '0.9em' }}>
                                <div style={{ fontWeight: 'bold' }}>{event.method} {event.url}</div>
                                <div>{event.status ? `Status: ${event.status}` : 'Pending...'}</div>
                            </div>
                        </ServiceItem>
                    ))
                )}
            </div>
        </div>
    );

    // Sidebar Navigation Rail Item
    const NavItem = ({ icon: Icon, active, onClick, title }: any) => (
        <div
            onClick={onClick}
            title={title}
            style={{
                padding: '10px 0',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
                color: active ? 'var(--vscode-activityBar-foreground)' : 'var(--vscode-activityBar-inactiveForeground)',
                borderLeft: active ? '2px solid var(--vscode-activityBar-activeBorder)' : '2px solid transparent',
                backgroundColor: active ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent' // Subtle highlight
            }}
        >
            <Icon size={24} strokeWidth={active ? 2.5 : 2} />
        </div>
    );

    return (
        <div style={{ display: 'flex', height: '100%', flexDirection: 'row' }}>
            {/* Left Rail */}
            <div style={{
                width: 50,
                backgroundColor: 'var(--vscode-activityBar-background)',
                borderRight: '1px solid var(--vscode-activityBar-border)',
                display: 'flex',
                flexDirection: 'column',
                paddingTop: 10
            }}>
                <NavItem icon={LayoutGrid} active={activeView === 'projects'} onClick={() => onChangeView('projects')} title="Projects" />
                <NavItem icon={Eye} active={activeView === 'watcher'} onClick={() => onChangeView('watcher')} title="File Watcher" />
                <NavItem icon={Network} active={activeView === 'proxy'} onClick={() => onChangeView('proxy')} title="Dirty Proxy" />

                <div style={{ flex: 1 }}></div>

                <div style={{ paddingBottom: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <NavItem icon={Settings} onClick={onOpenSettings} title="Settings" />
                    <NavItem icon={HelpCircle} onClick={onOpenHelp} title="Help" />
                </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--vscode-sideBar-background)' }}>

                {/* View Headers */}
                {activeView === 'projects' && (
                    <div style={{ borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)' }}>
                        <SectionHeader onClick={toggleExplorerExpand}>
                            <SectionTitle style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                {explorerExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} WSDL Explorer
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

                {activeView === 'watcher' && (
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)', padding: '5px 10px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 'bold' }}>File Watcher</div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <HeaderButton
                                onClick={(e) => { e.stopPropagation(); if (watcherRunning) onStopWatcher(); else onStartWatcher(); }}
                                title={watcherRunning ? "Stop Watcher" : "Start Watcher"}
                                style={{ color: watcherRunning ? 'var(--vscode-testing-iconPassed)' : 'inherit' }}
                            >
                                {watcherRunning ? <Square size={14} /> : <Play size={14} />}
                            </HeaderButton>
                            <HeaderButton onClick={(e) => { e.stopPropagation(); onClearWatcher(); }} title="Clear History" style={{ marginLeft: 5 }}>
                                <Trash2 size={14} />
                            </HeaderButton>
                        </div>
                    </div>
                )}

                {activeView === 'proxy' && (
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)', padding: '5px 10px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 'bold' }}>Dirty Proxy</div>
                    </div>
                )}

                {/* Main Content Body */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {activeView === 'proxy' && renderProxyList()}

                    {activeView === 'watcher' && renderWatcherList()}

                    {activeView === 'projects' && (
                        <>
                            {explorerExpanded && (
                                <div style={{ borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)' }}>
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
                                    </div>
                                    {downloadStatus && <div style={{ padding: '0 10px 5px', fontSize: '0.8em' }}>{downloadStatus.map((f, i) => <div key={i}>• {f}</div>)}</div>}
                                    {renderInterfaceList(exploredInterfaces, true)}
                                    {exploredInterfaces.length > 0 && <div style={{ height: 10 }}></div>}
                                </div>
                            )}

                            <div style={{ padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                                <div style={{ fontWeight: 'bold' }}>Workspace {workspaceDirty && <DirtyMarker>●</DirtyMarker>}</div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <HeaderButton onClick={onAddProject} title="New Project"><Plus size={16} /></HeaderButton>
                                    <HeaderButton onClick={saveWorkspace} title="Save Workspace"><Save size={16} /></HeaderButton>
                                    <HeaderButton onClick={openWorkspace} title="Open Workspace"><FolderOpen size={16} /></HeaderButton>
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
                                        <HeaderButton onClick={(e) => { e.stopPropagation(); closeProject(proj.name); }} title="Close">
                                            {deleteConfirm === proj.name ? 'Confirm?' : <Trash2 size={16} />}
                                        </HeaderButton>
                                    </SectionHeader>
                                    {(proj as any).expanded && renderInterfaceList(proj.interfaces, false)}
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
