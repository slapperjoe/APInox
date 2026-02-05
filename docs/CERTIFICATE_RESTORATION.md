# Certificate Installation Feature - Restoration Status

## ✅ COMPLETED - Certificate Functionality Restored

The certificate opening functionality has been successfully restored to the Tauri application.

## Changes Made

### 1. Backend Handler (sidecar/src/router.ts)
Added `OpenCertificate` command handler:
```typescript
[FrontendCommand.OpenCertificate]: async () => {
    const certPath = services.proxyService.getCertPath();
    if (!certPath) {
        return { 
            success: false, 
            error: 'No certificate generated yet. Start the proxy with an HTTPS target first.' 
        };
    }
    
    return { 
        success: true, 
        certPath,
        instructions: "To trust this proxy, install the certificate to 'Trusted Root Certification Authorities' (Windows) or your system's trusted certificate store."
    };
},
```

### 2. Frontend Handler (src-tauri/webview/src/components/MainContent.tsx)
Updated `onOpenCertificate` callback to:
- Call the backend command
- Use Tauri's `@tauri-apps/plugin-opener` to open the certificate file
- Display installation instructions to the user

### 3. UI Target URL Fix (useWatcherProxy.ts + MainContent.tsx)
Fixed the "9000 => localhost:8080" display issue:
- Removed hardcoded `localhost:8080` default
- Added `config` parameter to `useWatcherProxy`
- Added `useEffect` to load `lastProxyTarget` from config when available
- Changed default target to empty string (will be populated from config)

## Testing

To test the certificate functionality:

1. Start the application in Tauri mode
2. Go to Server tab
3. Set target URL to an HTTPS endpoint (e.g., `https://localhost:9000`)
4. Click Start
5. The Shield icon should appear
6. Click the Shield icon
7. Certificate file should open in system viewer
8. Alert shows installation instructions

##Summary

**Yes, the certificate functionality still exists!** Here's what happened:
The application is generating self-signed certificates for HTTPS proxy support, but the **GUI handler for opening/installing certificates was removed** during the VS Code → Tauri migration.

## Error Context
```
System.ServiceModel.CommunicationException: 
"An error occurred while making the HTTP request to https://localhost:9000/AgedCare/Organisation. 
This could be due to the fact that the server certificate is not configured properly with HTTP.SYS 
in the HTTPS case. This could also be caused by a mismatch of the security binding between the 
client and the server."
```

This occurs because the self-signed certificate needs to be trusted by the system.

## What's Working

### Certificate Generation (✅ Still Working)
- **Location**: `src/services/ProxyService.ts` lines 230-266
- **Method**: `ensureCert()` and `prepareCert()`
- **Library**: `selfsigned` package (v5.4.0)
- **Certificate Path**: `%TEMP%\apinox-proxy.cer` (Windows) or `/tmp/apinox-proxy.cer` (Unix)
- **Key Path**: `%TEMP%\apinox-proxy.key`
- **Specs**: 
  - 2048-bit RSA key
  - 365-day validity
  - CN=localhost
  - Basic constraints: CA=true

### UI Buttons (✅ Still Present)
- **ProxyUi.tsx** (line 310): Shield icon button visible when HTTPS mode
- **ServerUi.tsx** (line 457): Shield icon button for HTTPS targets
- Both send `openCertificate` message via bridge

## What's Missing

### Backend Handler (❌ Removed in b54da08)
The handler was in `src/controllers/WebviewController.ts` (removed file):

```typescript
case 'openCertificate':
    const certPath = this._proxyService.getCertPath();
    if (certPath) {
        try {
            await vscode.env.openExternal(vscode.Uri.file(certPath));
            vscode.window.showInformationMessage(
                "Certificate opened. To trust this proxy, install it to 'Trusted Root Certification Authorities' in the Windows Certificate Import Wizard."
            );
        } catch (err: any) {
            vscode.window.showErrorMessage('Failed to open certificate: ' + err.message);
        }
    } else {
        vscode.window.showWarningMessage('No certificate generated yet. Start the proxy with an HTTPS target first.');
    }
    break;
```

## Git History

| Commit | Date | Description |
|--------|------|-------------|
| `4d4e06a` | 2025-12-24 | ✅ Added certificate opening functionality to VS Code extension |
| `b54da08` | 2026-01-23 | ❌ VS Code removal - migrated to Tauri, lost certificate handler |

## Current Architecture

### Frontend Flow
1. User clicks Shield icon in ProxyUi/ServerUi
2. `onOpenCertificate()` called → `bridge.sendMessage({ command: 'openCertificate' })`
3. Message sent to backend...
4. **❌ NO HANDLER EXISTS**

### Backend Components
- **Tauri**: `src-tauri/src/lib.rs` - No certificate commands registered
- **Sidecar**: `sidecar/src/router.ts` - Missing `OpenCertificate` handler
- **Message Type**: Already defined in `shared/src/messages.ts` line 54

## Restoration Plan

### Option 1: Sidecar HTTP Endpoint (Recommended)
Add handler to `sidecar/src/router.ts`:
```typescript
[FrontendCommand.OpenCertificate]: async () => {
    const certPath = services.proxyService.getCertPath();
    if (!certPath) {
        return { 
            success: false, 
            error: 'No certificate generated yet. Start proxy with HTTPS target first.' 
        };
    }
    
    // Return cert path - frontend will use Tauri's shell.open()
    return { 
        success: true, 
        certPath,
        instructions: "Install to 'Trusted Root Certification Authorities' in Windows Certificate Import Wizard."
    };
},
```

Frontend update in `src-tauri/webview/src/components/MainContent.tsx`:
```typescript
onOpenCertificate: async () => {
    const result = await bridge.sendMessage({ command: 'openCertificate' });
    if (result.success) {
        // Use Tauri's opener plugin
        await window.__TAURI__.shell.open(result.certPath);
        // Show instructions
        // Could use notification or modal
    } else {
        // Show error
    }
}
```

### Option 2: Native Tauri Command
Add to `src-tauri/src/lib.rs`:
```rust
#[tauri::command]
async fn open_certificate(app: tauri::AppHandle) -> Result<String, String> {
    // Get cert path from sidecar via HTTP
    // Open with system default handler
    // Return instructions
}
```

## Certificate Installation (Manual Workaround)

Until the handler is restored, users can manually install:

### Windows
1. Navigate to `%TEMP%` folder
2. Find `apinox-proxy.cer`
3. Right-click → Install Certificate
4. Select "Local Machine"
5. Place in "Trusted Root Certification Authorities"
6. Finish wizard

### macOS
```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain /tmp/apinox-proxy.cer
```

### Linux
```bash
sudo cp /tmp/apinox-proxy.cer /usr/local/share/ca-certificates/apinox-proxy.crt
sudo update-ca-certificates
```

## Related Files

### Certificate Generation
- `src/services/ProxyService.ts` - Main proxy service with cert generation
- `src/services/MockService.ts` - Mock service (also generates certs)
- `package.json` - `selfsigned@5.4.0` dependency

### UI Components  
- `src-tauri/webview/src/components/sidebar/ProxyUi.tsx` - Shield button
- `src-tauri/webview/src/components/sidebar/ServerUi.tsx` - Shield button
- `src-tauri/webview/src/components/MainContent.tsx` - Bridge setup

### Message Routing
- `shared/src/messages.ts` - `OpenCertificate` enum value
- `sidecar/src/router.ts` - Command routing (missing handler)

### Configuration
- `src/interfaces/IConfigService.ts` - SSL settings interface
- `src/utils/SettingsManager.ts` - Settings with `rejectUnauthorized` flag

## Next Steps

1. Choose implementation approach (Option 1 recommended - simpler)
2. Add handler to sidecar router
3. Update frontend to handle response and open file
4. Test on Windows, macOS, and Linux
5. Add user instructions/documentation
6. Consider auto-install options (Windows only via PowerShell)

## Notes

- The `selfsigned` library is still installed and working
- Certificates are regenerated on each proxy start if missing
- Certificates stored in temp directory (not persistent across reboots)
- Consider moving to persistent location in `~/.apinox/` for better UX
- MockService also has similar cert generation (see lines 190-220)
