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
    GitBranch: () => <span data-testid="icon-git-branch" />,
    RefreshCw: () => <span data-testid="icon-refresh-cw" />,
    // Live execution status icons (mirrored from the main TestCaseView):
    // CheckCircle/XCircle render on step rows; Loader2 is what the shared
    // Spinner wraps; Minus marks skipped workflow sub-steps.
    CheckCircle: () => <span data-testid="icon-check-circle" />,
    XCircle: () => <span data-testid="icon-x-circle" />,
    Minus: () => <span data-testid="icon-minus" />,
    Loader2: () => <span data-testid="icon-loader" />,
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
        onDeleteTestStep: vi.fn(),
        onEditTestCaseJson: vi.fn(),
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

    /**
     * Right-click → Edit as JSON is the find-and-replace path. The variables panel edits
     * values but cannot rename a name, so renaming a `{{token}}` across step bodies needs
     * the raw document.
     */
    it('right-clicking a case offers Edit as JSON', () => {
        render(<TestsUi {...defaultProps} />);

        fireEvent.contextMenu(screen.getByText('Case 1'));
        const item = screen.getByText('Edit as JSON');
        fireEvent.click(item);

        expect(defaultProps.onEditTestCaseJson).toHaveBeenCalledWith('case-1');
    });

    it('the menu omits Edit as JSON when the rail renders without the app wiring', () => {
        const withoutEditor = { ...defaultProps, onEditTestCaseJson: undefined };
        render(<TestsUi {...withoutEditor} />);

        fireEvent.contextMenu(screen.getByText('Case 1'));
        expect(screen.queryByText('Edit as JSON')).not.toBeInTheDocument();
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

    it('right-clicking a test step offers rename/delete with the two-click confirm', () => {
        // Each action in its own mount (the shared menu only closes on outside
        // mousedown, so stale menus would duplicate labels across renders).
        const openStepMenu = () => {
            const view = render(<TestsUi {...defaultProps} />);
            fireEvent.contextMenu(view.getByText('Step 1'));
            return view;
        };

        // Rename + Delete both render for a step.
        const v1 = openStepMenu();
        expect(v1.getByText('Rename')).toBeInTheDocument();
        expect(v1.getByText('Delete')).toBeInTheDocument();
        v1.unmount();

        // Rename drives the inline input.
        const v2 = openStepMenu();
        fireEvent.click(v2.getByText('Rename'));
        const input = v2.getByDisplayValue('Step 1');
        fireEvent.change(input, { target: { value: 'Renamed Step' } });
        fireEvent.blur(input);
        expect(defaultProps.onRenameTestStep).toHaveBeenCalledWith('case-1', 'step-1', 'Renamed Step');
        v2.unmount();

        // Delete is the two-click confirm: the (unarmed) click arms it — the
        // parent's handler is called once but the shared `deleteConfirm` is not
        // yet set for this step, so nothing is actually removed.
        const v3 = openStepMenu();
        fireEvent.click(v3.getByText('Delete'));
        expect(defaultProps.onDeleteTestStep).toHaveBeenCalledTimes(1); // arm click
        expect(v3.getByText('Delete')).toBeInTheDocument(); // menu stays open
        v3.unmount();

        // Second click (armed) performs the delete with (caseId, stepId).
        const v3b = render(<TestsUi {...defaultProps} deleteConfirm="step-1" />);
        fireEvent.contextMenu(v3b.getByText('Step 1'));
        v3b.getByText('Click again to delete').click();
        expect(defaultProps.onDeleteTestStep).toHaveBeenCalledTimes(2); // delete click
        expect(defaultProps.onDeleteTestStep).toHaveBeenLastCalledWith('case-1', 'step-1');
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
        expect(screen.queryByLabelText('Delete Suite')).not.toBeInTheDocument();

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

    it('the suite chevron toggles the suite — the handler is called and a collapsed suite hides its cases', () => {
        const { unmount } = render(<TestsUi {...defaultProps} />);

        // Expanded by default, so the case rows render.
        expect(screen.getByText('Case 1')).toBeInTheDocument();

        // DOM order: the suite chevron is the first, the case's is the second.
        fireEvent.click(screen.getAllByTestId('icon-chevron-down')[0]);
        expect(defaultProps.onToggleSuiteExpand).toHaveBeenCalledWith('suite-1');

        // The handler owns the state; re-rendering collapsed must hide the
        // cases and flip the chevron to the right-pointing (collapsed) icon.
        unmount();
        render(<TestsUi {...defaultProps} projects={[{ ...mockProject, testSuites: [{ ...mockProject.testSuites[0], expanded: false }] }]} />);
        expect(screen.queryByText('Case 1')).not.toBeInTheDocument();
        expect(screen.getByTestId('icon-chevron-right')).toBeInTheDocument();
    });

    it('the test case chevron toggles the case — the handler is called and a collapsed case hides its steps', () => {
        const { unmount } = render(<TestsUi {...defaultProps} />);

        expect(screen.getByText('Step 1')).toBeInTheDocument();

        fireEvent.click(screen.getAllByTestId('icon-chevron-down')[1]);
        expect(defaultProps.onToggleCaseExpand).toHaveBeenCalledWith('case-1');

        unmount();
        render(<TestsUi {...defaultProps} projects={[{ ...mockProject, testSuites: [{ ...mockProject.testSuites[0], testCases: [{ ...mockProject.testSuites[0].testCases[0], expanded: false }] }] }]} />);
        expect(screen.queryByText('Step 1')).not.toBeInTheDocument();
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

    describe('testCase steps (expandable to the referenced case)', () => {
        // The host case's step references a case that lives in a COLLAPSED
        // sibling suite, so its steps only appear when the step is expanded.
        const projectWithHostStep = (config: any): ApinoxProject => ({
            name: 'Project TC',
            fileName: 'tc.json',
            readOnly: false,
            interfaces: [],
            testSuites: [
                {
                    id: 'suite-host',
                    name: 'Suite Host',
                    testCases: [
                        {
                            id: 'case-host',
                            name: 'Case Host',
                            steps: [
                                { id: 'step-tc', name: 'Run TC', type: 'testCase', config }
                            ]
                        }
                    ]
                },
                {
                    id: 'suite-target',
                    name: 'Suite Target',
                    expanded: false,
                    testCases: [
                        {
                            id: 'case-target',
                            name: 'Target Case',
                            steps: [
                                { id: 'ts-1', name: 'Login Request', type: 'request', config: {} },
                                { id: 'ts-2', name: 'Wait', type: 'delay', config: {} }
                            ]
                        }
                    ]
                }
            ]
        });

        it('a testCase step referencing a case with steps is expandable and shows the nested steps', () => {
            render(<TestsUi {...defaultProps} projects={[projectWithHostStep({ testCaseId: 'case-target' })]} />);

            // Collapsed by default: chevron present, sub-steps hidden (the
            // referenced case lives in a collapsed suite).
            expect(screen.getByText('Run TC')).toBeInTheDocument();
            expect(screen.queryByText('Login Request')).not.toBeInTheDocument();
            expect(screen.getByLabelText('Expand test case steps')).toBeInTheDocument();

            // Click the step's chevron (the shared Tooltip's aria-label gates it).
            fireEvent.click(screen.getByLabelText('Expand test case steps'));
            expect(screen.getByText('Login Request')).toBeInTheDocument();
            expect(screen.getByText('Wait')).toBeInTheDocument();
            expect(screen.queryByLabelText('Expand test case steps')).not.toBeInTheDocument();

            // Collapse again.
            fireEvent.click(screen.getByLabelText('Collapse test case steps'));
            expect(screen.queryByText('Login Request')).not.toBeInTheDocument();

            // Clicking a nested step selects the PARENT test step.
            fireEvent.click(screen.getByLabelText('Expand test case steps'));
            fireEvent.click(screen.getByText('Login Request'));
            expect(defaultProps.onSelectTestStep).toHaveBeenCalledWith('case-host', 'step-tc');
        });

        it('a testCase step with no matching case shows no chevron', () => {
            render(<TestsUi {...defaultProps} projects={[projectWithHostStep({ testCaseId: 'missing' })]} />);

            expect(screen.getByText('Run TC')).toBeInTheDocument();
            // No step-level expand toggle: the dangling reference isn't
            // expandable, and its (absent) steps never render.
            expect(screen.queryByLabelText('Expand test case steps')).not.toBeInTheDocument();
            expect(screen.queryByText('Login Request')).not.toBeInTheDocument();
        });

        it('a testCase step referencing an empty case shows no chevron', () => {
            const project: ApinoxProject = {
                ...projectWithHostStep({ testCaseId: 'case-empty' }),
                testSuites: [
                    {
                        id: 'suite-host',
                        name: 'Suite Host',
                        testCases: [
                            {
                                id: 'case-host',
                                name: 'Case Host',
                                steps: [{ id: 'step-tc', name: 'Run TC', type: 'testCase', config: { testCaseId: 'case-empty' } }]
                            }
                        ]
                    },
                    {
                        id: 'suite-target',
                        name: 'Suite Target',
                        expanded: false,
                        testCases: [{ id: 'case-empty', name: 'Empty Case', steps: [] }]
                    }
                ]
            };
            render(<TestsUi {...defaultProps} projects={[project]} />);

            expect(screen.getByText('Run TC')).toBeInTheDocument();
            expect(screen.queryByLabelText('Expand test case steps')).not.toBeInTheDocument();
        });

        it('non-testCase steps show no chevron even when test cases are present', () => {
            render(<TestsUi {...defaultProps} />);

            // The default project has a plain request step: no step-level
            // chevrons (no right-pointing chevron; no expand toggle title).
            expect(screen.queryAllByTestId('icon-chevron-right')).toHaveLength(0);
            expect(screen.queryByLabelText('Expand test case steps')).not.toBeInTheDocument();
        });
    });

    describe('live execution status on step rows (mirrors the main TestCaseView)', () => {
        // Fixture: a case with two steps, so pass/fail can be asserted per step.
        const twoStepProject: ApinoxProject = {
            name: 'Project 2',
            fileName: 'p2.json',
            readOnly: false,
            interfaces: [],
            testSuites: [
                {
                    id: 'suite-2',
                    name: 'Suite 2',
                    testCases: [
                        {
                            id: 'case-2',
                            name: 'Case 2',
                            steps: [
                                { id: 'step-2a', name: 'Step 2A', type: 'request', config: {} },
                                { id: 'step-2b', name: 'Step 2B', type: 'request', config: {} }
                            ]
                        }
                    ]
                }
            ]
        };

        // A host case whose testCase step references 'case-target-n' (a case
        // in a collapsed sibling suite) — its steps render under the step.
        const hostStepProject: ApinoxProject = {
            name: 'Project N',
            fileName: 'n.json',
            readOnly: false,
            interfaces: [],
            testSuites: [
                {
                    id: 'suite-n',
                    name: 'Suite N',
                    testCases: [
                        {
                            id: 'case-n',
                            name: 'Case N',
                            steps: [
                                { id: 'step-n', name: 'Run TC', type: 'testCase', config: { testCaseId: 'case-target-n' } }
                            ]
                        }
                    ]
                },
                {
                    id: 'suite-target-n',
                    name: 'Suite Target N',
                    expanded: false,
                    testCases: [
                        {
                            id: 'case-target-n',
                            name: 'Target N',
                            steps: [
                                { id: 'ts-a', name: 'Create Order', type: 'request', config: {} },
                                { id: 'ts-b', name: 'Pause', type: 'delay', config: {} }
                            ]
                        }
                    ]
                }
            ]
        };

        it('renders the running spinner next to a running step (no pass/fail icons)', () => {
            render(
                <TestsUi
                    {...defaultProps}
                    testExecution={{
                        'case-1': {
                            'step-1': { status: 'running' }
                        }
                    }}
                />
            );

            // The running step gets the shared Spinner (Lucide Loader2).
            expect(screen.getByTestId('icon-loader')).toBeInTheDocument();
            expect(screen.queryByTestId('icon-check-circle')).not.toBeInTheDocument();
            expect(screen.queryByTestId('icon-x-circle')).not.toBeInTheDocument();
        });

        it('renders pass and fail icons on the affected steps only', () => {
            render(
                <TestsUi
                    {...defaultProps}
                    projects={[twoStepProject]}
                    testExecution={{
                        'case-2': {
                            'step-2a': { status: 'pass' },
                            'step-2b': { status: 'fail' }
                        }
                    }}
                />
            );

            expect(screen.getAllByTestId('icon-check-circle')).toHaveLength(1);
            expect(screen.getAllByTestId('icon-x-circle')).toHaveLength(1);
            expect(screen.queryByTestId('icon-loader')).not.toBeInTheDocument();
        });

        it('keeps an empty fixed-width status slot on step rows without status', () => {
            const view = render(<TestsUi {...defaultProps} />);

            // The single step row carries the (empty) slot so the chevron +
            // type-icon columns stay aligned, and no status icon renders.
            expect(view.getAllByTestId('step-status-slot')).toHaveLength(1);
            expect(screen.queryByTestId('icon-check-circle')).not.toBeInTheDocument();
            expect(screen.queryByTestId('icon-x-circle')).not.toBeInTheDocument();
            expect(screen.queryByTestId('icon-loader')).not.toBeInTheDocument();
        });

        it('mirrors per-nested-step results (running/skipped) onto the expanded sub-step rows', () => {
            const view = render(
                <TestsUi
                    {...defaultProps}
                    projects={[hostStepProject]}
                    testExecution={{
                        'case-n': {
                            'step-n': {
                                status: 'pass',
                                workflowSteps: {
                                    'ts-a': { status: 'running' },
                                    'ts-b': { status: 'skipped' }
                                }
                            }
                        }
                    }}
                />
            );

            // The testCase step row shows its own pass icon; the (collapsed)
            // sub-steps do not render yet.
            expect(view.getAllByTestId('icon-check-circle')).toHaveLength(1);
            expect(view.queryByTestId('icon-loader')).not.toBeInTheDocument();
            expect(view.queryByTestId('icon-minus')).not.toBeInTheDocument();

            // Expanded: the sub-step rows mirror the per-step results —
            // running → spinner, skipped → Minus.
            fireEvent.click(view.getByLabelText('Expand test case steps'));
            expect(view.getAllByTestId('icon-loader')).toHaveLength(1);
            expect(view.getAllByTestId('icon-minus')).toHaveLength(1);
        });

        it('indents each tree level at half the legacy step (suite 8 / case 18 / step 26 / sub-step 35)', () => {
            const view = render(
                <TestsUi
                    {...defaultProps}
                    projects={[hostStepProject]}
                />
            );
            fireEvent.click(view.getByLabelText('Expand test case steps'));

            const paddingLeft = (label: string) =>
                window.getComputedStyle(
                    view.getByText(label).parentElement as HTMLElement
                ).paddingLeft;

            // The halved indentation ladder: 8px base, ~8-9px per level —
            // the former 8 / 35 / 52 / 70px values cut in half.
            expect(paddingLeft('Suite N')).toBe('8px');
            expect(paddingLeft('Case N')).toBe('18px');
            expect(paddingLeft('Run TC')).toBe('26px');
            expect(paddingLeft('Create Order')).toBe('35px');
        });
    });
});
