# APInox - SOAP & API Testing Tool

A desktop application for SOAP web service testing and API development, inspired by Bruno and SOAP-UI.

**Focus**: SOAP/REST/GraphQL API testing, test automation, and workflow management.  
**Sister Application**: [APIprox](https://github.com/yourusername/apiprox) - HTTP/HTTPS proxy & mock server for traffic interception.

## Features

- **Workspace Management**: Manage multiple projects in a single workspace. Save and load projects locally.
- **WSDL Explorer**: 
    - Load WSDLs from URLs or local files.
    - Explore Services, Bindings, and Operations.
    - Selectively add interfaces to your active projects.
- **Smart Proxy Support**: Automatically detects and uses your System Proxy settings (supports HTTP/HTTPS proxies with Authentication).
- **WCF/Enterprise Ready**:
    - **SSL Bypass**: Automatically handles self-signed certificates purely for WSDL loading and Request execution (useful for internal dev/test environments).
    - **Header Emulation**: Mimics browser headers to bypass strict WAFs.
    - **Detailed Logging**: Network errors are logged with full status and body for debugging.
- **Environment Variables & Secrets**:
    - Visual editor for environments (Dev/Test/Prod).
    - Quick environment switcher in toolbar.
    - **Custom Variables**: Add any custom fields to environments.
    - **Encrypted Secrets**: Mark sensitive fields as secret with AES-256-GCM encryption.
        - Toggle lock icon to encrypt fields at rest (`~/.apinox/secrets.enc`).
        - Masked display (••••••••) with show/hide eye icon.
        - Variable resolution with `{{fieldName}}` works transparently.
        - Export redacts secrets as `[REDACTED]`.
        - Import preserves existing secrets.
    - Import/export environments for team sharing.
- **Request Editor**: 
    - Auto-generates SOAP Envelopes with correct path handling and namespaces.
    - Editable Request Endpoint URL per request.
    - XML Syntax Highlighting.
    - **Wildcard Support**: Use `{{...}}` for dynamic values, date math, or custom JavaScript logic.
- **Response Viewer**:
    - View formatted XML responses.
    - Layout Toggle: Switch between vertical (split up/down) and horizontal (split left/right) views.
- **Performance Metrics & Load Testing**:
    - **Response Time Tracking**: Monitor performance across multiple test runs.
    - **Load Testing**: Execute concurrent requests to test service capacity.
    - **SLA Monitoring**: Visual indicators for response time thresholds.
    - **Historical Comparison**: Charts show trends across test runs.
    - **Export Metrics**: Save results to CSV/JSON for analysis.
- **Request Chaining & Workflows**:
    - **Variable Extraction**: Extract values from responses using XPath (XML), Regex (JSON/HTML/Text), or JSONPath
    - **Regex Extractors**: Use regex patterns with capture groups for JSON, HTML, or plain text responses
    - **Variable Injection**: Reference extracted variables in subsequent requests using `${varName}`
    - **Conditional Steps**: IF/THEN logic to control test flow
    - **Loop Steps**: Repeat operations with iteration counters
    - **Script Steps**: JavaScript for complex logic and data manipulation
    - **Variables Panel**: View all available variables with real-time values
    - **Smart Autocomplete**: Variable suggestions when typing `${` or `{{`
    - **Enhanced Tooltips**: Hover over variables to see source, value, and context
- **Project Structure**: Organize work into Projects -> Interfaces -> Operations -> Requests.
- **Context Actions**: Clone, Delete, and Rename requests easily via context menus.
- **Settings**: Persistent configuration with a built-in JSONC editor and contextual **Help Panel**.
- **Debug & Diagnostics**:
    - **Debug Modal**: Press **Ctrl+Shift+D** to open comprehensive diagnostics.
    - **Backend Logs**: View real-time Tauri/Rust backend logs with auto-refresh.
    - **Frontend Logs**: Captured browser console logs for React/UI debugging.
    - **System Info**: View configuration state and system diagnostics.
    - **Connection Test**: Test frontend-backend communication with latency display.
    - **Debug Indicator**: Optional red square overlay for advanced debugging (hidden by default).
- **Cross-Platform**: 
    - Runs on Windows, macOS, and Linux.
    - Native desktop application built with Tauri.
    - **Ctrl+S** to save all dirty projects.

## Usage

1. **Launch APInox**: Run the application from your desktop.
2. **Load a WSDL**:
    - Use the **WSDL Explorer** section.
    - Select "URL" or "File" input mode.
    - Click `▶` (Load) to parse the WSDL.
3. **Add to Project**:
    - Expand the loaded WSDL in the Explorer.
    - Right-click an Interface -> "Add to Project" (or use the `+` icon in the explorer header to add all).
4. **Create Requests**:
    - In the **Workspace** section, expand your Project and Interface.
    - Right-click an Operation -> "Add Request".
5. **Execute**:
    - Edit the XML body in the editor.
    - (Optionally) Update the Endpoint URL in the toolbar.
    - Click the "Run" button.
6. **Workspace**:
    - Dirty indicator (●) shows unsaved changes.
    - Save button appears on dirty projects/requests.
    - Use **Ctrl+S** to save all dirty projects at once.
    - Use the **Close** (❌) icon to close projects.
7. **Debug & Diagnostics**:
    - Press **Ctrl+Shift+D** to open the debug modal.
    - View backend logs, frontend logs, and system diagnostics.
    - Test connection to backend.
    - Toggle debug indicator visibility if needed.

## APIprox - Sister Application

**Need to intercept and mock HTTP/HTTPS traffic?** Check out [APIprox](https://github.com/yourusername/apiprox)!

**APIprox** is the companion application for network traffic interception, mocking, and manipulation:

- **HTTP/HTTPS Proxy**: Route traffic through APIprox to inspect requests/responses
- **HTTPS Interception**: Decrypt HTTPS with custom CA certificate
- **Mock Server**: Return predefined responses without hitting real servers
- **Replace Rules**: Modify XML/JSON in-flight using XPath or regex
- **Traffic Recording**: Capture and analyze all HTTP traffic
- **Certificate Management**: Easy HTTPS interception setup

**Use Together:** Run APIprox to intercept traffic from APInox or any other application!

See **APIprox** [README](../APIprox/README.md) and [manual](../APIprox/manual.md) for full documentation.

## Reusable Packages

### `apinox-wsdl-parser` — Standalone WSDL Parser

The WSDL/SOAP parsing logic lives in [`packages/wsdl-parser/`](./packages/wsdl-parser/) as a standalone Rust library, separate from the Tauri desktop application. It can be used by any Rust project that needs to understand WSDL files — for example, to build a SOAP mock server — without pulling in Tauri or other desktop-app dependencies.

#### What it does

- Parses WSDL 1.1 XML documents and extracts services, bindings, port types, and operations
- Recursively fetches and resolves remote schema imports (`<xsd:import>`, `<xsd:include>`, `<wsdl:import>`)
- Builds typed XSD schema trees for generating SOAP request envelopes
- Detects SOAP 1.1 and SOAP 1.2 bindings automatically
- Provides all the information a mock server needs: operation names, `SOAPAction` headers, endpoint URLs, and input schemas

#### Adding to your project

```toml
# Cargo.toml
[dependencies]
apinox-wsdl-parser = { path = "../APInox/packages/wsdl-parser" }
```

#### Usage

**Parse a WSDL string:**

```rust
use apinox_wsdl_parser::WsdlParser;

let wsdl_xml = std::fs::read_to_string("service.wsdl")?;
let services = WsdlParser::parse(&wsdl_xml)?;

for service in &services {
    println!("Service: {} (namespace: {:?})", service.name, service.target_namespace);
    for op in &service.operations {
        println!("  Operation  : {}", op.name);
        println!("  SOAP Action: {:?}", op.action);
        println!("  Endpoint   : {:?}", op.original_endpoint);
    }
}
```

**Fetch and parse from a URL with full import resolution:**

```rust
use apinox_wsdl_parser::{WsdlParser, ImportResolver};

let mut resolver = ImportResolver::new()?;
let wsdl_xml = resolver
    .fetch_document("http://example.com/Service.svc?wsdl", None)
    .await?;

// Resolve all schema imports (up to 10 levels deep)
let services = WsdlParser::parse_with_imports(
    "http://example.com/Service.svc?wsdl",
    &wsdl_xml,
    10,
).await?;
```

**Building a mock server from parsed output:**

Each `ServiceOperation` contains the fields a SOAP mock server needs to match and respond to requests:

| Field | Description |
|-------|-------------|
| `op.name` | Operation name |
| `op.action` | `SOAPAction` header value to match incoming requests |
| `op.original_endpoint` | Endpoint URL defined in the WSDL |
| `op.target_namespace` | XML namespace for the SOAP envelope |
| `op.full_schema` | XSD schema tree of the input message (use this to validate or generate responses) |

See [`packages/wsdl-parser/README.md`](./packages/wsdl-parser/README.md) for the full API reference.

## Roadmap & Planned Features

We are constantly working to improve APInox for C# developers. Here is what we are planning next:

- **Git Integration**: Shared workspaces and team synchronization.
- **Azure DevOps**: Link operations to Work Items and attach artifacts directly.
- **Generate C# Code**: Copy your SOAP request as a ready-to-use C# `HttpClient` snippet.
- **WSDL to Proxy**: Integration with `dotnet-svcutil`.

## Security Best Practices

APInox takes security seriously, especially when handling sensitive data like API credentials and tokens.

### Encrypted Secrets
- **Use Secret Fields**: Always mark sensitive data (passwords, API keys, tokens) as "Secret" using the lock icon toggle in environment settings.
- **Encryption at Rest**: Secret fields are encrypted using AES-256-GCM and stored separately in `~/.apinox/secrets.enc`.
- **Never Commit Secrets**: When exporting environments for version control, secrets are automatically redacted as `[REDACTED]`.
- **Team Sharing**: Share environment files safely - team members can import them and add their own secrets locally.

### Certificate Security
- **Development Only**: The proxy's self-signed certificate is for development/testing environments only.
- **Trust Scope**: Only install the APInox certificate in your Trusted Root store for local development machines.
- **Production**: Never use self-signed certificates or bypass SSL verification in production environments.

### Access Control
- **File Permissions**: APInox stores configuration and secrets in your user directory (`~/.apinox/`). Ensure proper OS-level file permissions.
- **Network Isolation**: When using the proxy/mock server, be aware that it listens on localhost and can intercept traffic.

### Best Practices
- **Rotate Credentials**: Regularly update encrypted secrets, especially after team member changes.
- **Audit Logs**: Review application logs (Ctrl+Shift+D) for unexpected requests or errors.
- **Environment Separation**: Use separate environments for Dev/Test/Prod with different credentials.

## Developer Notes

- **Agent Context**: See [AGENTS.md](./AGENTS.md) for architecture overview and setup instructions.
- **Code Analysis**: See [CODE_ANALYSIS.md](./CODE_ANALYSIS.md) for technical debt and simplification recommendations.
- **First-time Tauri setup**: Run `npm run tauri:init` to install root, request-editor, and webview npm dependencies and fetch the Rust workspace crates before running `npm run tauri:dev`.
