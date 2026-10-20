import type { SchemaIssue } from '@shared/models';

/** How many violations the banner lists before collapsing the rest. */
export const MAX_REPORTED_ISSUES = 20;

/**
 * Build the response-pane text for a schema-violation report.
 *
 * The first line is the summary the banner shows collapsed; the rest are the
 * individual findings, which the banner reveals on demand. Kept as a pure
 * function so the formatting is testable without mounting the response pane.
 */
export function formatSchemaReport(issues: SchemaIssue[]): string {
    if (!issues || issues.length === 0) return '';
    const shown = issues.slice(0, MAX_REPORTED_ISSUES);
    const head = `Response does not match the OpenAPI schema (${issues.length} issue${issues.length === 1 ? '' : 's'})`;
    const lines = shown.map(issue => `${issue.path}: ${issue.message}`);
    if (issues.length > shown.length) {
        lines.push(`… ${issues.length - shown.length} more`);
    }
    return [head, ...lines].join('\n');
}
