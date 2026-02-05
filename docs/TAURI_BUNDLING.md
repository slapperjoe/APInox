# Tauri Sidecar Bundling - Status

## ❌ NOT WORKING YET - Wrong Build Command Used

Your logs show: `Sidecar script not found!`

Looking for: `C:\Program Files\APInox\sidecar-bundle\bundle.js`  
**File doesn't exist** = bundle not included in installer

## Root Cause

Build was run without the prepare step. 

## Solution

**MUST run:**
```bash
npm run tauri:build
```

**NOT:**
- `tauri build` 
- `npx tauri build`
- VS Code extension

## What's Implemented

✅ esbuild bundling  
✅ Resource configuration  
✅ Smart lookup logic  
❌ **Not yet built correctly**

See BUILD_INSTRUCTIONS.md for details.
