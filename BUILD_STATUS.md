# Build Status

## What's Working ✅

### VS Code Extension
```bash
npm run compile        # Builds extension + webview
code .                 # Open and press F5 to run
```

### Tauri Desktop App
```bash
npm run tauri:dev      # Development with hot reload
npm run tauri:build    # Production build
```
- Uses JavaScript bundle (`sidecar-bundle/bundle.js`)
- Requires Node.js on target machine
- Node.js detection checks common install locations first

### Current Features
- ✅ WSDL parsing and operation exploration
- ✅ SOAP request execution  
- ✅ Proxy server for traffic inspection
- ✅ Mock server for test responses
- ✅ Request/response replace rules
- ✅ Test suites and test runner
- ✅ Performance testing
- ✅ Request history
- ✅ File watcher
- ✅ Project management
- ✅ Changelog visible in welcome screen
- ✅ Theme-aware logo display

## What's Not Working ❌

### Standalone Binary (No Node.js Required)
**Status:** Blocked by axios dynamic module resolution

**Tested Approaches:**
- ❌ pkg + source files
- ❌ pkg + esbuild bundle  
- ❌ Bun compile

**Root Cause:** Axios uses conditional `require()` that breaks all bundlers

**Solution:** Replace axios with native fetch/https (see `STANDALONE_BINARY_TODO.md`)

**Timeline:** 1-2 days of focused work

## Recent Fixes (2026-01-21)

1. ✅ Logo overlay fixed - Now subtle background watermark
2. ✅ Theme-based logo visibility - Shows correct logo per theme
3. ✅ Node.js detection improved - Checks `/opt/homebrew/bin` etc.
4. ✅ Changelog loading in Tauri - Multiple path fallbacks
5. ✅ Upgraded to @yao-pkg/pkg 6.12.0 (Node 20 support)
6. ✅ Cleaned up build scripts

## Build Commands

### Development
```bash
npm run tauri:dev              # Tauri with hot reload
npm run dev:webview            # Webview only (browser)
```

### Production
```bash
npm run tauri:build            # Full Tauri build
npm run compile                # VS Code extension build
```

### Testing
```bash
npm test                       # Run unit tests
npm run test:coverage          # With coverage
```

## Next Steps

1. **Fix changelog visibility** (if still issues in prod)
2. **Replace axios** for standalone binary support
3. **Merge CLI into sidecar** for unified binary
4. **Add distributed testing docs**

## Support

- Main docs: `README.md`
- Architecture: `AGENTS.md`
- Tauri bundling: `TAURI_BUNDLING.md`
- Binary plans: `STANDALONE_BINARY_TODO.md`, `CLI_SIDECAR_MERGE.md`
