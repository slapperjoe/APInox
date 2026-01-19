import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestsUi } from '../TestsUi';
// Mock Lucide icons
vi.mock('lucide-react', () => ({
    Play: () => _jsx("span", { "data-testid": "icon-play" }),
    Plus: () => _jsx("span", { "data-testid": "icon-plus" }),
    Trash2: () => _jsx("span", { "data-testid": "icon-trash" }),
    ChevronDown: () => _jsx("span", { "data-testid": "icon-chevron-down" }),
    ChevronRight: () => _jsx("span", { "data-testid": "icon-chevron-right" }),
    FlaskConical: () => _jsx("span", { "data-testid": "icon-flask" }),
    FolderOpen: () => _jsx("span", { "data-testid": "icon-folder" }),
    ListChecks: () => _jsx("span", { "data-testid": "icon-list-checks" }),
    Edit2: () => _jsx("span", { "data-testid": "icon-edit" }),
    Clock: () => _jsx("span", { "data-testid": "icon-clock" }),
    FileCode: () => _jsx("span", { "data-testid": "icon-file-code" }),
    ArrowRight: () => _jsx("span", { "data-testid": "icon-arrow-right" }),
    FileText: () => _jsx("span", { "data-testid": "icon-file-text" })
}));
describe('TestsUi', () => {
    const mockProject = {
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
    const defaultProps = {
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
        render(_jsx(TestsUi, { ...defaultProps }));
        expect(screen.getByText('Test Suites (1)')).toBeInTheDocument();
        expect(screen.getByText('Suite 1')).toBeInTheDocument();
        // Default expanded state depends on props, but assuming expanded if not set to false
        expect(screen.getByText('Case 1')).toBeInTheDocument();
        expect(screen.getByText('Step 1')).toBeInTheDocument();
    });
    it('should handle selection', () => {
        render(_jsx(TestsUi, { ...defaultProps }));
        // Select Suite
        fireEvent.click(screen.getByText('Suite 1'));
        expect(defaultProps.onSelectSuite).toHaveBeenCalledWith('suite-1');
        // Select Case
        fireEvent.click(screen.getByText('Case 1'));
        expect(defaultProps.onSelectTestCase).toHaveBeenCalledWith('case-1');
    });
    it('should show add suite menu', () => {
        render(_jsx(TestsUi, { ...defaultProps }));
        fireEvent.click(screen.getByTitle('Add Test Suite'));
        expect(screen.getByText('Add suite to project:')).toBeInTheDocument();
        expect(screen.getByText('Project 1')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Project 1'));
        expect(defaultProps.onAddSuite).toHaveBeenCalledWith('Project 1');
    });
    it('should handle context menu rename for case', () => {
        render(_jsx(TestsUi, { ...defaultProps }));
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
        // Need to select suite/case to see run buttons usually? 
        // Looking at code: `{isSuiteSelected && ...}` for suite actions.
        // But code logic: `const isSuiteSelected = selectedSuiteId === suite.id && selectedCaseId === null;`
        // We need to simulate selection state inside component?
        // `TestsUi` has internal state `selectedSuiteId`.
        render(_jsx(TestsUi, { ...defaultProps }));
        // Select Suite first to reveal buttons
        fireEvent.click(screen.getByText('Suite 1')); // Sets selectedSuiteId
        const runSuiteBtn = screen.getByTitle('Run Suite');
        fireEvent.click(runSuiteBtn);
        expect(defaultProps.onRunSuite).toHaveBeenCalledWith('suite-1');
        // Select Case to reveal buttons
        fireEvent.click(screen.getByText('Case 1')); // Sets selectedCaseId
        const runCaseBtn = screen.getByTitle('Run Test Case');
        fireEvent.click(runCaseBtn);
        expect(defaultProps.onRunCase).toHaveBeenCalledWith('case-1');
    });
});
