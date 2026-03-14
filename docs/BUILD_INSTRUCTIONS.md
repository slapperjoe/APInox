## Tauri Production Build

### Current Build Path

APInox is now packaged as a Tauri desktop application with a Rust backend and React webview. There is no separate backend bundle to build or include.

### Production vs Development Builds

**Production Build** (`npm run tauri:build`):
- Builds shared packages
- Builds the webview in production mode
- Compiles the Rust backend with release optimizations
- Produces platform installers/bundles

**Development Build** (`npm run tauri:dev`):
- Starts the Vite dev server for the webview
- Compiles and runs the Tauri app in debug mode
- Supports fast iteration for Rust and frontend changes

### How to Build Correctly

**Use one of these commands:**
```bash
npm run tauri:dev
npm run tauri:build
```

### What `npm run tauri:build` Does

1. Increments the build number
2. Syncs versions across package files
3. Builds reusable packages
4. Builds the webview with Vite
5. Runs the Tauri production build

### Verification

After building, verify that:
- the webview assets were produced under `src-tauri/webview/dist/`
- the Rust build completed successfully
- installers or bundles were created under `src-tauri/target/release/bundle/`

### Next Steps

1. Run `npm run tauri:build` from the project root
2. Install or launch the generated app
3. Open the Debug modal and confirm backend logs look healthy
4. Exercise a WSDL load and request execution path
