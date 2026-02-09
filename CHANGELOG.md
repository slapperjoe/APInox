# Changelog


## [0.16.0] - 2026-02-05
### Added
- **Regex Extractors**: Extract values from JSON, HTML, or plain text responses using regex patterns
  - Support for capture groups to extract specific values
  - Common pattern library (email, URL, UUID, JSON fields, HTML tags)
  - Pattern validation with helpful error messages
  - Type dropdown in Extractor UI (XPath, Regex, JSONPath, Header)
  - Enhanced documentation with real-world examples
  - Complementary to existing XPath extractors for non-XML responses

### Auto-Generated Changes
- No Commit messages found.

## [0.15.105] - 2026-02-04
### Changed
- **Build Size Optimization**: Significantly reduced installer size through production optimizations
  - Installer size reduced from 28.92 MB to 20.59 MB (-28.8% reduction)
  - Stripped sourcemaps from production builds (kept in development)
  - Enabled sidecar minification for production
  - Added LZMA compression to NSIS installer
  - Webview bundle reduced from 62.22 MB to 16.91 MB (-72.8%)
  - Development builds retain sourcemaps for debugging
  - All functionality preserved and tested

## [0.15.94] - 2026-02-04
### Added
- **SettingsManager**: Comprehensive configuration management system
  - Centralized handling of application settings (environments, UI state, mock server config)
  - Methods for managing recent workspaces and performance testing configurations
  - Support for proxy rules and timeout configurations
- **WS-Security Support**: New WSSecurityUtil for generating WS-Security headers
  - UsernameToken with PasswordText or PasswordDigest
  - Certificate signing support
  - Nonce and timestamp generation for replay attack prevention
- **WildcardProcessor**: Advanced dynamic text processing
  - Context-aware variable and function processing
  - UUID generation, date manipulation, and user-defined scripts
  - Integration with environment and global variables
- **Font Detection**: Utility to detect installed monospaced fonts on user's system
- **Workflow Editor UI**: Complete workflow editing interface
  - ScriptStepEditor for JavaScript step editing
  - WorkflowEditor with drag-and-drop step management
  - WorkflowPropertiesPanel for metadata and statistics
  - WorkflowSummary for workflow overview
  - Integrated with TestRunnerService for step execution
- **Drag-and-Drop Reordering**: Sidebar items can now be reordered via drag-and-drop
  - Custom `useDragAndDrop` hook for managing drag state
  - Visual feedback during dragging
  - Works with projects, folders, and interfaces
- **Sample Request Panel**: Display sample XML requests with metadata in Operation Summary
  - Create requests directly from samples
  - XML tree structure rendering
  - Filtering of sample requests from project interface additions
- **Variables Panel**: Display extracted variables from prior test steps
  - Variable autocomplete in Monaco editor
  - Execution status visualization with icons and tooltips
- **Save Error Dialog**: User-friendly error handling for save failures
  - Retry, delete, and keep options
  - Clear error messages with actionable feedback
- **TitleBar Enhancements**: Custom title bar with window controls
  - Minimize/maximize functionality
  - Project info display
  - Better Tauri integration

### Improved
- **UI Consistency**: Comprehensive refactoring for standardization
  - Unified Button and Form component libraries
  - NumberSpinner for numeric inputs
  - Consistent spacing constants (SPACING, MODAL)
  - Semantic color variables (STATUS_COLORS, CHANGE_COLORS, ICON_COLORS, TAG_COLORS)
  - Theme-aware color mixing for hover effects
- **FileWatcherService**: Enhanced XML validation and retry logic
  - Metrics tracking for request/response handling
  - Improved error handling and logging
- **Workflow Configuration**: Integrated workflow UI in WorkspaceLayout
- **Component Styling**: Migrated components to use semantic spacing and theme variables
  - GraphQLVariablesPanel, HeadersPanel, QueryParamsPanel
  - RestAuthPanel, SecurityPanel
  - MonacoSingleLineInput with themed wildcard tags
  - TauriNotificationProvider with themed toast colors
  - WorkspaceLayout with theme-aware logo visibility

### Fixed
- **Request File Cleanup**: FolderProjectStorage now properly deletes orphaned files when requests are renamed
- **TestRunnerService**: Includes settings manager for workflow execution
- **Color Consistency**: All UI components now properly use VS Code theme variables

### Documentation
- Added TLS Fix Guide for .NET WCF connections to APInox Proxy
- Updated AGENTS.md to reflect Tauri as primary platform
- Documented drag-and-drop implementation
- Added request chaining phase 1 completion notes
- Comprehensive Copilot instructions for Tauri development

### Scripts & Diagnostics
- **Certificate Management Scripts**:
  - `bind-proxy-cert.ps1`: Bind APInox certificate to HTTPS port
  - `fix-cert-store.ps1`: Check and fix certificate installation
  - `install-proxy-cert.ps1`: Install certificate to Trusted Root
  - `reset-certificates.ps1`: Complete certificate reset
  - `verify-cert-installation.ps1`: Manual certificate verification
- **Diagnostic Scripts**:
  - `debug-proxy-config.ps1`: Diagnose proxy setup issues
  - `test-cert-https.js`: Test HTTPS server with APInox certificate
  - `test-proxy-tls.js`: Diagnose TLS connection issues for .NET WCF
- **DiagnosticsTab**: Integrated certificate and proxy diagnostics
  - React-based dialog system (replaces native alerts)
  - TLS connection attempt logging

## [0.15.0] - 2026-01-24
### Added
- **Environment Variables & Custom Fields**: Enhanced environment management with flexible custom field support
  - Add unlimited custom fields to any environment (Dev/Test/Prod)
  - Visual editor in Settings → Environments tab
  - Quick environment switcher in toolbar
  - Import/export environments for team sharing
  - Variable resolution with `{{fieldName}}` syntax
  
- **Encrypted Secrets**: Environment variables can now be marked as secret with AES-256-GCM encryption at rest
  - Toggle any custom field between Plain/Secret with lock icon
  - Masked display (••••••••) with show/hide eye icon
  - Automatic encryption in `~/.apinox/secrets.enc`
  - Variable resolution ({{fieldName}}) works transparently with encrypted values
  - Export redacts secrets as `[REDACTED]` for safe version control
  - Import preserves existing secrets (team members add their own locally)
  - Wildcard syntax highlighting for {{variables}} in Monaco editor
  
- **Performance Metrics & Load Testing**: Built-in performance testing capabilities
  - Response time tracking across multiple test runs
  - Load testing with configurable concurrent requests (1-100 users)
  - SLA monitoring with visual threshold indicators
  - Historical comparison charts showing trends
  - Export metrics to CSV/JSON for analysis and CI/CD integration
  - Ramp-up configuration for gradual load increase
  
- **Certificate Management**: Restored ability to open development certificates from the GUI
  - Added OpenCertificate command handler in sidecar router
  - Shield icon in Server UI opens certificate file in system file manager
  - Certificates automatically generated when proxy/mock server starts with HTTPS target

### Fixed
- **macOS**: Performance suites and settings now persist across reinstalls
  - Config directory moved from exe-relative location to stable user directory (`~/Library/Application Support/apinox/` on macOS)
  - Automatic migration from legacy location included
  
- **Request Rename Persistence**: Renamed requests no longer revert to original names after application restart
  - Added cleanup logic in FolderProjectStorage to delete old request files when requests are renamed
  - Orphaned request files (.xml/.json pairs) are now properly removed during save
  - Consistent with existing cleanup patterns for interfaces, operations, test suites, and test cases
  
- **Proxy UI Target URL**: Fixed hardcoded "localhost:8080" display to show actual configured target URL
  - Proxy/watcher status now correctly displays "9000 => {actual target URL}"
  - Status loads from lastProxyTarget setting on component mount
  
- **Performance Test UI**: Performance test request entries now show interaction icons on hover
  - Added trash/delete icon for quick request removal
  - Consistent with other sidebar item patterns (suites, test cases, operations)

## [0.14.0] - 2026-01-22
### Auto-Generated Changes
- feat: Implement WSDL loading cancellation and local XSD resolution - Added CancelWsdlLoadCommand to allow users to cancel ongoing WSDL loading operations. - Enhanced LoadWsdlCommand to support cancellation and local directory resolution for XSD files. - Updated WebviewController to integrate the new cancel command. - Modified the bridge utility to automatically extract local directory paths for WSDL files. - Improved XML generation logic to handle complex types using full schema when available. - Introduced a build number management system with .buildno file for versioning. - Created scripts to fix XSD import paths in WSDL/XSD files for local development.

## [0.13.4] - 2026-01-22
### Auto-Generated Changes
- Refactor code structure for improved readability and maintainability Fixes to WSDL imports

## [0.13.3] - 2026-01-21
### Auto-Generated Changes
- feat: migrate from axios to native fetch API for standalone binary support  - Replaced axios with native Node.js fetch in ProxyService and other services - Updated ProxyService to handle HTTP requests and responses using fetch - Added NativeHttpClient utility for HTTP operations with error handling - Enhanced DebugModal to reflect changes in sidecar diagnostics - Updated WelcomePanel and styles for logo adjustments - Bumped webview version to 0.13.2 - Added comprehensive tests for NativeHttpClient - Documented standalone binary implementation and build process

## [0.13.2] - 2026-01-21
### Auto-Generated Changes
- Mac Fixes

## [0.13.1] - 2026-01-21
### Auto-Generated Changes
- feat: enhance script playground functionality

## [0.13.0] - 2026-01-21
### Auto-Generated Changes
- feat: Major fixes for prod version

## [0.12.0] - 2026-01-19
### Auto-Generated Changes
- feat: add Tauri dialog plugin and enhance settings management - Added @tauri-apps/plugin-dialog dependency for file selection dialogs. - Enhanced MainContent component to support new configDir state. - Updated SettingsEditorModal to auto-save settings on tab changes and close. - Integrated file watcher configuration in IntegrationsTab with file selection capability. - Improved GeneralTab to display settings location and sidecar status. - Added sample requests for SOAP,REST,and GraphQL in the Samples folder. - Updated UI context and message handling to manage new configDir state. - Refactored various components to improve settings handling and user experience.
-----

## [0.11.0] - 2026-01-15
### Fixed
- Tauri application fixes and stability improvements.

## [0.10.0] - 2026-01-15
### Added
- **Tauri App**: Reintroduction of the Tauri-based application.

## [0.9.0] - 2026-01-07
### Added
- **WSDL Management**: New settings webview for WSDL parsing and SOAP operations.

## [0.8.0] - 2026-01-01
### Added
- **Unified Server Tab**: Combined Proxy and Mock into a single Server view with toggle modes (Off, Mock, Proxy, Both).
- **Mock Server**:
    - Return predefined responses without hitting real backend.
    - Mock rules with URL, XPath, and regex matching.
    - Record mode to auto-capture real responses.
    - Latency simulation.
- **Settings Tab Enum**: Refactored settings modal for better navigation.

### Changed
- Removed separate Proxy and Mock tabs from sidebar.
- Settings cog on Server tab now opens directly to Server settings.

## [0.7.6] - 2025-12-31
### Added
- **Status Bar Launch**: "🧪 Dirty SOAP" button for quick access.
- **Manual Save**: New save workflow (Ctrl+S) replacing auto-save on keystroke.
- **Unsaved Warning**: Browser alert when closing with unsaved changes.

## [0.7.0] - 2025-12-29
### Added
- **Replace Rules**:
    - Functionality to apply text replacement rules to XML content in the Proxy Service.
    - UI for creating and managing replace rules in Settings.
- **Context Management**: new Project, Selection, and UI context providers.
- **New Webview UI**: Updated UI for SOAP interaction, deprecating old verification scripts.

## [0.6.0] - 2025-12-24
### Added
- **Proxy Service**:
    - HTTPS proxy support with self-signed certificate generation (`ensureCert`).
    - ConfigSwitcherService to inject proxy URLs into config files.
    - Certificate installation helpers in the UI.

## [0.5.0] - 2025-12-23
### Added
- **File Watcher**: Real-time file watching with history and operation name extraction.
- **Headers Panel**: New UI for managing HTTP headers.

## [0.4.0] - 2025-12-23
### Added
- **Assertions**: UI components and handling for SoapUI assertions.

## [0.3.0] - 2025-12-22
### Added
- **WSDL Parser**: Robust parsing with Axios, including proxy detection and SSL verification fixes.
- **Workspace**: Dirty state tracking and workspace persistence.

## [0.2.0] - 2025-12-19
### Added
- **Wildcard System**: Support for dynamic values in requests (URL, Headers, Body).
    - `{{env}}`: Current environment identifier.
    - `{{url}}`: Current environment's endpoint URL.
    - `{{newguid}}`, `{{uuid}}`: Generate a new UUID.
    - `{{now}}`, `{{epoch}}`: Current timestamp.
    - `{{randomInt(min,max)}}`: Random integer generator.
    - **Data Gen**: `{{lorem}}`, `{{name}}`, `{{country}}`, `{{state}}`.
    - **Date Math**: `{{now+1m}}` (add 1 minute), `{{now-2d}}` (subtract 2 days), etc.
- **Settings Management**:
    - Persistent configuration stored in `~/.APInox/config.jsonc`.
    - UI Settings (layout, line numbers) are now remembered.
    - Autosave functionality for unsaved workspace changes.
- **UI Improvements**:
    - **Environment Selector**: Quickly switch between environments.
    - **Settings Editor**: Direct JSONC editing for advanced configuration.
    - **Enhanced Styling**: Distinct highlighting for environment variables (Blue) vs. dynamic wildcards (Pink).
    - Improved Toolbar alignment and layout.
- **Logging**:
    - Full request path and payload are now logged.

### Fixed
- Re-enabled build minification for better performance.
- Fixed toolbar button alignment issues.
- Addressed various UI glitches in the Monaco Editor.
