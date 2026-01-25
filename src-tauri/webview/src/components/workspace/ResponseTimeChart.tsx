/**
 * ResponseTimeChart Component
 * 
 * A simple SVG-based line chart for visualizing response times across runs.
 */

import React from 'react';
import styled from 'styled-components';
import { PerformanceStats } from '@shared/models';
import { SPACING_XS, SPACING_SM, SPACING_MD } from '../../styles/spacing';

interface DataPoint {
    label: string;
    value: number;
    p95?: number;
    p99?: number;
}

interface ResponseTimeChartProps {
    data: DataPoint[];
    height?: number;
    showP95?: boolean;
    showP99?: boolean;
    title?: string;
}

// Chart dimensions constants
const CHART_WIDTH = 300;
const CHART_PADDING = {
    top: 20,
    right: 20,
    bottom: 30,
    left: 50
};

const ChartContainer = styled.div`
    width: 100%;
`;

const ChartTitle = styled.div`
    font-size: 11px;
    font-weight: 500;
    margin-bottom: ${SPACING_XS};
    color: var(--vscode-foreground);
`;

const EmptyState = styled.div<{ $height: number }>`
    height: ${props => props.$height}px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
`;

const Legend = styled.div`
    display: flex;
    gap: ${SPACING_MD};
    font-size: 10px;
    margin-top: ${SPACING_XS};
    justify-content: center;
`;

const LegendItem = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_XS};
`;

const LegendLine = styled.div<{ $color: string; $opacity?: number }>`
    width: 12px;
    height: 2px;
    background: ${props => props.$color};
    opacity: ${props => props.$opacity || 1};
`;

export const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({
    data,
    height = 150,
    showP95 = true,
    showP99 = false,
    title = 'Response Times'
}) => {
    if (data.length === 0) {
        return (
            <ChartContainer>
                {title && <ChartTitle>{title}</ChartTitle>}
                <EmptyState $height={height}>
                    No data to display
                </EmptyState>
            </ChartContainer>
        );
    }

    const padding = CHART_PADDING;
    const chartWidth = CHART_WIDTH - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate scales
    const allValues = data.flatMap(d => [d.value, d.p95 || 0, d.p99 || 0]);
    const maxValue = Math.max(...allValues) * 1.1 || 100;
    const minValue = 0;

    const xScale = (index: number) => padding.left + (index / (data.length - 1 || 1)) * chartWidth;
    const yScale = (value: number) => height - padding.bottom - ((value - minValue) / (maxValue - minValue)) * chartHeight;

    // Create line paths
    const createPath = (accessor: (d: DataPoint) => number | undefined) => {
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

    return (
        <ChartContainer>
            {title && <ChartTitle>{title}</ChartTitle>}
            <svg
                width="100%"
                height={height}
                viewBox={`0 0 ${CHART_WIDTH} ${height}`}
                style={{ overflow: 'visible' }}
            >
                {/* Grid lines */}
                {gridLines.map((line, i) => (
                    <g key={i}>
                        <line
                            x1={padding.left}
                            y1={line.y}
                            x2={CHART_WIDTH - padding.right}
                            y2={line.y}
                            stroke="var(--vscode-editorWidget-border)"
                            strokeWidth={0.5}
                            strokeDasharray="3,3"
                        />
                        <text
                            x={padding.left - 8}
                            y={line.y + 3}
                            textAnchor="end"
                            fontSize={9}
                            fill="var(--vscode-descriptionForeground)"
                        >
                            {Math.round(line.value)}ms
                        </text>
                    </g>
                ))}

                {/* P99 line */}
                {showP99 && p99Path && (
                    <path
                        d={p99Path}
                        fill="none"
                        stroke="var(--vscode-charts-red)"
                        strokeWidth={1.5}
                        strokeDasharray="4,2"
                        opacity={0.6}
                    />
                )}

                {/* P95 line */}
                {showP95 && p95Path && (
                    <path
                        d={p95Path}
                        fill="none"
                        stroke="var(--vscode-charts-yellow)"
                        strokeWidth={1.5}
                        strokeDasharray="2,2"
                        opacity={0.8}
                    />
                )}

                {/* Average line */}
                <path
                    d={avgPath}
                    fill="none"
                    stroke="var(--vscode-charts-green)"
                    strokeWidth={2}
                />

                {/* Data points */}
                {data.map((d, i) => (
                    <circle
                        key={i}
                        cx={xScale(i)}
                        cy={yScale(d.value)}
                        r={3}
                        fill="var(--vscode-charts-green)"
                    />
                ))}

                {/* X-axis labels */}
                {data.map((d, i) => (
                    <text
                        key={i}
                        x={xScale(i)}
                        y={height - 8}
                        textAnchor="middle"
                        fontSize={8}
                        fill="var(--vscode-descriptionForeground)"
                    >
                        {d.label.length > 6 ? d.label.slice(0, 6) + '…' : d.label}
                    </text>
                ))}
            </svg>

            {/* Legend */}
            <Legend>
                <LegendItem>
                    <LegendLine $color="var(--vscode-charts-green)" />
                    Avg
                </LegendItem>
                {showP95 && (
                    <LegendItem>
                        <LegendLine $color="var(--vscode-charts-yellow)" $opacity={0.8} />
                        P95
                    </LegendItem>
                )}
                {showP99 && (
                    <LegendItem>
                        <LegendLine $color="var(--vscode-charts-red)" $opacity={0.6} />
                        P99
                    </LegendItem>
                )}
            </Legend>
        </ChartContainer>
    );
};

/**
 * Convert PerformanceStats array to chart data points
 */
export function statsToChartData(runs: Array<{ id?: string; summary: PerformanceStats; startTime?: number }>): DataPoint[] {
    return runs.map((run, index) => ({
        label: run.startTime
            ? new Date(run.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : `Run ${index + 1}`,
        value: run.summary.avgResponseTime,
        p95: run.summary.p95,
        p99: run.summary.p99
    }));
}
