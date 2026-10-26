import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddToProjectDialog } from '../AddToProjectDialog';
import { matchTrafficToOperations } from '../../../utils/trafficMatch';
import type { TrafficLog } from '../TrafficViewer';
import type { UnifiedProject } from '@shared/models';

/**
 * The menu caps what it lists at 12 matches, so the dialog is where the rest
 * are visible. It now takes the full ranked list and opens on the answer the
 * scorer produced — top match pre-selected in both dropdowns, matched
 * operations first with the signal that ranked them in the label.
 */

const log: TrafficLog = {
    id: 'log-1',
    timestamp: 0,
    method: 'POST',
    url: 'http://prod/svc',
    requestHeaders: { 'SOAPAction': '"urn:svc#Login"' },
    requestBody: '<e:Envelope><e:Body><Login/></e:Body></e:Envelope>',
};

const mkProject = (partial: Partial<UnifiedProject> & { name: string }): UnifiedProject => ({
    parsedAt: new Date(),
    operations: [],
    ...partial,
});

const projects = [
    mkProject({ name: 'Dev', sourceUrl: 'http://dev/svc', operations: [{ name: 'Login', action: 'urn:svc#Login', requests: [] }] }),
    mkProject({ name: 'Prod', sourceUrl: 'http://prod/svc', operations: [{ name: 'Login', action: 'urn:svc#Login', requests: [] }] }),
];

function selects() {
    const [project, operation] = screen.getAllByRole('combobox');
    return { project, operation };
}

describe('AddToProjectDialog with ranked matches', () => {
    it('opens on the top match, host tie-breaker included', () => {
        const matches = matchTrafficToOperations(log, projects);
        expect(matches[0].projectName).toBe('Prod');

        render(<AddToProjectDialog log={log} projects={projects} matches={matches} onConfirm={vi.fn()} onClose={vi.fn()} />);
        const { project, operation } = selects();
        expect(project).toHaveValue('Prod');
        expect(operation).toHaveValue('Login');
    });

    it('labels a matched operation with the signal that ranked it', () => {
        const matches = matchTrafficToOperations(log, projects);
        render(<AddToProjectDialog log={log} projects={projects} matches={matches} onConfirm={vi.fn()} onClose={vi.fn()} />);

        expect(screen.getByText('Login — SOAPAction')).toBeInTheDocument();
    });

    it('orders operations by rank, keeping the rest in WSDL order', () => {
        const rankedProjects = [mkProject({
            name: 'Svc',
            sourceUrl: 'http://svc/',
            operations: [
                { name: 'Unrelated', action: '', requests: [] },
                { name: 'GetPrice', action: '', requests: [] },
            ],
        })];
        const bodyLog = { ...log, url: 'http://svc/', requestHeaders: {}, requestBody: '<e:Envelope><e:Body><GetPrice/></e:Body></e:Envelope>' };
        const matches = matchTrafficToOperations(bodyLog, rankedProjects);

        render(<AddToProjectDialog log={bodyLog} projects={rankedProjects} matches={matches} onConfirm={vi.fn()} onClose={vi.fn()} />);
        const options = screen.getAllByRole('combobox')[1].querySelectorAll('option');
        expect(options[0]).toHaveTextContent('GetPrice — Body element');
        expect(options[1]).toHaveTextContent('Unrelated');
    });

    it('still defaults to a new operation when nothing matches', () => {
        render(<AddToProjectDialog log={log} projects={projects} matches={[]} onConfirm={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getAllByRole('combobox')[1]).toHaveValue('__new__');
    });
});
