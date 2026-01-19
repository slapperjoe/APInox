import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const ResponseTimeChart = ({ data, height = 150, showP95 = true, showP99 = false, title = 'Response Times' }) => {
    if (data.length === 0) {
        return (_jsx("div", { style: {
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--vscode-descriptionForeground)',
                fontSize: 12
            }, children: "No data to display" }));
    }
    const width = 300;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    // Calculate scales
    const allValues = data.flatMap(d => [d.value, d.p95 || 0, d.p99 || 0]);
    const maxValue = Math.max(...allValues) * 1.1 || 100;
    const minValue = 0;
    const xScale = (index) => padding.left + (index / (data.length - 1 || 1)) * chartWidth;
    const yScale = (value) => height - padding.bottom - ((value - minValue) / (maxValue - minValue)) * chartHeight;
    // Create line paths
    const createPath = (accessor) => {
        const points = data
            .map((d, i) => {
            const val = accessor(d);
            return val !== undefined ? `${xScale(i)},${yScale(val)}` : null;
        })
            .filter(Boolean);
        return `M${points.join('L')}`;
    };
    const avgPath = createPath(d => d.value);
    const p95Path = showP95 ? createPath(d => d.p95) : '';
    const p99Path = showP99 ? createPath(d => d.p99) : '';
    // Grid lines
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
        y: padding.top + chartHeight * (1 - ratio),
        value: minValue + (maxValue - minValue) * ratio
    }));
    return (_jsxs("div", { style: { width: '100%' }, children: [title && (_jsx("div", { style: {
                    fontSize: 11,
                    fontWeight: 500,
                    marginBottom: 4,
                    color: 'var(--vscode-foreground)'
                }, children: title })), _jsxs("svg", { width: "100%", height: height, viewBox: `0 0 ${width} ${height}`, style: { overflow: 'visible' }, children: [gridLines.map((line, i) => (_jsxs("g", { children: [_jsx("line", { x1: padding.left, y1: line.y, x2: width - padding.right, y2: line.y, stroke: "var(--vscode-editorWidget-border)", strokeWidth: 0.5, strokeDasharray: "3,3" }), _jsxs("text", { x: padding.left - 8, y: line.y + 3, textAnchor: "end", fontSize: 9, fill: "var(--vscode-descriptionForeground)", children: [Math.round(line.value), "ms"] })] }, i))), showP99 && p99Path && (_jsx("path", { d: p99Path, fill: "none", stroke: "var(--vscode-charts-red)", strokeWidth: 1.5, strokeDasharray: "4,2", opacity: 0.6 })), showP95 && p95Path && (_jsx("path", { d: p95Path, fill: "none", stroke: "var(--vscode-charts-yellow)", strokeWidth: 1.5, strokeDasharray: "2,2", opacity: 0.8 })), _jsx("path", { d: avgPath, fill: "none", stroke: "var(--vscode-charts-green)", strokeWidth: 2 }), data.map((d, i) => (_jsx("circle", { cx: xScale(i), cy: yScale(d.value), r: 3, fill: "var(--vscode-charts-green)" }, i))), data.map((d, i) => (_jsx("text", { x: xScale(i), y: height - 8, textAnchor: "middle", fontSize: 8, fill: "var(--vscode-descriptionForeground)", children: d.label.length > 6 ? d.label.slice(0, 6) + '…' : d.label }, i)))] }), _jsxs("div", { style: {
                    display: 'flex',
                    gap: 12,
                    fontSize: 10,
                    marginTop: 4,
                    justifyContent: 'center'
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsx("div", { style: { width: 12, height: 2, background: 'var(--vscode-charts-green)' } }), "Avg"] }), showP95 && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsx("div", { style: { width: 12, height: 2, background: 'var(--vscode-charts-yellow)', opacity: 0.8 } }), "P95"] })), showP99 && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsx("div", { style: { width: 12, height: 2, background: 'var(--vscode-charts-red)', opacity: 0.6 } }), "P99"] }))] })] }));
};
/**
 * Convert PerformanceStats array to chart data points
 */
export function statsToChartData(runs) {
    return runs.map((run, index) => ({
        label: run.startTime
            ? new Date(run.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : `Run ${index + 1}`,
        value: run.summary.avgResponseTime,
        p95: run.summary.p95,
        p99: run.summary.p99
    }));
}
