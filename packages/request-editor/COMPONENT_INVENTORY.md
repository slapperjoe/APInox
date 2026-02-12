# Component Extraction Inventory

## ✅ EXTRACT TO @apinox/request-editor

### Core Editors (HIGH PRIORITY)
- [x] `MonacoRequestEditor.tsx` - Main request body editor
- [x] `MonacoResponseViewer.tsx` - Response viewer
- [x] `MonacoSingleLineInput.tsx` - Single-line input field

### Panels (HIGH PRIORITY)
- [x] `HeadersPanel.tsx` - HTTP headers editor
- [x] `AssertionsPanel.tsx` - Test assertions configuration
- [x] `ExtractorsPanel.tsx` - Data extraction rules
- [x] `QueryParamsPanel.tsx` - Query string parameters
- [x] `RestAuthPanel.tsx` - REST authentication config
- [x] `SecurityPanel.tsx` - WS-Security for SOAP
- [x] `AttachmentsPanel.tsx` - File attachments
- [x] `GraphQLVariablesPanel.tsx` - GraphQL variables
- [x] `VariablesPanel.tsx` - Environment variables display

### Supporting Components (MEDIUM PRIORITY)
- [x] `ScriptEditor.tsx` - JavaScript editor for test scripts
- [x] `SchemaViewer.tsx` - XML/JSON schema viewer
- [x] `StatusCodePicker.tsx` - HTTP status code picker

### Common/Shared Components (LOW PRIORITY)
- [x] `common/Button.tsx` - Button component
- [x] `common/Form.tsx` - Form components
- [x] `common/NumberSpinner.tsx` - Number input spinner
- [x] `common/EmptyState.tsx` - Empty state display
- [x] `common/Skeleton.tsx` - Loading skeleton

### Utilities (HIGH PRIORITY)
- [x] `xmlFoldingUtils.ts` - XML auto-folding logic
- [x] `soapUtils.ts` - SOAP XML generation helpers
- [x] `xpathGenerator.ts` - XPath generation from XML
- [x] `xpathEvaluator.ts` - XPath evaluation
- [x] `xmlTreeParser.ts` - XML tree parsing
- [x] `codeGenerator.ts` - Code snippet generation

### Hooks (MEDIUM PRIORITY)
- [x] `useWildcardDecorations.ts` - Monaco decorations for variables

### Tests
- [x] All associated `.test.tsx` files for above components

---

## ❌ KEEP IN APInox Core (DO NOT EXTRACT)

### App Structure
- `App.tsx` - Main app component
- `WorkspaceLayout.tsx` - Overall layout
- `MainContent.tsx` - Content area wrapper
- `Sidebar.tsx` - Sidebar container
- `TitleBar.tsx` - Window title bar
- `ErrorBoundary.tsx` - Error boundary

### Project Management
- `ProjectTestTree.tsx` - Project tree view
- `TestNavigator.tsx` - Test case navigator
- `sidebar/ProjectList.tsx` - Project list
- `sidebar/FolderTree.tsx` - Folder tree
- `sidebar/CollectionList.tsx` - REST collections
- `sidebar/ServiceTree.tsx` - SOAP service tree

### API Explorer
- `explorer/ApiExplorerMain.tsx` - API explorer
- `sidebar/ApiExplorerSidebar.tsx` - Explorer sidebar

### Workspace Panels (App-specific, use editor components)
- `workspace/ProjectSummary.tsx`
- `workspace/InterfaceSummary.tsx`
- `workspace/OperationSummary.tsx`
- `workspace/TestSuiteSummary.tsx`
- `workspace/TestCaseView.tsx`
- `workspace/WorkflowEditor.tsx`
- `workspace/WorkflowSummary.tsx`
- `workspace/WorkflowPropertiesPanel.tsx`
- `workspace/SampleRequestPanel.tsx`
- `workspace/RequestTypeSelector.tsx`
- `workspace/WelcomePanel.tsx`

### Test Workflow Steps
- `workspace/RequestStepEditor.tsx`
- `workspace/DelayStepEditor.tsx`
- `workspace/ConditionStepEditor.tsx`
- `workspace/LoopStepEditor.tsx`
- `workspace/ScriptStepEditor.tsx`

### Modals (App-specific logic)
- `modals/SettingsEditorModal.tsx`
- `modals/AddToProjectModal.tsx`
- `modals/AddToTestCaseModal.tsx`
- `modals/BulkImportModal.tsx`
- `modals/ImportRequestsModal.tsx`
- `modals/ExportWorkspaceModal.tsx`
- `modals/WsdlSyncModal.tsx`
- `modals/WorkflowBuilderModal.tsx`
- `modals/RenameModal.tsx`
- `modals/SampleModal.tsx`
- `modals/ConfirmationModal.tsx`
- `modals/PickRequestModal.tsx`
- `modals/ExtractorModal.tsx`
- `modals/CodeSnippetModal.tsx`
- `modals/ScriptPlaygroundModal.tsx`
- `modals/HelpModal.tsx`
- `modals/DebugModal.tsx`
- `modals/Modal.tsx` - Base modal

### Settings Tabs
- `modals/settings/GeneralTab.tsx`
- `modals/settings/EnvironmentsTab.tsx`
- `modals/settings/GlobalsTab.tsx`
- `modals/settings/IntegrationsTab.tsx`

### Sidebar Panels
- `sidebar/TestsUi.tsx`
- `sidebar/WorkflowsUi.tsx`
- `sidebar/HistorySidebar.tsx`
- `sidebar/ScrapbookPanel.tsx`
- `sidebar/EnvironmentSelector.tsx`
- `sidebar/SidebarRail.tsx`

### Utilities (App-specific)
- `utils/bridge.ts` - Sidecar communication
- `utils/projectUtils.ts` - Project operations
- `utils/workspaceSearch.ts` - Search functionality
- `utils/reportGenerator.ts` - Report generation
- `utils/csvExport.ts` - CSV export
- `utils/fontDetection.ts` - Font detection

### Hooks (App-specific)
- `hooks/useWorkspaceCallbacks.ts`
- `hooks/useRequestExecution.ts`
- `hooks/useRequestHandlers.ts`
- `hooks/useTestCaseHandlers.ts`
- `hooks/useSidebarCallbacks.ts`
- `hooks/useContextMenu.ts`
- `hooks/useExplorer.ts`
- `hooks/useFolderManager.ts`
- `hooks/useMessageHandler.ts`
- `hooks/useLayoutHandler.ts`
- `hooks/useAppLifecycle.ts`
- `hooks/useDragAndDrop.ts`

---

## ⚠️ PROXY/MOCK - Move to APIprox Later

### Proxy Components (Phase 2)
- `workspace/BreakpointOverlay.tsx`
- `sidebar/ProxyUi.tsx`
- `sidebar/MockUi.tsx`
- `sidebar/ServerUi.tsx`
- `sidebar/WatcherPanel.tsx`
- `modals/BreakpointModal.tsx`
- `modals/CreateReplaceRuleModal.tsx`
- `modals/MockRuleModal.tsx`
- `modals/settings/ServerTab.tsx`
- `modals/settings/ReplaceRulesTab.tsx`
- `modals/settings/ProxyRulesEditor.tsx`

### Performance Testing (Phase 2)
- `workspace/PerformanceSuiteEditor.tsx`
- `workspace/PerformanceResultsPanel.tsx`
- `workspace/ResponseTimeChart.tsx`
- `workspace/WorkerStatusPanel.tsx`
- `sidebar/PerformanceUi.tsx`

### Integrations (Phase 2)
- `modals/AddToDevOpsModal.tsx`
- `modals/DiagnosticsTab.tsx`

### Hooks (Proxy-specific)
- `hooks/useWatcherProxy.ts`

### Utils (Proxy-specific)
- `utils/mockUtils.ts`

---

## Component Dependencies Analysis

### External Dependencies Required by Editor Package
- `@monaco-editor/react` ✅
- `monaco-editor` ✅
- `lucide-react` (icons) ✅
- `styled-components` ✅
- `react`, `react-dom` (peer deps) ✅

### Internal Dependencies to Extract
- Theme types/interfaces (from ThemeContext)
- Variable types (for autocomplete)
- Request/response types (from shared/models.ts)

### Dependencies to Remove
- `bridge.ts` - Replace with callback props
- `ThemeContext` - Replace with theme prop
- App-specific state management hooks
