import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { UnifiedExplorerMain } from '../UnifiedExplorerMain';
import { UnifiedProject } from '@shared/models';

/**
 * Target Namespace row dedup — the "Operation Details" grid shows the
 * "Target Namespace" row ONLY when the sample envelope's declared namespace
 * (xmlns:web on the sample XML) differs from the operation's WSDL
 * targetNamespace. The default generated envelope declares exactly the
 * WSDL namespace, so the row is hidden there (the value is already visible
 * in the sample XML); it reappears when a stored sample request declares a
 * different namespace.
 */

const ENVELOPE_NS = 'http://schemas.xmlsoap.org/soap/envelope/';

const makeProject = (op: {
    targetNamespace?: string;
    sampleRequest?: string;
}): UnifiedProject => ({
    name: 'SVC',
    source: 'wsdl',
    sourceUrl: 'http://example.org/svc?WSDL',
    parsedAt: new Date().toISOString(),
    soapVersion: '1.1',
    operations: [
        {
            id: 'op-1',
            name: 'GetThing',
            action: 'http://example.org/GetThing',
            targetNamespace: op.targetNamespace,
            originalEndpoint: 'http://example.org/svc',
            requests: op.sampleRequest
                ? [
                    {
                        name: 'sample_req',
                        request: op.sampleRequest,
                        endpoint: 'http://example.org/svc',
                        method: 'POST',
                        contentType: 'text/xml',
                        requestType: 'soap',
                    },
                ]
                : [],
        },
    ],
});

const baseProps: Omit<React.ComponentProps<typeof UnifiedExplorerMain>, 'projects' | 'selectedNode'> = {
    onSelectNode: vi.fn(),
    onRefreshProject: vi.fn(),
    onLoadWsdl: vi.fn(),
    onNewRequest: vi.fn(),
    onRegisterExecute: vi.fn(),
};

const renderOp = (project: UnifiedProject) =>
    render(
        <UnifiedExplorerMain
            {...baseProps}
            projects={[project]}
            selectedNode={{ type: 'operation', id: 'op-1' }}
        />,
    );

describe('Operation Details — Target Namespace row dedup', () => {
    it('hides the row when the generated sample declares the WSDL namespace', () => {
        renderOp(makeProject({ targetNamespace: 'http://example.org/ns' }));

        expect(screen.getByText('Operation Details')).toBeInTheDocument();
        expect(screen.queryByText('Target Namespace:')).not.toBeInTheDocument();
    });

    it('shows the row when a stored sample request declares a different namespace', () => {
        const sample = `<soapenv:Envelope xmlns:soapenv="${ENVELOPE_NS}" xmlns:web="http://other/ns">
  <soapenv:Header/>
  <soapenv:Body>
    <web:GetThing/>
  </soapenv:Body>
</soapenv:Envelope>`;
        renderOp(makeProject({ targetNamespace: 'http://example.org/ns', sampleRequest: sample }));

        expect(screen.getByText('Target Namespace:')).toBeInTheDocument();
        expect(screen.getByText('http://example.org/ns')).toBeInTheDocument();
    });

    it('shows the row when the operation has no WSDL namespace but the sample declares one', () => {
        const sample = `<soapenv:Envelope xmlns:soapenv="${ENVELOPE_NS}" xmlns:web="http://example.org/ns">
  <soapenv:Header/>
  <soapenv:Body>
    <web:GetThing/>
  </soapenv:Body>
</soapenv:Envelope>`;
        renderOp(makeProject({ sampleRequest: sample }));

        expect(screen.getByText('Target Namespace:')).toBeInTheDocument();
    });
});
