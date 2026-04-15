# Plan: Prop Drilling Refactoring for APInox

## TL;DR

The APInox codebase has **excellent context infrastructure** (9 React Context providers) but suffers from **context-to-props leakage** where `MainContent` consumes all contexts and passes ~80-120 props down to `WorkspaceLayout` and `Sidebar`. This plan outlines how to eliminate this prop drilling by making child components consume contexts directly, reducing prop counts from 80+ to 0-3 per component.

**Recommended Approach**: Implement a **Context Consumer Pattern** where `WorkspaceLayout` and its children access contexts directly instead of receiving props. Create a composite `WorkspaceProvider` that combines relevant state for easier consumption.

---

## Discovery Findings

### Current State Management Architecture ✅

The application already has **9 well-organized Context providers**:

| Context | File | Purpose | Status |
|---------|------|---------|--------|
| ProjectContext | ProjectContext.tsx | Projects list, CRUD operations, dirty state | ✅ Excellent |
| SelectionContext | SelectionContext.tsx | Selected interface, operation, request, test case | ✅ Excellent |
| UIContext | UIContext.tsx | Layout mode, modals, editor settings | ✅ Good |
| NavigationContext | NavigationContext.tsx | Active sidebar view, navigation state | ✅ Good |
| TestRunnerContext | TestRunnerContext.tsx | Test execution state | ✅ Good |
| PerformanceContext | PerformanceContext.tsx | Performance suite state | ✅ Good |
| SearchContext | SearchContext.tsx | Search functionality | ✅ Present |
| ScrapbookContext | ScrapbookContext.tsx | Scrapbook features | ✅ Present |
| ThemeContext | @apinox/request-editor | Theme management | ✅ External Package |

**Key Insight**: Context architecture is **well-designed**. The problem is not missing contexts, but rather that `MainContent` consumes all contexts and passes everything as props instead of letting children access contexts directly.

---

### Prop Drilling Hotspots Identified

#### 🔴 CRITICAL: WorkspaceLayout Component
- **File**: `src-tauri/webview/src/components/WorkspaceLayout.tsx` (925 lines)
- **Current Props**: ~80-100 individual values through 10+ grouped objects
- **Problem**: Receives massive prop objects but sub-components only use 2-5 props each

**Prop Breakdown**:
```typescript
// Direct props (2)
projects, setProjects

// Grouped prop objects (8 groups = ~47 nested properties)
selectionState      // 9 nested: project, interface, operation, request, testSuite, testCase, testStep, performanceSuite, workflowStep
requestActions      // 5 nested: onExecute, onCancel, onUpdate, onReset, response, loading
viewState          // 12 nested: activeView, layoutMode, showLineNumbers, splitRatio, isResizing, handlers...
configState        // 5 nested: config, defaultEndpoint, changelog, isReadOnly, backendConnected
stepActions        // 8 nested: onRunTestCase, onOpenStepRequest, onBackToCase, onAddStep...
toolsActions       // 5 nested: onAddExtractor, onEditExtractor, onAddAssertion...
explorerState      // 6 nested (optional): inputType, setInputType, wsdlUrl, setWsdlUrl, loadWsdl, downloadStatus
breakpointState    // 2 nested (optional)

// Performance actions (10+ from WorkspacePerformanceActions)
onUpdateSuite, onAddPerformanceRequest, onDeletePerformanceRequest,
onSelectPerformanceRequest, onUpdatePerformanceRequest, onImportFromWorkspace,
onRunSuite, onStopRun, performanceProgress, performanceHistory, onBackToSuite

// Coordinator actions (3)
coordinatorStatus, onStartCoordinator, onStopCoordinator

// NavigationActions (7)
onSelectProject, onSelectInterface, onSelectOperation,
onSelectRequest, onSelectTestCase, onSelectWorkflowStep, onUpdateWorkflowStep,
onUpdateWorkflow, onRunWorkflow, onEditWorkflow
```

**Total**: ~80-100 individual values passed through component tree

#### 🟡 MODERATE: Sidebar Component
- **File**: `src-tauri/webview/src/components/Sidebar.tsx`
- **Current Props**: ~120+ individual values through 9 grouped objects
- **Problem**: Well-grouped but still excessive; sub-components only use fractions

**Prop Groups**:
```typescript
projectProps      // 20+ props: projects, addProject, closeProject, selectProject...
explorerProps     // 10 props: loadWsdl, downloadStatus, inputType...
wsdlProps         // 8 props: wsdlUrl, setWsdlUrl, loadWsdl...
selectionProps    // 14 props: selectedInterface, selectedOperation...
testRunnerProps   // 9 props: testExecution, onRunTestCase...
testsProps        // 15 props: test cases, suites, actions...
workflowsProps    // 7 props: workflow state and actions...
performanceProps  // 14 props: performance suite state...
historyProps      // 4 props: request history...
```

#### 🟢 LOW: MainContent Component
- **File**: `src-tauri/webview/src/components/MainContent.tsx`
- **Status**: Appropriately complex as central orchestrator
- **Problem**: Consumes 9 contexts but passes everything as props instead of letting children access contexts

---

### Problematic Patterns Identified

#### Pattern 1: Context-to-Props Leakage
**Location**: `MainContent.tsx` lines 1312-1450

```typescript
// ❌ BEFORE: MainContent consumes contexts but passes as props
<WorkspaceLayout
    projects={projects}                    // From ProjectContext
    setProjects={setProjects}              // From ProjectContext
    selectionState={{                      // Manually assembled from SelectionContext
        project: projects.find(...) || null,
        interface: selectedInterface,
        request: selectedRequest,
        // ... 6 more fields
    }}
    requestActions={{                      // Manually assembled
        onExecute: executeRequest,         // Local handler
        onCancel: cancelRequest,           // Local handler
        onUpdate: handleRequestUpdate,     // Local handler
        // ... 3 more handlers
    }}
    // ... 7 more grouped objects (80+ total props)
/>
```

**Problem**: `WorkspaceLayout` could access these contexts directly but doesn't.

#### Pattern 2: Prop Grouping Without Context
**Location**: `src-tauri/webview/src/components/workspace/props.ts` lines 162-290

```typescript
// Props are grouped but still passed through component tree
export interface WorkspaceSelectionState {
    project?: ApinoxProject | null;
    interface?: ApiInterface | null;
    request: ApiRequest | null;
    operation: ApiOperation | null;
    testSuite?: TestSuite | null;
    testCase?: TestCase | null;
    testStep?: TestStep | null;
    performanceSuite?: PerformanceSuite | null;
    workflowStep?: WorkflowStep | null;
}

// This object is passed as a single prop but contains 9 values
```

**Problem**: Grouping helps organization but doesn't solve the fundamental prop drilling issue.

#### Pattern 3: Deeply Nested Components Receiving Unused Props
**Location**: `WorkspaceLayout.tsx` → Workspace sub-components

```typescript
// ❌ BEFORE: Components deep in tree only need 2-5 props but receive all 80+
<MonacoRequestEditor
    value={effectiveRequest.request}
    onChange={onUpdateRequest}
    // ... 15+ more props (many unused by deeper components)
/>

<AssertionsPanel
    assertions={effectiveRequest.assertions}
    onAddAssertion={onAddAssertion}
    // Only uses 2-3 of the 80+ props from WorkspaceLayout
/>
```

---

## Implementation Plan

### Phase 1: Foundation - Create WorkspaceProvider (6-8 hours)

**Goal**: Create a composite context that combines relevant state for workspace components.

#### Step 1.1: Create WorkspaceContext Type Definition
**File**: `src-tauri/webview/src/context/WorkspaceContext.tsx` (NEW)

```typescript
import React from 'react';
import { ApinoxProject } from '@apinox/shared';
import { ApiInterface, ApiOperation, ApiRequest } from '../../shared/src/models';
import { TestSuite, TestCase, TestStep } from '../../shared/src/models';
import { PerformanceSuite } from '../../shared/src/models';

interface WorkspaceContextValue {
    // Project state
    projects: ApinoxProject[];
    dirtyProjects: Set<string>;
    
    // Selection state
    selectedProjectId: string | null;
    selectedInterface: ApiInterface | null;
    selectedOperation: ApiOperation | null;
    selectedRequest: ApiRequest | null;
    
    // Test state
    selectedTestSuite: TestSuite | null;
    selectedTestCase: TestCase | null;
    selectedTestStep: TestStep | null;
    
    // Performance state
    selectedPerformanceSuite: PerformanceSuite | null;
    
    // Request/Response state
    response: any;
    loading: boolean;
    
    // UI state
    layoutMode: 'vertical' | 'horizontal';
    showLineNumbers: boolean;
    splitRatio: number;
    isResizing: boolean;
    
    // Config state
    config: any;
    defaultEndpoint: string;
    isReadOnly: boolean;
    backendConnected: boolean;
    
    // Actions - Project
    addProject: (project: ApinoxProject) => void;
    updateProject: (id: string, project: ApinoxProject) => void;
    closeProject: (id: string) => void;
    setDirty: (id: string) => void;
    
    // Actions - Selection
    selectInterface: (interface: ApiInterface) => void;
    selectOperation: (operation: ApiOperation) => void;
    selectRequest: (request: ApiRequest) => void;
    
    // Actions - Request/Response
    executeRequest: () => void;
    cancelRequest: () => void;
    updateRequest: (request: ApiRequest) => void;
    
    // Actions - UI
    toggleLayout: () => void;
    toggleLineNumbers: () => void;
    setSplitRatio: (ratio: number) => void;
}

export const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

export const useWorkspace = (): WorkspaceContextValue => {
    const context = React.useContext(WorkspaceContext);
    if (!context) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
};
```

**Effort**: 1 hour  
**Risk**: Very Low (new file, no breaking changes)

#### Step 1.2: Create WorkspaceProvider Component
**File**: `src-tauri/webview/src/context/WorkspaceProvider.tsx` (NEW)

```typescript
import React, { useMemo, useCallback } from 'react';
import { WorkspaceContext, WorkspaceContextValue } from './WorkspaceContext';
import { useProject } from './ProjectContext';
import { useSelection } from './SelectionContext';
import { useUI } from './UIContext';
import { useTestRunner } from './TestRunnerContext';
import { usePerformance } from './PerformanceContext';

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Consume existing contexts
    const { projects, dirtyProjects, addProject, updateProject, closeProject, setDirty } = useProject();
    const { 
        selectedInterface, setSelectedInterface,
        selectedOperation, setSelectedOperation,
        selectedRequest, setSelectedRequest,
        response, setResponse, loading, setLoading
    } = useSelection();
    const { 
        layoutMode, setLayoutMode,
        showLineNumbers, setShowLineNumbers,
        splitRatio, setSplitRatio,
        isResizing, setIsResizing
    } = useUI();
    const { testExecution, runTestCase, stopTestRun } = useTestRunner();
    const { performanceProgress, runSuite, stopRun } = usePerformance();
    
    // Get selected project from projects array
    const selectedProjectId = selectedRequest?.projectId || null;
    
    // Create combined context value
    const value: WorkspaceContextValue = useMemo(() => ({
        // Project state
        projects,
        dirtyProjects,
        
        // Selection state
        selectedProjectId,
        selectedInterface,
        selectedOperation,
        selectedRequest,
        
        // Test state (from selection or test runner)
        selectedTestSuite: null, // Extract from selection if needed
        selectedTestCase: null,
        selectedTestStep: null,
        
        // Performance state
        selectedPerformanceSuite: null,
        
        // Request/Response state
        response,
        loading,
        
        // UI state
        layoutMode,
        showLineNumbers,
        splitRatio,
        isResizing,
        
        // Config state (could add separate config context later)
        config: {},
        defaultEndpoint: '',
        isReadOnly: false,
        backendConnected: true,
        
        // Actions - Project
        addProject,
        updateProject,
        closeProject,
        setDirty,
        
        // Actions - Selection
        selectInterface: setSelectedInterface,
        selectOperation: setSelectedOperation,
        selectRequest: setSelectedRequest,
        
        // Actions - Request/Response
        executeRequest: () => {
            // Implement request execution logic
            setLoading(true);
            // ... execute request
        },
        cancelRequest: () => {
            setLoading(false);
        },
        updateRequest: setSelectedRequest,
        
        // Actions - UI
        toggleLayout: () => setLayoutMode(prev => prev === 'vertical' ? 'horizontal' : 'vertical'),
        toggleLineNumbers: () => setShowLineNumbers(prev => !prev),
        setSplitRatio,
    }), [
        projects, dirtyProjects, selectedProjectId, selectedInterface, 
        selectedOperation, selectedRequest, response, loading,
        layoutMode, showLineNumbers, splitRatio, isResizing,
        addProject, updateProject, closeProject, setDirty,
        setSelectedInterface, setSelectedOperation, setSelectedRequest,
        setLayoutMode, setShowLineNumbers, setSplitRatio
    ]);

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
        </WorkspaceContext.Provider>
    );
};
```

**Effort**: 2 hours  
**Risk**: Low (wraps existing contexts, no breaking changes)

#### Step 1.3: Wrap MainContent with WorkspaceProvider
**File**: `src-tauri/webview/src/components/MainContent.tsx`

```typescript
// Add import
import { WorkspaceProvider } from '../context/WorkspaceProvider';

// In component render, wrap WorkspaceLayout
<WorkspaceProvider>
    <WorkspaceLayout />
</WorkspaceProvider>
```

**Effort**: 30 minutes  
**Risk**: Very Low (non-breaking change)

---

### Phase 2: Refactor WorkspaceLayout to Use Context (6-8 hours)

**Goal**: Eliminate all props from WorkspaceLayout by making it consume WorkspaceContext directly.

#### Step 2.1: Update WorkspaceLayout Props Interface
**File**: `src-tauri/webview/src/components/WorkspaceLayout.tsx`

```typescript
// ❌ BEFORE
export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
    projects, setProjects, selectionState, requestActions, viewState,
    configState, stepActions, toolsActions, explorerState, breakpointState,
    onUpdateSuite, onAddPerformanceRequest, // ... 70+ more props
}) => { ... }

// ✅ AFTER
export const WorkspaceLayout: React.FC = () => {
    const {
        // Project state
        projects, dirtyProjects,
        
        // Selection state
        selectedInterface, selectedOperation, selectedRequest,
        
        // Request/Response state
        response, loading, executeRequest, cancelRequest, updateRequest,
        
        // UI state
        layoutMode, showLineNumbers, splitRatio, isResizing,
        toggleLayout, toggleLineNumbers, setSplitRatio,
        
        // Actions
        addProject, updateProject, closeProject, setDirty,
        selectInterface, selectOperation, selectRequest,
        
        // ... other needed values
    } = useWorkspace();
    
    // Rest of component logic remains the same
    // But now accesses state from context instead of props
};
```

**Effort**: 2 hours  
**Risk**: Medium (requires careful refactoring and testing)

#### Step 2.2: Update MainContent to Remove Props
**File**: `src-tauri/webview/src/components/MainContent.tsx`

```typescript
// ❌ BEFORE (lines 1312-1450)
<WorkspaceLayout
    projects={projects}
    setProjects={setProjects}
    selectionState={{
        project: projects.find(p => p.id === selectedProjectId) || null,
        interface: selectedInterface,
        operation: selectedOperation,
        request: selectedRequest,
        testSuite: selectedTestSuite,
        testCase: selectedTestCase,
        testStep: selectedTestStep,
        performanceSuite: selectedPerformanceSuite,
        workflowStep: selectedWorkflowStep
    }}
    requestActions={{
        onExecute: executeRequest,
        onCancel: cancelRequest,
        onUpdate: handleRequestUpdate,
        onReset: resetRequest,
        response: response,
        loading: loading
    }}
    viewState={{
        activeView: activeView,
        layoutMode: layoutMode,
        showLineNumbers: showLineNumbers,
        splitRatio: splitRatio,
        isResizing: isResizing,
        onToggleLayout: toggleLayout,
        onToggleLineNumbers: toggleLineNumbers,
        onStartResizing: startResizing,
        onStopResizing: stopResizing,
        onUpdateSplitRatio: setSplitRatio,
        inlineElementValues: inlineElementValues,
        onToggleInlineElementValues: toggleInlineElementValues,
        hideCausalityData: hideCausalityData,
        onToggleHideCausalityData: toggleHideCausalityData
    }}
    configState={{
        config: config,
        defaultEndpoint: defaultEndpoint,
        changelog: changelog,
        isReadOnly: isReadOnly,
        backendConnected: backendConnected
    }}
    stepActions={{
        onRunTestCase: runTestCase,
        onOpenStepRequest: openStepRequest,
        onBackToCase: backToCase,
        onAddStep: addStep,
        testExecution: testExecution,
        onUpdateStep: updateStep,
        onSelectStep: selectStep,
        onDeleteStep: deleteStep,
        onMoveStep: moveStep
    }}
    toolsActions={{
        onAddExtractor: addExtractor,
        onEditExtractor: editExtractor,
        onAddAssertion: addAssertion,
        onAddExistenceAssertion: addExistenceAssertion,
        onOpenDevOps: openDevOps
    }}
    explorerState={{
        inputType: inputType,
        setInputType: setInputType,
        wsdlUrl: wsdlUrl,
        setWsdlUrl: setWsdlUrl,
        loadWsdl: loadWsdl,
        downloadStatus: downloadStatus
    }}
    breakpointState={{
        breakpoints: breakpoints,
        toggleBreakpoint: toggleBreakpoint
    }}
    onUpdateSuite={updatePerformanceSuite}
    onAddPerformanceRequest={addPerformanceRequest}
    onDeletePerformanceRequest={deletePerformanceRequest}
    onSelectPerformanceRequest={selectPerformanceRequest}
    onUpdatePerformanceRequest={updatePerformanceRequest}
    onImportFromWorkspace={importFromWorkspace}
    onRunSuite={runPerformanceSuite}
    onStopRun={stopPerformanceRun}
    performanceProgress={performanceProgress}
    performanceHistory={performanceHistory}
    onBackToSuite={backToPerformanceSuite}
    coordinatorStatus={coordinatorStatus}
    onStartCoordinator={startCoordinator}
    onStopCoordinator={stopCoordinator}
    onSelectProject={selectProject}
    onSelectInterface={selectInterface}
    onSelectOperation={selectOperation}
    onSelectRequest={selectRequest}
    onSelectTestCase={selectTestCase}
    onSelectWorkflowStep={selectWorkflowStep}
    onUpdateWorkflowStep={updateWorkflowStep}
    onUpdateWorkflow={updateWorkflow}
    onRunWorkflow={runWorkflow}
    onEditWorkflow={editWorkflow}
/>

// ✅ AFTER
<WorkspaceLayout />
```

**Effort**: 1 hour  
**Risk**: Low (deletion of prop passing, logic moved to provider)

#### Step 2.3: Update Workspace Sub-Components
**Files**: Various workspace components in `src-tauri/webview/src/components/workspace/`

These components should also be updated to use `useWorkspace()` hook where appropriate:

```typescript
// Example: MonacoRequestEditor.tsx
import { useWorkspace } from '../../context/WorkspaceContext';

const MonacoRequestEditor: React.FC = () => {
    const { selectedRequest, updateRequest } = useWorkspace();
    
    // No props needed!
    return (
        <MonacoEditor
            value={selectedRequest?.request || ''}
            onChange={(value) => updateRequest({ ...selectedRequest, request: value })}
        />
    );
};
```

**Effort**: 3-4 hours (multiple files)  
**Risk**: Medium (requires testing each component)

---

### Phase 3: Sidebar Optimization (3-4 hours)

**Goal**: Create SidebarContext to reduce prop passing in sidebar components.

#### Step 3.1: Create SidebarContext
**File**: `src-tauri/webview/src/context/SidebarContext.tsx` (NEW)

```typescript
import React from 'react';
import { useProject } from './ProjectContext';
import { useSelection } from './SelectionContext';
import { useNavigation } from './NavigationContext';
import { useTestRunner } from './TestRunnerContext';
import { usePerformance } from './PerformanceContext';

interface SidebarContextValue {
    // Project state
    projects: any[];
    addProject: (project: any) => void;
    closeProject: (id: string) => void;
    selectProject: (id: string) => void;
    
    // Selection state
    selectedInterface: any | null;
    selectedOperation: any | null;
    selectedRequest: any | null;
    
    // Navigation state
    activeView: string;
    changeView: (view: string) => void;
    
    // Test state
    testExecution: any;
    runTestCase: (testCase: any) => void;
    
    // Performance state
    performanceSuites: any[];
    runSuite: (suite: any) => void;
}

export const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export const useSidebar = (): SidebarContextValue => {
    const context = React.useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
};

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const projectState = useProject();
    const selectionState = useSelection();
    const navState = useNavigation();
    const testState = useTestRunner();
    const perfState = usePerformance();
    
    const value: SidebarContextValue = useMemo(() => ({
        ...projectState,
        selectedInterface: selectionState.selectedInterface,
        selectedOperation: selectionState.selectedOperation,
        selectedRequest: selectionState.selectedRequest,
        activeView: navState.activeView,
        changeView: navState.changeView,
        testExecution: testState.testExecution,
        runTestCase: testState.runTestCase,
        performanceSuites: perfState.suites,
        runSuite: perfState.runSuite
    }), [projectState, selectionState, navState, testState, perfState]);
    
    return (
        <SidebarContext.Provider value={value}>
            {children}
        </SidebarContext.Provider>
    );
};
```

**Effort**: 1.5 hours  
**Risk**: Low

#### Step 3.2: Wrap Sidebar with SidebarProvider
**File**: `src-tauri/webview/src/components/MainContent.tsx`

```typescript
import { SidebarProvider } from '../context/SidebarProvider';

<SidebarProvider>
    <Sidebar />
</SidebarProvider>
```

**Effort**: 30 minutes  
**Risk**: Very Low

#### Step 3.3: Update Sidebar Components to Use Context
**Files**: `src-tauri/webview/src/components/workspace/TestsUi.tsx`, `WorkflowsUi.tsx`, `PerformanceUi.tsx`

```typescript
// Example: TestsUi.tsx
import { useSidebar } from '../../context/SidebarContext';

const TestsUi: React.FC = () => {
    const { projects, addProject, closeProject, selectProject } = useSidebar();
    
    // No props needed!
};
```

**Effort**: 1.5 hours  
**Risk**: Low

---

### Phase 4: Testing & Cleanup (2-3 hours)

#### Step 4.1: Run Full Test Suite
```bash
npm test
```

**Effort**: 30 minutes  
**Risk**: None (validation step)

#### Step 4.2: Build and Verify No TypeScript Errors
```bash
npm run compile-webview
npm run tauri:dev
```

**Effort**: 1 hour  
**Risk**: None (validation step)

#### Step 4.3: Manual Testing Checklist
- [ ] Open existing project
- [ ] Create new project
- [ ] Load WSDL
- [ ] Select operation and execute request
- [ ] View response
- [ ] Add assertions
- [ ] Run test case
- [ ] Run performance suite
- [ ] Toggle layout modes
- [ ] Verify all UI interactions work

**Effort**: 1 hour  
**Risk**: None (validation step)

#### Step 4.4: Update Documentation
Update `docs/CODE_SMELLS_ANALYSIS.md` to mark prop drilling as completed.

**Effort**: 30 minutes  
**Risk**: None

---

## Relevant Files

### New Files to Create
- `src-tauri/webview/src/context/WorkspaceContext.tsx` - Workspace context type definition
- `src-tauri/webview/src/context/WorkspaceProvider.tsx` - Workspace provider component
- `src-tauri/webview/src/context/SidebarContext.tsx` - Sidebar context type definition
- `src-tauri/webview/src/context/SidebarProvider.tsx` - Sidebar provider component

### Files to Modify
- `src-tauri/webview/src/components/MainContent.tsx` - Wrap children with providers, remove props
- `src-tauri/webview/src/components/WorkspaceLayout.tsx` - Convert to context consumer
- `src-tauri/webview/src/components/Sidebar.tsx` - Convert to context consumer
- `src-tauri/webview/src/components/workspace/*.tsx` - Update sub-components to use contexts

### Files to Reference (Existing Contexts)
- `src-tauri/webview/src/context/ProjectContext.tsx` - Pattern reference
- `src-tauri/webview/src/context/SelectionContext.tsx` - Pattern reference
- `src-tauri/webview/src/context/UIContext.tsx` - Pattern reference

---

## Verification

### Automated Tests
1. **TypeScript Compilation**: `npm run compile-webview` should complete with zero errors
2. **Unit Tests**: `npm test` should pass all existing tests
3. **Tauri Build**: `npm run tauri:build` should succeed

### Manual Testing
1. **Project Operations**:
   - Create new project → Verify no errors
   - Open existing project → Verify state loads correctly
   - Close project → Verify cleanup works

2. **Request/Response Flow**:
   - Load WSDL → Verify services appear
   - Select operation → Verify request editor shows
   - Execute request → Verify response displays
   - Update request → Verify changes persist

3. **UI Interactions**:
   - Toggle layout mode (vertical/horizontal) → Verify split updates
   - Toggle line numbers → Monaco editor should update
   - Resize panels → Split ratio should adjust smoothly

4. **Test Execution**:
   - Create test case → Add steps → Run test → Verify results
   - Add assertions → Verify they execute correctly

5. **Performance Suites**:
   - Create performance suite → Add requests → Run suite → View results

### Code Quality Checks
1. **Prop Count Verification**:
   ```bash
   # Check WorkspaceLayout has no props
   grep -n "WorkspaceLayoutProps" src-tauri/webview/src/components/WorkspaceLayout.tsx
   # Should return: 0 matches (or only in type definition being removed)
   
   # Check components use useWorkspace hook
   grep -n "useWorkspace()" src-tauri/webview/src/components/workspace/*.tsx
   # Should show multiple usages
   ```

2. **Context Usage Verification**:
   ```bash
   # Verify WorkspaceProvider wraps WorkspaceLayout
   grep -A 2 "WorkspaceProvider" src-tauri/webview/src/components/MainContent.tsx
   # Should show: <WorkspaceProvider><WorkspaceLayout /></WorkspaceProvider>
   ```

---

## Decisions & Assumptions

### Decisions Made
1. **Create Composite Contexts**: Instead of making components consume 9 separate contexts, create `WorkspaceContext` and `SidebarContext` that combine relevant state
2. **Keep Existing Contexts**: Don't remove existing contexts (ProjectContext, SelectionContext, etc.) - they're well-designed and used elsewhere
3. **Provider Wrapping Pattern**: Use provider wrapping in MainContent rather than passing props down
4. **Gradual Migration**: Migrate components incrementally to allow testing at each step

### Assumptions
1. **Existing Contexts Are Stable**: The 9 existing contexts won't change significantly during this refactoring
2. **No Breaking Changes Required**: This is purely internal refactoring; no API changes needed
3. **Test Coverage Exists**: Existing tests will catch regressions (if not, add tests in Phase 4)
4. **TypeScript Strict Mode**: Codebase uses strict TypeScript, so type errors will be caught immediately

### Scope Boundaries

**Included**:
- WorkspaceLayout prop elimination
- Sidebar prop reduction
- Creation of WorkspaceContext and SidebarContext
- Updating workspace sub-components to use contexts
- Testing and verification

**Excluded**:
- Removing existing contexts (ProjectContext, SelectionContext, etc.)
- Major architectural changes beyond prop drilling
- Performance optimizations unrelated to prop drilling
- UI/UX improvements
- Bug fixes unrelated to this refactoring

---

## Further Considerations

### Option A: Zustand/Recoil State Management (Future)
**Question**: Should we consider migrating to a state management library like Zustand or Recoil for even simpler state access?

**Pros**:
- Even simpler API than React Context
- Built-in performance optimizations
- Better devtools support
- Less boilerplate

**Cons**:
- Adds new dependency
- Learning curve for team
- Migration effort on top of current plan

**Recommendation**: **Not now**. Complete this refactoring first, then evaluate if additional state management library is needed. Current React Context approach is sufficient.

### Option B: Component Splitting (Parallel Task)
**Question**: Should we also split WorkspaceLayout into smaller components as part of this effort?

**Pros**:
- Improves maintainability
- Better separation of concerns
- Easier testing

**Cons**:
- Adds significant scope (6-8 additional hours)
- May introduce layout/styling issues
- Separate concern from prop drilling

**Recommendation**: **Separate task**. Focus on prop drilling first, then create separate issue for component splitting.

### Option C: Full Context Consolidation (Aggressive)
**Question**: Should we consolidate all 9 contexts into fewer contexts?

**Pros**:
- Simpler architecture
- Fewer context providers to wrap
- Easier to reason about state

**Cons**:
- High risk of breaking changes
- Loses modularity
- Large refactor with high testing burden

**Recommendation**: **Don't do this**. Current context structure is well-designed. Composite contexts (WorkspaceContext, SidebarContext) provide the right balance.

---

## Effort Summary

| Phase | Task | Effort | Risk |
|-------|------|--------|------|
| **Phase 1** | Create WorkspaceContext & Provider | 3.5 hours | Very Low |
| | Wrap MainContent with WorkspaceProvider | 0.5 hours | Very Low |
| **Phase 2** | Update WorkspaceLayout to use context | 2 hours | Medium |
| | Remove props from MainContent | 1 hour | Low |
| | Update workspace sub-components | 3-4 hours | Medium |
| **Phase 3** | Create SidebarContext & Provider | 1.5 hours | Low |
| | Wrap Sidebar with provider | 0.5 hours | Very Low |
| | Update sidebar sub-components | 1.5 hours | Low |
| **Phase 4** | Testing & validation | 1.5 hours | None |
| | Documentation updates | 0.5 hours | None |
| **TOTAL** | | **18-22 hours** | **Low-Medium** |

**Timeline**: 2-3 days for one developer

---

## Success Criteria

✅ **WorkspaceLayout receives 0 props** (all from context)  
✅ **Sidebar prop count reduced by 70%+** (from ~120 to ~30-40)  
✅ **All existing tests pass**  
✅ **No TypeScript compilation errors**  
✅ **Manual testing confirms no regressions**  
✅ **Code is more maintainable and testable**
