import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styled from 'styled-components';
import { Clock, AlertTriangle, CheckCircle, XCircle, BarChart3, Activity, Download, FileText } from 'lucide-react';
import { ResponseTimeChart, statsToChartData } from './ResponseTimeChart';
import { generateMarkdownReport, downloadMarkdownReport } from '../../utils/reportGenerator';
const Container = styled.div `
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
    padding: 15px;
    border: 1px solid var(--vscode-widget-border);
`;
const SectionHeader = styled.h3 `
    margin: 0 0 15px 0;
    font-size: 1.1em;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: 8px;
`;
const StatsGrid = styled.div `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
`;
const StatCard = styled.div `
    background: var(--vscode-input-background);
    border-radius: 6px;
    padding: 12px;
    text-align: center;
    border-left: 3px solid ${props => {
    if (props.variant === 'success')
        return 'var(--vscode-testing-iconPassed)';
    if (props.variant === 'warning')
        return 'var(--vscode-charts-orange)';
    if (props.variant === 'error')
        return 'var(--vscode-testing-iconFailed)';
    return 'var(--vscode-textLink-foreground)';
}};
`;
const StatValue = styled.div `
    font-size: 1.5em;
    font-weight: bold;
    margin-bottom: 4px;
`;
const StatLabel = styled.div `
    font-size: 0.85em;
    opacity: 0.7;
`;
const ProgressContainer = styled.div `
    margin-bottom: 20px;
`;
const ProgressBar = styled.div `
    height: 8px;
    background: var(--vscode-input-background);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
`;
const ProgressFill = styled.div `
    height: 100%;
    width: ${props => props.percent}%;
    background: var(--vscode-textLink-foreground);
    transition: width 0.3s ease;
`;
const ProgressText = styled.div `
    font-size: 0.9em;
    display: flex;
    justify-content: space-between;
    opacity: 0.8;
`;
const HistoryItem = styled.div `
    display: flex;
    align-items: center;
    padding: 10px;
    background: var(--vscode-list-hoverBackground);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    gap: 12px;
    margin-bottom: 8px;
    border-left: 3px solid ${props => {
    if (props.status === 'completed')
        return 'var(--vscode-testing-iconPassed)';
    if (props.status === 'aborted')
        return 'var(--vscode-charts-orange)';
    return 'var(--vscode-testing-iconFailed)';
}};
`;
const ChartContainer = styled.div `
    margin-top: 20px;
`;
const ChartTitle = styled.div `
    font-size: 0.9em;
    font-weight: 600;
    margin-bottom: 10px;
    opacity: 0.8;
`;
const BarContainer = styled.div `
    display: flex;
    flex-direction: column;
    gap: 6px;
`;
const BarRow = styled.div `
    display: flex;
    align-items: center;
    gap: 10px;
`;
const BarLabel = styled.div `
    width: 150px;
    font-size: 0.85em;
    text-align: right;
    opacity: 0.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;
const BarTrack = styled.div `
    flex: 1;
    height: 12px;
    background: var(--vscode-input-background);
    border-radius: 4px;
    overflow: hidden;
`;
const BarFill = styled.div `
    height: 100%;
    width: ${props => props.width}%;
    background: ${props => props.color || 'var(--vscode-textLink-foreground)'};
    border-radius: 4px;
    transition: width 0.3s ease;
`;
const BarValue = styled.div `
    width: 60px;
    font-size: 0.85em;
    font-weight: 500;
`;
export const PerformanceResultsPanel = ({ runs, currentProgress, isRunning, onExport }) => {
    const latestRun = runs.length > 0 ? runs[runs.length - 1] : null;
    const formatDuration = (ms) => {
        if (ms < 1000)
            return `${ms.toFixed(0)}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };
    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };
    const renderStats = (stats) => (_jsxs(StatsGrid, { children: [_jsxs(StatCard, { children: [_jsx(StatValue, { children: stats.totalRequests }), _jsx(StatLabel, { children: "Total Requests" })] }), _jsxs(StatCard, { variant: stats.successRate >= 0.95 ? 'success' : stats.successRate >= 0.8 ? 'warning' : 'error', children: [_jsxs(StatValue, { children: [(stats.successRate * 100).toFixed(1), "%"] }), _jsx(StatLabel, { children: "Success Rate" })] }), _jsxs(StatCard, { children: [_jsx(StatValue, { children: formatDuration(stats.avgResponseTime) }), _jsx(StatLabel, { children: "Avg Response" })] }), _jsxs(StatCard, { variant: stats.slaBreachCount === 0 ? 'success' : 'warning', children: [_jsx(StatValue, { children: stats.slaBreachCount }), _jsx(StatLabel, { children: "SLA Breaches" })] }), _jsxs(StatCard, { children: [_jsx(StatValue, { children: formatDuration(stats.minResponseTime) }), _jsx(StatLabel, { children: "Min Response" })] }), _jsxs(StatCard, { children: [_jsx(StatValue, { children: formatDuration(stats.maxResponseTime) }), _jsx(StatLabel, { children: "Max Response" })] }), _jsxs(StatCard, { children: [_jsx(StatValue, { children: formatDuration(stats.p50) }), _jsx(StatLabel, { children: "p50 (Median)" })] }), _jsxs(StatCard, { children: [_jsx(StatValue, { children: formatDuration(stats.p95) }), _jsx(StatLabel, { children: "p95" })] }), _jsxs(StatCard, { children: [_jsx(StatValue, { children: formatDuration(stats.p99) }), _jsx(StatLabel, { children: "p99" })] })] }));
    return (_jsxs(Container, { children: [isRunning && currentProgress && (_jsxs(Section, { children: [_jsxs(SectionHeader, { children: [_jsx(Activity, { size: 16 }), " Running..."] }), _jsxs(ProgressContainer, { children: [_jsx(ProgressBar, { children: _jsx(ProgressFill, { percent: (currentProgress.iteration / currentProgress.total) * 100 }) }), _jsxs(ProgressText, { children: [_jsxs("span", { children: ["Iteration ", currentProgress.iteration, " of ", currentProgress.total] }), _jsxs("span", { children: [Math.round((currentProgress.iteration / currentProgress.total) * 100), "%"] })] })] })] })), latestRun && (_jsxs(Section, { children: [_jsxs(SectionHeader, { children: [_jsx(BarChart3, { size: 16 }), " Latest Run: ", latestRun.suiteName, latestRun.status === 'completed' && _jsx(CheckCircle, { size: 14, color: "var(--vscode-testing-iconPassed)" }), latestRun.status === 'aborted' && _jsx(AlertTriangle, { size: 14, color: "var(--vscode-charts-orange)" }), latestRun.status === 'failed' && _jsx(XCircle, { size: 14, color: "var(--vscode-testing-iconFailed)" })] }), _jsxs("div", { style: { marginBottom: 15, fontSize: '0.9em', opacity: 0.7, display: 'flex', gap: 15 }, children: [_jsxs("span", { children: [_jsx(Clock, { size: 12 }), " ", formatTime(latestRun.startTime)] }), _jsxs("span", { children: ["Duration: ", formatDuration(latestRun.endTime - latestRun.startTime)] })] }), onExport && (_jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 15 }, children: [_jsxs("button", { onClick: () => onExport(latestRun.id), style: {
                                    background: 'var(--vscode-button-secondaryBackground)',
                                    color: 'var(--vscode-button-secondaryForeground)',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5
                                }, children: [_jsx(Download, { size: 14 }), " Export CSV"] }), _jsxs("button", { onClick: () => {
                                    const report = generateMarkdownReport(latestRun);
                                    downloadMarkdownReport(report, `${latestRun.suiteName}_report`);
                                }, style: {
                                    background: 'var(--vscode-button-secondaryBackground)',
                                    color: 'var(--vscode-button-secondaryForeground)',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5
                                }, children: [_jsx(FileText, { size: 14 }), " Export Report"] })] })), renderStats(latestRun.summary), latestRun.results.length > 0 && (_jsxs(ChartContainer, { children: [_jsx(ChartTitle, { children: "Response Time Distribution (by Request)" }), _jsx(BarContainer, { children: (() => {
                                    // Group results by request and calculate avg
                                    const avgByRequest = new Map();
                                    for (const r of latestRun.results) {
                                        // Create a display name that includes operation/interface if available
                                        const displayParts = [];
                                        if (r.operationName)
                                            displayParts.push(r.operationName);
                                        else if (r.requestName !== 'Request 1')
                                            displayParts.push(r.requestName);
                                        if (r.interfaceName)
                                            displayParts.push(`(${r.interfaceName})`);
                                        const displayName = displayParts.length > 0
                                            ? displayParts.join(' ')
                                            : r.requestName;
                                        const existing = avgByRequest.get(r.requestId) || { name: r.requestName, displayName, avg: 0, count: 0 };
                                        existing.avg = (existing.avg * existing.count + r.duration) / (existing.count + 1);
                                        existing.count++;
                                        avgByRequest.set(r.requestId, existing);
                                    }
                                    const data = Array.from(avgByRequest.values());
                                    const maxDuration = Math.max(...data.map(d => d.avg), 1);
                                    return data.map((d, i) => (_jsxs(BarRow, { children: [_jsxs(BarLabel, { title: d.displayName, children: [d.displayName.substring(0, 20), d.displayName.length > 20 ? '...' : ''] }), _jsx(BarTrack, { children: _jsx(BarFill, { width: (d.avg / maxDuration) * 100, color: d.avg > latestRun.summary.p95 ? 'var(--vscode-charts-orange)' : undefined }) }), _jsx(BarValue, { children: formatDuration(d.avg) })] }, i)));
                                })() })] }))] })), runs.length > 1 && (_jsxs(Section, { children: [_jsxs(SectionHeader, { children: [_jsx(Clock, { size: 16 }), " Run History (", runs.length, " runs)"] }), _jsx("div", { style: { marginBottom: 20 }, children: _jsx(ResponseTimeChart, { data: statsToChartData(runs.slice(-10)), title: "Response Time Trend (Last 10 Runs)", height: 160, showP95: true, showP99: false }) }), runs.slice(0, -1).reverse().map(run => (_jsxs(HistoryItem, { status: run.status, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontWeight: 500 }, children: run.suiteName }), _jsxs("div", { style: { fontSize: '0.85em', opacity: 0.7 }, children: [formatTime(run.startTime), " \u2022 ", formatDuration(run.endTime - run.startTime)] })] }), _jsxs("div", { style: { textAlign: 'right' }, children: [_jsxs("div", { style: { fontWeight: 500 }, children: [formatDuration(run.summary.avgResponseTime), " avg"] }), _jsxs("div", { style: { fontSize: '0.85em', opacity: 0.7 }, children: [(run.summary.successRate * 100).toFixed(0), "% success"] })] })] }, run.id)))] })), runs.length === 0 && !isRunning && (_jsxs("div", { style: { textAlign: 'center', padding: 40, opacity: 0.6 }, children: [_jsx(BarChart3, { size: 48, style: { marginBottom: 15, opacity: 0.5 } }), _jsx("div", { children: "No performance runs yet." }), _jsx("div", { style: { fontSize: '0.9em', marginTop: 5 }, children: "Run a suite to see results here." })] }))] }));
};
