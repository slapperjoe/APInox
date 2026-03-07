import { MonitorPlay, Eye, FileJson, Network, Radio, Layout, FlaskConical, Activity, Compass, FolderOpen, Settings, Cloud, Clock, ListChecks, Braces } from 'lucide-react';

const normalizeContent = (text: string) => {
    const trimmed = text.replace(/^\n/, '').replace(/\n\s*$/, '');
    const lines = trimmed.split('\n');
    const indents = lines
        .filter(line => line.trim().length > 0)
        .map(line => (line.match(/^\s*/) || [''])[0].length);
    const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
    return lines.map(line => line.slice(minIndent)).join('\n');
};

const HELP_SECTIONS_RAW = [
    {
        id: 'core',
        label: 'Core',
        icon: Layout,
        order: 1,
        content: `
    # Core

    APInox supports SOAP, REST, and GraphQL. Load an API definition in the Explorer, add items to a project, then build and run requests in the editor.
    `,
        children: [
            {
                id: 'wsdl-editor',
                label: 'Request Editor',
                icon: FileJson,
                order: 1,
                content: `
    # Request Editor

    The Request Editor is where you build and execute requests and inspect responses. It adapts based on the request type.

    ## Tabs

    - **Body**: The main request body editor. Adapts per request type:
      - *SOAP*: XML editor with formatting tools.
      - *REST (JSON/XML/text)*: Monaco editor with syntax highlighting.
      - *REST (None)*: Shows "No request body" — GET/DELETE/HEAD auto-switch here.
      - *GraphQL*: Split layout — query editor (left, 67%) + Variables panel (right, 33%).
    - **Params**: Key-value editor for URL query parameters. Auto-populated from OpenAPI definitions. GET/DELETE/HEAD requests open this tab by default. Shows a count badge when params are present.
    - **Headers**: View/edit request headers. Shows a count badge when headers are set.
    - **Assertions**: Add automated checks to validate responses.
    - **Extractors**: Extract values from responses into variables.
    - **WS-Security**: Configure WS-Security credentials for SOAP requests.

    ## GraphQL Body Tab

    The GraphQL body tab shows a split pane:
    - **Left (67%)**: Monaco editor in GraphQL syntax mode — write clean query syntax directly.
    - **Right (33%)**: Variables panel — key-value pairs for \`$variable\` substitutions.

    At send time, APInox automatically wraps the query as \`{"query":"...","variables":{...},"operationName":"..."}\`. The \`operationName\` is extracted from the query text. If you prefer to write the full JSON payload manually, that works too — any body starting with \`{\` is sent as-is.

    ## Toolbar Actions (SOAP)

    - **Run / Cancel**: Execute or stop the current request.
    - **Reset**: Restore the default XML template.
    - **Format XML**: Reformat the current XML.
    - **Toggle Attribute Alignment**: Align attributes vertically.
    - **Toggle Inline Values**: Compact simple element values onto one line.
    - **Code**: Generate a code snippet for the request.

    ## Variables & Environments

    Use \`{{variable}}\` syntax in the body or headers. Switch environments from the sidebar ENV selector. Manage environments in **Settings → Environments**.

    ## User Scripts

    Place custom scripts in \`~/.apinox/scripts\` and export functions. Use them as \`{{functionName}}\`.
    `
            },
            {
                id: 'workspace',
                label: 'Workspace',
                icon: Layout,
                order: 2,
                content: `
    # Workspace & Projects

    APInox organizes your work into a structured hierarchy.

    ## Structure

    - **Project**: Top-level container, stored as a folder on disk (git-friendly).
    - **Interface**: A service/API definition — SOAP port, REST tag group, or GraphQL Query/Mutation.
    - **Operation**: A single endpoint or action within an interface.
    - **Request**: A saved, editable instance of an operation.

    ## Request Types

    | Type | Interface Source | Body |
    |------|-----------------|------|
    | **SOAP** | WSDL | XML |
    | **REST** | OpenAPI JSON/YAML | JSON / XML / form-data / binary / none |
    | **GraphQL** | GraphQL endpoint introspection | GraphQL query + variables |

    ## Context Actions

    Right-click items in the sidebar to clone, rename, delete, or add requests.
    `
            },
            {
                id: 'interface',
                label: 'Interfaces',
                icon: Layout,
                order: 3,
                content: `
    # Interfaces

    An **Interface** groups related operations. Its type depends on the source API.

    ## SOAP Interfaces

    - Shows a **1.1** or **1.2** badge next to the name indicating the SOAP version.
    - Displays WSDL URL, binding name, and endpoint.

    ## REST Interfaces

    - Grouped by OpenAPI tag (one interface per tag).
    - Each operation has a method badge (GET, POST, PUT, etc.).
    - Query parameters are pre-populated from the OpenAPI definition.

    ## GraphQL Interfaces

    - One **Query** interface and one **Mutation** interface per endpoint.
    - Each field from the schema becomes an operation with a starter query.
    `
            },
            {
                id: 'operation',
                label: 'Operations',
                icon: Layout,
                order: 4,
                content: `
    # Operations

    An **Operation** is a single action or endpoint. Each operation can have multiple saved requests. Use context menu actions in the sidebar to clone, rename, or delete requests.

    For REST operations, the HTTP method is shown inline. For SOAP, the SOAP action is used. For GraphQL, each schema field is its own operation.
    `
            }
        ]
    },
    {
        id: 'explorer',
        label: 'Explorer',
        icon: Compass,
        order: 2,
        content: `
    # API Explorer

    Load any API definition — SOAP WSDL, OpenAPI (REST), or a GraphQL endpoint — and browse its operations before importing into a project.
    `,
        children: [
            {
                id: 'api-explorer',
                label: 'Loading APIs',
                icon: Compass,
                order: 1,
                content: `
    # API Explorer — Loading APIs

    The Explorer detects the API type automatically based on the URL or file.

    ## Supported Formats

    | Format | Detection | Notes |
    |--------|-----------|-------|
    | **SOAP WSDL** | \`.wsdl\`, \`.xml\`, or any other URL | Parsed via WSDL parser |
    | **OpenAPI JSON** | URL ends in \`.json\` | Swagger 2.0 and OAS3 |
    | **OpenAPI YAML** | URL ends in \`.yaml\` or \`.yml\` | Swagger 2.0 and OAS3 |
    | **GraphQL** | URL path contains \`graphql\` or \`gql\` | Introspection query sent automatically |

    ## Loading Methods

    - **URL**: Paste a URL and click **Load API**.
    - **File**: Click the import zone or drag and drop a file (WSDL, JSON, YAML) onto it.

    ## Sample APIs

    Click any sample card to pre-fill the URL:

    | Sample | Type |
    |--------|------|
    | Swagger Petstore | OpenAPI 2.0 (JSON) |
    | Petstore YAML | OpenAPI 2.0 (YAML) |
    | Country Info | SOAP WSDL |
    | Calculator | SOAP WSDL |
    | SpaceX | GraphQL |
    | Rick & Morty | GraphQL |

    ## GraphQL Introspection

    For GraphQL URLs, APInox sends an introspection query and builds a **Query** interface and a **Mutation** interface from the schema. Each field becomes an operation with a starter query body (using \`__typename\` for object types).

    ## After Loading

    - Browse interfaces and operations in the Explorer sidebar.
    - Click **Add to Project** on an operation to save it.
    - Click **Add All** to import everything.
    - Click **Clear** to reset the Explorer.
    `
            },
            {
                id: 'explorer-rest',
                label: 'REST (OpenAPI)',
                icon: Braces,
                order: 2,
                content: `
    # REST — OpenAPI Explorer

    When loading an OpenAPI (Swagger) definition, APInox:

    1. Groups paths by their first **tag** — each tag becomes an Interface.
    2. Generates a **Sample** request for each path with:
       - The correct HTTP method (GET, POST, PUT, PATCH, DELETE, etc.)
       - Query parameters pre-populated (empty values, edit in the Params tab).
       - A sample JSON body for POST/PUT/PATCH (generated from the schema).
       - GET/DELETE/HEAD requests open the **Params** tab by default (no body).

    ## Executing REST Requests

    - URL query parameters are appended automatically from the Params tab.
    - Body is sent as-is for POST/PUT/PATCH.
    - The result appears in the Response panel with status code and timing.
    `
            },
            {
                id: 'explorer-graphql',
                label: 'GraphQL',
                icon: Network,
                order: 3,
                content: `
    # GraphQL Explorer

    Paste any GraphQL endpoint URL (containing \`/graphql\` or \`/gql\`) and click **Load API**.

    APInox sends an introspection query to discover the schema, then builds:

    - A **Query** interface with one operation per query field.
    - A **Mutation** interface with one operation per mutation field (if mutations exist).

    ## Starter Queries

    Each generated sample query uses this pattern:

    \`\`\`graphql
    query {
      fieldName {
        __typename
      }
    }
    \`\`\`

    Object/interface/union return types get \`{ __typename }\` as a minimal valid subfield selection. Scalar and enum return types are queried directly.

    ## Writing Queries

    Edit the query in the **Body** tab (left pane). Add variable values in the **Variables** panel (right pane). Variables use the GraphQL \`$name: Type\` syntax in the query definition.

    At send time, APInox builds the HTTP payload:
    \`\`\`json
    {
      "query": "...",
      "variables": { "name": "value" },
      "operationName": "OperationName"
    }
    \`\`\`
    `
            }
        ]
    },
    {
        id: 'testing',
        label: 'Testing',
        icon: FlaskConical,
        order: 3,
        content: `
    # Testing

    Build automated tests with suites, cases, assertions, and performance runs.
    `,
        children: [
            {
                id: 'test-suite',
                label: 'Test Suites',
                icon: FlaskConical,
                order: 1,
                content: `
    # Test Suites

    A **Test Suite** groups automated tests for a service or feature.

    ## Suite Actions

    - **Create**: Click the **+** icon in the Tests sidebar header.
    - **Run**: Click the **Play** icon on a suite row to run all cases.
    - **Delete**: Click the trash icon to remove a suite.

    ## Test Cases

    Suites contain **Test Cases** with ordered steps. Add cases from the suite row, then add steps inside each case.
    `
            },
            {
                id: 'tests-assertions',
                label: 'Assertions',
                icon: ListChecks,
                order: 2,
                content: `
    # Tests & Assertions

    APInox includes a test runner for automated validation.

    ## Hierarchy

    - **Test Suite**: Container for related test cases.
    - **Test Case**: A scenario composed of ordered steps.
    - **Test Step**: Typically a request step, but can include other step types.

    ## Creating Tests

    1. Create a suite from the Tests sidebar.
    2. Add cases to the suite.
    3. Add steps using the add button inside a case.

    ## Assertions

    Assertions validate response content and status.

    ### Adding Assertions

    1. Run a request step.
    2. Open the **Assertions** tab.
    3. Use the **Add Assertion** dropdown to select a type.

    ### Assertion Types

    - **Simple Contains** / **Simple Not Contains**
    - **Response SLA**
    - **XPath Match**
    - **SOAP Fault**
    - **HTTP Status**
    - **Script (JavaScript)**

    ### Smart Assertions

    Select text in the Response viewer, then use **Match** or **Exists** in the response toolbar to create assertions.

    ## Variables & Extractors

    Select text in the Response viewer and click **Extract** to save it as a variable. Use \`{{variableName}}\` in the body or headers.
    `
            },
            {
                id: 'performance-suite',
                label: 'Performance',
                icon: Activity,
                order: 3,
                content: `
    # Performance Suites

    Performance suites run a sequence of requests repeatedly to measure latency and reliability.

    ## Create & Run

    1. Add a suite from the Performance sidebar.
    2. Add requests to the suite.
    3. Click **Run Suite** to execute.

    ## Configuration

    - **Delay (ms)**: Pause between requests in sequence.
    - **Iterations**: How many times to run the full request list.
    - **Concurrency**: Parallelism (1 = sequential).
    - **Warmup Runs**: Runs excluded from stats.

    ## Results

    - Summary stats (avg, p50/p95/p99, success rate).
    - Run history with per-run details.
    - Export results to CSV.
    `
            }
        ]
    },
    {
        id: 'server-group',
        label: 'Server',
        icon: Network,
        order: 4,
        content: `
    # Server

    The unified Server tab combines proxy and mock features in one view.
    `,
        children: [
            {
                id: 'server',
                label: 'Unified Server',
                icon: Network,
                order: 1,
                content: `
    # Unified Server

    The **Server** tab combines Proxy and Mock in one place.

    ## Modes

    | Mode | Description |
    |------|-------------|
    | **Off** | Server stopped |
    | **Moxy** | Mock responses from rules |
    | **Proxy** | Traffic logging with breakpoints + replace rules |
    | **Both** | Mock + Proxy combined |

    ## Using the Server Tab

    1. Choose a mode.
    2. Click **Play** to start or **Square** to stop.
    3. Traffic history shows combined Proxy + Mock events.

    ## Controls

    - **Gear** opens Server settings.
    - **Trash** clears traffic history.
    - **Plus** adds a rule or breakpoint.
    `
            },
            {
                id: 'proxy',
                label: 'APInox Proxy',
                icon: MonitorPlay,
                order: 2,
                content: `
    # APInox Proxy

    The proxy intercepts HTTP/S traffic for inspection and modification.

    ## Getting Started

    1. Configure **Port** and **Target URL** in **Settings → Server**.
    2. Select **Proxy** or **Both** and click **Play**.
    3. Point your client at the proxy URL (e.g., \`http://localhost:9000\`).
    4. Inspect events in **Traffic**.

    ## Breakpoints

    Breakpoints pause requests/responses so you can edit them live.

    ## Replace Rules

    Replace Rules apply automatic replacements in-flight (XPath-scoped, regex or plain text). Configure in **Settings → Replace Rules**.

    ## HTTPS Support

    The proxy generates a local certificate for HTTPS traffic. Trust it in your client if needed.
    `
            },
            {
                id: 'mock-server',
                label: 'APInox Mock',
                icon: Radio,
                order: 3,
                content: `
    # APInox Mock

    The mock server returns predefined responses without hitting a real backend.

    ## Getting Started

    1. Select **Moxy** or **Both** mode in the Server tab.
    2. Add mock rules.
    3. Start the server.

    ## Mock Rules

    Rules match requests and return canned responses. Supported match conditions:

    - URL Path, SOAPAction, Operation Name, Body Contains, XPath, Header.

    Response configuration includes status code, body, headers, and optional delay.

    ## Record Mode & Passthrough

    - **Record Mode** captures real responses as rules automatically.
    - **Forward unmatched requests** sends misses to the target server.
    `
            }
        ]
    },
    {
        id: 'tools',
        label: 'Tools & Logs',
        icon: Clock,
        order: 5,
        content: `
    # Tools & Logs

    Utility views for monitoring traffic and reviewing request history.
    `,
        children: [
            {
                id: 'file-watcher',
                label: 'File Watcher',
                icon: Eye,
                order: 1,
                content: `
    # File Watcher

    The File Watcher monitors request/response files written by external tools.

    ## Setup

    1. Configure file paths in **Settings → JSON (Advanced)** under \`fileWatcher.requestPath\` and \`fileWatcher.responsePath\`.
    2. Click **Start Watcher** in the sidebar.

    ## Functionality

    - Real-time updates as files change.
    - Smart naming from the SOAP body root element.
    - Read-only view — inspect but not edit.
    - Export history to CSV.
    `
            },
            {
                id: 'history',
                label: 'History',
                icon: Clock,
                order: 2,
                content: `
    # Request History

    History stores recent manual executions (SOAP, REST, and GraphQL) so you can replay or inspect them.

    ## Actions

    - **Search** to filter entries.
    - **Star** important requests.
    - **Replay** to load a request/response into the editor.
    - **Delete** to remove entries.
    `
            }
        ]
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        order: 6,
        content: `
    # Settings

    The Settings modal provides UI preferences, environments, replace rules, and integrations.
    `,
        children: [
            {
                id: 'settings-general',
                label: 'General',
                icon: Settings,
                order: 1,
                content: `
    # Settings → General

    Control UI behavior such as layout mode, line numbers, attribute alignment, and auto-folding.
    `
            },
            {
                id: 'settings-environments',
                label: 'Environments',
                icon: Compass,
                order: 2,
                content: `
    # Settings → Environments

    Manage environment profiles used in \`{{variable}}\` substitution.

    - Set **Endpoint URL**, **Short Code**, and **Color**.
    - Each environment has a saved **Color** — shown in the sidebar ENV selector and tabs. Colors are persisted and do not change between restarts.
    - Mark a profile as **Active**.
    - Import/export environments as JSON.
    `
            },
            {
                id: 'settings-globals',
                label: 'Globals',
                icon: Cloud,
                order: 3,
                content: `
    # Settings → Globals

    Define global variables available to all requests via \`{{variable}}\`.
    `
            },
            {
                id: 'settings-replace-rules',
                label: 'Replace Rules',
                icon: ListChecks,
                order: 4,
                content: `
    # Settings → Replace Rules

    Configure automatic replacements in proxy traffic.

    - Target request, response, or both.
    - XPath-scoped replacements for specific elements.
    - Regex or plain-text matching.
    `
            },
            {
                id: 'settings-server',
                label: 'Server',
                icon: Network,
                order: 5,
                content: `
    # Settings → Server

    Configure server port, target URL, and mock options like passthrough and record mode.
    `
            },
            {
                id: 'settings-json',
                label: 'JSON (Advanced)',
                icon: FileJson,
                order: 6,
                content: `
    # Settings → JSON (Advanced)

    Edit the raw JSONC config directly. Useful for advanced tweaks and file watcher paths.
    `
            },
            {
                id: 'settings-fonts',
                label: 'Editor Fonts',
                icon: FileJson,
                order: 7,
                content: `
    # Editor Fonts

    APInox supports various monospace fonts for the code editor. Only fonts installed on your system appear in the font selector.

    ## Recommended Fonts

    - **Fira Code** - [Download](https://github.com/tonsky/FiraCode/releases)
    - **JetBrains Mono** - [Download](https://www.jetbrains.com/lp/mono/)
    - **Cascadia Code** - [Download](https://github.com/microsoft/cascadia-code/releases)

    ## System Fonts

    - **Consolas** (Windows) · **Monaco** / **Menlo** (macOS) · **Courier New** (cross-platform)

    After installing a font, restart APInox — it will appear in the font selector automatically.
    `
            }
        ]
    },
    {
        id: 'integrations',
        label: 'Integrations',
        icon: Cloud,
        order: 7,
        content: `
    # Integrations

    Connect external services such as Azure DevOps.
    `,
        children: [
            {
                id: 'integrations-azure-devops',
                label: 'Azure DevOps',
                icon: Cloud,
                order: 1,
                content: `
    # Azure DevOps

    Configure org URL, store a PAT, and select a project in **Settings → Integrations**.

    When configured, use the **Add to Azure DevOps** action in the request toolbar to post request/response data to a work item.
    `
            }
        ]
    }
];

const normalizeSection = (section: any) => ({
    ...section,
    content: normalizeContent(section.content),
    children: section.children
        ? [...section.children]
            .sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999))
            .map(normalizeSection)
        : undefined
});

export const HELP_SECTIONS = [...HELP_SECTIONS_RAW]
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map(normalizeSection);

