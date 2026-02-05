# Sidecar Startup Diagnostics

## Overview
Enhanced logging has been added to help diagnose sidecar startup issues on different machines, especially in production builds.

## Latest Improvements (Production Build Diagnostics)

### Problem Solved
In production builds, sidecar startup failures were silent because:
1. Console output isn't visible
2. The Debug Modal tried to fetch logs from sidecar (which wasn't running)
3. This caused slow timeouts and no useful information

### Solution
1. **File-based Logging**: Tauri/Rust logs are now written to a persistent log file
2. **Startup Error Capture**: All sidecar startup errors are captured and available via Tauri commands
3. **Fallback Log Access**: Debug Modal now reads Tauri logs directly when sidecar isn't running

## Where to Find Logs

### In the Application
1. **Debug Modal** (Ctrl+Shift+D or Cmd+Shift+D)
   - **📋 Copy All Diagnostics button** - Quickly copy all diagnostic info to clipboard for sharing
   - Shows sidecar status (Ready/Not ready)
   - Shows **startup error** if sidecar failed to start
   - Shows **log file path** for manual inspection
   - Shows config directory location
   - Shows sidecar port (if running)
   - Contains troubleshooting tips if not ready
   - Access to logs in real-time (Tauri logs OR sidecar logs)

### In Log Files
- **Tauri logs**: Written by the Rust process to a persistent file
  - Location shown in Debug Modal under "Log File"
  - Windows: `%APPDATA%\com.apinox.app\logs\apinox.log`
  - macOS: `~/Library/Logs/com.apinox.app/apinox.log`
  - Linux: `~/.local/share/com.apinox.app/logs/apinox.log`
  - Max size: 5 MB, rotates automatically
  
- **Sidecar logs**: Captured by the logging system
  - Available via Debug Modal → Sidecar Logs tab
  - Also accessible at `http://127.0.0.1:<port>/logs` when running

## Enhanced Logging Added

### Tauri Side (Rust - `src-tauri/src/lib.rs`)

#### Startup Sequence Logging
```
========== SIDECAR STARTUP ==========
Executable path: <path>
Executable directory: <path>
Preferred config directory: <path>
Current working directory: <path>
Searching for sidecar in N locations
  [Depth 0] Checking: <path>
  ✓ Found sidecar at: <path>
Sidecar script: <path>
Project root: <path>
Config directory: <path>
```

#### Node.js Availability Check
```
Checking for Node.js availability...
Node.js version: v18.x.x
```

Or if Node.js is not available:
```
Failed to execute 'node --version': <error>
Node.js may not be installed or not in PATH
```

#### Process Spawn Logging
```
Building sidecar command...
Applied Windows CREATE_NO_WINDOW flag (Windows only)
Spawning sidecar process...
Sidecar process spawned successfully (PID: 12345)
Starting stdout monitoring thread...
Starting stderr monitoring thread...
========== SIDECAR STARTUP COMPLETE ==========
```

#### Error Cases
```
========== SIDECAR STARTUP FAILED ==========
Error: <detailed error message>
==========================================
```

Possible errors:
- "Node.js not found: <error>. Please ensure Node.js is installed and in your PATH."
- "Sidecar not found. Run 'npm run build:sidecar' first."
- "Failed to spawn sidecar: <error>. Check if Node.js is installed and sidecar is built."

#### Runtime Monitoring
- All sidecar stdout logged as: `[Sidecar] <message>`
- All sidecar stderr logged as: `[Sidecar STDERR] <message>`
- Port detection: `✓ Sidecar port detected: 3000`

### Sidecar Side (Node.js - `sidecar/src/index.ts`)

#### Startup Information
```
[Sidecar] ========== STARTUP ==========
[Sidecar] Node.js version: v18.x.x
[Sidecar] Platform: win32 / darwin / linux
[Sidecar] Architecture: x64 / arm64
[Sidecar] Process ID: 12345
[Sidecar] Current working directory: <path>
[Sidecar] Command-line arguments: [...]
```

#### Configuration Detection
```
[Sidecar] Config dir from CLI arg: <path>
```

Or:
```
[Sidecar] WARNING: No --config-dir argument provided
[Sidecar] Checking environment variable APINOX_CONFIG_DIR...
[Sidecar] Found APINOX_CONFIG_DIR in environment: <path>
```

Or:
```
[Sidecar] ERROR: No config directory specified!
```

#### Service Initialization
```
[Sidecar] Initializing Express application...
[Sidecar] Middleware configured
[Sidecar] Initializing service container...
[Sidecar] Service container initialized successfully
[Sidecar] Creating command router...
[Sidecar] Command router created
```

#### Server Startup
```
[Sidecar] Starting HTTP server...
[Sidecar] Binding to: 127.0.0.1:0 (random port)
[Sidecar] ========================================
[Sidecar] ✓ HTTP SERVER STARTED SUCCESSFULLY
[Sidecar] ========================================
SIDECAR_PORT:3000
[Sidecar] APInox sidecar running on http://127.0.0.1:3000
[Sidecar] Health check: http://127.0.0.1:3000/health
[Sidecar] Debug info: http://127.0.0.1:3000/debug
[Sidecar] Logs: http://127.0.0.1:3000/logs
[Sidecar] ========================================
```

#### Error Cases
```
[Sidecar] FATAL: Failed to initialize services: <error>
[Sidecar] Stack trace: <stack>
```

```
[Sidecar] FATAL: Server error: <error>
[Sidecar] Error code: EADDRINUSE / EACCES / etc.
[Sidecar] Stack trace: <stack>
```

```
[Sidecar] FATAL: Uncaught exception: <error>
[Sidecar] Stack trace: <stack>
```

```
[Sidecar] FATAL: Unhandled promise rejection: <reason>
[Sidecar] Promise: <promise>
[Sidecar] Stack trace: <stack>
```

## New Diagnostic Endpoints

### `/debug` Endpoint
Now returns additional information:
```json
{
  "message": "Sidecar is running",
  "configDir": "C:\\Users\\...\\AppData\\Roaming\\com.apinox.app",
  "nodeVersion": "v18.17.0",
  "platform": "win32",
  "arch": "x64",
  "pid": 12345,
  "uptime": 123.456,
  "memoryUsage": {
    "rss": 50000000,
    "heapTotal": 20000000,
    "heapUsed": 15000000,
    "external": 1000000
  }
}
```

### New Tauri Commands

#### `get_sidecar_diagnostics`
Can be called from frontend:
```typescript
const diagnostics = await invoke('get_sidecar_diagnostics');
```

Returns:
```json
{
  "port": 3000,
  "ready": true,
  "configDir": "C:\\Users\\...\\AppData\\Roaming\\com.apinox.app",
  "processRunning": true,
  "nodeCheck": {
    "available": true,
    "version": "v18.17.0"
  },
  "startupError": null,
  "logFilePath": "C:\\Users\\...\\AppData\\Roaming\\com.apinox.app\\logs\\apinox.log"
}
```

#### `get_tauri_logs` (NEW)
Retrieve Tauri/Rust logs directly:
```typescript
const logs = await invoke<string[]>('get_tauri_logs', { lines: 100 });
```

Returns array of log lines (most recent first). This works even when sidecar fails to start!

## Common Issues and What Logs to Check

### Issue: "Sidecar status: Not ready"

#### 1. Node.js Not Found
**Look for:**
```
Failed to execute 'node --version': program not found
Node.js may not be installed or not in PATH
```

**Solution:** Install Node.js or add it to PATH

#### 2. Sidecar Not Built/Bundled
**Look for:**
```
Sidecar script not found in any search paths!
Searched locations:
  1: <path>/sidecar/dist/sidecar/src/index.js
  2: <path>/sidecar/dist/sidecar/src/index.js
```

**Solution:** 
- Development: Run `npm run build:sidecar`
- Production: Ensure sidecar is bundled (see [TAURI_BUNDLING.md](./TAURI_BUNDLING.md))
- The build process should include `npm run compile && npm run compile-webview && cd sidecar && npm run build`

#### 3. Permission Issues
**Look for:**
```
Failed to create .apinox-config next to exe: Permission denied
Failed to create fallback config dir: Permission denied
```

**Solution:** Run with appropriate permissions or check antivirus/firewall

#### 4. Port Conflicts
**Look for in sidecar logs:**
```
[Sidecar] FATAL: Server error: listen EADDRINUSE
[Sidecar] Error code: EADDRINUSE
```

**Solution:** Another process is using the port (rare, since we use random ports)

#### 5. Module Loading Errors
**Look for in sidecar logs:**
```
[Sidecar] FATAL: Uncaught exception: Cannot find module 'express'
```

**Solution:** Run `npm install` in sidecar directory

#### 6. Sidecar Crashes During Startup
**Look for:**
```
[Sidecar STDERR] <error messages>
Sidecar stdout stream ended (prematurely)
```

**Solution:** Check stderr messages for specific error

## Debug Modal Features

When sidecar is **not ready**, the debug modal shows:

⚠ **Sidecar Not Ready**

Possible causes:
- Node.js not installed or not in PATH
- Sidecar not built (run: npm run build:sidecar)
- Port conflict or firewall blocking localhost
- Permissions issue with config directory

Check logs below for detailed error messages.

## How to Collect Diagnostic Information

### For Bug Reports (Easy Way)

1. Open Debug Modal (Ctrl+Shift+D / Cmd+Shift+D)
2. Click **"Copy All Diagnostics"** button at the top
3. Paste the diagnostic information into your bug report or GitHub issue

The copied information includes:
- System information (config directory, sidecar status, port)
- Sidecar diagnostics (Node.js version, startup errors, log file path)
- Sidecar runtime info (platform, memory usage, uptime)
- Recent logs (last 50 sidecar logs + last 20 frontend logs)

### For Bug Reports (Manual Way)

If the copy button doesn't work:

1. Open Debug Modal (Ctrl+Shift+D / Cmd+Shift+D)
2. Copy **System Information** section
3. Copy **Sidecar Logs** (click "Show Sidecar Logs")
4. Copy **Frontend Logs** (click "Show Frontend Logs")
5. If on Windows, also check Windows Event Viewer for application errors

### Manual Diagnostic Steps

1. **Verify Node.js:**
   ```bash
   node --version
   ```

2. **Check sidecar exists:**
   ```bash
   # From project root
   ls sidecar/dist/sidecar/src/index.js
   ```

3. **Test sidecar manually:**
   ```bash
   cd sidecar
   node dist/sidecar/src/index.js --config-dir C:\Users\YOUR_USER\test-config
   ```
   
   Should output:
   ```
   [Sidecar] ========== STARTUP ==========
   ...
   SIDECAR_PORT:3000
   [Sidecar] ✓ HTTP SERVER STARTED SUCCESSFULLY
   ```

4. **Test health endpoint:**
   ```bash
   curl http://127.0.0.1:3000/health
   ```

5. **Check logs endpoint:**
   ```bash
   curl http://127.0.0.1:3000/logs
   ```

## Production Logging

Logging is now enabled in **both debug and production** builds at the Info level. This helps diagnose issues on user machines without requiring a debug build.

To collect logs from a production installation:
1. Open Debug Modal
2. Export logs using the interface
3. Or access logs at: `http://127.0.0.1:<port>/logs` (if sidecar is running)
