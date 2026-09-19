import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { UnifiedExplorerSidebar } from '../UnifiedExplorerSidebar';
import { UnifiedProject } from '@shared/models';

/**
 * Unified explorer sidebar header + "+" add flow.
 *
 * The sidebar now has a header (like the TestsUi / other sidebar panels) with
 * the "UNIFIED EXPLORER" title and a "+" button. The "+" opens a small menu
 * (New Request / Load Definition); each action drives a two-step flow
 * (pick project → name request / source URL) rendered below the header.
 *
 * "Load Definition" is only present when `onLoadWsdl` is provided (it is
 * undefined in non-Tauri dev, mirroring the import handlers).
 */

// ── fixtures ─────────────────────────────────────────────────────────────────
const makeProject = (name = 'CountryInfo'): UnifiedProject => ({
    name,
    source: 'wsdl',
    sourceUrl: `http://example.org/${name}?WSDL`,
    parsedAt: new Date().toISOString(),
    soapVersion: '1.1',
    operations: [
        {
            id: `${name}-op-1`,
            name: 'GetCurrencyRate',
            action: `http://example.org/${name}/GetCurrencyRate`,
            targetNamespace: `http://example.org/${name}/`,
            originalEndpoint: `http://example.org/${name}`,
            requests: [],
        },
    ],
});

const baseProps: Omit<React.ComponentProps<typeof UnifiedExplorerSidebar>, 'projects'> = {
    selectedNode: null,
    onSelectNode: vi.fn(),
    onRefreshProject: vi.fn(),
    onDeleteProject: vi.fn(),
    onDeleteOperation: vi.fn(),
    onDeleteRequest: vi.fn(),
    onNewRequest: vi.fn(),
    onExportProject: vi.fn(),
    onReorderOperation: vi.fn(),
    onReorderRequest: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('UnifiedExplorerSidebar header', () => {
    it('renders the UNIFIED EXPLORER title and the "+" button', () => {
        render(<UnifiedExplorerSidebar {...baseProps} projects={[makeProject()]} />);

        expect(screen.getByText('Unified Explorer')).toBeInTheDocument();
        expect(screen.getByTitle('Add')).toBeInTheDocument();
    });

    it('shows the "+" button even with zero projects', () => {
        render(<UnifiedExplorerSidebar {...baseProps} projects={[]} />);

        expect(screen.getByText('Unified Explorer')).toBeInTheDocument();
        expect(screen.getByTitle('Add')).toBeInTheDocument();
    });
});

describe('UnifiedExplorerSidebar "+" menu', () => {
    it('opens the menu with New Request and Load Definition', () => {
        const onLoadWsdl = vi.fn();
        render(<UnifiedExplorerSidebar {...baseProps} projects={[makeProject()]} onLoadWsdl={onLoadWsdl} />);

        fireEvent.click(screen.getByTitle('Add'));

        expect(screen.getByText('New Request')).toBeInTheDocument();
        expect(screen.getByText('Load Definition')).toBeInTheDocument();
    });

    it('omits Load Definition when onLoadWsdl is undefined (non-Tauri dev)', () => {
        render(<UnifiedExplorerSidebar {...baseProps} projects={[makeProject()]} />);

        fireEvent.click(screen.getByTitle('Add'));

        expect(screen.getByText('New Request')).toBeInTheDocument();
        expect(screen.queryByText('Load Definition')).not.toBeInTheDocument();
    });

    it('closes the menu on Escape', () => {
        const onLoadWsdl = vi.fn();
        render(<UnifiedExplorerSidebar {...baseProps} projects={[makeProject()]} onLoadWsdl={onLoadWsdl} />);

        fireEvent.click(screen.getByTitle('Add'));
        expect(screen.getByText('New Request')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByText('New Request')).not.toBeInTheDocument();
    });
});

describe('UnifiedExplorerSidebar "+" → New Request flow', () => {
    it('skips the project step when there is a single project and offers the operation', () => {
        const projects = [makeProject()];
        render(<UnifiedExplorerSidebar {...baseProps} projects={projects} />);

        fireEvent.click(screen.getByTitle('Add'));
        fireEvent.click(screen.getByText('New Request'));

        // Single project: straight to the operation picker (no project step).
        expect(screen.getByText('Add request to operation:')).toBeInTheDocument();
        const select = screen.getByDisplayValue('GetCurrencyRate') as HTMLSelectElement;
        expect(select).toBeInTheDocument();

        // The breadcrumb shows the action + the chosen project, and a cancel (X) is present.
        expect(screen.getByText('New Request — CountryInfo')).toBeInTheDocument();
        expect(screen.getByTitle('Cancel add flow')).toBeInTheDocument();

        // Creating the request calls onNewRequest(project, operation).
        fireEvent.click(screen.getByTitle('Create request'));
        expect(baseProps.onNewRequest).toHaveBeenCalledTimes(1);
        expect(baseProps.onNewRequest).toHaveBeenCalledWith('CountryInfo', 'GetCurrencyRate');

        // The flow resets: the header title is back and the picker is gone.
        expect(screen.queryByText('Add request to operation:')).not.toBeInTheDocument();
        expect(screen.getByText('Unified Explorer')).toBeInTheDocument();
    });

    it('shows the project picker first when there are multiple projects', () => {
        const projects = [makeProject('Alpha'), makeProject('Beta')];
        render(<UnifiedExplorerSidebar {...baseProps} projects={projects} />);

        fireEvent.click(screen.getByTitle('Add'));
        fireEvent.click(screen.getByText('New Request'));

        expect(screen.getByText('Which project?')).toBeInTheDocument();
        expect(screen.queryByText('Add request to operation:')).not.toBeInTheDocument();

        // Pick a project (the picker rows are buttons; the tree rows are divs).
        fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
        expect(screen.getByText('Add request to operation:')).toBeInTheDocument();
        expect(screen.getByText('New Request — Alpha')).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Create request'));
        expect(baseProps.onNewRequest).toHaveBeenCalledWith('Alpha', 'GetCurrencyRate');
    });

    it('cancels the flow via the X button', () => {
        const projects = [makeProject()];
        render(<UnifiedExplorerSidebar {...baseProps} projects={projects} />);

        fireEvent.click(screen.getByTitle('Add'));
        fireEvent.click(screen.getByText('New Request'));
        expect(screen.getByText('Add request to operation:')).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Cancel add flow'));
        expect(screen.queryByText('Add request to operation:')).not.toBeInTheDocument();
        expect(screen.getByText('Unified Explorer')).toBeInTheDocument();
        expect(baseProps.onNewRequest).not.toHaveBeenCalled();
    });
});

describe('UnifiedExplorerSidebar "+" → Load Definition flow', () => {
    it('submits the source URL to onLoadWsdl', () => {
        const onLoadWsdl = vi.fn();
        render(<UnifiedExplorerSidebar {...baseProps} projects={[]} onLoadWsdl={onLoadWsdl} />);

        fireEvent.click(screen.getByTitle('Add'));
        fireEvent.click(screen.getByText('Load Definition'));

        // Zero projects: straight to the source step.
        expect(screen.getByText('WSDL / OpenAPI / GraphQL URL')).toBeInTheDocument();
        const input = screen.getByPlaceholderText('https://…/Service?WSDL') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'http://example.org/Service?WSDL' } });

        fireEvent.click(screen.getByTitle('Load definition'));
        expect(onLoadWsdl).toHaveBeenCalledTimes(1);
        expect(onLoadWsdl).toHaveBeenCalledWith('http://example.org/Service?WSDL');

        // The flow resets.
        expect(screen.queryByText('WSDL / OpenAPI / GraphQL URL')).not.toBeInTheDocument();
        expect(screen.getByText('Unified Explorer')).toBeInTheDocument();
    });

    it('shows the project picker first when there are multiple projects', () => {
        const onLoadWsdl = vi.fn();
        const projects = [makeProject('Alpha'), makeProject('Beta')];
        render(<UnifiedExplorerSidebar {...baseProps} projects={projects} onLoadWsdl={onLoadWsdl} />);

        fireEvent.click(screen.getByTitle('Add'));
        fireEvent.click(screen.getByText('Load Definition'));

        expect(screen.getByText('Which project to refresh?')).toBeInTheDocument();
        // Picker row is a button; the tree also renders the project names.
        fireEvent.click(screen.getByRole('button', { name: 'Beta' }));

        // Beta's sourceUrl is pre-filled as the input's value; submit it.
        const input = screen.getByDisplayValue('http://example.org/Beta?WSDL') as HTMLInputElement;
        expect(input).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('Load definition'));
        expect(onLoadWsdl).toHaveBeenCalledWith('http://example.org/Beta?WSDL');
    });
});
