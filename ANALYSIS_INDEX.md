# APInox Logging & Replacements Analysis - Complete Index

## 📚 Documentation Files Generated

### 1. **LOGGING_ANALYSIS.md** (20 KB)
   - **Purpose:** Comprehensive, detailed line-by-line analysis
   - **Content:**
     - HTTP Request Logging (SoapClient, HttpClient, ProxyService)
     - Response Headers & Body Logging (what is/isn't logged)
     - Request Headers Logging Gaps (critical findings)
     - Replacements & Substitutions (ReplaceRuleApplier deep dive)
     - WildcardProcessor (environment variables, {{functions}}, ${context})
     - Environment Variable Substitution
     - Authentication Handling (Basic, Bearer, API Key)
     - WS-Security Handling (UsernameToken)
     - Request Body Formatting & Logging
     - Proxy Request/Response Event Logging
     - Summary: Logging Gaps & Recommendations
     - File Locations & Line References
   - **Best for:** Deep dive, understanding all details, troubleshooting

### 2. **LOGGING_QUICK_REFERENCE.md** (7.2 KB)
   - **Purpose:** Quick lookup and action items
   - **Content:**
     - Quick Facts table (what's logged where)
     - Critical Gaps (4 main issues)
     - Where to Add Logging (code snippets ready to copy)
     - Replacement Flow Diagram (visual overview)
     - What's Logged Where (3-part breakdown)
     - Key Files for Modifications (priority matrix)
     - Line Number Quick Index (for each file)
     - Debugging Tips (how to trace requests)
   - **Best for:** Quick answers, implementation, coding

### 3. **REQUEST_FLOW_DIAGRAM.txt** (61.9 KB)
   - **Purpose:** Visual, ASCII-art flow showing every step
   - **Content:**
     - Step-by-step request flow from Router through HTTP client
     - SOAP path vs REST/GraphQL path
     - SoapClient processing (WS-Security, attachments)
     - HttpClient execution (auth, fetch, timeout)
     - Proxy Service path (mocks, replace rules, breakpoints)
     - ReplaceRuleApplier algorithm
     - Visual indicators for: what's logged (✅), what's not (❌), partial (⚠️)
     - Every logging point marked with exact line numbers
   - **Best for:** Understanding the flow, visual learners, tracing execution

### 4. **ANALYSIS_INDEX.md** (this file)
   - **Purpose:** Navigation and quick reference
   - **Content:**
     - Overview of all documentation
     - Key findings at a glance
     - How to use the documents
     - Quick troubleshooting guide

---

## 🎯 Key Findings Summary

### Critical Logging Gaps (Must Fix):

1. **Response Headers NEVER logged**
   - Files: HttpClient.js (line 213-215), ProxyService.js (line 552)
   - Status: Captured but not logged
   - Impact: Can't debug response header transformations
   - Fix: Add `this.log("Response Headers:", responseHeaders)` after line 216

2. **Original Request NOT logged in Proxy**
   - File: ProxyService.js (line 408-409)
   - Status: Captured in event object, not logged to console
   - Impact: Can't see what client sent before proxy modifications
   - Fix: Add `this.logDebug()` calls after line 410

3. **Wildcard Substitution NOT logged**
   - Files: WildcardProcessor.js (lines ~40-100+), Router.js (line 126-133)
   - Status: No logging anywhere
   - Impact: Can't debug variable resolution ({{uuid}}, {{env}}, ${context})
   - Fix: Add logging to WildcardProcessor and Router

4. **Replacement Rule Details NOT logged**
   - File: ReplaceRuleApplier.js (line 14-31)
   - Status: Only rule names logged, not actual replacements
   - Impact: Can't see what was matched/replaced
   - Fix: Add before/after logging in ReplaceRuleApplier.apply()

---

## 📍 File Reference Map

### SoapClient (soapClient.js)
```
Lines 41-402 | SOAP request execution
189-191     | ✅ Request headers & body logged
174-233     | 🔒 WS-Security application
238-264     | 🔒 Security header injection
```

### HttpClient (HttpClient.js)
```
Lines 43-370    | HTTP execution layer
177-183         | ✅ Request details logged
216-217         | ✅ Response status & body logged
212-215         | ❌ Response headers captured but NOT logged
350-367         | 🔒 Authentication header application
```

### ProxyService (ProxyService.js)
```
Lines 48-864       | Proxy server & request forwarding
399-410            | ❌ Request captured but NOT logged to console
508-516            | ⚠️  Replace rules applied (logged by name)
541                | ✅ Outgoing headers logged
551-555            | 📊 Response captured (NOT logged)
562-572            | ⚠️  Replace rules applied to response
585                | 📤 Full event emitted (not console logged)
646-684            | 📤 makeHttpRequest() to target
```

### ReplaceRuleApplier (ReplaceRuleApplier.js)
```
Lines 10-131   | Rule application engine
14-31          | ⚠️  apply() - only rule names logged
36-48          | ❌ applyRule() - no logging on success
```

### WildcardProcessor (WildcardProcessor.js)
```
Lines ~40-100+ | Variable substitution (partial view)
               | ❌ NO logging at all
               | Processes: {{uuid}}, {{now}}, {{env}}, ${context}
```

### Router (router.js)
```
Lines 45-1275         | Request routing & command handling
112-122               | ⚠️  Environment resolution (errors logged)
126-133               | ❌ Wildcard processing (not logged)
99-216                | ExecuteRequest handler
```

---

## 🚀 How to Use This Analysis

### If you want to:

**Understand the complete logging picture:**
→ Start with LOGGING_ANALYSIS.md sections 1-3 (HTTP Requests Sent)

**Fix logging gaps immediately:**
→ Go to LOGGING_QUICK_REFERENCE.md "WHERE TO ADD LOGGING" section
→ Copy the code snippets and add to your source files

**Debug a specific request:**
→ Use REQUEST_FLOW_DIAGRAM.txt to trace the request path
→ Check which logging statements apply to your scenario

**Understand response flow:**
→ Start with REQUEST_FLOW_DIAGRAM.txt (visual)
→ Check LOGGING_ANALYSIS.md section 8 for Proxy Service details

**Fix replacement rule issues:**
→ LOGGING_ANALYSIS.md section 3 (Replacements & Substitutions)
→ LOGGING_QUICK_REFERENCE.md "WHERE TO ADD LOGGING" section 3

**Debug variable substitution:**
→ LOGGING_ANALYSIS.md section 4 (WildcardProcessor)
→ LOGGING_QUICK_REFERENCE.md "WHERE TO ADD LOGGING" section 4

---

## 📊 Logging Status Matrix

| Component | Request Headers | Request Body | Response Headers | Response Body | Status |
|-----------|----------------|-------------|-----------------|---------------|--------|
| SoapClient | ✅ (189) | ✅ (191) | ❌ | ❌ | ✅ (190) |
| HttpClient | ✅ (178) | ✅ (180) | ❌ | ✅ (217) | ✅ (216) |
| ProxyService | ❌ (event only) | ❌ (event only) | ❌ (event only) | ✅ Partial | ✅ (551) |

**Key:**
- ✅ = Logged to console
- ❌ = Not logged (but may be in events)
- Number = Line where logged
- "event only" = In emitted event object, not console logged

---

## �� What's Hidden (By Design vs By Oversight)

### Hidden By Design (Security/Privacy):
- ✅ Passwords/credentials (base64 encoded for Basic auth)
- ✅ Bearer tokens (logged as "Bearer <token>" with actual token visible - minor risk)
- ✅ Full request bodies in some contexts (too large)
- ✅ Response headers (may contain sensitive info)

### Hidden By Oversight (Should Be Logged):
- ❌ Original request headers in Proxy
- ❌ Response headers everywhere
- ❌ Wildcard substitution details
- ❌ Replacement rule details (before/after)
- ❌ WS-Security header content
- ❌ Environment variable resolution
- ❌ Proxy agent configuration

---

## ⚡ Quick Troubleshooting Guide

### "I don't see my request headers in logs"
→ Check if using ProxyService - original headers NOT logged
→ Check SoapClient/HttpClient - they DO log headers

### "Response headers aren't showing"
→ They're never logged to console
→ Available in event objects only (ProxyService.emit('log', event))
→ Add logging: See LOGGING_QUICK_REFERENCE.md section 1

### "Wildcards not working / wrong value"
→ WildcardProcessor has NO logging
→ Add logging: See LOGGING_QUICK_REFERENCE.md section 4
→ Or add console.log() in router.js lines 126-133

### "Replace rules aren't applying"
→ ProxyService logs rule names but not details
→ Add detailed logging: See LOGGING_QUICK_REFERENCE.md section 3
→ Check ReplaceRuleApplier XPath matching (lines 54-82)

### "Environment variables not resolving"
→ Router logs errors only, not the values
→ Check SettingsManager.getResolvedEnvironment()
→ Add logging at router.js line 117

---

## 📝 Files Summary

| File | Completeness | Detail Level | Best For |
|------|--------------|--------------|----------|
| LOGGING_ANALYSIS.md | 100% | Very High | Deep understanding, reference |
| LOGGING_QUICK_REFERENCE.md | 100% | Medium | Implementation, quick lookup |
| REQUEST_FLOW_DIAGRAM.txt | 100% | Very High | Visual understanding, tracing |
| ANALYSIS_INDEX.md | 100% | Low | Navigation, overview |

---

## 🎓 Next Steps

1. **Review**: Read LOGGING_QUICK_REFERENCE.md (10 minutes)
2. **Understand**: Review REQUEST_FLOW_DIAGRAM.txt (15 minutes)
3. **Plan**: Identify which fixes are most critical for your use case
4. **Implement**: Use code snippets from LOGGING_QUICK_REFERENCE.md
5. **Test**: Verify logging appears as expected
6. **Iterate**: Use LOGGING_ANALYSIS.md for reference as needed

---

Generated: 2024-03-15
Analysis Complete ✅
