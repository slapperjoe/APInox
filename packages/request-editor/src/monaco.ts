import { configureMonacoEnvironment } from './utils/configureMonacoEnvironment';

configureMonacoEnvironment();

export { MonacoRequestEditor } from './components/MonacoRequestEditor';
export type { MonacoRequestEditorHandle } from './components/MonacoRequestEditor';
export { MonacoRequestEditorWithToolbar } from './components/MonacoRequestEditorWithToolbar';
export type { MonacoRequestEditorWithToolbarProps, ExtraTab } from './components/MonacoRequestEditorWithToolbar';
export { MonacoResponseViewer } from './components/MonacoResponseViewer';
export { MonacoResponseViewerWithToolbar } from './components/MonacoResponseViewerWithToolbar';
export type { MonacoResponseViewerWithToolbarProps } from './components/MonacoResponseViewerWithToolbar';
export { MonacoSingleLineInput } from './components/MonacoSingleLineInput';
export type { MonacoSingleLineInputHandle } from './components/MonacoSingleLineInput';
export { RequestWorkspace } from './components/RequestWorkspace';
export type { RequestWorkspaceProps, ApiRequest, ExecutionResponse, Variable } from './components/RequestWorkspace';

export { HeadersPanel } from './components/HeadersPanel';
export { AssertionsPanel } from './components/AssertionsPanel';
export { ExtractorsPanel } from './components/ExtractorsPanel';
export { QueryParamsPanel } from './components/QueryParamsPanel';
export { FormDataPanel } from './components/FormDataPanel';
export { BinaryBodyPanel } from './components/BinaryBodyPanel';
export { RestAuthPanel } from './components/RestAuthPanel';
export { SecurityPanel } from './components/SecurityPanel';
export { AttachmentsPanel } from './components/AttachmentsPanel';
export { GraphQLVariablesPanel } from './components/GraphQLVariablesPanel';
export { VariablesPanel } from './components/VariablesPanel';
export { ScriptEditor } from './components/ScriptEditor';

export { applyAutoFolding } from './utils/xmlFoldingUtils';
export { useWildcardDecorations } from './hooks/useWildcardDecorations';
