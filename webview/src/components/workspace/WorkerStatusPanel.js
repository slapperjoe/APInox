import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import styled from 'styled-components';
import { Users, Server, Cpu, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';
const Container = styled.div `
    /* No outer styling - panel is now embedded in a Section */
`;
const WorkerList = styled.div `
    display: flex;
    flex-direction: column;
    gap: 8px;
`;
const WorkerCard = styled.div `
    display: flex;
    align-items: center;
    padding: 10px 12px;
    background: var(--vscode-list-hoverBackground);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    gap: 12px;
    border-left: 3px solid ${props => {
    switch (props.status) {
        case 'connected':
        case 'idle': return 'var(--vscode-testing-iconPassed)';
        case 'working': return 'var(--vscode-charts-blue)';
        case 'disconnected': return 'var(--vscode-testing-iconFailed)';
        default: return 'var(--vscode-panel-border)';
    }
}};
`;
const WorkerIcon = styled.div `
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${props => {
    switch (props.status) {
        case 'connected':
        case 'idle': return 'var(--vscode-testing-iconPassed)';
        case 'working': return 'var(--vscode-charts-blue)';
        case 'disconnected': return 'var(--vscode-testing-iconFailed)';
        default: return 'var(--vscode-badge-background)';
    }
}};
    color: white;
`;
const WorkerInfo = styled.div `
    flex: 1;
`;
const WorkerName = styled.div `
    font-weight: 500;
    font-size: 0.95em;
`;
const WorkerMeta = styled.div `
    font-size: 0.8em;
    color: var(--vscode-descriptionForeground);
    display: flex;
    gap: 12px;
    margin-top: 3px;
`;
const StatusBadge = styled.span `
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.75em;
    font-weight: 500;
    text-transform: uppercase;
    background: ${props => {
    switch (props.status) {
        case 'connected':
        case 'idle': return 'var(--vscode-testing-iconPassed)';
        case 'working': return 'var(--vscode-charts-blue)';
        case 'disconnected': return 'var(--vscode-testing-iconFailed)';
        default: return 'var(--vscode-badge-background)';
    }
}};
    color: white;
`;
const EmptyState = styled.div `
    text-align: center;
    padding: 30px 20px;
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em;
`;
export const WorkerStatusPanel = ({ status }) => {
    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    };
    const getStatusIcon = (workerStatus) => {
        switch (workerStatus) {
            case 'connected':
            case 'idle': return _jsx(CheckCircle, { size: 16 });
            case 'working': return _jsx(Loader, { size: 16 });
            case 'disconnected': return _jsx(AlertCircle, { size: 16 });
            default: return _jsx(Server, { size: 16 });
        }
    };
    return (_jsx(Container, { children: _jsx(WorkerList, { children: status.workers.length === 0 ? (_jsx(EmptyState, { children: status.running ? (_jsxs(_Fragment, { children: [_jsx(Users, { size: 32, style: { marginBottom: 10, opacity: 0.5 } }), _jsx("div", { children: "Waiting for workers to connect..." }), _jsxs("div", { style: { fontSize: '0.85em', marginTop: 5 }, children: ["Run: ", _jsxs("code", { children: ["npx dirty-soap worker --connect ws://localhost:", status.port] })] })] })) : (_jsxs(_Fragment, { children: [_jsx(Users, { size: 32, style: { marginBottom: 10, opacity: 0.5 } }), _jsx("div", { children: "Start the coordinator to accept worker connections" })] })) })) : (status.workers.map(worker => (_jsxs(WorkerCard, { status: worker.status, children: [_jsx(WorkerIcon, { status: worker.status, children: getStatusIcon(worker.status) }), _jsxs(WorkerInfo, { children: [_jsx(WorkerName, { children: worker.id }), _jsxs(WorkerMeta, { children: [worker.platform && (_jsxs("span", { children: [_jsx(Cpu, { size: 12 }), " ", worker.platform] })), worker.nodeVersion && (_jsxs("span", { children: ["Node ", worker.nodeVersion] })), _jsxs("span", { children: [_jsx(Clock, { size: 12 }), " ", formatTime(worker.connectedAt)] }), worker.assignedIterations && (_jsxs("span", { children: ["Iterations ", worker.assignedIterations.start, "-", worker.assignedIterations.end] }))] })] }), _jsx(StatusBadge, { status: worker.status, children: worker.status })] }, worker.id)))) }) }));
};
