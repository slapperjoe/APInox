export type { SchemaNode, RequestType, HttpMethod, BodyType } from "./shared";

export { ErrorBoundary } from "./components/ErrorBoundary";
export { RequestTypeSelector } from "./components/RequestTypeSelector";
export {
  RequestTypeBadge,
  MethodBadge,
  BodyTypeBadge,
  ContentTypeBadge,
  BadgeGroup,
} from "./components/RequestTypeBadges";
export { StatusCodePicker } from "./components/StatusCodePicker";
export { EmptyState } from "./components/common/EmptyState";
export type { EmptyStateProps } from "./components/common/EmptyState";

export { ThemeProvider, useTheme } from "./contexts/ThemeContext";
export {
  EditorSettingsProvider,
  useEditorSettings,
  DEFAULT_EDITOR_SETTINGS,
} from "./contexts/EditorSettingsContext";
export type { EditorSettings } from "./contexts/EditorSettingsContext";

export { getInitialXml, generateXmlFromSchema } from "./utils/soapUtils";
export { XPathGenerator } from "./utils/xpathGenerator";
export { CustomXPathEvaluator } from "./utils/xpathEvaluator";
export { parseXmlToTree } from "./utils/xmlTreeParser";
export { formatXml, stripCausalityData } from "./utils/xmlFormatter";
export {
  formatContent,
  formatJson,
} from "./utils/contentFormatter";
export {
  validateUrl,
  validateJson,
  validateAndFormatJson,
  validateXml,
  getXmlErrors,
  validateXPath,
  testXPath,
  validateRegex,
  testRegex,
  getRegexGroups,
  validateEmail,
  validateContentType,
} from "./utils/validators";
export type { ValidationResult } from "./utils/validators";

export {
  debugLog,
  debugWarn,
  debugError,
  captureLog,
  editorLogs,
} from "./utils/logger";
export type { EditorLogEntry } from "./utils/logger";
