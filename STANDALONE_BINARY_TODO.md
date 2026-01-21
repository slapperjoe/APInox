# Standalone Binary TODO

## Goal
Create a truly standalone sidecar binary with embedded Node.js runtime, requiring zero dependencies on target machines.

## Current Blockers

### 1. Axios Dynamic Module Resolution
**Problem:** Axios uses conditional `require()` statements that all bundlers struggle with:
```javascript
// axios/lib/defaults/index.js
const adapter = require(
  isNode ? './adapter/http' : './adapter/xhr'
);
```

**Tested Solutions:**
- ❌ `pkg` with source files → Module not found error
- ❌ `pkg` with esbuild bundle → Still fails (axios externalized)
- ❌ `pkg` with `--public-packages` → Same error
- ❌ `pkg` with `--no-bytecode` → Breaks other modules
- ❌ `bun` compile → Different module resolution issues

**Error:**
```
Error: Cannot find module '/snapshot/dirty-soap/node_modules/axios/dist/node/axios.cjs'
```

## Solution: Replace Axios

### Why
- Native Node.js `https` and `fetch` (Node 18+) work perfectly with ALL bundlers
- Smaller bundle size
- Fewer dependencies
- No dynamic requires
- Standard web APIs

### Files Using Axios

1. **`src/services/ProxyService.ts`**
   - Purpose: HTTP proxy for intercepting requests
   - Usage: Forwarding HTTP requests with custom headers
   - Replacement: Node.js `https` module

2. **`src/services/MockService.ts`**
   - Purpose: Mock server returning predefined responses
   - Usage: Minimal - just matching requests
   - Replacement: None needed (doesn't make external calls)

3. **`src/services/HttpClient.ts`**
   - Purpose: Generic HTTP client wrapper
   - Usage: GET/POST with headers, timeout
   - Replacement: Native `fetch` (Node 18+)

4. **`src/commands/DownloadWsdlCommand.ts`**
   - Purpose: Download WSDL files from URLs
   - Usage: Simple GET requests
   - Replacement: Native `fetch`

5. **`src/services/AzureDevOpsService.ts`**
   - Purpose: Azure DevOps API integration
   - Usage: Authenticated API calls
   - Replacement: Native `fetch`

6. **CLI commands** (`src/cli/commands/send-request.ts`)
   - Purpose: Send test SOAP requests
   - Replacement: Native `https`

### Implementation Plan

#### Phase 1: Create Native HTTP Utilities

Create `src/utils/NativeHttpClient.ts`:
```typescript
export interface HttpClientOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export async function request(url: string, options: HttpClientOptions): Promise<{
  status: number;
  headers: Record<string, string>;
  data: string;
}> {
  // Use native fetch (Node 18+)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);
  
  try {
    const response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: controller.signal
    });
    
    const data = await response.text();
    
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
```

#### Phase 2: Update Services One-by-One

1. **HttpClient.ts** (simplest) ✓
   - Replace axios with native fetch
   - Test all usages

2. **DownloadWsdlCommand.ts** ✓
   - Simple GET request replacement

3. **AzureDevOpsService.ts** ✓
   - Handle auth headers with fetch

4. **ProxyService.ts** (complex)
   - Requires streaming support
   - Use `https` module directly for proxying

5. **CLI commands** ✓
   - Update send-request to use native https

#### Phase 3: Remove Axios Dependency

```bash
npm uninstall axios
cd sidecar && npm uninstall axios
```

#### Phase 4: Build Standalone Binary

```bash
cd sidecar
npm run bundle  # esbuild will now work
pkg bundle.js --targets node20-macos-arm64,node20-macos-x64,node20-win-x64,node20-linux-x64 --out-path . --compress GZip
```

### Testing Checklist

- [ ] WSDL download works
- [ ] SOAP requests execute
- [ ] Proxy service forwards requests
- [ ] Mock service returns responses
- [ ] Azure DevOps integration works
- [ ] CLI commands function
- [ ] Binary builds without errors
- [ ] Binary runs without Node.js installed
- [ ] Works on Windows/Mac/Linux

### Benefits After Completion

✅ **Zero Dependencies** - Users don't need Node.js  
✅ **~50MB Binary** - Includes embedded runtime  
✅ **Cross-Platform** - Single binary per platform  
✅ **Offline Install** - No npm, no PATH issues  
✅ **Perfect for Distributed Testing** - Copy binary to workers  
✅ **Docker FROM scratch** - Minimal containers  

## Alternative: CLI-Sidecar Merge

Once axios is removed, merge CLI commands into sidecar for unified binary:

```bash
# Same binary, multiple modes
apinox serve --config-dir /path           # Tauri sidecar
apinox worker --connect ws://host         # Perf test worker
apinox coordinator --suite suite.json     # Perf test coordinator
apinox run-suite suite.json               # Local perf test
```

See `CLI_SIDECAR_MERGE.md` for full plan.

## Timeline Estimate

- **Replace axios in simple files**: 2-3 hours
- **Replace axios in ProxyService**: 3-4 hours (streaming complexity)
- **Testing all functionality**: 2-3 hours
- **Build and test binaries**: 1-2 hours

**Total: 1-2 days of focused work**

## Priority

**Medium-High** - The JavaScript bundle works fine for now, but standalone binaries would significantly improve:
- User experience (no Node.js installation)
- Distributed testing deployments
- Docker container sizes
- Overall professionalism

## Status

🟡 **Blocked on axios removal** - All binary approaches fail due to axios  
🟢 **Workaround available** - JS bundle + improved Node.js detection works well
