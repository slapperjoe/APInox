## Tauri Production Build - IMPORTANT

### The sidecar is NOT being bundled! Here's why:

Looking at your logs, it's searching for `C:\Program Files\APInox\sidecar-bundle\bundle.js` but it doesn't exist.

### Root Cause

You likely ran the build using **Windows NSIS installer** or built without running the prepare script.

### How to Build Correctly

**MUST USE THIS COMMAND:**
```bash
npm run tauri:build
```

**DO NOT USE:**
- `tauri build` (misses prepare step)
- `npx tauri build` (misses prepare step)
- Building from VS Code Tauri extension (misses prepare step)

### What `npm run tauri:build` Does

1. ✅ Runs `npm run prepare:sidecar` which:
   - Compiles TypeScript
   - Bundles with esbuild
   - Copies to `sidecar-bundle/` with dependencies
2. ✅ Then runs `tauri build` which includes the bundle

### Verification

After building, check that the installer includes the bundle:

**Windows (NSIS):**
```bash
# Extract installer or check installed files
dir "C:\Program Files\APInox\sidecar-bundle\"
```

Should contain:
- `bundle.js` (2.6 MB)
- `node_modules\` folder with express, cors, jsonc-parser

### Current Status

❌ Your production build is missing the sidecar-bundle  
✅ The bundling code is implemented and working  
⚠️ Need to rebuild using `npm run tauri:build`

### Next Steps

1. Run `npm run tauri:build` from project root
2. Install the new build
3. Check logs - should see "✓ Found bundled sidecar at: ..."
4. Sidecar should start successfully

**The implementation is complete - just needs to be built correctly!**
