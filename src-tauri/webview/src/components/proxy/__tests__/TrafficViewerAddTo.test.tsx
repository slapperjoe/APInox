import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TrafficViewer } from '../TrafficViewer';
import type { TrafficLog } from '../TrafficViewer';
import type { UnifiedProject } from '@shared/models';
import { EditorSettingsProvider } from '../../../request-editor/contexts/EditorSettingsContext';

/**
 * Traffic right-click "Add to": the capture is scored against the loaded
 * projects (utils/trafficMatch) and the submenu lists the operations it
 * matches — clicking one adds straight to the tree with no dialog. The last
 * entry is the manual picker, which still opens AddToProjectDialog for the
 * no-match case.
 */

const log: TrafficLog = {
    id: 'log-1',
    timestamp: 0,
    method: 'POST',
    url: 'http://svc/Service1.asmx',
    // The filter bar defaults to 2xx only, so a status-less capture is not
    // rendered and the row cannot be right-clicked.
    status: 200,
    requestHeaders: { 'SOAPAction': '"urn:svc#Login"' },
    requestBody: '<soap:Envelope><soap:Body><Login/></soap:Body></soap:Envelope>',
};

const project: UnifiedProject = {
    name: 'Service1',
    displayName: 'Production',
    source: 'wsdl',
    sourceUrl: 'http://svc/Service1.asmx?WSDL',
    parsedAt: new Date(),
    operations: [{
        id: 'op-1',
        name: 'Login',
        action: 'urn:svc#Login',
        requests: [],
    }],
};

/** TrafficViewer reads the live editor settings for its copy formatting, so it
 *  needs the provider the app puts above it. */
function renderViewer(props: React.ComponentProps<typeof TrafficViewer>) {
    return render(<EditorSettingsProvider><TrafficViewer {...props} /></EditorSettingsProvider>);
}

function openMenu() {
    const row = screen.getByTitle(log.url);
    fireEvent.contextMenu(row);
}

describe('TrafficViewer right-click "Add to"', () => {
    it('lists the matched operation and adds it directly on click', () => {
        const onAddTrafficToOperation = vi.fn();
        renderViewer({ logs: [log], projects: [project], onAddTrafficToOperation });

        openMenu();
        const parent = screen.getByText('Add to');
        fireEvent.mouseEnter(parent);

        // Label and sub-line are separate nodes; the sub-line names the project
        // and which signal fired, so a tie between projects is legible.
        const entry = screen.getByText('Production · SOAPAction');
        fireEvent.click(entry);

        expect(onAddTrafficToOperation).toHaveBeenCalledWith(
            log,
            expect.objectContaining({ projectName: 'Service1', operationName: 'Login' }),
        );
    });

    it('falls back to the dialog entry when nothing matches', () => {
        const onAddToApinoxProject = vi.fn();
        renderViewer({ logs: [log], projects: [], onAddToApinoxProject });

        openMenu();
        const parent = screen.getByText('Add to');
        expect(screen.getByText('No WSDL match')).toBeInTheDocument();
        fireEvent.mouseEnter(parent);

        fireEvent.click(screen.getByText('Add to a new operation…'));
        expect(onAddToApinoxProject).toHaveBeenCalledWith(log);
    });

    it('omits the section when neither handler is wired', () => {
        renderViewer({ logs: [log] });
        openMenu();
        expect(screen.queryByText('Add to')).not.toBeInTheDocument();
    });

    it('matches a skeleton-shaped project without a detail load', () => {
        // A skeleton is a name-only tree with empty bodies, but it carries the
        // action — so a style-literal capture whose operation name differs from
        // its Body element still resolves, in one pass, for every project.
        const skeleton = {
            ...project,
            operations: [{ name: 'Authenticate', action: 'urn:svc#Login', requests: [{ name: 'sample', request: '' }] }],
        };
        renderViewer({ logs: [log], projects: [skeleton], onAddTrafficToOperation: vi.fn() });

        openMenu();
        fireEvent.mouseEnter(screen.getByText('Add to'));
        expect(screen.getByText('Production · SOAPAction')).toBeInTheDocument();
    });

});
