/**
 * TestsUi add-suite flow (C: global suites).
 *
 * The old project-picker menu (t_5a771ccd, position:fixed placement, viewport
 * clamping, outside-click/Escape close) was REMOVED: creating a suite no
 * longer picks an owning project, so the + button opens the inline suite-name
 * input directly. These tests pin the new contract:
 *
 *   • + opens the inline name input, pre-filled with a count-based name
 *   • blur/Enter submits (onAddSuite(undefined, name))
 *   • Escape and empty submits cancel (no onAddSuite call)
 *   • no project-picker menu ever renders
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestsUi, TestsUiProps } from "../TestsUi";
import { ApinoxProject } from "@shared/models";

// Mock Lucide icons (same set as TestsUi.test.tsx).
vi.mock("lucide-react", () => ({
    Play: () => <span data-testid="icon-play" />,
    Plus: () => <span data-testid="icon-plus" />,
    Trash2: () => <span data-testid="icon-trash" />,
    ChevronDown: () => <span data-testid="icon-chevron-down" />,
    ChevronRight: () => <span data-testid="icon-chevron-right" />,
    FlaskConical: () => <span data-testid="icon-flask" />,
    FolderOpen: () => <span data-testid="icon-folder" />,
    ListChecks: () => <span data-testid="icon-list-checks" />,
    Edit2: () => <span data-testid="icon-edit" />,
    Clock: () => <span data-testid="icon-clock" />,
    FileCode: () => <span data-testid="icon-file-code" />,
    ArrowRight: () => <span data-testid="icon-arrow-right" />,
    FileText: () => <span data-testid="icon-file-text" />,
    Pencil: () => <span data-testid="icon-pencil" />
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
            testCases: []
        }
    ]
};

const defaultProps: TestsUiProps = {
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

const openAddSuite = () => fireEvent.click(screen.getByLabelText("Add Test Suite"));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("TestsUi add suite (C: global suites, no project picker)", () => {
    it("opens the inline name input directly — no project-picker menu", () => {
        render(<TestsUi {...defaultProps} />);

        openAddSuite();

        // The pre-picker menu is gone; the name input appears immediately.
        expect(screen.queryByText("Add suite to project:")).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText("Suite Name")).toBeInTheDocument();
    });

    it("pre-fills the suggested name based on the current suite count", () => {
        render(<TestsUi {...defaultProps} />);

        // One existing suite ("Suite 1") -> suggestion "TestSuite 2".
        openAddSuite();

        expect((screen.getByPlaceholderText("Suite Name") as HTMLInputElement).value).toBe("TestSuite 2");
    });

    it("submits on blur with an undefined project and the typed name", () => {
        render(<TestsUi {...defaultProps} />);

        openAddSuite();
        const input = screen.getByPlaceholderText("Suite Name") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "Global Suite" } });
        fireEvent.blur(input);

        expect(defaultProps.onAddSuite).toHaveBeenCalledTimes(1);
        expect(defaultProps.onAddSuite).toHaveBeenCalledWith(undefined, "Global Suite");
        expect(screen.queryByPlaceholderText("Suite Name")).not.toBeInTheDocument();
    });

    it("submits on Enter", () => {
        render(<TestsUi {...defaultProps} />);

        openAddSuite();
        const input = screen.getByPlaceholderText("Suite Name") as HTMLInputElement;
        fireEvent.keyDown(input, { key: "Enter" });

        expect(defaultProps.onAddSuite).toHaveBeenCalledTimes(1);
        // Pre-filled suggestion submitted as-is.
        expect(defaultProps.onAddSuite).toHaveBeenCalledWith(undefined, "TestSuite 2");
    });

    it("cancels on Escape without adding", () => {
        render(<TestsUi {...defaultProps} />);

        openAddSuite();
        const input = screen.getByPlaceholderText("Suite Name") as HTMLInputElement;
        fireEvent.keyDown(input, { key: "Escape" });

        expect(defaultProps.onAddSuite).not.toHaveBeenCalled();
        expect(screen.queryByPlaceholderText("Suite Name")).not.toBeInTheDocument();
    });

    it("an empty submit is a no-op (input closes, no suite added)", () => {
        render(<TestsUi {...defaultProps} />);

        openAddSuite();
        const input = screen.getByPlaceholderText("Suite Name") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "   " } });
        fireEvent.blur(input);

        expect(defaultProps.onAddSuite).not.toHaveBeenCalled();
        expect(screen.queryByPlaceholderText("Suite Name")).not.toBeInTheDocument();
    });

    it("uses the GLOBAL suites (testSuites prop) over per-project suites when provided", () => {
        const globalSuite = { id: "gs-1", name: "Global Suite", testCases: [] };
        render(<TestsUi {...defaultProps} testSuites={[globalSuite]} />);

        // Only the global suite renders (the per-project "Suite 1" is hidden
        // by the global source of truth), and the next suggestion counts the
        // GLOBAL list.
        expect(screen.getByText("Global Suite")).toBeInTheDocument();
        expect(screen.queryByText("Suite 1")).not.toBeInTheDocument();

        openAddSuite();
        expect((screen.getByPlaceholderText("Suite Name") as HTMLInputElement).value).toBe("TestSuite 2");
    });
});
