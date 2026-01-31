# Diagnostic Commands Implementation

## Overview

Implemented backend support for certificate and proxy diagnostics accessible via the Debug Modal (`Ctrl+Shift+D` → Certificate & Proxy tab).

## Changes Made

### 1. Frontend Command Enum (`shared/src/messages.ts`)

Added new commands to `FrontendCommand` enum:

```typescript
CheckCertificate = 'checkCertificate'
CheckCertificateStore = 'checkCertificateStore'
TestHttpsServer = 'testHttpsServer'
InstallCertificateToLocalMachine = 'installCertificateToLocalMachine'
MoveCertificateToLocalMachine = 'moveCertificateToLocalMachine'
RegenerateCertificate = 'regenerateCertificate'
GetProxyStatus = 'getProxyStatus'
```

### 2. Command Handlers (`sidecar/src/router.ts`)

Implemented handlers for all diagnostic commands:

#### CheckCertificate
- **Purpose**: Check if certificate files exist
- **Returns**: `{ exists: boolean, certPath: string | null, keyPath: string | null, thumbprint: string | null }`
- **Platform Support**: All platforms (thumbprint extraction Windows-only)
- **Location**: Checks `%TEMP%\apinox-proxy.cer` and `apinox-proxy.key`

#### CheckCertificateStore
- **Purpose**: Check where certificate is installed (LocalMachine vs CurrentUser)
- **Returns**: `{ inLocalMachine: boolean, inCurrentUser: boolean, unsupported?: boolean }`
- **Platform Support**: Windows only (uses PowerShell certificate store queries)
- **Requires**: `thumbprint` parameter from CheckCertificate

#### TestHttpsServer
- **Purpose**: Test if Node.js can create HTTPS server with the certificate
- **Returns**: `{ success: boolean, error?: string }`
- **Platform Support**: All platforms
- **Tests**: Creates temporary HTTPS server to validate cert/key pair

#### InstallCertificateToLocalMachine
- **Purpose**: Install certificate to LocalMachine\Root store
- **Returns**: `{ success: boolean, error?: string }`
- **Platform Support**: Windows only (uses PowerShell X509Store)
- **Requires**: Certificate file at `%TEMP%\apinox-proxy.cer`

#### MoveCertificateToLocalMachine
- **Purpose**: Move certificate from CurrentUser\Root to LocalMachine\Root
- **Returns**: `{ success: boolean, error?: string }`
- **Platform Support**: Windows only
- **Requires**: `thumbprint` parameter
- **Process**: Adds to LocalMachine, then removes from CurrentUser

#### RegenerateCertificate
- **Purpose**: Delete and regenerate certificate/key pair
- **Returns**: `{ success: boolean, certPath?: string, keyPath?: string, error?: string }`
- **Platform Support**: All platforms
- **Implementation**:
  - Deletes existing cert/key files
  - Uses node-forge to generate new RSA 2048-bit key pair
  - Creates X.509 certificate with:
    - CN=localhost, O=APInox Proxy
    - Valid for 10 years
    - **Fixed**: `cA: false` (server cert, not CA)
    - Key usage: digitalSignature, keyEncipherment
    - Extended key usage: serverAuth, clientAuth
    - SAN: DNS=localhost, IP=127.0.0.1
  - Self-signs with SHA-256
  - Saves PEM files to temp directory

#### GetProxyStatus
- **Purpose**: Get current proxy status
- **Returns**: `{ running: boolean, config: ProxyConfig }`
- **Platform Support**: All platforms
- **Uses**: ProxyService methods

## Certificate Generation Improvements

The `RegenerateCertificate` command now generates **proper server certificates** with:

1. **cA: false** - Not a Certificate Authority (was `true` before, which was incorrect)
2. **Correct key usage**:
   - digitalSignature
   - keyEncipherment
3. **Extended key usage**:
   - serverAuth (TLS server authentication)
   - clientAuth (TLS client authentication)
4. **Subject Alternative Name (SAN)**:
   - DNS: localhost
   - IP: 127.0.0.1

This should fix the `SEC_E_INVALID_TOKEN` errors that were occurring with the previous certificate.

## Usage Flow

### From DiagnosticsTab UI

1. **User clicks "Run Certificate Check"**
   ```typescript
   const certStatus = await bridge.sendMessageAsync({ command: 'checkCertificate' });
   if (certStatus.exists && certStatus.thumbprint) {
       const storeStatus = await bridge.sendMessageAsync({ 
           command: 'checkCertificateStore', 
           thumbprint: certStatus.thumbprint 
       });
   }
   const httpsTest = await bridge.sendMessageAsync({ command: 'testHttpsServer' });
   ```

2. **User clicks "Install Certificate"**
   ```typescript
   const result = await bridge.sendMessageAsync({ command: 'installCertificateToLocalMachine' });
   ```

3. **User clicks "Fix Certificate Location"**
   ```typescript
   const result = await bridge.sendMessageAsync({ 
       command: 'moveCertificateToLocalMachine', 
       thumbprint: certStatus.thumbprint 
   });
   ```

4. **User clicks "Regenerate Certificate"**
   ```typescript
   const result = await bridge.sendMessageAsync({ command: 'regenerateCertificate' });
   ```

5. **User clicks "Run Proxy Check"**
   ```typescript
   const proxyStatus = await bridge.sendMessageAsync({ command: 'getProxyStatus' });
   ```

## Platform-Specific Notes

### Windows
- Full support for all commands
- Uses PowerShell for certificate store operations
- Requires elevated privileges for LocalMachine store operations

### macOS/Linux
- CheckCertificate: ✅ Supported
- CheckCertificateStore: ❌ Not supported (returns `unsupported: true`)
- TestHttpsServer: ✅ Supported
- InstallCertificateToLocalMachine: ❌ Not supported
- MoveCertificateToLocalMachine: ❌ Not supported
- RegenerateCertificate: ✅ Supported
- GetProxyStatus: ✅ Supported

### Future Enhancement
For macOS/Linux, certificate installation would use:
- macOS: `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain`
- Linux: Copy to `/usr/local/share/ca-certificates/` and run `update-ca-certificates`

## Error Handling

All commands return structured responses with `success` boolean and `error` string:

```typescript
// Success
{ success: true }

// Failure
{ success: false, error: "Certificate not found in CurrentUser store" }
```

The DiagnosticsTab UI handles these responses and displays appropriate messages.

## Testing Commands Manually

### Via Tauri Dev Tools (F12)

```javascript
// Check certificate
await window.__TAURI__.invoke('execute_command', {
    command: 'checkCertificate'
});

// Check store
await window.__TAURI__.invoke('execute_command', {
    command: 'checkCertificateStore',
    thumbprint: 'E77F392EAB2E923BB24E8431ADBF09A0F493423F'
});

// Test HTTPS
await window.__TAURI__.invoke('execute_command', {
    command: 'testHttpsServer'
});

// Regenerate
await window.__TAURI__.invoke('execute_command', {
    command: 'regenerateCertificate'
});
```

## Build Requirements

- `sidecar/`: Built with `npm run build` (TypeScript compilation)
- `webview/`: Built with `npm run build` (React + Vite)
- Dependencies: `node-forge` (already in package.json)

## Next Steps

1. **Test the diagnostics flow**:
   - Open Debug Modal (`Ctrl+Shift+D`)
   - Switch to "🔧 Certificate & Proxy" tab
   - Run certificate check
   - Test HTTPS server
   - Try regenerate if issues found

2. **Verify HTTPS proxy works** after regenerating certificate with corrected properties

3. **Add telemetry** (optional) to track which errors are most common

4. **Consider UI improvements**:
   - Auto-run diagnostics on tab open
   - Show progress indicators during long operations
   - Add "Copy diagnostic report" button
