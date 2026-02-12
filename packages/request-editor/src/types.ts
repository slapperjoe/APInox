// Core types for @apinox/request-editor package
// These define the public API surface

// ============================================================================
// Theme System
// ============================================================================

/**
 * Theme configuration for editor components
 * Allows parent app to inject custom themes without tight coupling
 */
export interface EditorTheme {
  /** Theme name (e.g., 'apinox-dark', 'apinox-light') */
  name: string;
  /** Whether this is a light theme (false = dark theme) */
  isLight: boolean;
  /** Editor background color */
  background: string;
  /** Editor foreground/text color */
  foreground: string;
  /** Line number color */
  lineNumberColor: string;
  /** Selection background */
  selectionBackground: string;
  /** Cursor color */
  cursorColor: string;
  /** Input background */
  inputBackground: string;
  /** Input border */
  inputBorder: string;
  /** Button background */
  buttonBackground: string;
  /** Button foreground */
  buttonForeground: string;
  /** Button hover background */
  buttonHoverBackground: string;
  /** Disabled foreground */
  disabledForeground: string;
  /** Error foreground */
  errorForeground: string;
}

// ============================================================================
// Variable System (for autocomplete)
// ============================================================================

export interface EditorVariable {
  /** Variable name (e.g., 'apiKey', 'baseUrl') */
  name: string;
  /** Current value (null if not set) */
  value: string | null;
  /** Source of variable (e.g., 'environment', 'global', 'extracted') */
  source: string;
}

// ============================================================================
// Monaco Editor Props
// ============================================================================

export interface MonacoRequestEditorProps {
  /** Current editor content */
  value: string;
  /** Callback when content changes */
  onChange: (value: string) => void;
  /** Editor language (xml, json, graphql, text) */
  language?: 'xml' | 'json' | 'graphql' | 'text';
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when editor gains focus */
  onFocus?: () => void;
  /** Elements to auto-fold (e.g., ['soapenv:Header']) */
  autoFoldElements?: string[];
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Unique request ID (triggers reset when changed) */
  requestId?: string;
  /** Force update key (triggers rerender) */
  forceUpdateKey?: number;
  /** Logging ID for debugging */
  logId?: string;
  /** Font size (default: 14) */
  fontSize?: number;
  /** Font family (default: Consolas) */
  fontFamily?: string;
  /** Available variables for autocomplete */
  availableVariables?: EditorVariable[];
  /** Theme configuration */
  theme?: EditorTheme;
}

export interface MonacoRequestEditorHandle {
  /** Insert text at cursor position */
  insertText: (text: string) => void;
  /** Get current editor value */
  getValue: () => string;
}

export interface MonacoResponseViewerProps {
  /** Response content to display */
  value: string;
  /** Content language (xml, json, text) */
  language?: 'xml' | 'json' | 'text';
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (data: { text: string, offset: number } | null) => void;
  /** Elements to auto-fold */
  autoFoldElements?: string[];
  /** Font size (default: 14) */
  fontSize?: number;
  /** Font family (default: Consolas) */
  fontFamily?: string;
  /** Theme configuration */
  theme?: EditorTheme;
}

export interface MonacoSingleLineInputProps {
  /** Current input value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Read-only mode */
  readOnly?: boolean;
  /** Font size (default: 12) */
  fontSize?: number;
  /** Available variables for autocomplete */
  availableVariables?: EditorVariable[];
  /** Theme configuration */
  theme?: EditorTheme;
}

// ============================================================================
// Headers Panel
// ============================================================================

export interface HttpHeader {
  key: string;
  value: string;
  enabled: boolean;
}

export interface HeadersPanelProps {
  /** Current headers */
  headers: HttpHeader[];
  /** Callback when headers change */
  onChange: (headers: HttpHeader[]) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Available variables for autocomplete */
  availableVariables?: EditorVariable[];
  /** Theme configuration */
  theme?: EditorTheme;
}

// ============================================================================
// Assertions Panel
// ============================================================================

export type AssertionType = 'contains' | 'not-contains' | 'equals' | 'not-equals' | 
  'xpath' | 'jsonpath' | 'regex' | 'status-code' | 'header-exists' | 'response-time' |
  'Simple Contains' | 'Simple Not Contains' | 'Response SLA' | 'XPath Match' | 
  'SOAP Fault' | 'HTTP Status' | 'Script';

export interface Assertion {
  id: string;
  type: AssertionType;
  enabled?: boolean;
  name?: string;
  configuration?: Record<string, any>;
  /** For contains/equals assertions */
  expected?: string;
  /** For xpath/jsonpath/regex assertions */
  query?: string;
  /** For header-exists assertions */
  headerName?: string;
  /** For response-time assertions (milliseconds) */
  maxTime?: number;
}

export interface AssertionsPanelProps {
  /** Current assertions */
  assertions: Assertion[];
  /** Callback when assertions change */
  onChange: (assertions: Assertion[]) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Available variables for autocomplete */
  availableVariables?: EditorVariable[];
  /** Theme configuration */
  theme?: EditorTheme;
}

// ============================================================================
// Extractors Panel
// ============================================================================

export type ExtractorType = 'xpath' | 'jsonpath' | 'regex' | 'header' | 'Regex' | 'XPath';

export interface RequestExtractor {
  id: string;
  name: string;
  type: ExtractorType;
  enabled: boolean;
  /** XPath, JSONPath, or regex pattern */
  query: string;
  /** XPath/regex path (backward compat) */
  path?: string;
  /** Variable name to store extracted value */
  variable?: string;
  /** Source of extraction (body/header) */
  source?: string;
  /** For header extractor */
  headerName?: string;
  /** Default value if extraction fails */
  defaultValue?: string;
}

export interface ExtractorsPanelProps {
  /** Current extractors */
  extractors: RequestExtractor[];
  /** Callback when extractors change */
  onChange: (extractors: RequestExtractor[]) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Available variables for autocomplete */
  availableVariables?: EditorVariable[];
  /** Theme configuration */
  theme?: EditorTheme;
}

// ============================================================================
// Query Params Panel
// ============================================================================

export interface QueryParam {
  key: string;
  value: string;
  enabled: boolean;
}

export interface QueryParamsPanelProps {
  /** Current query parameters */
  params: QueryParam[];
  /** Callback when params change */
  onChange: (params: QueryParam[]) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Available variables for autocomplete */
  availableVariables?: EditorVariable[];
  /** Theme configuration */
  theme?: EditorTheme;
}

// ============================================================================
// REST Auth Panel
// ============================================================================

export type RestAuthType = 'none' | 'basic' | 'bearer' | 'apiKey' | 'oauth2';

export interface BasicAuthConfig {
  username: string;
  password: string;
}

export interface BearerAuthConfig {
  token: string;
}

export interface ApiKeyAuthConfig {
  key: string;
  value: string;
  addTo: 'header' | 'query';
}

export interface OAuth2Config {
  accessToken: string;
  tokenType?: string;
}

export interface RestAuthConfig {
  type: RestAuthType;
  basic?: BasicAuthConfig;
  bearer?: BearerAuthConfig;
  apiKey?: ApiKeyAuthConfig;
  oauth2?: OAuth2Config;
}

export interface RestAuthPanelProps {
  /** Current auth configuration */
  config: RestAuthConfig;
  /** Callback when config changes */
  onChange: (config: RestAuthConfig) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Available variables for autocomplete */
  availableVariables?: EditorVariable[];
  /** Theme configuration */
  theme?: EditorTheme;
}

// ============================================================================
// Security Panel (WS-Security for SOAP)
// ============================================================================

export type WSSecurityType = 'none' | 'usernameToken' | 'certificate';

export interface WSSecurityConfig {
  enabled?: boolean;
  type: WSSecurityType;
  username?: string;
  password?: string;
  passwordType?: 'PasswordText' | 'PasswordDigest';
  hasNonce?: boolean;
  hasCreated?: boolean;
  privateKeyPath?: string;
  publicCertPath?: string;
}

export interface SecurityPanelProps {
  /** Current WS-Security configuration */
  config: WSSecurityConfig;
  /** Callback when config changes */
  onChange: (config: WSSecurityConfig) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Available variables for autocomplete */
  availableVariables?: EditorVariable[];
  /** Theme configuration */
  theme?: EditorTheme;
}

// ============================================================================
// Attachments Panel
// ============================================================================

export type AttachmentType = 'Base64' | 'MTOM' | 'SwA';

export interface RequestAttachment {
  id: string;
  name: string;
  contentType: string;
  type: AttachmentType;
  enabled: boolean;
  /** Base64 content or file path */
  content: string;
  /** Content-ID for cid: reference */
  contentId?: string;
  /** File system path (optional) */
  fsPath?: string;
  /** File size in bytes (optional) */
  size?: number;
}

export interface AttachmentsPanelProps {
  /** Current attachments */
  attachments: RequestAttachment[];
  /** Callback when attachments change */
  onChange: (attachments: RequestAttachment[]) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback to trigger file picker */
  onPickFile?: () => Promise<{ name: string; content: string; contentType: string } | null>;
  /** Theme configuration */
  theme?: EditorTheme;
}

// ============================================================================
// GraphQL Variables Panel
// ============================================================================

export interface GraphQLVariablesPanelProps {
  /** Current variables (JSON string) */
  value: string;
  /** Callback when variables change */
  onChange: (value: string) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Available variables for autocomplete */
  availableVariables?: EditorVariable[];
  /** Theme configuration */
  theme?: EditorTheme;
}

// ============================================================================
// Variables Panel (Display Only)
// ============================================================================

export interface VariablesPanelProps {
  /** Variables to display */
  variables: EditorVariable[];
  /** Theme configuration */
  theme?: EditorTheme;
}

// ============================================================================
// Schema Viewer
// ============================================================================

export interface SchemaNode {
  name: string;
  type?: string;
  minOccurs?: string;
  maxOccurs?: string;
  children?: SchemaNode[];
}

export interface SchemaViewerProps {
  /** Schema tree to display */
  schema: SchemaNode;
  /** Theme configuration */
  theme?: EditorTheme;
}

// ============================================================================
// Status Code Picker
// ============================================================================

export interface StatusCodePickerProps {
  /** Current status code */
  value: number;
  /** Callback when status code changes */
  onChange: (code: number) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Theme configuration */
  theme?: EditorTheme;
}

// ============================================================================
// Script Editor (for test scripts)
// ============================================================================

export interface ScriptEditorProps {
  /** Current script content */
  value: string;
  /** Callback when script changes */
  onChange: (value: string) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Available variables for autocomplete */
  availableVariables?: EditorVariable[];
  /** Theme configuration */
  theme?: EditorTheme;
}
