/**
 * TestsUi right-click import/export menu (suite: Export Suite / Import Suite /
 * Import Test Case; case: Export Test Case).
 *
 * Pins the wiring: each menu item fires the matching prop with the right id,
 * the "Import / Export" section renders only when the handlers are provided
 * (isolated tests render the rail without the full app wiring), and step
 * menus stay untouched (no file actions).
 *
 * jsdom-only (webview vitest config) — the shared SidebarContextMenu renders
 * here, so the lucide mock must cover every icon both modules import.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestsUi, TestsUiProps } from "../TestsUi";
import { ApinoxProject } from "@shared/models";

// Mock Lucide icons (superset of the TestsUi.test.tsx set + the file-action
// icons; SidebarContextMenu imports the rest — every name must exist or the
// menu's icon components render undefined).
vi.mock("lucide-react", () => ({
    Play: () => <span data-testid="icon-play" />,
    Plus: () => <span data-testid="icon-plus" />,
    Trash2: () => <span data-testid="icon-trash" />,
    ChevronDown: () => <span data-testid="icon-chevron-down" />,
    ChevronRight: () => <span data-testid="icon-chevron-right" />,
    FlaskConical: () => <span data-testid="icon-flask" />,
    FolderOpen: () => <span data-testid="icon-folder" />,
    ListChecks: () => <span data-testid="icon-list-checks" />,
    Clock: () => <span data-testid="icon-clock" />,
    FileCode: () => <span data-testid="icon-file-code" />,
    ArrowRight: () => <span data-testid="icon-arrow-right" />,
    FileText: () => <span data-testid="icon-file-text" />,
    GitBranch: () => <span data-testid="icon-git-branch" />,
    RefreshCw: () => <span data-testid="icon-refresh-cw" />,
    CheckCircle: () => <span data-testid="icon-check-circle" />,
    XCircle: () => <span data-testid="icon-x-circle" />,
    Minus: () => <span data-testid="icon-minus" />,
    Loader2: () => <span data-testid="icon-loader" />,
    Pencil: () => <span data-testid="icon-pencil" />,
    Download: () => <span data-testid="icon-download" />,
    Globe: () => <span data-testid="icon-globe" />,
    Link: () => <span data-testid="icon-link" />,
    Copy: () => <span data-testid="icon-copy" />,
    Pause: () => <span data-testid="icon-pause" />,
    VenetianMask: () => <span data-testid="icon-mask" />,
    Check: () => <span data-testid="icon-check" />,
    ExternalLink: () => <span data-testid="icon-external" />,
    Code: () => <span data-testid="icon-code" />,
    File: () => <span data-testid="icon-file" />,
    Workflow: () => <span data-testid="icon-workflow" />
}));

const mockProject: ApinoxProject = {
    name: "Project 1",
    fileName: "project1.json",
    readOnly: false,
    interfaces: [],
    testSuites: [
        {
            id: "suite-1",
            name: "Suite 1",
            testCases: [
                {
                    id: "case-1",
                    name: "Case 1",
                    steps: [{ id: "step-1", name: "Step 1", type: "request", config: {} }]
                }
            ]
        }
    ]
};

const baseProps: TestsUiProps = {
    projects: [mockProject],
    onAddSuite: vi.fn(),
    onDeleteSuite: vi.fn(),
    onRunSuite: vi.fn(),
    onAddTestCase: vi.fn(),
    onDeleteTestCase: vi.fn(),
    onRenameTestCase: vi.fn(),
    onRunCase: vi.fn(),
    onSelectSuite: vi.fn(),
    onSelectTestCase: vi.fn(),
    onToggleSuiteExpand: vi.fn(),
    onToggleCaseExpand: vi.fn(),
    onSelectTestStep: vi.fn(),
    onRenameTestStep: vi.fn(),
    deleteConfirm: null
};

const fileProps = {
    onExportSuite: vi.fn(),
    onImportSuite: vi.fn(),
    onImportTestCase: vi.fn(),
    onExportTestCase: vi.fn()
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("TestsUi right-click import/export menu", () => {
    it("right-clicking a suite offers Export Suite / Import Suite / Import Test Case", () => {
        const view = render(<TestsUi {...baseProps} {...fileProps} />);

        fireEvent.contextMenu(view.getByText("Suite 1"));

        expect(view.getByText("Import / Export")).toBeInTheDocument();
        expect(view.getByText("Export Suite")).toBeInTheDocument();
        expect(view.getByText("Import Suite")).toBeInTheDocument();
        expect(view.getByText("Import Test Case")).toBeInTheDocument();
        view.unmount();
    });

    it("Export Suite fires onExportSuite with the suite id", () => {
        const view = render(<TestsUi {...baseProps} {...fileProps} />);
        fireEvent.contextMenu(view.getByText("Suite 1"));

        fireEvent.click(view.getByText("Export Suite"));

        expect(fileProps.onExportSuite).toHaveBeenCalledTimes(1);
        expect(fileProps.onExportSuite).toHaveBeenCalledWith("suite-1");
        view.unmount();
    });

    it("Import Suite fires onImportSuite (no args — it picks its own file)", () => {
        const view = render(<TestsUi {...baseProps} {...fileProps} />);
        fireEvent.contextMenu(view.getByText("Suite 1"));

        fireEvent.click(view.getByText("Import Suite"));

        expect(fileProps.onImportSuite).toHaveBeenCalledTimes(1);
        view.unmount();
    });

    it("Import Test Case fires onImportTestCase with the target suite id", () => {
        const view = render(<TestsUi {...baseProps} {...fileProps} />);
        fireEvent.contextMenu(view.getByText("Suite 1"));

        fireEvent.click(view.getByText("Import Test Case"));

        expect(fileProps.onImportTestCase).toHaveBeenCalledTimes(1);
        expect(fileProps.onImportTestCase).toHaveBeenCalledWith("suite-1");
        view.unmount();
    });

    it("right-clicking a case offers Export Test Case and fires onExportTestCase", () => {
        const view = render(<TestsUi {...baseProps} {...fileProps} />);
        fireEvent.contextMenu(view.getByText("Case 1"));

        expect(view.getByText("Export Test Case")).toBeInTheDocument();
        fireEvent.click(view.getByText("Export Test Case"));

        expect(fileProps.onExportTestCase).toHaveBeenCalledTimes(1);
        expect(fileProps.onExportTestCase).toHaveBeenCalledWith("case-1");
        view.unmount();
    });

    it("without the file handlers the rail renders no Import / Export section", () => {
        const view = render(<TestsUi {...baseProps} />);
        fireEvent.contextMenu(view.getByText("Suite 1"));

        expect(view.queryByText("Import / Export")).not.toBeInTheDocument();
        // The base suite actions still render (the menu is intact).
        expect(view.getByText("Rename")).toBeInTheDocument();
        expect(view.getByText("Delete")).toBeInTheDocument();
        view.unmount();
    });

    it("partial handlers render only the items they back (no empty section)", () => {
        const view = render(<TestsUi {...baseProps} onExportSuite={fileProps.onExportSuite} />);
        fireEvent.contextMenu(view.getByText("Suite 1"));

        expect(view.getByText("Import / Export")).toBeInTheDocument();
        expect(view.getByText("Export Suite")).toBeInTheDocument();
        expect(view.queryByText("Import Suite")).not.toBeInTheDocument();
        expect(view.queryByText("Import Test Case")).not.toBeInTheDocument();
        view.unmount();
    });

    it("step right-clicks stay untouched (rename/delete only, no file actions)", () => {
        const view = render(<TestsUi {...baseProps} {...fileProps} />);
        fireEvent.contextMenu(view.getByText("Step 1"));

        expect(view.queryByText("Import / Export")).not.toBeInTheDocument();
        expect(view.queryByText("Export Test Case")).not.toBeInTheDocument();
        expect(view.getByText("Rename")).toBeInTheDocument();
        view.unmount();
    });
});
