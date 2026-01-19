import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState } from 'react';
import styled from 'styled-components';
import { Play, Plus, Trash2, Settings, Clock, Repeat, Flame, Zap, GripVertical, Loader, Square, Calendar, ToggleLeft, ToggleRight, Import, Download, ChevronDown, ChevronRight, CheckCircle, XCircle, AlertTriangle, Users, Server } from 'lucide-react';
import { WorkerStatusPanel } from './WorkerStatusPanel';
import { EmptyState } from '../../components/common/EmptyState';
import { Content, Toolbar, ToolbarButton, IconButton } from '../../styles/WorkspaceLayout.styles';
import { ContextMenu, ContextMenuItem } from '../../styles/App.styles';
const EditorContainer = styled.div `
    padding: 20px;
    height: 100%;
    overflow-y: auto;
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-font-family);
`;
const Section = styled.div `
    margin-bottom: 25px;
    background: var(--vscode-editor-inactiveSelectionBackground);
    border-radius: 6px;
    padding: ${props => props.$collapsed ? '0' : '15px'};
    border: 1px solid var(--vscode-widget-border);
    overflow: hidden;
`;
const SectionHeader = styled.div `
    margin: 0;
    padding: 15px;
    font-size: 1.1em;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    cursor: ${props => props.$clickable ? 'pointer' : 'default'};
    user-select: none;
    transition: background 0.15s ease;
    
    &:hover {
        background: ${props => props.$clickable ? 'var(--vscode-list-hoverBackground)' : 'transparent'};
    }
`;
const SectionContent = styled.div `
    display: ${props => props.$collapsed ? 'none' : 'block'};
    padding: 15px;
`;
const SectionTitle = styled.span `
    flex: 1;
`;
const Grid = styled.div `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
`;
const FormGroup = styled.div `
    display: flex;
    flex-direction: column;
    gap: 5px;
`;
const Label = styled.label `
    font-size: 0.9em;
    opacity: 0.8;
    display: flex;
    align-items: center;
    gap: 5px;
`;
const Input = styled.input `
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 6px;
    border-radius: 4px;
    font-family: inherit;
    
    &:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
    }
`;
const RequestList = styled.div `
    display: flex;
    flex-direction: column;
    gap: 8px;
`;
const RequestItem = styled.div `
    display: flex;
    align-items: center;
    padding: 10px;
    background: ${props => props.isDragging ? 'var(--vscode-editor-selectionBackground)' : 'var(--vscode-list-hoverBackground)'};
    border: 1px solid ${props => props.isDropTarget ? 'var(--vscode-focusBorder)' : 'var(--vscode-panel-border)'};
    border-radius: 4px;
    gap: 12px;
    opacity: ${props => props.isDragging ? 0.5 : 1};
    transition: border-color 0.15s ease, background-color 0.15s ease;
`;
const DragHandle = styled.div `
    cursor: grab;
    opacity: 0.5;
    display: flex;
    align-items: center;
    
    &:active {
        cursor: grabbing;
    }
    
    &:hover {
        opacity: 1;
    }
`;
const MethodBadge = styled.span `
    font-size: 0.8em;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    min-width: 45px;
    text-align: center;
`;
// Stats Grid for SLA metrics
const StatsGrid = styled.div `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
    gap: 10px;
    margin-bottom: 15px;
`;
const StatCard = styled.div `
    background: var(--vscode-input-background);
    border-radius: 6px;
    padding: 10px;
    text-align: center;
    border: 1px solid ${props => props.$variant === 'success' ? 'var(--vscode-testing-iconPassed)' :
    props.$variant === 'warning' ? 'var(--vscode-editorWarning-foreground)' :
        props.$variant === 'error' ? 'var(--vscode-testing-iconFailed)' :
            'var(--vscode-widget-border)'};
`;
const StatValue = styled.div `
    font-size: 1.3em;
    font-weight: bold;
    margin-bottom: 2px;
`;
const StatLabel = styled.div `
    font-size: 0.75em;
    opacity: 0.7;
`;
// Progress Bar
const ProgressContainer = styled.div `
    margin: 10px 0;
`;
const ProgressBar = styled.div `
    height: 8px;
    background: var(--vscode-input-background);
    border-radius: 4px;
    overflow: hidden;
`;
const ProgressFill = styled.div `
    height: 100%;
    width: ${props => props.$percent}%;
    background: var(--vscode-progressBar-background);
    transition: width 0.3s ease;
`;
// Bar Chart for response times
const ChartContainer = styled.div `
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 80px;
    margin: 15px 0;
    padding: 10px;
    background: var(--vscode-input-background);
    border-radius: 6px;
`;
const ChartBar = styled.div `
    flex: 1;
    min-width: 4px;
    max-width: 16px;
    height: ${props => props.$height}%;
    background: ${props => props.$success ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-testing-iconFailed)'};
    border-radius: 2px 2px 0 0;
    transition: height 0.3s ease;
`;
// Run History Item
const RunItem = styled.div `
    background: var(--vscode-input-background);
    border-radius: 6px;
    margin-bottom: 8px;
    border: 1px solid var(--vscode-widget-border);
    overflow: hidden;
`;
const RunHeader = styled.div `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    cursor: pointer;
    
    &:hover {
        background: var(--vscode-list-hoverBackground);
    }
`;
const RunDetails = styled.div `
    padding: 12px;
    border-top: 1px solid var(--vscode-widget-border);
    background: var(--vscode-editor-background);
    max-height: 200px;
    overflow-y: auto;
`;
const ResultRow = styled.div `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    margin: 2px 0;
    background: ${props => props.$success ? 'var(--vscode-diffEditor-insertedTextBackground)' : 'var(--vscode-diffEditor-removedTextBackground)'};
    border-radius: 3px;
    font-size: 0.85em;
`;
export const PerformanceSuiteEditor = ({ suite, onUpdate, onRun, onStop, isRunning, onAddRequest, onDeleteRequest, onUpdateRequest, onSelectRequest, onImportFromWorkspace, schedules = [], onAddSchedule, onToggleSchedule, onDeleteSchedule, progress, history = [], coordinatorStatus, onStartCoordinator, onStopCoordinator }) => {
    const [draggedId, setDraggedId] = useState(null);
    const [dropTargetId, setDropTargetId] = useState(null);
    const [newCron, setNewCron] = useState('0 3 * * *'); // Default: daily at 3am
    const [showScheduleInput, setShowScheduleInput] = useState(false);
    const [expandedRunId, setExpandedRunId] = useState(null);
    const [coordPort, setCoordPort] = useState(8765);
    const [coordExpected, setCoordExpected] = useState(1);
    // Rename state
    const [renameId, setRenameId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    // Delete confirmation state
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    // Context Menu state
    const [contextMenu, setContextMenu] = useState(null);
    const handleContextMenu = (e, reqId, currentName) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, reqId, currentName });
    };
    const closeContextMenu = () => setContextMenu(null);
    const startRename = () => {
        if (contextMenu) {
            setRenameId(contextMenu.reqId);
            setRenameValue(contextMenu.currentName);
            closeContextMenu();
        }
    };
    // Handle global click to close menu
    React.useEffect(() => {
        const handleClick = () => closeContextMenu();
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);
    const submitRename = () => {
        if (renameId && onUpdateRequest) {
            onUpdateRequest(suite.id, renameId, { name: renameValue });
        }
        setRenameId(null);
        setRenameValue('');
    };
    // Helper to check if section is collapsed
    const isCollapsed = (sectionId) => {
        return suite.collapsedSections?.includes(sectionId) ?? false;
    };
    // Toggle collapse state for a section
    const toggleSection = (sectionId) => {
        const current = suite.collapsedSections || [];
        const updated = current.includes(sectionId)
            ? current.filter(id => id !== sectionId)
            : [...current, sectionId];
        onUpdate({ ...suite, collapsedSections: updated });
    };
    const handleChange = (field, value) => {
        onUpdate({ ...suite, [field]: value });
    };
    const handleConfigChange = (e, field, type = 'text') => {
        let val = e.target.value;
        if (type === 'number') {
            const num = parseInt(val);
            if (!isNaN(num)) {
                handleChange(field, num);
            }
        }
        else {
            handleChange(field, val);
        }
    };
    // Drag and Drop handlers
    const handleDragStart = (e, requestId) => {
        setDraggedId(requestId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', requestId);
    };
    const handleDragOver = (e, requestId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (requestId !== draggedId) {
            setDropTargetId(requestId);
        }
    };
    const handleDragLeave = () => {
        setDropTargetId(null);
    };
    const handleDrop = (e, targetId) => {
        e.preventDefault();
        setDropTargetId(null);
        if (!draggedId || draggedId === targetId) {
            setDraggedId(null);
            return;
        }
        // Reorder steps
        const sortedRequests = [...suite.requests];
        const draggedIndex = sortedRequests.findIndex(r => r.id === draggedId);
        const targetIndex = sortedRequests.findIndex(r => r.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedId(null);
            return;
        }
        const [draggedItem] = sortedRequests.splice(draggedIndex, 1);
        sortedRequests.splice(targetIndex, 0, draggedItem);
        // Update order field
        sortedRequests.forEach((r, i) => r.order = i);
        onUpdate({ ...suite, requests: sortedRequests });
        setDraggedId(null);
    };
    const handleDragEnd = () => {
        setDraggedId(null);
        setDropTargetId(null);
    };
    const sortedRequests = [...(suite.requests || [])].sort((a, b) => a.order - b.order);
    return (_jsxs(Content, { children: [_jsxs(Toolbar, { children: [_jsxs("div", { style: { fontWeight: 'bold', fontSize: '1.1em', display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx(Zap, { size: 16 }), suite.name] }), _jsx("div", { style: { flex: 1 } }), isRunning ? (_jsxs(ToolbarButton, { onClick: onStop, style: { backgroundColor: 'var(--vscode-errorForeground)', color: 'white' }, children: [_jsx(Loader, { size: 14, style: { animation: 'spin 1s linear infinite' } }), _jsx(Square, { size: 10 }), " Stop"] })) : (_jsxs(_Fragment, { children: [onImportFromWorkspace && (_jsxs(ToolbarButton, { onClick: () => onImportFromWorkspace(suite.id), title: "Import from Workspace", children: [_jsx(Import, { size: 14 }), " Import"] })), _jsxs(ToolbarButton, { onClick: () => onRun(suite.id), style: { color: 'var(--vscode-testing-iconPassed)' }, children: [_jsx(Play, { size: 14 }), " Run Suite"] })] }))] }), _jsxs(EditorContainer, { children: [history && history.length > 0 && (_jsxs(Section, { style: { marginBottom: 20, background: 'var(--vscode-editor-background)', borderColor: 'var(--vscode-testing-iconPassed)' }, children: [_jsx(SectionHeader, { children: _jsxs(SectionTitle, { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx(CheckCircle, { size: 16, style: { color: 'var(--vscode-testing-iconPassed)' } }), "Performance Summary"] }) }), _jsx(SectionContent, { children: _jsxs(Grid, { style: { gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.85em', opacity: 0.7, marginBottom: 4 }, children: "Total Requests" }), _jsx("div", { style: { fontSize: '1.5em', fontWeight: 'bold' }, children: suite.requests?.length || 0 })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.85em', opacity: 0.7, marginBottom: 4 }, children: "Last Run" }), _jsxs("div", { style: { fontSize: '1.5em', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }, children: [history[0].status === 'completed' ? (_jsx(CheckCircle, { size: 18, style: { color: 'var(--vscode-testing-iconPassed)' } })) : (_jsx(XCircle, { size: 18, style: { color: 'var(--vscode-testing-iconFailed)' } })), _jsx("span", { style: { fontSize: '0.7em' }, children: new Date(history[0].startTime).toLocaleString() })] })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.85em', opacity: 0.7, marginBottom: 4 }, children: "Avg Response Time" }), _jsxs("div", { style: { fontSize: '1.5em', fontWeight: 'bold' }, children: [history[0].summary?.avgResponseTime ?
                                                            history[0].summary.avgResponseTime.toFixed(0)
                                                            : '0', "ms"] })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.85em', opacity: 0.7, marginBottom: 4 }, children: "Success Rate" }), _jsxs("div", { style: { fontSize: '1.5em', fontWeight: 'bold' }, children: [history[0].summary?.successRate !== undefined ?
                                                            (history[0].summary.successRate * 100).toFixed(0)
                                                            : '0', "%"] })] }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '0.85em', opacity: 0.7, marginBottom: 4 }, children: "Iterations" }), _jsx("div", { style: { fontSize: '1.5em', fontWeight: 'bold' }, children: history[0].summary?.totalRequests ?
                                                        Math.floor(history[0].summary.totalRequests / (suite.requests?.length || 1))
                                                        : '0' })] })] }) })] })), (!history || history.length === 0) && (_jsx(EmptyState, { icon: AlertTriangle, title: "No performance runs yet", description: 'Configure your test requests below and click "Run Suite" to start your first performance test.' })), isRunning && (_jsxs(Section, { children: [_jsxs(SectionHeader, { children: [_jsx(Loader, { size: 16, className: "animate-spin" }), " Running..."] }), _jsx(SectionContent, { children: _jsxs(ProgressContainer, { children: [_jsx("div", { style: { marginBottom: 5, fontSize: '0.9em' }, children: progress && progress.total > 0
                                                ? `Iteration ${progress.iteration} of ${progress.total}`
                                                : 'Starting...' }), _jsx(ProgressBar, { children: _jsx(ProgressFill, { "$percent": progress && progress.total > 0 ? (progress.iteration / progress.total) * 100 : 0 }) })] }) })] })), _jsxs(Section, { "$collapsed": isCollapsed('config'), children: [_jsxs(SectionHeader, { "$clickable": true, onClick: () => toggleSection('config'), children: [isCollapsed('config') ? _jsx(ChevronRight, { size: 16 }) : _jsx(ChevronDown, { size: 16 }), _jsxs(SectionTitle, { children: [_jsx(Settings, { size: 16 }), " Configuration"] })] }), _jsx(SectionContent, { "$collapsed": isCollapsed('config'), children: _jsxs(Grid, { children: [_jsxs(FormGroup, { children: [_jsxs(Label, { title: "Delay between requests in sequence", children: [_jsx(Clock, { size: 14 }), " Delay (ms)"] }), _jsx(Input, { type: "number", value: suite.delayBetweenRequests, onChange: (e) => handleConfigChange(e, 'delayBetweenRequests', 'number'), title: "Delay between requests in sequence" })] }), _jsxs(FormGroup, { children: [_jsxs(Label, { title: "Number of times to run the full sequence", children: [_jsx(Repeat, { size: 14 }), " Iterations"] }), _jsx(Input, { type: "number", value: suite.iterations, onChange: (e) => handleConfigChange(e, 'iterations', 'number'), title: "Number of times to run the full sequence" })] }), _jsxs(FormGroup, { children: [_jsxs(Label, { title: "Parallel requests (1 = sequential)", children: [_jsx(Zap, { size: 14 }), " Concurrency"] }), _jsx(Input, { type: "number", value: suite.concurrency, onChange: (e) => handleConfigChange(e, 'concurrency', 'number'), min: 1, title: "Parallel requests (1 = sequential)" })] }), _jsxs(FormGroup, { children: [_jsxs(Label, { title: "Runs to discard before measuring stats", children: [_jsx(Flame, { size: 14 }), " Warmup Runs"] }), _jsx(Input, { type: "number", value: suite.warmupRuns, onChange: (e) => handleConfigChange(e, 'warmupRuns', 'number'), title: "Runs to discard before measuring stats" })] })] }) })] }), _jsxs(Section, { "$collapsed": isCollapsed('requests'), children: [_jsxs(SectionHeader, { "$clickable": true, onClick: () => toggleSection('requests'), children: [isCollapsed('requests') ? _jsx(ChevronRight, { size: 16 }) : _jsx(ChevronDown, { size: 16 }), _jsxs(SectionTitle, { children: [_jsx(Play, { size: 16 }), " Test Requests (", suite.requests.length, ")"] }), onAddRequest && !isCollapsed('requests') && (_jsxs(ToolbarButton, { onClick: (e) => { e.stopPropagation(); onAddRequest(suite.id); }, children: [_jsx(Plus, { size: 14 }), " Add Request"] }))] }), _jsx(SectionContent, { "$collapsed": isCollapsed('requests'), children: _jsxs(RequestList, { children: [sortedRequests.map((req, index) => (_jsxs(RequestItem, { draggable: true, isDragging: draggedId === req.id, isDropTarget: dropTargetId === req.id, onDragStart: (e) => handleDragStart(e, req.id), onDragOver: (e) => handleDragOver(e, req.id), onDragLeave: handleDragLeave, onDrop: (e) => handleDrop(e, req.id), onDragEnd: handleDragEnd, onClick: () => onSelectRequest?.(req), onContextMenu: (e) => handleContextMenu(e, req.id, req.name), style: { cursor: 'pointer' }, children: [_jsx(DragHandle, { onClick: (e) => e.stopPropagation(), children: _jsx(GripVertical, { size: 16 }) }), _jsxs("div", { style: { fontWeight: 'bold', width: 25, opacity: 0.6 }, children: [index + 1, "."] }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx(MethodBadge, { children: req.method }), renameId === req.id ? (_jsx(Input, { value: renameValue, onChange: (e) => setRenameValue(e.target.value), onBlur: submitRename, onKeyDown: (e) => {
                                                                        if (e.key === 'Enter')
                                                                            submitRename();
                                                                        if (e.key === 'Escape')
                                                                            setRenameId(null);
                                                                        e.stopPropagation();
                                                                    }, autoFocus: true, onClick: (e) => e.stopPropagation(), style: { padding: '2px 4px', width: 200 } })) : (_jsx("span", { style: { fontWeight: 500 }, children: req.name }))] }), _jsx("div", { style: { fontSize: '0.85em', opacity: 0.7, marginTop: 4 }, children: req.endpoint }), (req.interfaceName || req.operationName) && (_jsxs("div", { style: { fontSize: '0.8em', opacity: 0.6, marginTop: 2, fontStyle: 'italic' }, children: [req.interfaceName, " ", req.operationName && ` • ${req.operationName}`] })), req.soapAction && (_jsxs("div", { style: { fontSize: '0.8em', opacity: 0.6, marginTop: 2, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: req.soapAction, children: ["Action: ", req.soapAction] }))] }), _jsx("div", { style: { display: 'flex', alignItems: 'center', gap: 5 }, children: onDeleteRequest && (_jsx(IconButton, { onClick: (e) => {
                                                            e.stopPropagation();
                                                            if (deleteConfirmId === req.id) {
                                                                onDeleteRequest(suite.id, req.id);
                                                                setDeleteConfirmId(null);
                                                            }
                                                            else {
                                                                setDeleteConfirmId(req.id);
                                                                setTimeout(() => setDeleteConfirmId(current => current === req.id ? null : current), 3000);
                                                            }
                                                        }, title: deleteConfirmId === req.id ? "Click again to Confirm" : "Remove Request", shake: deleteConfirmId === req.id, children: _jsx(Trash2, { size: 14 }) })) })] }, req.id))), contextMenu && (_jsxs(ContextMenu, { top: contextMenu.y, left: contextMenu.x, onClick: (e) => e.stopPropagation(), children: [_jsx(ContextMenuItem, { onClick: () => startRename(), children: "Rename" }), _jsx(ContextMenuItem, { onClick: () => {
                                                        if (onDeleteRequest)
                                                            onDeleteRequest(suite.id, contextMenu.reqId);
                                                        closeContextMenu();
                                                    }, children: "Delete" })] })), sortedRequests.length === 0 && (_jsx("div", { style: { padding: 20, textAlign: 'center', opacity: 0.6, fontStyle: 'italic' }, children: "No requests in suite. Add a request to begin." }))] }) })] }), _jsxs(Section, { "$collapsed": isCollapsed('scheduling'), children: [_jsxs(SectionHeader, { "$clickable": true, onClick: () => toggleSection('scheduling'), children: [isCollapsed('scheduling') ? _jsx(ChevronRight, { size: 16 }) : _jsx(ChevronDown, { size: 16 }), _jsxs(SectionTitle, { children: [_jsx(Calendar, { size: 16 }), " Scheduling (", schedules.filter(s => s.suiteId === suite.id).length, ")"] }), !isCollapsed('scheduling') && !showScheduleInput && (_jsxs(ToolbarButton, { onClick: (e) => { e.stopPropagation(); setShowScheduleInput(true); }, title: "Add Schedule", children: [_jsx(Plus, { size: 14 }), " Add Schedule"] }))] }), _jsxs(SectionContent, { "$collapsed": isCollapsed('scheduling'), children: [showScheduleInput && (_jsxs("div", { style: { display: 'flex', gap: 10, marginBottom: 15 }, children: [_jsx(Input, { type: "text", value: newCron, onChange: (e) => setNewCron(e.target.value), placeholder: "0 3 * * * (daily at 3am)", style: { flex: 1 } }), _jsxs(ToolbarButton, { onClick: () => {
                                                    if (onAddSchedule && newCron) {
                                                        onAddSchedule(suite.id, newCron);
                                                        setNewCron('0 3 * * *');
                                                        setShowScheduleInput(false);
                                                    }
                                                }, style: { color: 'var(--vscode-testing-iconPassed)' }, children: [_jsx(Plus, { size: 14 }), " Add"] }), _jsx(ToolbarButton, { onClick: () => setShowScheduleInput(false), children: "Cancel" })] })), schedules.filter(s => s.suiteId === suite.id).map(schedule => (_jsxs(RequestItem, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, flex: 1 }, children: [_jsx("button", { onClick: () => onToggleSchedule?.(schedule.id, !schedule.enabled), style: {
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: schedule.enabled
                                                                ? 'var(--vscode-testing-iconPassed)'
                                                                : 'var(--vscode-disabledForeground)',
                                                            padding: 0
                                                        }, title: schedule.enabled ? 'Disable' : 'Enable', children: schedule.enabled ? _jsx(ToggleRight, { size: 20 }) : _jsx(ToggleLeft, { size: 20 }) }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 500 }, children: _jsx("code", { children: schedule.cronExpression }) }), _jsxs("div", { style: { fontSize: '0.85em', opacity: 0.7 }, children: [schedule.enabled ? 'Active' : 'Disabled', schedule.lastRun && ` • Last run: ${new Date(schedule.lastRun).toLocaleString()}`] })] })] }), _jsx(IconButton, { onClick: (e) => {
                                                    e.stopPropagation();
                                                    if (deleteConfirmId === schedule.id) {
                                                        onDeleteSchedule?.(schedule.id);
                                                        setDeleteConfirmId(null);
                                                    }
                                                    else {
                                                        setDeleteConfirmId(schedule.id);
                                                        setTimeout(() => setDeleteConfirmId(current => current === schedule.id ? null : current), 3000);
                                                    }
                                                }, title: deleteConfirmId === schedule.id ? "Click again to Confirm" : "Delete Schedule", shake: deleteConfirmId === schedule.id, children: _jsx(Trash2, { size: 14 }) })] }, schedule.id))), schedules.filter(s => s.suiteId === suite.id).length === 0 && !showScheduleInput && (_jsx("div", { style: { padding: 15, textAlign: 'center', opacity: 0.6, fontStyle: 'italic' }, children: "No schedules. Click \"Add Schedule\" to run this suite automatically." }))] })] }), coordinatorStatus && onStartCoordinator && onStopCoordinator && (_jsxs(Section, { "$collapsed": isCollapsed('workers'), children: [_jsxs(SectionHeader, { "$clickable": true, onClick: () => toggleSection('workers'), children: [isCollapsed('workers') ? _jsx(ChevronRight, { size: 16 }) : _jsx(ChevronDown, { size: 16 }), _jsxs(SectionTitle, { children: [_jsx(Users, { size: 16 }), " Distributed Workers (", coordinatorStatus.workers.length, ")"] }), !isCollapsed('workers') && (_jsx("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, onClick: e => e.stopPropagation(), children: !coordinatorStatus.running ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx("span", { style: { fontSize: '0.85em', opacity: 0.7 }, children: "Port:" }), _jsx(Input, { type: "number", value: coordPort, onChange: e => setCoordPort(parseInt(e.target.value) || 8765), min: 1024, max: 65535, style: { width: 60, padding: 2 } })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx("span", { style: { fontSize: '0.85em', opacity: 0.7 }, children: "Expected:" }), _jsx(Input, { type: "number", value: coordExpected, onChange: e => setCoordExpected(parseInt(e.target.value) || 1), min: 1, max: 100, style: { width: 40, padding: 2 } })] }), _jsxs(ToolbarButton, { onClick: () => onStartCoordinator(coordPort, coordExpected), title: "Start Coordinator", style: { color: 'var(--vscode-testing-iconPassed)' }, children: [_jsx(Play, { size: 14 }), " Start"] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.85em' }, title: "Coordinator running", children: [_jsx(Server, { size: 14, style: { color: 'var(--vscode-testing-iconPassed)' } }), _jsxs("span", { children: ["Port ", coordinatorStatus.port] })] }), _jsxs("div", { style: { fontSize: '0.85em', opacity: 0.7 }, children: [coordinatorStatus.workers.length, "/", coordinatorStatus.expectedWorkers, " connected"] }), _jsxs(ToolbarButton, { onClick: onStopCoordinator, title: "Stop Coordinator", style: { color: 'var(--vscode-errorForeground)' }, children: [_jsx(Square, { size: 14 }), " Stop"] })] })) }))] }), _jsx(SectionContent, { "$collapsed": isCollapsed('workers'), children: _jsx(WorkerStatusPanel, { status: coordinatorStatus }) })] })), _jsxs(Section, { "$collapsed": isCollapsed('history'), children: [_jsxs(SectionHeader, { "$clickable": true, onClick: () => toggleSection('history'), children: [isCollapsed('history') ? _jsx(ChevronRight, { size: 16 }) : _jsx(ChevronDown, { size: 16 }), _jsxs(SectionTitle, { children: [_jsx(Clock, { size: 16 }), " Run History (", history.length, ")"] })] }), _jsx(SectionContent, { "$collapsed": isCollapsed('history'), children: history.length > 0 ? (_jsx(_Fragment, { children: history.slice(0, 5).map((run) => {
                                        const isExpanded = expandedRunId === run.id;
                                        const stats = run.summary;
                                        const maxDuration = Math.max(...run.results.map(r => r.duration), 1);
                                        return (_jsxs(RunItem, { children: [_jsxs(RunHeader, { onClick: () => setExpandedRunId(isExpanded ? null : run.id), children: [isExpanded ? _jsx(ChevronDown, { size: 16 }) : _jsx(ChevronRight, { size: 16 }), run.status === 'completed' ? (_jsx(CheckCircle, { size: 16, style: { color: 'var(--vscode-testing-iconPassed)' } })) : run.status === 'aborted' ? (_jsx(AlertTriangle, { size: 16, style: { color: 'var(--vscode-editorWarning-foreground)' } })) : (_jsx(XCircle, { size: 16, style: { color: 'var(--vscode-testing-iconFailed)' } })), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontWeight: 500 }, children: new Date(run.startTime).toLocaleString() }), _jsxs("div", { style: { fontSize: '0.85em', opacity: 0.7 }, children: [stats.totalRequests, " requests \u2022 ", stats.successRate.toFixed(0), "% success \u2022 avg ", stats.avgResponseTime.toFixed(0), "ms"] })] }), _jsx(ToolbarButton, { onClick: (e) => {
                                                                e.stopPropagation();
                                                                // Export CSV
                                                                const csv = [
                                                                    'Request,Iteration,Duration (ms),Status,Success,SLA Breached,Timestamp',
                                                                    ...run.results.map(r => `"${r.requestName}",${r.iteration},${r.duration.toFixed(2)},${r.status},${r.success},${r.slaBreached},${new Date(r.timestamp).toISOString()}`)
                                                                ].join('\n');
                                                                const blob = new Blob([csv], { type: 'text/csv' });
                                                                const url = URL.createObjectURL(blob);
                                                                const a = document.createElement('a');
                                                                a.href = url;
                                                                a.download = `performance-run-${run.id}.csv`;
                                                                a.click();
                                                                URL.revokeObjectURL(url);
                                                            }, title: "Export CSV", children: _jsx(Download, { size: 14 }) })] }), isExpanded && (_jsxs(RunDetails, { children: [_jsxs(StatsGrid, { children: [_jsxs(StatCard, { "$variant": stats.successRate >= 95 ? 'success' : stats.successRate >= 80 ? 'warning' : 'error', children: [_jsxs(StatValue, { children: [stats.successRate.toFixed(1), "%"] }), _jsx(StatLabel, { children: "Success Rate" })] }), _jsxs(StatCard, { children: [_jsxs(StatValue, { children: [stats.avgResponseTime.toFixed(0), "ms"] }), _jsx(StatLabel, { children: "Average" })] }), _jsxs(StatCard, { children: [_jsxs(StatValue, { children: [stats.minResponseTime.toFixed(0), "ms"] }), _jsx(StatLabel, { children: "Min" })] }), _jsxs(StatCard, { children: [_jsxs(StatValue, { children: [stats.maxResponseTime.toFixed(0), "ms"] }), _jsx(StatLabel, { children: "Max" })] }), _jsxs(StatCard, { children: [_jsxs(StatValue, { children: [stats.p50.toFixed(0), "ms"] }), _jsx(StatLabel, { children: "p50" })] }), _jsxs(StatCard, { children: [_jsxs(StatValue, { children: [stats.p95.toFixed(0), "ms"] }), _jsx(StatLabel, { children: "p95" })] }), _jsxs(StatCard, { "$variant": stats.slaBreachCount > 0 ? 'error' : 'success', children: [_jsxs(StatValue, { children: [stats.p99.toFixed(0), "ms"] }), _jsx(StatLabel, { children: "p99" })] }), _jsxs(StatCard, { "$variant": stats.slaBreachCount > 0 ? 'error' : undefined, children: [_jsx(StatValue, { children: stats.slaBreachCount }), _jsx(StatLabel, { children: "SLA Breaches" })] })] }), _jsx("div", { style: { fontSize: '0.85em', marginBottom: 5, opacity: 0.7 }, children: "Response Times" }), _jsx(ChartContainer, { children: run.results.slice(0, 50).map((result, idx) => (_jsx(ChartBar, { "$height": (result.duration / maxDuration) * 100, "$success": result.success, title: `${result.requestName}: ${result.duration.toFixed(0)}ms` }, idx))) }), _jsxs("div", { style: { fontSize: '0.85em', marginBottom: 5, opacity: 0.7 }, children: ["Results (", run.results.length, ")"] }), run.results.slice(0, 20).map((result, idx) => (_jsxs(ResultRow, { "$success": result.success, children: [result.success ? (_jsx(CheckCircle, { size: 12, style: { color: 'var(--vscode-testing-iconPassed)' } })) : (_jsx(XCircle, { size: 12, style: { color: 'var(--vscode-testing-iconFailed)' } })), _jsx("span", { style: { flex: 1 }, children: result.requestName }), _jsxs("span", { style: { opacity: 0.7 }, children: ["#", result.iteration + 1] }), _jsxs("span", { style: { fontWeight: 500 }, children: [result.duration.toFixed(0), "ms"] }), result.slaBreached && (_jsx("span", { title: "SLA Breached", children: _jsx(AlertTriangle, { size: 12, style: { color: 'var(--vscode-editorWarning-foreground)' } }) }))] }, idx))), run.results.length > 20 && (_jsxs("div", { style: { textAlign: 'center', opacity: 0.6, fontSize: '0.85em', marginTop: 8 }, children: ["... and ", run.results.length - 20, " more results"] }))] }))] }, run.id));
                                    }) })) : (_jsx("div", { style: { padding: 15, textAlign: 'center', opacity: 0.6, fontStyle: 'italic' }, children: "No runs yet. History will appear after the first completed run." })) })] })] })] }));
};
