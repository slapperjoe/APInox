# APInox Logging & Replacements - QUICK REFERENCE

## Quick Facts

### What IS Logged to Console:

| Component | Endpoint | Headers | Body | Response | Status |
|-----------|----------|---------|------|----------|--------|
| **SoapClient** | ✅ (189) | ✅ (190) | ✅ (191) | ❌ | ❌ |
| **HttpClient** | ✅ (177) | ✅ (178) | ✅ (180) | ✅ (217) | ✅ (216) |
| **ProxyService** | ✅ (525) | ✅ (541) | ❌ | ❌ | ✅ (551) |

### Critical Gaps:

1. **⚠️ Response Headers NEVER logged to console** 
   - Captured in HttpClient (line 213-215) and ProxyService (line 552)
   - But not logged to debug output
   - Only available in emitted events

2. **⚠️ ProxyService original request NOT logged**
   - Received from client at line 408-409
   - Only captured in event object, never logged to console
   - Modified headers logged (line 541), but not original

3. **⚠️ Replacement rules don't log before/after**
   - Only logs rule names, not the actual replacements
   - No visibility into what was matched/replaced

4. **⚠️ Wildcard substitutions NOT logged**
   - Environment variables, {{functions}}, ${context} vars processed
   - No logging showing what was substituted
   - Makes debugging variable resolution impossible

---

## WHERE TO ADD LOGGING

### 1. Response Headers Logging

**File:** `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/services/HttpClient.js`
**After Line 216, add:**
```javascript
this.log("Response Headers:", responseHeaders);
```

**File:** `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/services/ProxyService.js`
**After Line 552, add:**
```javascript
this.logDebug(`[Proxy] Response Headers: ${JSON.stringify(response.headers)}`);
```

### 2. Original Request Logging (ProxyService)

**File:** `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/services/ProxyService.js`
**After Line 410, add:**
```javascript
this.logDebug(`[Proxy] Incoming Request Headers: ${JSON.stringify(req.headers)}`);
this.logDebug(`[Proxy] Incoming Request Body: ${reqBody.substring(0, 500)}...`); // First 500 chars
```

### 3. Replacement Rule Details

**File:** `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/utils/ReplaceRuleApplier.js`
**In applyRule() method, add:**
```javascript
static applyRule(xml, rule) {
    const targetElement = this.getTargetElementFromXPath(rule.xpath);
    const modifiedXml = this.doReplacement(...);
    if (xml !== modifiedXml) {
        console.log(`[ReplaceRuleApplier] Rule "${rule.name}" matched and replaced content`);
    }
    return modifiedXml;
}
```

### 4. Wildcard Substitution Logging

**File:** `/Users/mark/Code/APInox/sidecar/dist/sidecar/src/router.js`
**Around Line 128, add:**
```javascript
const beforeWildcards = args;
args = WildcardProcessor.process(args, envVars, globalVars, undefined, contextVars);
if (args !== beforeWildcards) {
    console.log('[Router] Wildcards processed in request body');
}

const beforeEndpoint = endpoint;
endpoint = WildcardProcessor.process(endpoint, envVars, globalVars, undefined, contextVars);
if (endpoint !== beforeEndpoint) {
    console.log(`[Router] Endpoint after wildcard processing: ${endpoint}`);
}
```

---

## REPLACEMENT FLOW DIAGRAM

```
Request from User
    ↓
[Router] ExecuteRequest
    ├─ Resolves environment variables (line 112-122)
    ├─ Processes wildcards/substitutions (line 126-133)
    └─ → Body & Endpoint with variables substituted
    ↓
[SoapClient] executeRawRequest
    ├─ Applies WS-Security if configured (line 174-176)
    └─ → XML payload with security headers
    ↓
[HttpClient] sendRequest
    ├─ Applies auth headers (line 101)
    └─ → Headers with authorization
    ↓
[ProxyService] handleRequest (if proxy enabled)
    ├─ Applies replace rules to request (line 508-516)
    ├─ Checks breakpoints (line 518-524)
    ├─ Forwards to target server (line 543-549)
    ├─ Applies replace rules to response (line 562-572)
    ├─ Checks breakpoints (line 575-582)
    └─ Emits log event (line 585)
    ↓
Response returned to User
```

---

## WHAT'S LOGGED WHERE

### Console/Debug Output (via logger):
- ✅ Endpoints
- ✅ Request headers (prepared/outgoing)
- ✅ Request bodies (formatted)
- ✅ Response status codes
- ✅ Response bodies
- ✅ Error messages
- ❌ Response headers
- ❌ Replaced rule details
- ❌ Wildcard substitutions

### Event Objects (emitted via this.emit('log', event)):
- ✅ Request headers (original)
- ✅ Request body (original)
- ✅ Response headers
- ✅ Response body
- ✅ Status code
- ✅ Duration/timing
- ✅ Success flag

### Hidden/Not Logged:
- ❌ Before/after replacement content
- ❌ Which replace rules matched
- ❌ Wildcard substitution details
- ❌ Environment variable values
- ❌ WS-Security header content
- ❌ Authentication credentials (properly hidden)
- ❌ Proxy server responses
- ❌ SSL/TLS certificate validation results

---

## KEY FILES FOR MODIFICATIONS

| File | Purpose | Log Level | Suggested Changes |
|------|---------|-----------|------------------|
| HttpClient.js | Core HTTP execution | ✅ Good | Add response headers logging |
| ProxyService.js | Proxy & request forwarding | ⚠️ Gaps | Add original request logging |
| ReplaceRuleApplier.js | Replace rule application | ❌ None | Add rule match/replace details |
| WildcardProcessor.js | Variable substitution | ❌ None | Add substitution logging |
| router.js | Request routing | ⚠️ Gaps | Add environment/wildcard logging |

---

## LINE NUMBER QUICK INDEX

### SoapClient (soapClient.js)
- 189: Endpoint logging
- 190: Request headers
- 191: Request body
- 174-233: WS-Security application
- 238-264: Security header injection

### HttpClient (HttpClient.js)
- 177: Method + endpoint
- 178: Request headers
- 180-181: Request body
- 216: Response status
- 217: Response body
- 212-215: Response headers captured (NOT logged)
- 350-367: Authentication handling

### ProxyService (ProxyService.js)
- 399-409: Original request captured
- 408: Request headers from client
- 409: Request body from client
- 411: Request event emitted
- 508-516: Request replace rules applied
- 525: Sending to target
- 541: Outgoing headers (modified)
- 551-555: Response captured
- 562-572: Response replace rules applied
- 585: Response event emitted

### Router (router.js)
- 112-122: Environment resolution
- 126-133: Wildcard processing

### ReplaceRuleApplier (ReplaceRuleApplier.js)
- 14-31: apply() - main entry point
- 28: Error logging

---

## FOR DEBUGGING

### To trace a request through the system:

1. Check Router logs (ExecuteRequest entry point)
2. Check for wildcard substitution (lines 126-133)
3. Check SoapClient logs (endpoints, headers, body)
4. Check HttpClient logs (method, headers, body, status, response)
5. If using Proxy:
   - Check ProxyService logs (outgoing headers, rules applied)
   - Check emitted events for original request/response

### To debug replace rules:

1. Enable detailed replace rule logging (add to ReplaceRuleApplier)
2. Compare original vs. final content
3. Check XPath extraction logic (lines 54-72)
4. Check element pattern matching (lines 78-82)

### To debug wildcard substitution:

1. Add logging to WildcardProcessor.process()
2. Log environment variables loaded
3. Log each regex replacement (uuid, now, randomInt, etc.)
4. Log final content after all replacements
