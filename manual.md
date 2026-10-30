# APInox Manual

APInox is a desktop app (Tauri + Rust backend, React webview) for working with SOAP web services — WSDL exploration, request building, automated test runs, performance suites, traffic interception, and notes. The app's **Help panel** mirrors most of this; this manual is the long-form version.

## Views

The sidebar rail switches between the main views:

- **Explorer** — projects, interfaces, operations; Quick Requests and History sub-windows.
- **Tests** — test suites, test cases, and the runner.
- **Performance** — performance suites.
- **Traffic** — the proxy server: traffic logging, breakpoints, replace rules.
- **Mock** — mock rules and record mode.
- **Notes** — markdown scratchpad.
- **Settings** — tabbed settings.

## Projects

APInox uses a single implicit workspace: all projects live in `~/.apinox/projects/` and load automatically on startup.

- **New Project** creates an empty project; **Import** accepts `.apinox`, `.json`, and SoapUI 5.x `.xml` workspace/project files.
- Adding interfaces/operations to a project is done from the Explorer (right-click → Add, or the `+` in the explorer header to add all).
- Dirty projects show a `●` indicator; `Ctrl+S` saves (the focused pane first, otherwise every dirty project), and closing a project asks for confirmation before removing its files from disk.

## Loading WSDLs and OpenAPI documents

- Load a WSDL from URL or local file in the Explorer. Remote schema imports (`<xsd:import>`, `<xsd:include>`, `<wsdl:import>`) are fetched and resolved recursively (up to 10 levels).
- OpenAPI documents are imported as first-class projects: operations carry their path template and HTTP method, and the stored response schema is used to validate responses (reported, not enforced).
- The source URL is kept on the project so you can refresh/sync interfaces later.
- A **load via proxy** toggle routes the WSDL fetch through the proxy when you need to capture or modify the fetch itself.

## Request editor

- SOAP envelopes are generated from the parsed XSD schema tree, with correct namespaces and element paths.
- Editable endpoint URL per request; editable headers per request (Content-Type is a header chosen in the **Headers** tab).
- XML syntax highlighting; the response viewer formats XML/JSON.
- WS-Security headers can be configured per request.
- Layout can be vertical or horizontal, and cases/suites have an **Edit as JSON** workspace tab.

## Wildcards and variables

Use `{{...}}` placeholders in request bodies, URLs, and headers.

**Environment and global variables:**
- `{{url}}` and `{{env}}` — shortcut for the active environment's `endpoint_url`.
- `{{myVar}}` — any environment field or global variable (`Settings → Globals`).

**Dynamic values:**
- `{{uuid}}` / `{{newguid}}` — random UUID v4
- `{{now}}` — ISO 8601 timestamp
- `{{epoch}}` — Unix timestamp (seconds)
- `{{randomInt(1,100)}}` — random integer in range
- `{{lorem(5)}}` — N words of lorem ipsum
- `{{name}}`, `{{country}}`, `{{state}}` — random values

**Date math** (ISO 8601 result, units `d`, `m` = month, `y` = year):
- `{{now+1d}}`, `{{now-2m}}`, `{{now+3y}}`

**Test variables** use the `${...}` form (SoapUI-style `${#TestCase#VarName}` also works) and are resolved from values extracted by earlier steps.

Custom JavaScript does not run inside wildcards — use a **script step** in a test case for complex logic.

## Environments and secrets

Manage environments in **Settings → Environments**; switch via the sidebar ENV selector. Each environment has built-in fields (`endpoint_url`, `env`) plus any custom fields you add.

For sensitive values:

1. Add a custom field.
2. Click the **lock icon** to mark it as secret.
3. The value is masked (`••••••••`) with an eye icon to show/hide.
4. Reference it normally: `{{apiKey}}`.

How it works: secrets are encrypted with AES-256-GCM and stored in `~/.apinox/secrets.enc`, resolved automatically before sending, redacted as `[REDACTED]` on export, and preserved for existing fields on import. Each team member keeps their own secrets locally.

## Test cases and suites

- **Test Suite** → **Test Case** → **Test Step**. Create from the Tests sidebar; the **Test Case Wizard** builds a case from a captured request.
- Step types: **request**, **delay**, **condition**, **transfer**, **loop**, **script**, **testCase** (a live reference to another case; nested steps run with their own result rows).
- A step embeds a full copy of its request — editing the case never mutates the source request.
- **Condition** steps are assertions (`equals`, `notEquals`, `contains`, `notContains`, `greaterThan`, `lessThan`, `exists`, `notExists`); a false condition fails the case.
- **Loops**: `count`, `list` (iterate a variable), or `while`, with an iterator variable and a max-iteration safety limit.
- **Assertion types** on request steps: Simple Contains / Not Contains, Response SLA, XPath Match, JSONPath Match, Header Match, SOAP Fault, HTTP Status, Script (JavaScript).
- **Extractors** store values for later steps: XPath, JSONPath, Regex (first capture group; `g` flag returns all matches comma-separated), and Header, with source (`body`/`header`), pattern, variable name, and optional default. Selecting text in the Response viewer and clicking **Extract** does the same.
- The **Variables Panel** shows available variables, their current values, the step that produced each, and extraction status.
- Renaming a variable rewrites every reference to it — step bodies, assertion tokens, and the producing extractor (both `{{name}}` and `${name}` syntaxes).
- **Edit as JSON** is a workspace tab for cases and suites; the entity `id` cannot change.

## Performance suites

Performance suites group requests that are executed repeatedly to measure throughput and latency.

- Suite settings: **Iterations**, **Warmup Runs**, **Concurrency** (default 1 = sequential), and **Delay Between Requests**.
- Steps can be individual requests or whole test cases.
- Every real HTTP call produces its own result row, so percentiles (p50/p95/p99), success rate, and SLA breaches reflect actual calls rather than one number per case. SLA thresholds are set per request (and at case level, checked against the case total).
- Runs stream progress live; the last 50 completed runs stay in history between sessions.

## Traffic, proxy, and mock server

These are built in — the old standalone APIprox app no longer exists; its features live in the **Traffic** and **Mock** views.

**Server modes:** Off / Moxy (mock rules only) / Proxy (logging with breakpoints and replace rules) / Both.

- Point a client at the proxy URL (e.g. `http://localhost:8888`), or use the **System Proxy** toggle to route OS traffic automatically. HTTPS interception requires installing APInox's generated CA certificate — development machines only.
- **Breakpoints** pause traffic for inspection; **replace rules** modify XML/JSON in flight (XPath or regex).
- **Mock rules** answer requests without hitting real servers: match conditions (URL, operation, SOAPAction, header, contains, XPath, template name), response status/body/headers, optional delay. **Record mode** auto-captures real responses as rules; **passthrough** forwards unmatched requests to a target backend.
- Right-click a capture to **Add to** the Explorer operation it matches — by SOAPAction, the first element under `<Body>`, or the OpenAPI path template, with host as tie-breaker.
- Traffic history is shared across Proxy and Mock events.

## Notes

A markdown scratchpad with find (`Ctrl+F`) and replace (`Ctrl+H`) in every view mode. `Ctrl+S` saves the focused pane.

## Settings

Tabbed settings (General, Environments, Globals, Integrations, Updates, About) with a raw JSON editor. Persisted as `~/.apinox/config.jsonc` — comments are lost when the UI rewrites the file.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Ctrl`/`Cmd + S` | Save the focused pane; otherwise all dirty projects |
| `Ctrl + Shift + D` | Debug modal — backend logs, frontend logs, system info, connection test |
| `Ctrl + F` / `Ctrl + H` | Find / replace in editors with search support |

## Files and folders

| Path | Contents |
|------|----------|
| `~/.apinox/projects/` | Project storage (interfaces, operations, requests) |
| `~/.apinox/config.jsonc` | Settings |
| `~/.apinox/secrets.enc` | Encrypted secret fields |

## Troubleshooting

- The **Debug modal** (`Ctrl+Shift+D`) shows real-time backend and frontend logs and a connection test.
- WSDL-loading and TLS issues on internal servers: [docs/WCF_DEBUGGING.md](./docs/WCF_DEBUGGING.md), [docs/TLS_FIX_GUIDE.md](./docs/TLS_FIX_GUIDE.md). CA certificate trust problems: [docs/CERT_INSTALL_TROUBLESHOOTING.md](./docs/CERT_INSTALL_TROUBLESHOOTING.md).
- New to SOAP/WSDL? [learning/](./learning/) is a self-contained HTML course.
