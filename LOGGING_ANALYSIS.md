# APInox Request/Response Logging & Replacement Analysis

## Overview
This document provides a detailed analysis of HTTP request/response logging and replacement/substitution logic across the APInox codebase, specifically examining what is logged, what is NOT logged, and where replacements are applied.

---

## 1. HTTP REQUESTS SENT - LOGGING ANALYSIS

### 1.1 SoapClient (`sidecar/dist/sidecar/src/soapClient.js`)

**File:** `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/soapClient.js`

#### What IS Logged:

**Lines 189-191: Request endpoint and headers**
```javascript
this.log(`Methods: POST ${endpoint} `);
this.log("Headers:", requestHeaders);
this.log("Body:", xml);
```
- Logs POST method + endpoint
- Logs ALL request headers (including SOAPAction if present)
- Logs the full XML body

**Lines 284, 328, 346, 347: Attachment-related logging**
```javascript
this.log(`[Attachments] Inlined Base64: ${attachment.name} (${attachment.contentId})`);
this.log(`[Attachments] Added multipart: ${attachment.name} (${attachment.contentId})`);
this.log(`[Attachments] Sending multipart request with ${multipartAttachments.length} attachments`);
this.log("Multipart Headers:", multipartHeaders);
```

**Lines 210, 223: WS-Security logging**
```javascript
this.log('[WS-Security] Applied UsernameToken security header');
```

#### What is NOT Logged:

- ❌ Response status code or headers (delegated to HttpClient)
- ❌ Response body (delegated to HttpClient)
- ❌ Request/response timing information at SoapClient level
- ❌ Actual HTTP error details from makeRequest

**Flow:** SoapClient delegates HTTP execution to HttpClient via `executeRawRequest()` → `this.httpClient.execute()`

---

### 1.2 HttpClient (`sidecar/dist/sidecar/src/services/HttpClient.js`)

**File:** `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/services/HttpClient.js`

#### What IS Logged:

**Lines 177-183: Request details**
```javascript
this.log(`${method} ${endpoint}`);
this.log("Headers:", requestHeaders);
if (formattedRequestBody) {
    this.log("Body:", formattedRequestBody);
    this.log("[HttpClient] sendRequest Body: " + formattedRequestBody);
}
this.log("[HttpClient] sendRequest Headers: " + JSON.stringify(requestHeaders));
```

**Lines 216-217: Response details**
```javascript
this.log("Response Status:", response.status);
this.log("Response Body:", responseData);
```

**Lines 125: GraphQL body logging**
```javascript
this.log("[HttpClient] executeGraphQL Body: " + jsonBody);
```

**Line 232: Request cancellation**
```javascript
this.log("Request canceled by user");
```

**Line 241: Request failure**
```javascript
this.log("Request failed:", error.message);
```

#### What is NOT Logged:

- ❌ Response headers are NOT logged (only captured: line 212-215)
- ❌ Request timing information (start/end times calculated but only returned in response object, not logged)
- ❌ Authentication headers details (line 352: "Bearer <token>" logged as-is, passwords in Basic auth are base64 encoded but logged)
- ❌ SSL/TLS certificate validation details
- ❌ Proxy configuration details (agents created but not logged: lines 172, 194-197)

**Return Object (Logged):** Lines 219-226
```javascript
{
    success: response.status >= 200 && response.status < 400,
    status: response.status,
    headers: responseHeaders,
    rawResponse: responseData,
    rawRequest: formattedRequestBody,
    timeTaken,
}
```

---

### 1.3 ProxyService (`sidecar/dist/sidecar/src/services/ProxyService.js`)

**File:** `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/services/ProxyService.js`

#### What IS Logged:

**Line 541: Outgoing headers to target**
```javascript
this.logDebug(`[Proxy] Outgoing Headers: ${JSON.stringify(requestHeaders)}`);
```

**Line 525: Sending request to target**
```javascript
this.logDebug(`[Proxy] Sending Request to: ${fullTargetUrl}`);
```

**Lines 296-301: Proxy startup configuration**
```javascript
this.logDebug(`[ProxyService] Target: ${this.config.targetUrl}`);
this.logDebug(`[ProxyService] Port: ${this.config.port}`);
this.logDebug(`[ProxyService] Strict SSL: ${strictSSL ? 'ENABLED (validates certificates)' : 'DISABLED (accepts self-signed)'}`);
```

**Line 447: Proxy settings**
```javascript
this.logDebug(`[Proxy] Request Settings - strictSSL=${strictSSL}, systemProxy=${proxyUrl || 'none'}`);
```

**Lines 411: Event logging (emitted, not console logged)**
```javascript
this.emit('log', { ...event, type: 'request' });
```

**Lines 551-555: Response event**
```javascript
event.status = response.statusCode;
event.responseHeaders = response.headers;
event.responseBody = response.body;
event.duration = (endTime - startTime) / 1000;
event.success = response.statusCode >= 200 && response.statusCode < 300;
```

#### Request Body Headers NOT Logged:

**Lines 399-409: Request captured but NOT logged**
```javascript
let reqBody = '';
req.on('data', chunk => reqBody += chunk);
// ...
const event = {
    id: eventId,
    requestHeaders: req.headers,
    requestBody: reqBody
};
// These are EMITTED, not logged to console
this.emit('log', { ...event, type: 'request' });
```

**⚠️ CRITICAL:** Request headers and body are captured in the `event` object but:
1. NOT logged to console/debug output at line 411
2. Only logged to the emitted event object
3. The actual logging happens at line 585: `this.emit('log', event)`

#### What is NOT Logged to Console:

- ❌ Original request body (only captured in event, not logged)
- ❌ Original request headers (only captured in event, not logged)
- ❌ Response headers details (captured at line 552, emitted at 585, but no debug logging)
- ❌ Request/response transformations applied (replace rules show what rules were applied but not the before/after)

---

## 2. REQUEST HEADERS & BODY LOGGING GAPS

### Summary Table:

| Component | Request Headers Logged? | Request Body Logged? | Response Headers Logged? | Response Body Logged? |
|-----------|----------------------|-------------------|----------------------|-------------------|
| **SoapClient** | ✅ YES (189) | ✅ YES (191) | ❌ NO | ❌ NO |
| **HttpClient** | ✅ YES (177-178) | ✅ YES (180-181) | ❌ NO (captured only) | ✅ YES (217) |
| **ProxyService** | ❌ NO (event only) | ❌ NO (event only) | ❌ NO (event only) | ✅ Partial (552) |

### Key Gaps:

1. **Response Headers Not Logged:**
   - HttpClient captures response headers (line 213-215) but doesn't log them
   - ProxyService captures response headers (line 552) but doesn't log them
   - Only captured in return objects/events

2. **Request Headers in ProxyService Not Logged:**
   - ProxyService receives original request headers at line 408 (`req.headers`)
   - Modified headers prepared at lines 527-540
   - Only the OUTGOING headers are logged (line 541), NOT the original incoming headers
   - Original headers are only captured in the event object (line 408), not logged

3. **Request Transformations Not Visible:**
   - Request headers are stripped/modified (lines 501-505) without logging what was removed
   - Original request body is stored but not compared with modified version

---

## 3. REPLACEMENTS & SUBSTITUTIONS

### 3.1 ReplaceRuleApplier (`sidecar/dist/sidecar/src/utils/ReplaceRuleApplier.js`)

**File:** `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/utils/ReplaceRuleApplier.js`

#### Key Logic:

**Lines 14-31: Apply all enabled rules**
```javascript
static apply(xml, rules, target) {
    const applicableRules = rules.filter(r => r.enabled && 
        (r.target === target || r.target === 'both'));
    
    let modifiedXml = xml;
    for (const rule of applicableRules) {
        try {
            modifiedXml = this.applyRule(modifiedXml, rule);
        } catch (e) {
            console.error(`[ReplaceRuleApplier] Rule ${rule.id} failed:`, e);
        }
    }
    return modifiedXml;
}
```

#### Logging in ReplaceRuleApplier:

- ✅ Line 28: Logs errors when rule application fails
- ❌ NO logging when rules are successfully applied
- ❌ NO logging of before/after content

#### ProxyService - Replace Rule Logging:

**Lines 508-515: Request replacement**
```javascript
let requestData = reqBody;
if (this.replaceRules.length > 0) {
    const originalReq = requestData;
    requestData = ReplaceRuleApplier.apply(requestData, this.replaceRules, 'request');
    if (requestData !== originalReq) {
        const applicableRules = this.replaceRules.filter(r => r.enabled && 
            (r.target === 'request' || r.target === 'both'));
        const ruleNames = applicableRules.map(r => r.name || r.id).join(', ');
        this.logDebug(`[Proxy] ✓ Applied replace rules to request: ${ruleNames}`);
    }
}
```

**Lines 562-572: Response replacement**
```javascript
let finalResponseData = response.body;
if (this.replaceRules.length > 0) {
    const originalData = finalResponseData;
    const applicableRules = this.replaceRules.filter(r => r.enabled && 
        (r.target === 'response' || r.target === 'both'));
    finalResponseData = ReplaceRuleApplier.apply(finalResponseData, this.replaceRules, 'response');
    if (finalResponseData !== originalData) {
        const ruleNames = applicableRules.map(r => r.name || r.id).join(', ');
        this.logDebug(`[Proxy] ✓ Applied replace rules: ${ruleNames}`);
        event.responseBody = finalResponseData;
    }
}
```

#### What IS Logged About Replacements:

- ✅ Which rules were applied (by name/id)
- ✅ Whether replacement occurred (checked by comparison: `!== originalReq/Data`)
- ✅ Line 514: `✓ Applied replace rules to request: <rule names>`
- ✅ Line 569: `✓ Applied replace rules: <rule names>`

#### What is NOT Logged About Replacements:

- ❌ The actual matching/replacement patterns used
- ❌ Before/after content comparison
- ❌ How many characters were changed
- ❌ XPath scoping details (though regex/match patterns are in the ReplaceRuleApplier, they're not logged)
- ❌ Individual rule statistics (e.g., "Rule 1 replaced 5 occurrences")

---

### 3.2 WildcardProcessor (`sidecar/dist/sidecar/src/utils/WildcardProcessor.js`)

**File:** `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/utils/WildcardProcessor.js`

#### Types of Substitutions:

1. **Context Variables (${#TestCase#VarName}, ${VarName})**
   - SoapUI-style and simple style placeholders

2. **Contextual Functions:**
   - `{{uuid}}` / `{{newguid}}` → UUID v4
   - `{{now}}` → ISO timestamp
   - `{{epoch}}` → Unix timestamp
   - `{{randomInt(min,max)}}` → Random integer
   - `{{lorem(count)}}` → Lorem ipsum
   - `{{name}}` → Random name
   - `{{country}}` → Random country
   - `{{state}}` → Random state
   - `{{now[+-]Xdmy}}` → Date math

3. **Environment Variables:**
   - `{{key}}` → Environment variable lookup

#### Logging in WildcardProcessor:

- ❌ NO logging of substitutions performed
- ❌ NO logging of which variables were replaced
- ❌ NO logging of function invocations

#### Router - WildcardProcessor Usage:

**Lines 126-128: In request body processing**
```javascript
if (args && typeof args === 'string') {
    const WildcardProcessor = await Promise.resolve()...
    args = WildcardProcessor.process(args, envVars, globalVars, undefined, contextVars);
}
```

**Lines 130-132: In endpoint processing**
```javascript
if (endpoint) {
    const WildcardProcessor = await Promise.resolve()...
    endpoint = WildcardProcessor.process(endpoint, envVars, globalVars, undefined, contextVars);
}
```

#### What is NOT Logged:

- ❌ No logging in Router when wildcards are processed
- ❌ No indication of which wildcards were replaced
- ❌ No before/after endpoint or body

---

## 4. ENVIRONMENT VARIABLE SUBSTITUTION

### Router - ExecuteRequest (`sidecar/dist/sidecar/src/router.js`)

**Lines 112-123: Environment resolution**
```javascript
const environmentName = payload.environment || services.settingsManager.getActiveEnvironment();
let envVars = {};
if (environmentName) {
    try {
        envVars = await services.settingsManager.getResolvedEnvironment(environmentName);
    } catch (err) {
        console.error(`[Router] Failed to resolve environment '${environmentName}':`, err);
    }
}
const globalVars = services.settingsManager.getGlobalVariables() || {};
const contextVars = payload.contextVariables || {};
```

#### Logging:

- ✅ Line 120: Logs errors when environment resolution fails
- ❌ NO logging of which environment was resolved
- ❌ NO logging of environment variable names/values
- ❌ NO logging showing variable substitution in body/endpoint

---

## 5. AUTHENTICATION HANDLING

### HttpClient - Basic Auth (`lines 350-353`)

```javascript
case "basic":
    if (auth.username && auth.password) {
        const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
        headers["Authorization"] = `Basic ${credentials}`;
    }
    break;
```

#### Logging:

- ✅ The resulting header is logged: `"Authorization": "Basic <base64>"` (line 177-178)
- ❌ Username/password values NOT logged (encoded as base64)
- ❌ No indication that basic auth was applied

### HttpClient - Bearer Token (`lines 355-358`)

```javascript
case "bearer":
    if (auth.token) {
        headers["Authorization"] = `Bearer ${auth.token}`;
    }
    break;
```

#### Logging:

- ✅ The resulting header is logged as `"Authorization": "Bearer <token>"` (line 177-178)
- ❌ Token value logged in plain sight (security risk?)

---

## 6. WS-SECURITY HANDLING

### SoapClient - WS-Security Application (`lines 174-233`)

**Lines 205-223: Apply UsernameToken**
```javascript
applyWSSecurity(xml, wsSecurityConfig) {
    if (wsSecurityConfig.type === 'usernameToken') {
        const { username, password, passwordType, hasNonce, hasCreated } = wsSecurityConfig;
        const wsSecurity = new soap.WSSecurity(username, password, {...});
        const securityHeaderXml = wsSecurity.toXML();
        xml = this.injectSecurityHeader(xml, securityHeaderXml);
        this.log('[WS-Security] Applied UsernameToken security header');
    }
}
```

#### Logging:

- ✅ Line 223: Logs that WS-Security header was applied
- ✅ Line 210: Logs when username/password is missing
- ❌ NO logging of the generated security header XML
- ❌ NO logging of injection point (where header was inserted)
- ❌ NO logging of the final XML after security header injection

**Lines 238-264: Inject Security Header**
```javascript
injectSecurityHeader(soapXml, securityHeaderXml) {
    // Check if soap:Header already exists
    // Insert security header
    // or Create new soap:Header
    // If can't parse: log warning
}
```

#### Logging:

- ✅ Line 263: `'[WS-Security] Warning: Could not parse SOAP envelope structure'`
- ❌ NO logging of successful injection
- ❌ NO logging of where header was inserted

---

## 7. REQUEST BODY FORMATTING & LOGGING

### SoapClient - XML Payload Preparation (`lines 122-126`)

```javascript
const xmlPayload = typeof args === "string"
    ? args
    : this.client?.wsdl?.objectToDocumentXML
        ? this.client.wsdl.objectToDocumentXML(operation, args, "", 
            this.client.wsdl.definitions?.$targetNamespace)
        : JSON.stringify(args);
```

#### Logging:

- ✅ Line 191: Full xmlPayload is logged
- ❌ NO logging of which path was taken (string vs. objectToDocumentXML vs. JSON.stringify)
- ❌ NO indication of format/structure

### HttpClient - Body Formatting for Log (`lines 323-339`)

```javascript
formatBodyForLog(body) {
    if (body === undefined || body === null) return "";
    if (typeof body === "string") return body;
    if (Buffer.isBuffer(body)) return `<Buffer length=${body.length}>`;
    if (typeof body.getBoundary === "function" || 
        typeof body.getHeaders === "function") {
        return "[form-data stream]";
    }
    try {
        return JSON.stringify(body);
    } catch {
        return "[unserializable body]";
    }
}
```

#### Logging Behavior:

- ✅ Truncates/summarizes non-string bodies (FormData shown as `[form-data stream]`)
- ✅ Shows buffer size instead of content
- ✅ Catches serialization errors
- ❌ FormData/multipart not shown with details
- ❌ Large payloads NOT truncated (could fill logs)

---

## 8. PROXY REQUEST/RESPONSE EVENT LOGGING

### ProxyService - Event Emission (`lines 396-597`)

**Lines 402-411: Request event captured**
```javascript
const event = {
    id: eventId,
    timestamp: startTime,
    timestampLabel: new Date(startTime).toLocaleString(),
    method: req.method || 'GET',
    url: req.url || '/',
    requestHeaders: req.headers,
    requestBody: reqBody
};
this.emit('log', { ...event, type: 'request' });
```

**Lines 551-585: Response event captured & emitted**
```javascript
event.status = response.statusCode;
event.responseHeaders = response.headers;
event.responseBody = response.body;
event.duration = (endTime - startTime) / 1000;
event.success = response.statusCode >= 200 && response.statusCode < 300;
// ... [Modifications applied]
this.emit('log', event);
```

#### What is Emitted (NOT logged to console):

- ✅ Full request headers
- ✅ Full request body
- ✅ Full response headers
- ✅ Full response body
- ✅ Duration/timing
- ✅ Status code
- ✅ Success flag
- ✅ Modified request data (if replace rules applied)
- ✅ Modified response data (if replace rules applied)

#### Console Logging:

- ✅ Line 525: `[Proxy] Sending Request to: ${fullTargetUrl}`
- ✅ Line 541: `[Proxy] Outgoing Headers: ${JSON.stringify(requestHeaders)}`
- ✅ Line 514: `[Proxy] ✓ Applied replace rules to request: ${ruleNames}`
- ✅ Line 569: `[Proxy] ✓ Applied replace rules: ${ruleNames}`
- ❌ Original request headers NOT logged to console
- ❌ Original request body NOT logged to console
- ❌ Response headers NOT logged to console
- ❌ Response body NOT logged to console

---

## 9. SUMMARY: LOGGING GAPS & RECOMMENDATIONS

### Critical Logging Gaps:

| Missing Information | Location | Impact |
|-------------------|----------|--------|
| Response headers in console | HttpClient, ProxyService | Can't debug header transformations |
| Request headers (original) in ProxyService console | ProxyService.handleRequest | Can't see what client sent |
| Request body in ProxyService console | ProxyService.handleRequest | Can't see original request from client |
| Replacement rule details | ReplaceRuleApplier | Can't see what was replaced |
| Wildcard substitutions | WildcardProcessor | Can't verify variable resolution |
| Before/after replacement content | ProxyService | Can't validate rule effectiveness |
| WS-Security header injection point | SoapClient | Can't debug security header issues |
| Authentication method applied | HttpClient.applyAuth | No visibility into auth selection |
| Request body serialization path | SoapClient | Don't know if WSDL or JSON serialization used |

### Recommendations for Enhanced Logging:

1. **Add response header logging to HttpClient** (after line 216)
2. **Add original request logging to ProxyService** (at line 399, before modifications)
3. **Add detailed replacement logging** (after each rule application)
4. **Add wildcard substitution logging** in WildcardProcessor.process()
5. **Add WS-Security header logging** showing the generated header XML
6. **Add authentication method logging** in HttpClient.applyAuth()
7. **Consider log level configuration** (verbose, info, warn, error) to avoid log spam
8. **Add request/response body size tracking** for performance monitoring

---

## 10. FILE LOCATIONS & LINE REFERENCES

### Primary Files Analyzed:

1. **SoapClient**
   - Location: `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/soapClient.js`
   - Lines: 41-402
   - Key methods: `executeRawRequest()` (132-200), `executeRequest()` (117-127), `applyWSSecurity()` (205-233)

2. **HttpClient**
   - Location: `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/services/HttpClient.js`
   - Lines: 43-370
   - Key methods: `sendRequest()` (159-250), `executeRest()` (75-105), `executeGraphQL()` (110-126), `executeSoap()` (131-145)

3. **ProxyService**
   - Location: `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/services/ProxyService.js`
   - Lines: 48-864
   - Key methods: `handleRequest()` (396-641), `makeHttpRequest()` (646-684)

4. **ReplaceRuleApplier**
   - Location: `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/utils/ReplaceRuleApplier.js`
   - Lines: 10-131
   - Key methods: `apply()` (14-31), `applyRule()` (36-48)

5. **WildcardProcessor**
   - Location: `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/utils/WildcardProcessor.js`
   - Lines: ~40-100+ (partial view shown)
   - Key methods: `process()` (static method)

6. **Router**
   - Location: `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/router.js`
   - Lines: 45-1275
   - Key handlers: `ExecuteRequest` (99-216), `ExecuteWorkflow` (1110-1156)

