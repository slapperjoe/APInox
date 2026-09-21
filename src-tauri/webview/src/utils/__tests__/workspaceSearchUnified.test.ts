import { describe, it, expect } from 'vitest';
import { searchUnifiedProjects } from '../workspaceSearch';
import { UnifiedProject } from '@shared/models';

/**
 * searchUnifiedProjects — workspace search over the FLAT unified model
 * (UnifiedProject.operations[].requests[], no legacy interfaces[] layer).
 *
 * The old search only walked the legacy nested model (ApinoxProject.
 * interfaces[].operations[].requests[]), so unified-explorer projects —
 * the only projects in Phase B — never matched. These tests pin the
 * fix: project names, operation names, request names, and display names
 * must all be searchable.
 */

function makeProject(partial: Partial<UnifiedProject> = {}): UnifiedProject {
    return {
        name: 'MyProject',
        displayName: undefined,
        source: 'wsdl',
        parsedAt: new Date(),
        operations: [],
        ...partial,
    } as UnifiedProject;
}

describe('searchUnifiedProjects', () => {
    it('matches project name', () => {
        const results = searchUnifiedProjects('MyProj', [makeProject()]);
        expect(results.some(r => r.type === 'project' && r.name === 'MyProject')).toBe(true);
    });

    it('matches project display name (falls back to name)', () => {
        const results = searchUnifiedProjects(
            'Custom Name',
            [makeProject({ displayName: 'Custom Name' })],
        );
        expect(results.some(r => r.type === 'project' && r.name === 'Custom Name')).toBe(true);
    });

    it('matches operation name', () => {
        const project = makeProject({
            operations: [
                {
                    name: 'GetUserInfo',
                    action: '',
                    requests: [],
                },
            ],
        });
        const results = searchUnifiedProjects('GetUser', [project]);
        const opResult = results.find(r => r.type === 'operation' && r.name === 'GetUserInfo');
        expect(opResult).toBeTruthy();
        // Navigation depends on data.operation being the full op object.
        expect(opResult?.data.operation?.name).toBe('GetUserInfo');
    });

    it('matches request name and carries parent operation for navigation', () => {
        const project = makeProject({
            name: 'Users',
            operations: [
                {
                    name: 'GetUserInfo',
                    action: '',
                    requests: [
                        { name: 'GetUserInfoRequest', request: '<xml/>' },
                    ],
                },
            ],
        });
        const results = searchUnifiedProjects('GetUserInfoRequest', [project]);
        const reqResult = results.find(r => r.type === 'request' && r.name === 'GetUserInfoRequest');
        expect(reqResult).toBeTruthy();
        // SearchContext's unified-explorer navigation resolves the unified
        // node via data.operation (find by id or name). Both must be present.
        expect(reqResult?.data.operation?.name).toBe('GetUserInfo');
        expect(reqResult?.data.request?.name).toBe('GetUserInfoRequest');
        expect(reqResult?.data.projectName).toBe('Users');
    });

    it('returns no results for an empty query', () => {
        expect(searchUnifiedProjects('', [makeProject()])).toEqual([]);
        expect(searchUnifiedProjects('   ', [makeProject()])).toEqual([]);
    });

    it('handles skeleton projects (empty operations array) without throwing', () => {
        const skeleton = makeProject({ operations: [] });
        // Project-name match still works on a skeleton (names are present).
        const results = searchUnifiedProjects('MyProj', [skeleton]);
        expect(results.some(r => r.type === 'project')).toBe(true);
    });

    it('respects maxResults and minScore', () => {
        const many = Array.from({ length: 10 }, (_, i) =>
            makeProject({ name: `Project${i}`, operations: [] }),
        );
        const limited = searchUnifiedProjects('Project', many, { maxResults: 3 });
        expect(limited.length).toBe(3);

        const none = searchUnifiedProjects('zzz', many, { minScore: 100 });
        expect(none.length).toBe(0);
    });

    it('is case-insensitive', () => {
        const project = makeProject({
            operations: [
                { name: 'getUserInfo', action: '', requests: [] },
            ],
        });
        const results = searchUnifiedProjects('GETUSER', [project]);
        expect(results.some(r => r.type === 'operation' && r.name === 'getUserInfo')).toBe(true);
    });
});
