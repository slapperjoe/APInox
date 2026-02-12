// Main entry point for @apinox/request-editor package

export const version = '0.1.0';

// Export all types
export * from './types';
// Don't re-export shared (contains duplicate SchemaNode)
export type { SchemaNode } from './shared';

// Export components
export { MonacoRequestEditor } from './components/MonacoRequestEditor';
export type { MonacoRequestEditorHandle } from './components/MonacoRequestEditor';
export { MonacoResponseViewer } from './components/MonacoResponseViewer';
export { MonacoSingleLineInput } from './components/MonacoSingleLineInput';
export type { MonacoSingleLineInputHandle } from './components/MonacoSingleLineInput';

// Export panels
export { HeadersPanel } from './components/HeadersPanel';
export { AssertionsPanel } from './components/AssertionsPanel';
export { ExtractorsPanel } from './components/ExtractorsPanel';
export { QueryParamsPanel } from './components/QueryParamsPanel';
export { RestAuthPanel } from './components/RestAuthPanel';
export { SecurityPanel } from './components/SecurityPanel';
export { AttachmentsPanel } from './components/AttachmentsPanel';
export { GraphQLVariablesPanel } from './components/GraphQLVariablesPanel';
export { VariablesPanel } from './components/VariablesPanel';

// Export supporting components
export { ScriptEditor } from './components/ScriptEditor';
export { SchemaViewer } from './components/SchemaViewer';
export { StatusCodePicker } from './components/StatusCodePicker';

// Export common components (Button, Form etc - check actual exports)
// Note: Some common components may not be exported yet - add as needed

// Export utilities
export { applyAutoFolding } from './utils/xmlFoldingUtils';
export { getInitialXml, generateXmlFromSchema } from './utils/soapUtils';
export { XPathGenerator } from './utils/xpathGenerator';
export { CustomXPathEvaluator } from './utils/xpathEvaluator';
export { parseXmlToTree } from './utils/xmlTreeParser';
export { generateCode } from './utils/codeGenerator';
export type { CodeLanguage } from './utils/codeGenerator';

// Export hooks
export { useWildcardDecorations } from './hooks/useWildcardDecorations';

// Export contexts (for apps that need theme context)
export { ThemeProvider, useTheme } from './contexts/ThemeContext';

