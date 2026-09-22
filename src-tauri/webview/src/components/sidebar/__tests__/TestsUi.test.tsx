import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestsUi, TestsUiProps } from '../TestsUi';
import { ApinoxProject } from '@shared/models';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
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
    // SidebarContextMenu re-exports Pencil from lucide-react and renders it as
    // the context-menu item icon; without it the menu crashes with
    // "Element type is invalid ... got: undefined".
    Pencil: () => <span data-testid="icon-pencil" />
}));

describe('TestsUi', () => {
    const mockProject: ApinoxProject = {
        name: 'Project 1',
        fileName: 'project1.json',
        readOnly: false,
        interfaces: [],
        testSuites: [
            {
                id: 'suite-1',
                name: 'Suite 1',
                testCases: [
                    {
                        id: 'case-1',
                        name: 'Case 1',
                        steps: [
                            { id: 'step-1', name: 'Step 1', type: 'request', config: {} }
                        ]
                    }
                ]
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

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render suites and cases', () => {
        render(<TestsUi {...defaultProps} />);

        expect(screen.getByText('Test Suites (1)')).toBeInTheDocument();
        expect(screen.getByText('Suite 1')).toBeInTheDocument();

        // Default expanded state depends on props, but assuming expanded if not set to false
        expect(screen.getByText('Case 1')).toBeInTheDocument();
        expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    it('should handle selection', () => {
        render(<TestsUi {...defaultProps} />);

        // Select Suite
        fireEvent.click(screen.getByText('Suite 1'));
        expect(defaultProps.onSelectSuite).toHaveBeenCalledWith('suite-1');

        // Select Case
        fireEvent.click(screen.getByText('Case 1'));
        expect(defaultProps.onSelectTestCase).toHaveBeenCalledWith('case-1');
    });

    it('should open an inline name input when adding a suite (no project picker)', () => {
        render(<TestsUi {...defaultProps} />);

        fireEvent.click(screen.getByLabelText('Add Test Suite'));

        // C (global suites): the + button opens the suite-name input DIRECTLY —
        // there is no project-pick menu (suites are project-agnostic).
        expect(screen.queryByText('Add suite to project:')).not.toBeInTheDocument();

        const nameInput = screen.getByPlaceholderText('Suite Name');
        fireEvent.change(nameInput, { target: { value: 'My Global Suite' } });
        fireEvent.blur(nameInput);

        expect(defaultProps.onAddSuite).toHaveBeenCalledTimes(1);
        const [projectName, suiteName] = (defaultProps.onAddSuite as any).mock.calls[0];
        expect(projectName).toBeUndefined();
        expect(suiteName).toBe('My Global Suite');
    });

    it('should handle context menu rename for case', () => {
        render(<TestsUi {...defaultProps} />);

        const caseItem = screen.getByText('Case 1');

        // Right click
        fireEvent.contextMenu(caseItem);

        const renameOption = screen.getByText('Rename');
        expect(renameOption).toBeInTheDocument();

        // Click Rename
        fireEvent.click(renameOption);

        // Input should appear
        const input = screen.getByDisplayValue('Case 1');
        expect(input).toBeInTheDocument();

        // Type new name
        fireEvent.change(input, { target: { value: 'Renamed Case' } });
        fireEvent.blur(input); // Trigger submit

        expect(defaultProps.onRenameTestCase).toHaveBeenCalledWith('case-1', 'Renamed Case');
    });

    it('should handle run actions', () => {
        // Suites keep an inline Run button (selected suite only). Cases run via
        // their right-click menu (the inline case buttons were removed).
        const { rerender } = render(<TestsUi {...defaultProps} />);

        // Select the suite (parent sets selectedTestSuite) to reveal suite actions.
        rerender(<TestsUi {...defaultProps} selectedTestSuite={{ id: 'suite-1' } as any} />);

        const runSuiteBtn = screen.getByLabelText('Run Suite');
        fireEvent.click(runSuiteBtn);
        expect(defaultProps.onRunSuite).toHaveBeenCalledWith('suite-1');

        // No inline "Run Test Case" button anymore — it lives in the case's
        // right-click menu.
        rerender(
            <TestsUi
                {...defaultProps}
                selectedTestSuite={{ id: 'suite-1' } as any}
                selectedTestCase={{ id: 'case-1' } as any}
            />
        );
        expect(screen.queryByLabelText('Run Test Case')).not.toBeInTheDocument();

        // Right-clicking the case offers Run Test Case in the menu.
        fireEvent.contextMenu(screen.getByText('Case 1'));
        const runCaseMenu = screen.getByText('Run Test Case');
        fireEvent.click(runCaseMenu);
        expect(defaultProps.onRunCase).toHaveBeenCalledWith('case-1');
    });

    it('right-clicking a suite opens a menu with run/rename/add-case/delete', () => {
        // Each action is tested in its own mount: the shared menu only closes
        // on outside mousedown (not item clicks), so stale menus would
        // duplicate the labels across renders.
        const openSuiteMenu = () => {
            const view = render(<TestsUi {...defaultProps} />);
            fireEvent.contextMenu(view.getByText('Suite 1'));
            return view;
        };

        // All four actions render (the default suite has a case → Run offered).
        const v1 = openSuiteMenu();
        expect(v1.getByText('Run Suite')).toBeInTheDocument();
        expect(v1.getByText('Rename')).toBeInTheDocument();
        expect(v1.getByText('Add Test Case')).toBeInTheDocument();
        expect(v1.getByText('Delete')).toBeInTheDocument();
        v1.unmount();

        // Run Suite fires the callback.
        const v2 = openSuiteMenu();
        fireEvent.click(v2.getByText('Run Suite'));
        expect(defaultProps.onRunSuite).toHaveBeenCalledWith('suite-1');
        v2.unmount();

        // Add Test Case fires the callback.
        const v3 = openSuiteMenu();
        fireEvent.click(v3.getByText('Add Test Case'));
        expect(defaultProps.onAddTestCase).toHaveBeenCalledWith('suite-1');
        v3.unmount();

        // Delete uses the two-click confirm (mirrors the inline trash): click 1
        // arms (menu stays open), click 2 (armed) deletes and closes. The parent
        // drives the shared `deleteConfirm` prop, so each click is simulated
        // with the confirm state the parent would have set.
        const v4 = render(<TestsUi {...defaultProps} deleteConfirm={null} />);
        fireEvent.contextMenu(v4.getByText('Suite 1'));
        v4.getByText('Delete').click();
        expect(defaultProps.onDeleteSuite).toHaveBeenCalledTimes(1); // arm click
        expect(v4.getByText('Delete')).toBeInTheDocument(); // menu still open
        v4.unmount();

        const v4b = render(<TestsUi {...defaultProps} deleteConfirm="suite-1" />);
        fireEvent.contextMenu(v4b.getByText('Suite 1'));
        expect(v4b.getByText('Click again to delete')).toBeInTheDocument();
        v4b.getByText('Click again to delete').click();
        expect(defaultProps.onDeleteSuite).toHaveBeenCalledTimes(2); // delete click
        v4b.unmount();
    });

    it('renaming a suite from its right-click menu persists the new name', () => {
        const onRenameSuite = vi.fn();
        render(<TestsUi {...defaultProps} onRenameSuite={onRenameSuite} />);

        fireEvent.contextMenu(screen.getByText('Suite 1'));
        fireEvent.click(screen.getByText('Rename'));

        const input = screen.getByDisplayValue('Suite 1');
        fireEvent.change(input, { target: { value: 'Renamed Suite' } });
        fireEvent.blur(input);

        expect(onRenameSuite).toHaveBeenCalledWith('suite-1', 'Renamed Suite');
    });

    it('right-clicking a test case offers run/rename/delete (delete is forced)', () => {
        // Each action in its own mount (the shared menu only closes on outside
        // mousedown, so stale menus would duplicate labels across renders).
        const openCaseMenu = () => {
            const view = render(<TestsUi {...defaultProps} />);
            fireEvent.contextMenu(view.getByText('Case 1'));
            return view;
        };

        const v1 = openCaseMenu();
        expect(v1.getByText('Run Test Case')).toBeInTheDocument();
        expect(v1.getByText('Rename')).toBeInTheDocument();
        expect(v1.getByText('Delete')).toBeInTheDocument();
        v1.unmount();

        const v2 = openCaseMenu();
        fireEvent.click(v2.getByText('Run Test Case'));
        expect(defaultProps.onRunCase).toHaveBeenCalledWith('case-1');
        v2.unmount();

        // Delete is the two-click confirm: one click (unarmed) arms it.
        const v3 = openCaseMenu();
        fireEvent.click(v3.getByText('Delete'));
        expect(defaultProps.onDeleteTestCase).toHaveBeenCalledTimes(1);
        expect(v3.getByText('Delete')).toBeInTheDocument(); // menu stays open
        v3.unmount();

        // Second click (armed) performs the delete and closes the menu.
        // (deleteConfirm is a static prop in this test — the mock parent never
        // clears it — so the armed label persists here; in the app the parent
        // clears it and the menu closes on the armed click.)
        const v3b = render(<TestsUi {...defaultProps} deleteConfirm="case-1" />);
        fireEvent.contextMenu(v3b.getByText('Case 1'));
        v3b.getByText('Click again to delete').click();
        expect(defaultProps.onDeleteTestCase).toHaveBeenCalledTimes(2);
        v3b.unmount();
    });

    it('an empty suite has no Run action (menu) and no inline Run button', () => {
        const emptySuiteProject: ApinoxProject = {
            name: 'Project A',
            fileName: 'a.json',
            readOnly: false,
            interfaces: [],
            testSuites: [
                { id: 'suite-empty', name: 'Empty Suite', testCases: [] }
            ]
        };

        // No inline Run button for the selected empty suite, and no inline
        // delete either — deletion is right-click menu only now.
        render(<TestsUi {...defaultProps} projects={[emptySuiteProject]} selectedTestSuite={{ id: 'suite-empty' } as any} />);
        expect(screen.queryByLabelText('Run Suite')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Delete Suite')).not.toBeInTheDocument();

        // The right-click menu omits Run but keeps the other suite actions.
        fireEvent.contextMenu(screen.getByText('Empty Suite'));
        expect(screen.queryByText('Run Suite')).not.toBeInTheDocument();
        expect(screen.getByText('Rename')).toBeInTheDocument();
        expect(screen.getByText('Add Test Case')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('renders no chevron for a suite with no test cases (empty node, not expandable)', () => {
        const emptySuiteProject: ApinoxProject = {
            name: 'Project A',
            fileName: 'a.json',
            readOnly: false,
            interfaces: [],
            testSuites: [
                { id: 'suite-empty', name: 'Empty Suite', testCases: [] }
            ]
        };
        render(<TestsUi {...defaultProps} projects={[emptySuiteProject]} />);

        // The suite row exists but carries no expand/collapse chevron.
        expect(screen.getByText('Empty Suite')).toBeInTheDocument();
        expect(screen.queryByTestId('icon-chevron-right')).not.toBeInTheDocument();
        expect(screen.queryByTestId('icon-chevron-down')).not.toBeInTheDocument();
    });

    it('renders no chevron for a test case with no steps', () => {
        const projectWithSteplessCase: ApinoxProject = {
            name: 'Project B',
            fileName: 'b.json',
            readOnly: false,
            interfaces: [],
            testSuites: [
                {
                    id: 'suite-b',
                    name: 'Suite B',
                    expanded: true,
                    testCases: [{ id: 'case-b', name: 'Case B', steps: [] }]
                }
            ]
        };
        render(<TestsUi {...defaultProps} projects={[projectWithSteplessCase]} />);

        // The suite (which HAS a case) shows a chevron; the stepless case does not.
        expect(screen.getByText('Case B')).toBeInTheDocument();
        // Suite B has 1 case -> exactly one chevron (the suite's). The case
        // with zero steps contributes none.
        expect(screen.getAllByTestId('icon-chevron-down')).toHaveLength(1);
    });
});
