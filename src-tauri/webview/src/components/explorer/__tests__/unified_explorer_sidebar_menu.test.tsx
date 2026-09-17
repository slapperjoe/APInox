import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { UnifiedExplorerSidebar } from '../UnifiedExplorerSidebar';
import { UnifiedProject } from '@shared/models';

/**
 * Sidebar-level context menu (import actions).
 *
 * Right-clicking ANY unclaimed surface of the unified sidebar (empty space,
 * the container padding, the empty state) opens a menu with the import
 * actions — this is what makes importing an APInox workspace possible when
 * the project tree is empty (no rows to right-click). Per-row menus
 * (project/operation/request) and the ScrapbookPanel stop propagation on
 * their own right-clicks, so a row right-click keeps showing the row menu,
 * not the sidebar menu.
 */

// ── fixtures ─────────────────────────────────────────────────────────────────
const makeProject = (): UnifiedProject => ({
    name: 'CountryInfo',
    source: 'wsdl',
    sourceUrl: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL',
    parsedAt: new Date().toISOString(),
    soapVersion: '1.1',
    operations: [
        {
            id: 'op-1',
            name: 'GetCurrencyRate',
            action: 'http://www.oorsprong.org/websamples.countryinfo/GetCurrencyRate',
            targetNamespace: 'http://www.oorsprong.org/websamples.countryinfo/',
            originalEndpoint: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso',
            requests: [
                {
                    id: 'req-1',
                    name: 'MyRateRequest',
                    request: '<GetCurrencyRate/>',
                    endpoint: 'http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso',
                },
            ],
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

// The three import handlers, each wired so the corresponding menu item
// renders (the sidebar menu omits items whose prop is undefined).
const importProps = {
    onImportWorkspace: vi.fn(),
    onImportSoapUI: vi.fn(),
    onBulkImport: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
});

// The empty-state block ("No projects yet") is the unclaimed surface we
// right-click when the tree has zero projects.
const emptyState = () => screen.getByText('No projects yet');

describe('UnifiedExplorerSidebar sidebar-level context menu (imports)', () => {
    it('shows the import menu when right-clicking the empty state (zero projects)', async () => {
        render(<UnifiedExplorerSidebar {...baseProps} {...importProps} projects={[]} />);

        fireEvent.contextMenu(emptyState());

        await screen.findByText('Import Workspace');
        expect(screen.getByText('Import Workspace')).toBeInTheDocument();
        expect(screen.getByText('Import SoapUI Workspace')).toBeInTheDocument();
        expect(screen.getByText('Bulk Import WSDLs')).toBeInTheDocument();
    });

    it('Import Workspace click calls onImportWorkspace', async () => {
        render(<UnifiedExplorerSidebar {...baseProps} {...importProps} projects={[]} />);

        fireEvent.contextMenu(emptyState());
        fireEvent.click(await screen.findByText('Import Workspace'));

        expect(importProps.onImportWorkspace).toHaveBeenCalledTimes(1);
        expect(importProps.onImportSoapUI).not.toHaveBeenCalled();
        expect(importProps.onBulkImport).not.toHaveBeenCalled();
    });

    it('Import SoapUI Workspace click calls onImportSoapUI', async () => {
        render(<UnifiedExplorerSidebar {...baseProps} {...importProps} projects={[]} />);

        fireEvent.contextMenu(emptyState());
        fireEvent.click(await screen.findByText('Import SoapUI Workspace'));

        expect(importProps.onImportSoapUI).toHaveBeenCalledTimes(1);
        expect(importProps.onImportWorkspace).not.toHaveBeenCalled();
    });

    it('Bulk Import WSDLs click calls onBulkImport', async () => {
        render(<UnifiedExplorerSidebar {...baseProps} {...importProps} projects={[]} />);

        fireEvent.contextMenu(emptyState());
        fireEvent.click(await screen.findByText('Bulk Import WSDLs'));

        expect(importProps.onBulkImport).toHaveBeenCalledTimes(1);
        expect(importProps.onImportWorkspace).not.toHaveBeenCalled();
    });

    it('right-clicking a project row still opens the ROW menu, not the sidebar menu', async () => {
        render(<UnifiedExplorerSidebar {...baseProps} {...importProps} projects={[makeProject()]} />);

        fireEvent.contextMenu(screen.getByText('CountryInfo'));

        // Row menu markers:
        await screen.findByText('Refresh WSDL');
        expect(screen.getByText('Export Project')).toBeInTheDocument();
        // The sidebar menu's "Import Workspace" item is a distinct label from
        // the row menu's "Import SoapUI Workspace" / "Bulk Import" rows —
        // assert the sidebar item specifically is absent while the row
        // actions are present.
        expect(screen.queryByText('Import Workspace')).not.toBeInTheDocument();
        expect(screen.queryByText('Bulk Import WSDLs')).not.toBeInTheDocument();
    });

    it('no sidebar menu when no import handlers are provided (non-Tauri dev)', async () => {
        render(<UnifiedExplorerSidebar {...baseProps} projects={[]} />);

        fireEvent.contextMenu(emptyState());

        // No menu at all: none of the sidebar-menu items render.
        expect(screen.queryByText('Import Workspace')).not.toBeInTheDocument();
        expect(screen.queryByText('Import SoapUI Workspace')).not.toBeInTheDocument();
        expect(screen.queryByText('Bulk Import WSDLs')).not.toBeInTheDocument();
    });

    it('omits individual items whose handlers are undefined', async () => {
        // Only onImportSoapUI provided → only that item renders.
        const props = { ...baseProps, onImportSoapUI: vi.fn() };
        render(<UnifiedExplorerSidebar {...props} projects={[]} />);

        fireEvent.contextMenu(emptyState());

        await screen.findByText('Import SoapUI Workspace');
        expect(screen.queryByText('Import Workspace')).not.toBeInTheDocument();
        expect(screen.queryByText('Bulk Import WSDLs')).not.toBeInTheDocument();
    });
});
