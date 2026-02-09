# Export Workspace Functionality Review

**Date**: 2026-02-06  
**Reviewer**: GitHub Copilot  
**Status**: ⚠️ **INCOMPLETE** - Missing critical data

---

## Summary

The current export workspace functionality exports **only project-level data** (interfaces, operations, requests, test suites, folders). It **DOES NOT export** critical application-level configuration including:
- ❌ **Workflows** (request chaining definitions)
- ❌ **Performance Suites** (load testing configurations)
- ❌ **Environments** (Dev/Test/Prod with encrypted secrets)
- ❌ **Server Configuration** (proxy/mock rules, replace rules)
- ❌ **Request History** (past executions)

---

## What IS Currently Exported

### ✅ Per-Project Data (via `SoapUIExporter.ts`)

**1. Interfaces (SOAP/REST)**
- Interface name, type, binding, SOAP version
- WSDL definition URL
- All operations under each interface

**2. Operations**
- Operation name, action, input schema
- Target namespace
- Original endpoint
- All requests under each operation

**3. Requests**
- Request name, endpoint, headers
- Request body (XML/JSON)
- Content type, HTTP method
- Assertions (XPath, Contains, SLA)

**4. Test Suites**
- Test suite name and ID
- Test cases with steps
- Step types: request, delay, transfer, script
- Step configurations (request details, delays, property transfers, script content)

**5. Folders (User-organized REST requests)**
- Folder hierarchy
- REST/GraphQL requests in folders
- Request metadata (method, bodyType, headers)

### ✅ Workspace-Level Data

**Workspace File** (`.xml`)
- Workspace name
- References to all project files (relative paths)
- Auto-saves unsaved projects alongside workspace

---

## What IS NOT Exported (❌ MISSING)

### 1. **Workflows** (`Config.workflows`)
**Impact**: HIGH - Users lose request chaining workflows

**What's Missing**:
```typescript
workflows: Workflow[] = [
  {
    id: string,
    name: string,
    description: string,
    steps: WorkflowStep[], // Request steps, conditions, loops, delays
    variables: Record<string, string>,
    extractors: WorkflowExtractor[] // XPath/JSONPath variable extraction
  }
]
```

**Why It Matters**:
- Workflows represent complex test scenarios with request chaining
- Variable extraction/injection between requests
- Conditional branching and loops
- Cannot be reconstructed from other data

---

### 2. **Performance Suites** (`Config.performanceSuites`)
**Impact**: HIGH - Users lose load testing configurations

**What's Missing**:
```typescript
performanceSuites: PerformanceSuite[] = [
  {
    id: string,
    name: string,
    requests: PerformanceRequest[], // Requests with concurrency settings
    concurrency: number,
    iterations: number,
    rampUpTime: number,
    thinkTime: number,
    variableOverrides: Record<string, string>
  }
]
```

**Why It Matters**:
- Load testing is a key feature (performance testing suites)
- Concurrency and iteration settings are critical
- Ramp-up times for realistic load simulation
- Cannot recreate performance test configurations

---

### 3. **Environments** (`Config.environments`)
**Impact**: CRITICAL - Users lose environment-specific configuration

**What's Missing**:
```typescript
environments: Record<string, {
  endpoint_url?: string,
  env?: string,
  color?: string,
  [customField: string]: string // User-defined variables
}> & {
  secrets: EncryptedSecrets // AES-256-GCM encrypted sensitive values
}
```

**Why It Matters**:
- Environments (Dev/Test/Prod) with different endpoints
- **Encrypted secrets** (passwords, API keys, tokens)
- Custom variables per environment
- Color coding for quick identification
- **Losing secrets is a security and usability disaster**

---

### 4. **Server Configuration** (`Config.server` / `Config.replaceRules`)
**Impact**: MEDIUM - Users lose debugging configurations

**What's Missing**:
```typescript
// Server configuration
server: {
  mode: 'off' | 'proxy' | 'mock' | 'both',
  port: number,
  targetUrl: string,
  useSystemProxy: boolean,
  mockRules: MockRule[], // Mock response rules
  passthroughEnabled: boolean
}

// Replace rules (Dirty Proxy)
replaceRules: ReplaceRule[] = [
  {
    id: string,
    name: string,
    xpath: string,
    matchText: string,
    replaceWith: string,
    target: 'request' | 'response' | 'both',
    isRegex: boolean,
    enabled: boolean
  }
]
```

**Why It Matters**:
- Mock rules for frontend development/offline testing
- Replace rules for debugging/data masking
- Proxy configuration for traffic interception
- **Losing mock rules means recreating test data manually**

---

### 5. **Request History** (`RequestHistoryService`)
**Impact**: LOW-MEDIUM - Nice to have for audit/debugging

**What's Missing**:
```typescript
history: RequestHistoryEntry[] = [
  {
    id: string,
    timestamp: number,
    projectName: string,
    requestBody: string,
    responseBody: string,
    statusCode: number,
    duration: number,
    success: boolean,
    starred: boolean,
    notes: string
  }
]
```

**Why It Matters**:
- Historical execution data for debugging
- Starred important requests
- User notes on specific executions
- Not critical but valuable for context

---

### 6. **Breakpoints** (`Config.breakpoints`)
**Impact**: LOW - Debugging feature

**What's Missing**:
```typescript
breakpoints: Breakpoint[] = [
  {
    id: string,
    enabled: boolean,
    type: 'request' | 'response',
    condition?: string
  }
]
```

---

## Recommended Fixes

### Option 1: Export to Extended XML Format (Backward Compatible)
**Add to `SoapUIExporter.exportProject()`**:

```typescript
public async exportProject(project: ApinoxProject, filePath: string, config?: Config) {
    const soapUiObj = {
        "con:soapui-project": {
            // ... existing exports ...
            
            // NEW: APInox extensions (backward compatible with SoapUI)
            "dirty:workflows": config?.workflows?.map(wf => ({
                "@_id": wf.id,
                "@_name": wf.name,
                "@_description": wf.description,
                "dirty:step": wf.steps.map(step => ({ /* serialize step */ })),
                "dirty:variable": wf.variables ? Object.entries(wf.variables).map(([k,v]) => ({
                    "@_key": k,
                    "@_value": v
                })) : []
            })),
            
            "dirty:performanceSuites": config?.performanceSuites?.map(suite => ({
                "@_id": suite.id,
                "@_name": suite.name,
                "@_concurrency": suite.concurrency,
                "@_iterations": suite.iterations,
                "dirty:request": suite.requests.map(req => ({ /* serialize request */ }))
            })),
            
            "dirty:environments": config?.environments ? Object.entries(config.environments).map(([name, env]) => ({
                "@_name": name,
                "@_color": env.color,
                "dirty:field": Object.entries(env).map(([k,v]) => ({
                    "@_key": k,
                    "@_value": k.includes('secret') ? '[REDACTED]' : v // Don't export plaintext secrets
                }))
            })) : [],
            
            "dirty:serverConfig": config?.server ? {
                "@_mode": config.server.mode,
                "@_port": config.server.port,
                "@_targetUrl": config.server.targetUrl,
                "dirty:mockRule": config.server.mockRules.map(rule => ({ /* serialize rule */ })),
                "dirty:replaceRule": config.replaceRules?.map(rule => ({ /* serialize rule */ }))
            } : undefined
        }
    };
}
```

### Option 2: Export to Separate Config File
**Create `ExportWorkspaceModal` enhancement**:

```typescript
export interface ExportOptions {
    includeWorkflows: boolean;
    includePerformanceSuites: boolean;
    includeEnvironments: boolean;
    includeServerConfig: boolean;
    includeHistory: boolean;
    redactSecrets: boolean; // Don't export plaintext secrets
}

async exportWorkspace(projects: ApinoxProject[], filePath: string, config: Config, options: ExportOptions) {
    // 1. Export projects (existing)
    await this.exportProjectsAsWorkspace(projects, filePath);
    
    // 2. Export config (NEW)
    if (options.includeWorkflows || options.includePerformanceSuites || ...) {
        const configPath = filePath.replace('.xml', '-config.json');
        const exportedConfig = {
            workflows: options.includeWorkflows ? config.workflows : undefined,
            performanceSuites: options.includePerformanceSuites ? config.performanceSuites : undefined,
            environments: options.includeEnvironments ? this.sanitizeEnvironments(config.environments, options.redactSecrets) : undefined,
            server: options.includeServerConfig ? config.server : undefined,
            replaceRules: options.includeServerConfig ? config.replaceRules : undefined,
            history: options.includeHistory ? this.loadHistory() : undefined
        };
        fs.writeFileSync(configPath, JSON.stringify(exportedConfig, null, 2));
    }
}
```

---

## Action Items

### Immediate (Critical)
- [ ] **Add config parameter to exportWorkspace()** - Pass full Config object
- [ ] **Export workflows** - Users lose request chaining workflows without this
- [ ] **Export performance suites** - Load testing configurations are lost
- [ ] **Export environments (sanitized)** - Redact secrets, keep structure
- [ ] **Update ExportWorkspaceModal** - Add checkboxes for what to export
- [ ] **Update import logic** - Read extended XML or companion config file

### Medium Priority
- [ ] Export server configuration (mock/proxy rules)
- [ ] Export replace rules
- [ ] Add "Export with Config" vs "Export Projects Only" options
- [ ] Handle secrets properly (redact on export, prompt on import)

### Low Priority
- [ ] Export request history (optional)
- [ ] Export breakpoints
- [ ] Version stamping for migrations

---

## Testing Checklist

After implementing fixes:

- [ ] Export workspace with workflows → Import → Verify workflows restored
- [ ] Export workspace with performance suites → Import → Verify suites restored
- [ ] Export workspace with environments → Import → Verify environments restored (secrets redacted)
- [ ] Export workspace with mock rules → Import → Verify rules restored
- [ ] Export with "redact secrets" option → Verify secrets are `[REDACTED]`
- [ ] Import workspace without config file → Projects still load (backward compatible)
- [ ] Import workspace with config file → Config merged correctly

---

## Conclusion

**Current Status**: Export workspace is **incomplete** for production use. Users exporting and importing workspaces will lose:
- All workflow definitions (request chaining)
- All performance test configurations
- All environment variables (including secrets)
- All debugging configurations (mock/proxy rules)

**Recommendation**: Implement Option 2 (separate config file) for clean separation of concerns and easier secrets management.

**Priority**: HIGH - This is a data loss bug that will frustrate users who rely on export/import for backup or team collaboration.
