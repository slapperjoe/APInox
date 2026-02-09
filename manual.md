# APInox Manual

## Overview
APInox is a VS Code extension for interacting with SOAP web services properly. It allows you to load WSDLs, explore operations, structure requests, and manage environments with ease.

## Features

### 1. WSDL Explorer
- Load WSDLs from a URL or local file system.
- Browse interfaces and operations in a tree view.
- Click "Add to Project" to organize relevant operations.

### 2. Request Editor
- Write raw XML requests with syntax highlighting (Monaco Editor).
- Use **Wildcards** to inject dynamic values.

### 3. Wildcards
Use the following placeholders in your XML body or URL:

**Environment & Global Variables:**
- `{{env}}`: The identifier of the currently active environment (e.g., `bld02`).
- `{{url}}`: The configured Endpoint URL for the active environment.
- `{{myVar}}`: Access any global variable defined in `settings > globals`.

**Dynamic Values:**
- `{{newguid}}` / `{{uuid}}`: Generates a random UUID v4.
- `{{now}}`: ISO 8601 Timestamp.
- `{{epoch}}`: Unix timestamp (seconds).
- `{{randomInt(1,100)}}`: Random integer between 1 and 100.

**Date Math:**
- `{{now+1h}}`: Current time plus 1 hour.
- `{{now-2d}}`: Current time minus 2 days.
- Supports `m` (minutes), `h` (hours), `d` (days), `y` (years).

**Data Generation:**
- `{{lorem(5)}}`: Generates 5 words of Lorem Ipsum.
- `{{name}}`: Random Full Name.
- `{{country}}`: Random Country.
- `{{state}}`: Random State/Province.

**User JavaScript:**
You can write custom JavaScript within wildcards for complex logic.
- `{{const d = new Date(); return d.toISOString();}}`
- `{{return Math.random() > 0.5 ? 'ValueA' : 'ValueB';}}`
*Note: This runs in a sandboxed environment.*

### 4. Environments & Variables

#### Managing Environments
Manage your environments in **Settings → Environments** tab. Each environment can have both built-in and custom variables.

**Built-in Variables:**
- `endpoint_url`: The base URL for API requests
- `env`: Environment identifier

**Custom Variables:**
Add any custom fields you need:
```jsonc
{
  "activeEnvironment": "Build",
  "environments": {
    "Build": {
      "endpoint_url": "http://bld.acme.com",
      "env": "bld01",
      "apiKey": "my-dev-key",
      "customerId": "12345"
    },
    "Prod": {
      "endpoint_url": "https://api.acme.com",
      "env": "prod",
      "apiKey": "my-prod-key",
      "customerId": "67890"
    }
  }
}
```

Access custom variables in requests using: `{{apiKey}}` or `{{customerId}}`

#### Encrypted Secrets
For sensitive data like passwords, API keys, or tokens:

1. **Add a Custom Field**: In Settings → Environments, click "Add Custom Field"
2. **Toggle to Secret**: Click the lock icon to mark the field as secret
3. **Enter Value**: The value will be masked as `••••••••`
4. **Show/Hide**: Use the eye icon to temporarily view the value
5. **Use in Requests**: Reference it like any variable: `{{mySecret}}`

**How It Works:**
- Secrets are encrypted with AES-256-GCM
- Stored separately in `~/.apinox/secrets.enc`
- Variable resolution happens automatically before sending requests
- Exports redact secrets as `[REDACTED]`
- Imports preserve your existing secrets

**Example:**
```xml
<soapenv:Envelope>
  <soapenv:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>admin</wsse:Username>
        <wsse:Password>{{password}}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <api:Request>
      <api:ApiKey>{{apiKey}}</api:ApiKey>
    </api:Request>
  </soapenv:Body>
</soapenv:Envelope>
```

### 5. Performance Testing

APInox includes built-in performance testing and load testing capabilities.

#### Response Time Tracking
Every request automatically tracks response time. View historical data in the Performance tab.

#### Load Testing
Test your service under load:

1. **Open Performance Tab**: Click the graph icon in the sidebar
2. **Configure Test**:
   - **Concurrent Users**: Number of simultaneous requests (1-100)
   - **Duration**: How long to run the test
   - **Ramp-Up**: Gradually increase load over time
3. **Set SLA Thresholds**: Define acceptable response times (e.g., 500ms)
4. **Run Test**: Click "Start Load Test"
5. **View Results**: Real-time charts show:
   - Response times (min/avg/max)
   - Requests per second
   - Error rate
   - SLA compliance

#### Export Metrics
Export test results for analysis:
- **CSV**: Import into Excel or analysis tools
- **JSON**: Integrate with CI/CD pipelines or custom reporting

#### Use Cases
- **Capacity Planning**: Determine max concurrent users
- **Regression Testing**: Compare performance across versions
- **SLA Validation**: Ensure response times meet requirements
- **Stress Testing**: Find breaking points

### 6. Mock Server

Return predefined responses without hitting real backends - perfect for frontend development or offline testing.

#### Creating Mock Rules

1. **Enable Mock Mode**: Server tab → Toggle to "Mock" or "Both"
2. **Add Mock Rule**: Click "+ Add Rule"
3. **Configure Matching**:
   - **URL Pattern**: Match by request path (e.g., `/api/getUser`)
   - **XPath**: Match XML content (e.g., `//customerId[text()="12345"]`)
   - **Regex**: Advanced pattern matching
4. **Define Response**:
   - **Status Code**: 200, 404, 500, etc.
   - **Response Body**: XML or JSON content
   - **Latency**: Add artificial delay (ms)
5. **Enable Rule**: Toggle the checkbox

#### Record Mode
Auto-capture real responses as mock rules:

1. **Enable Record Mode**: Toggle in Mock Server settings
2. **Execute Real Requests**: Run requests normally
3. **Responses Auto-Saved**: Each unique request creates a mock rule
4. **Edit Rules**: Modify captured responses as needed
5. **Disable Record**: Switch to playback mode

#### Passthrough Mode
Forward unmatched requests to real backend:
- **Enabled**: Only matched requests return mocks, others are proxied
- **Disabled**: All unmatched requests return 404

#### Example Mock Rule
```jsonc
{
  "id": "user-success",
  "name": "GetUser Success Response",
  "enabled": true,
  "conditions": [
    {
      "type": "url",
      "pattern": "/api/getUser",
      "isRegex": false
    },
    {
      "type": "xpath",
      "pattern": "//userId[text()='12345']"
    }
  ],
  "statusCode": 200,
  "responseBody": "<response><user>John Doe</user></response>",
  "delayMs": 100
}
```

#### Use Cases
- **Frontend Development**: Work without backend dependencies
- **Offline Testing**: Test without network access
- **Error Scenarios**: Simulate timeouts, errors, edge cases
- **Latency Testing**: Add delays to test slow connections

### 8. Request Chaining & Workflows

APInox supports powerful request chaining for complex test scenarios where one request depends on data from previous requests.

#### Variable Syntax Overview

**Two types of variables with distinct syntaxes:**
- `{{variableName}}` - Environment/global variables and dynamic functions
- `${variableName}` - Workflow variables (extracted from previous test steps)

**Important:** Each syntax has its specific purpose:
- Use `{{...}}` for environment config, global variables, and wildcards (uuid, now, etc.)
- Use `${...}}` exclusively for workflow variables extracted during test execution
- Mixing syntaxes helps distinguish between static configuration and dynamic test data

#### Extracting Variables from Responses

Extract values from responses using various extraction methods based on your response format.

##### Extraction Types

**1. XPath (XML/SOAP Responses)**

Best for XML and SOAP responses. Uses XPath expressions to navigate the XML tree.

1. **Add a Request Step**: Create a test case with multiple steps
2. **Configure Extractors**: In the request configuration, add extractors:
   - **Type**: XPath
   - **Variable Name**: The name to store the extracted value (e.g., `userId`)
   - **Source**: Where to extract from (e.g., `body`, `header`)
   - **XPath Expression**: Path to the value (e.g., `//user/id/text()`)
   - **Default Value**: Fallback if extraction fails (optional)

**Example Extractor Configuration:**
```json
{
  "type": "XPath",
  "variable": "authToken",
  "source": "body",
  "path": "//AuthResponse/Token/text()",
  "defaultValue": ""
}
```

**2. Regex (JSON, HTML, or Plain Text Responses)**

Use regular expressions to extract values from any text-based response. Particularly useful for:
- JSON responses without JSONPath support
- HTML responses
- Plain text responses
- Custom or proprietary formats

**Regex Tips:**
- Use **capture groups** `(...)` to extract specific values
- The **first capture group** becomes the extracted value
- If no capture group, the entire match is extracted
- Add the `g` flag to extract all matches (returns comma-separated)

**Common Regex Patterns:**
```javascript
// Extract JSON field value
"token":"([^"]+)"           // Captures: "abc123"

// Extract email address
\b[\w.-]+@[\w.-]+\.\w{2,}\b // Captures: user@example.com

// Extract number
\b\d+\b                     // Captures: 12345

// Extract decimal/price
\d+\.\d+                    // Captures: 99.95

// Extract URL
https?://[^\s]+            // Captures: https://api.example.com

// Extract HTML tag content
<title>([^<]+)</title>     // Captures content between tags

// Extract between markers
id=(\d+)                   // Captures: 12345 from "id=12345"

// Extract UUID
[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}
```

**Example - Extract JWT Token from JSON:**
```json
{
  "type": "Regex",
  "variable": "jwtToken",
  "source": "body",
  "path": "\"access_token\":\"([^\"]+)\"",
  "defaultValue": ""
}
```

**Response:**
```json
{
  "status": "success",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}
```
**Extracted Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**Example - Extract User ID from HTML:**
```json
{
  "type": "Regex",
  "variable": "userId",
  "source": "body",
  "path": "<span class=\"user-id\">([0-9]+)</span>",
  "defaultValue": ""
}
```

**Response:**
```html
<div class="user-info">
  <span class="user-id">12345</span>
  <span class="username">john.doe</span>
</div>
```
**Extracted Value:** `12345`

**Example - Extract Error Code from Plain Text:**
```json
{
  "type": "Regex",
  "variable": "errorCode",
  "source": "body",
  "path": "ERROR: ([A-Z0-9]+)",
  "defaultValue": "UNKNOWN"
}
```

**Response:**
```
Service returned ERROR: AUTH401 - Invalid credentials
```
**Extracted Value:** `AUTH401`

**3. JSONPath (Coming Soon)**

For native JSON response parsing with JSONPath expressions like `$.data.user.id`.

**4. Header Extraction (Coming Soon)**

Extract values directly from HTTP response headers like `Authorization`, `Set-Cookie`, etc.

#### Using Extracted Variables

In subsequent steps, reference extracted variables with `${variableName}`:

**Example - Login then Query:**

**Step 1: Login Request**
```xml
<soap:Envelope>
  <soap:Body>
    <Login>
      <Username>{{username}}</Username>
      <Password>{{password}}</Password>
    </Login>
  </soap:Body>
</soap:Envelope>
```
**Extractor:** Extract `authToken` from `//LoginResponse/Token/text()`

**Step 2: Query Request (uses extracted token)**
```xml
<soap:Envelope>
  <soap:Header>
    <AuthToken>${authToken}</AuthToken>  <!-- Workflow variable syntax -->
  </soap:Header>
  <soap:Body>
    <GetUserData>
      <UserId>12345</UserId>
      <RequestId>{{uuid}}</RequestId>  <!-- Dynamic function syntax -->
    </GetUserData>
  </soap:Body>
</soap:Envelope>
```

**Syntax Comparison:**
- `${authToken}` - Workflow variable (extracted from Step 1)
- `{{uuid}}` - Dynamic function (generates new UUID each request)

#### Conditional Execution

Add conditional steps to control test flow:

**Condition Types:**
- **Equals**: `${status}` equals `success`
- **Contains**: Response contains specific text
- **Greater Than**: Numeric comparisons
- **Less Than**: Numeric comparisons

**Example:**
```
IF ${statusCode} equals "200"
  THEN run next step
  ELSE skip to step 5
```

#### Loop Steps

Repeat operations multiple times:

**Loop Configuration:**
- **Iterations**: Number of times to repeat
- **Loop Variable**: Counter variable name (e.g., `i`)
- **Steps to Loop**: Which steps to repeat

**Example - Create 5 Users:**
```xml
<CreateUser>
  <Username>user_${i}</Username>
  <Email>user${i}@example.com</Email>
  <ID>{{uuid}}</ID>
</CreateUser>
```

#### Variables Panel

The **Variables Panel** (bottom-right during test editing) shows:
- All available variables from prior steps
- Current values (after test execution)
- Source step that extracted each variable
- Extraction status (pending, extracted, failed)

**Features:**
- ✅ Click to copy variable syntax (`${varName}`)
- ✅ Hover over variables in editor to see values
- ✅ Autocomplete when typing `${`

#### Script Steps

For complex logic, add JavaScript steps:

```javascript
// Access extracted variables
const token = context['authToken'];
const userId = context['userId'];

// Perform calculations
const timestamp = Date.now();

// Store new variables
context['requestId'] = `${userId}_${timestamp}`;

// Conditional logic
if (!token) {
  fail('Authentication token is missing!');
}

log(`Processing user ${userId} at ${timestamp}`);
```

**Available Script API:**
- `context` - Object containing all extracted variables
- `log(message)` - Log to test output
- `fail(reason)` - Fail the test with a message

#### Best Practices

1. **Name Variables Clearly**: Use descriptive names like `authToken`, not `t1`
2. **Use Default Values**: Provide fallbacks for extractors to prevent test failures
3. **Validate Extractions**: Add assertions to verify variables were extracted
4. **Keep Steps Focused**: One responsibility per step
5. **Document Workflows**: Use meaningful step names

#### Example: Complete Workflow

**Test Case: User Registration and Verification**

**Step 1:** Register New User
- Extract `userId` from response

**Step 2:** Send Verification Email
- Use `${userId}` in request
- Extract `verificationCode`

**Step 3:** Verify Email
- Use `${userId}` and `${verificationCode}`
- Extract `sessionToken`

**Step 4:** Get User Profile
- Use `${sessionToken}` for authentication
- Assert: Username matches expected value

**Step 5:** Cleanup (Delete User)
- Use `${userId}` to delete test data

### 9. Settings
- **Autosave**: Your workspace state is automatically saved to `~/.apinox/autosave.xml` to prevent data loss.
- **Layout**: 
    - Switch between Vertical and Horizontal layouts.
    - **Auto-Expand**: The Request panel automatically fills the screen if there is no Response visible.
- **Help Panel**: The Settings Editor includes a panel at the bottom that explains each configuration option as you type.
- **Proxy**: Configure network proxy settings in `config.jsonc`.

## Security Best Practices

### Encrypted Secrets
- **Always encrypt sensitive data**: Passwords, API keys, tokens should be marked as "Secret"
- **Don't commit secrets**: Export environments before committing - secrets are redacted automatically
- **Team workflow**: Each team member maintains their own secrets locally after importing environments

### Certificate Trust
- **Development only**: APInox's self-signed certificate is for local development
- **Don't trust in production**: Never bypass SSL verification in production environments
- **Remove when done**: Uninstall the certificate when no longer using APInox proxy features

### Access Control
- **File permissions**: Config stored in `~/.apinox/` - ensure proper OS permissions
- **Network security**: Proxy listens on localhost - be aware when intercepting traffic
- **Audit logs**: Review logs regularly (Ctrl+Shift+D) for unexpected activity

## Troubleshooting
- Check the **Output Panel** (select "APInox" in the dropdown) for detailed logs of requests and errors.
- If requests fail, verify your proxy settings and WSDL reachability.
