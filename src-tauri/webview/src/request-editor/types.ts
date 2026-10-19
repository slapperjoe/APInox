// Core types for ../request-editor package
// These define the public API surface

// ============================================================================
// Request Types
// ============================================================================

// These four are canonical in @shared/models. Re-exported rather than
// re-declared so the package and the app cannot drift.
export type { RequestType, HttpMethod, BodyType } from '@shared/models';

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
  /** Show minimap (default: false) */
  showMinimap?: boolean;
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
  /** Show minimap (default: false) */
  showMinimap?: boolean;
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
// Assertions Panel
// ============================================================================

export type { AssertionType } from '@shared/models';
import type { AssertionType } from '@shared/models';

export interface Assertion {
  id: string;
  type: AssertionType;
  name?: string;
  configuration?: Record<string, any>;
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

export type { RequestExtractorType, RequestExtractor } from '@shared/models';
import type { RequestExtractor } from '@shared/models';

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
// Form Data Panel
// ============================================================================

import type { FormFieldType } from '@shared/models';
export type { FormFieldType };

export interface FormField {
  key: string;
  value: string;
  type: FormFieldType;
  enabled: boolean;
  /** For file type: file name */
  fileName?: string;
  /** For file type: content type */
  contentType?: string;
  /** For file type: file size in bytes */
  fileSize?: number;
}

export interface FormDataPanelProps {
  /** Current form fields */
  fields: FormField[];
  /** Callback when fields change */
  onChange: (fields: FormField[]) => void;
  /** Encoding type */
  enctype?: 'application/x-www-form-urlencoded' | 'multipart/form-data';
  /** Read-only mode */
  readOnly?: boolean;
  /** Available variables for autocomplete */
  availableVariables?: EditorVariable[];
  /** Callback to trigger file picker (returns file data) */
  onPickFile?: () => Promise<{ name: string; content: string; contentType: string; size: number } | null>;
  /** Theme configuration */
  theme?: EditorTheme;
}

// ============================================================================
// Binary Body Panel
// ============================================================================

export interface BinaryFile {
  /** File name */
  fileName: string;
  /** MIME type */
  contentType: string;
  /** File size in bytes */
  fileSize: number;
  /** File content (base64 encoded or raw string) */
  content: string;
}

export interface BinaryBodyPanelProps {
  /** Current binary file (null if none selected) */
  file: BinaryFile | null;
  /** Callback when file changes */
  onChange: (file: BinaryFile | null) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback to trigger file picker */
  onPickFile?: () => Promise<{ name: string; content: string; contentType: string; size: number } | null>;
}

// ============================================================================
// REST Auth Panel
// ============================================================================

// Auth types are canonical in @shared/models — import locally and re-export for package consumers.
import type {
    RestAuthType,
    RestAuthConfig,
    BasicAuthConfig,
    BearerAuthConfig,
    ApiKeyAuthConfig,
    OAuth2Config,
} from '@shared/models';
export type {
    RestAuthType,
    RestAuthConfig,
    BasicAuthConfig,
    BearerAuthConfig,
    ApiKeyAuthConfig,
    OAuth2Config,
};

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

// ============================================================================
// Error Boundary
// ============================================================================

export interface ErrorInfo {
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Component stack where error occurred */
  componentStack?: string;
}

export interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: React.ReactNode;
  /** Optional fallback UI (receives error and reset function) */
  fallback?: (error: ErrorInfo, reset: () => void) => React.ReactNode;
  /** Optional error callback for logging/reporting */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Optional custom error title */
  errorTitle?: string;
  /** Optional custom error message */
  errorMessage?: string;
}
