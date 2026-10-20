import { describe, it, expect } from 'vitest';
import { formatSchemaReport, MAX_REPORTED_ISSUES } from '../utils/schemaReport';
import type { SchemaIssue } from '@shared/models';

describe('formatSchemaReport', () => {
    it('empty when there is nothing to report', () => {
        expect(formatSchemaReport([])).toBe('');
    });

    it('summary line plus one line per finding', () => {
        const issues: SchemaIssue[] = [
            { path: '$.data.id', message: 'expected integer, got string' },
            { path: '$', message: "missing required property 'name'" },
        ];
        const report = formatSchemaReport(issues);
        const lines = report.split('\n');
        expect(lines[0]).toBe('Response does not match the OpenAPI schema (2 issues)');
        expect(lines[1]).toBe('$.data.id: expected integer, got string');
        expect(lines[2]).toBe("$: missing required property 'name'");
    });

    it('singular for one finding', () => {
        expect(formatSchemaReport([{ path: '$', message: 'expected object' }])).toBe(
            'Response does not match the OpenAPI schema (1 issue)\n$: expected object',
        );
    });

    it('collapses past the cap instead of growing the banner', () => {
        const issues = Array.from({ length: MAX_REPORTED_ISSUES + 5 }, (_, i) => ({
            path: `$[${i}]`,
            message: 'expected string',
        }));
        const lines = formatSchemaReport(issues).split('\n');
        expect(lines.length).toBe(MAX_REPORTED_ISSUES + 2); // head + shown + collapse line
        expect(lines[lines.length - 1]).toBe('… 5 more');
    });
});
