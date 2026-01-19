/**
 * CSV Export Utilities
 *
 * Provides functions to export data arrays to CSV format.
 */
/**
 * Escape a value for CSV (handle commas, quotes, newlines)
 */
function escapeCsvValue(value) {
    if (value === null || value === undefined)
        return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
/**
 * Convert an array of objects to CSV string
 */
export function toCSV(data, columns) {
    if (data.length === 0)
        return '';
    // Header row
    const header = columns.map(c => escapeCsvValue(c.header)).join(',');
    // Data rows
    const rows = data.map(item => columns.map(c => escapeCsvValue(item[c.key])).join(','));
    return [header, ...rows].join('\r\n');
}
/**
 * Download a CSV string as a file
 */
export function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
/**
 * Export watcher events to CSV
 */
export function exportWatcherEvents(events, filename = 'watcher_events') {
    const columns = [
        { key: 'timestamp', header: 'Timestamp' },
        { key: 'type', header: 'Type' },
        { key: 'method', header: 'Method' },
        { key: 'url', header: 'URL' },
        { key: 'status', header: 'Status' },
        { key: 'duration', header: 'Duration (ms)' }
    ];
    const formattedData = events.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp).toISOString()
    }));
    const csv = toCSV(formattedData, columns);
    downloadCSV(csv, `${filename}_${Date.now()}`);
}
/**
 * Export proxy history events to CSV
 */
export function exportProxyHistory(events, filename = 'proxy_history') {
    const columns = [
        { key: 'timestamp', header: 'Timestamp' },
        { key: 'method', header: 'Method' },
        { key: 'url', header: 'URL' },
        { key: 'statusCode', header: 'Status' },
        { key: 'responseTime', header: 'Response Time (ms)' },
        { key: 'contentType', header: 'Content-Type' }
    ];
    const formattedData = events.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp).toISOString()
    }));
    const csv = toCSV(formattedData, columns);
    downloadCSV(csv, `${filename}_${Date.now()}`);
}
